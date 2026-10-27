// Administración: cuentas y roles, auditoría, indicadores del piloto y tareas periódicas.
import { Router } from 'express';
import { fail, translateDatabaseError } from '../lib/errors.js';
import { audit, notify } from '../lib/records.js';
import { requireRole } from '../lib/auth.js';
import { hashPassword, pseudonymOf, validatePassword } from '../lib/security.js';
import { addDays, localDate } from '../lib/time.js';
import { normalizeEmail } from './identity.js';
import { uuidParam } from '../lib/validate.js';

const STAFF_ROLES = ['trainer', 'nutritionist', 'admin'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const userRow = row => ({ id: row.id, email: row.email.startsWith('eliminado-') ? null : row.email, role: row.role, status: row.status, isFictitious: row.is_fictitious, enrolledAt: row.enrolled_at, createdAt: row.created_at });

/**
 * Tareas periódicas: recordatorios de sesiones pendientes para quienes los activaron.
 * Es idempotente: no repite un recordatorio ya enviado en los últimos 7 días.
 */
export async function runMaintenance(ctx) {
  const { db, config, now } = ctx;
  const stats = { sessionReminders: 0 };
  await db.transaction(async tx => {
    const today = localDate(now(), config.timezone);
    const pending = (await tx.query(
      `SELECT s.user_id, count(*)::int AS missing FROM training_sessions s
         JOIN user_plans p ON p.id = s.plan_id AND p.status = 'vigente'
        WHERE s.completed_at IS NULL AND s.planned_date < $1 AND s.planned_date >= $2
          AND (SELECT granted FROM consents c WHERE c.user_id = s.user_id AND c.purpose = 'recordatorios' ORDER BY c.recorded_at DESC, c.id LIMIT 1) IS TRUE
          AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = s.user_id AND n.type = 'sesiones_pendientes' AND n.created_at > $3)
        GROUP BY s.user_id`, [today, addDays(today, -7), new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000)])).rows;
    for (const row of pending) {
      await notify(tx, now(), row.user_id, 'sesiones_pendientes', `Tienes ${row.missing} ${row.missing === 1 ? 'sesión' : 'sesiones'} de la última semana sin registrar.`);
      stats.sessionReminders += 1;
    }
  });
  return stats;
}

export function adminRouter(ctx) {
  const { db, config, now } = ctx;
  const router = Router();
  const admin = requireRole('admin');

  router.get('/admin/users', admin, async (req, res) => {
    const role = req.query.role;
    const rows = (await db.query(`SELECT * FROM users ${role ? 'WHERE role = $1' : ''} ORDER BY created_at DESC LIMIT 200`, role ? [role] : [])).rows;
    res.json({ users: rows.map(userRow) });
  });

  router.post('/admin/users', admin, async (req, res) => {
    const { password, role } = req.body ?? {};
    const email = normalizeEmail(req.body?.email);
    if (!STAFF_ROLES.includes(role)) fail(400, 'INVALID_ROLE', 'Las cuentas creadas por administración son de preparador, nutricionista o administrador; los participantes se registran solos.');
    const passwordError = validatePassword(password, email);
    if (!EMAIL.test(email) || passwordError) fail(400, 'INVALID_USER', passwordError ?? 'Ingresa un correo válido.');
    const passwordHash = await hashPassword(password);
    const user = await db.transaction(async tx => {
      if ((await tx.query('SELECT 1 FROM users WHERE lower(email) = $1', [email])).rowCount) fail(409, 'EMAIL_IN_USE', 'Ya existe una cuenta con ese correo.');
      const inserted = (await tx.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING *', [email, passwordHash, role])).rows[0];
      await audit(tx, now(), { actor: req.auth, action: 'user.created', entityType: 'user', entityId: inserted.id, detail: { role } });
      return inserted;
    });
    res.status(201).json({ user: userRow(user) });
  });

  router.patch('/admin/users/:id', admin, async (req, res) => {
    const id = uuidParam(req.params.id, 'usuario');
    const { role, status } = req.body ?? {};
    if (role === undefined && status === undefined) fail(400, 'NOTHING_TO_UPDATE', 'Indica el rol o el estado.');
    if (id === req.auth.userId) fail(403, 'FORBIDDEN', 'Nadie puede modificar sus propios privilegios.');
    if (role !== undefined && ![...STAFF_ROLES, 'user'].includes(role)) fail(400, 'INVALID_ROLE', 'Rol inválido.');
    if (status !== undefined && !['active', 'blocked'].includes(status)) fail(400, 'INVALID_STATUS', 'Estado permitido: active o blocked.');
    try {
      const user = await db.transaction(async tx => {
        const current = (await tx.query("SELECT * FROM users WHERE id = $1 AND status <> 'deleted' FOR UPDATE", [id])).rows[0];
        if (!current) fail(404, 'NOT_FOUND', 'El usuario indicado no existe.');
        const changed = (role !== undefined && role !== current.role) || (status !== undefined && status !== current.status);
        if (!changed) return current;
        // Cambiar el rol o bloquear invalida las sesiones: sube la versión y se revocan los refresh tokens.
        const updated = (await tx.query('UPDATE users SET role = $2, status = $3, session_version = session_version + 1, updated_at = $4 WHERE id = $1 RETURNING *', [id, role ?? current.role, status ?? current.status, now()])).rows[0];
        await tx.query('UPDATE auth_sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [id, now()]);
        await audit(tx, now(), { actor: req.auth, action: 'user.updated', entityType: 'user', entityId: id, detail: { role: updated.role, status: updated.status } });
        return updated;
      });
      res.json({ user: userRow(user) });
    } catch (error) {
      if (error.code === '23503') fail(409, 'ROLE_IN_USE', 'No se puede cambiar el rol de una cuenta que ya aprobó contenido del catálogo: crea una cuenta nueva.');
      throw translateDatabaseError(error) ?? error;
    }
  });

  router.get('/admin/audit', admin, async (req, res) => {
    const filters = [];
    const params = [];
    for (const [query, column] of [['entityType', 'entity_type'], ['entityId', 'entity_id'], ['action', 'action'], ['actorId', 'actor_id']]) {
      if (req.query[query]) { params.push(req.query[query]); filters.push(`${column}${query.endsWith('Id') ? '::text' : ''} = $${params.length}`); }
    }
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = (await db.query(`SELECT * FROM audit_log ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ${limit}`, params)).rows;
    res.json({ events: rows.map(row => ({ id: row.id, occurredAt: row.occurred_at, actorId: row.actor_id, actorRole: row.actor_role, action: row.action, entityType: row.entity_type, entityId: row.entity_id, entityVersion: row.entity_version, detail: row.detail })) });
  });

  /** Indicadores medibles desde la API, con numerador y denominador. K6 y K7 se miden fuera (k6 y sondeo externo). */
  router.get('/admin/kpis', admin, async (_req, res) => {
    const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
    const enrolled = (await db.query("SELECT id, enrolled_at FROM users WHERE role = 'user' AND enrolled_at IS NOT NULL AND status = 'active'")).rows;
    const retained = [];
    for (const user of enrolled) {
      const pseudonym = pseudonymOf(config.pseudonymSecret, user.id);
      const from = new Date(new Date(user.enrolled_at).getTime() + 21 * 24 * 60 * 60 * 1000);
      const active = await one("SELECT count(*)::int AS n FROM usage_events WHERE pseudonym = $1 AND occurred_at >= $2 AND event_type IN ('plan_consultado', 'sesion_registrada')", [pseudonym, from]);
      if (active.n > 0) retained.push(user.id);
    }
    const today = localDate(now(), config.timezone);
    const adherence = await one(
      `SELECT count(*)::int AS planned, count(s.completed_at)::int AS completed FROM training_sessions s JOIN users u ON u.id = s.user_id
        WHERE u.enrolled_at IS NOT NULL AND s.planned_date <= $1`, [today]);
    // K5: toda rutina vigente debe componerse de contenido aprobado por el preparador (plantilla, si la hay, y cada ejercicio).
    const visible = await one("SELECT count(*)::int AS total FROM user_plans WHERE status = 'vigente'");
    const approved = await one(
      `SELECT count(*)::int AS ok FROM user_plans p
        WHERE p.status = 'vigente'
          AND (p.template_id IS NULL OR EXISTS (SELECT 1 FROM routine_templates t WHERE t.id = p.template_id AND t.approved_by IS NOT NULL))
          AND NOT EXISTS (SELECT 1 FROM user_plan_exercises pe JOIN exercises e ON e.id = pe.exercise_id WHERE pe.plan_id = p.id AND e.approved_by IS NULL)`);
    const registration = (await db.query(
      `SELECT a.pseudonym, min(a.occurred_at) AS started, max(b.occurred_at) AS completed
         FROM usage_events a JOIN usage_events b ON b.pseudonym = a.pseudonym AND b.event_type = 'registro_completado'
        WHERE a.event_type = 'registro_iniciado' GROUP BY a.pseudonym`)).rows;
    const fast = registration.filter(row => new Date(row.completed) - new Date(row.started) < 5 * 60 * 1000).length;
    const ratio = (numerator, denominator) => ({ numerator, denominator, value: denominator ? numerator / denominator : null });
    res.json({
      generatedAt: now(),
      note: 'Con pocas personas, estas cifras describen solo a la cohorte y no demuestran efectos en salud. Sin participantes inscritos, los indicadores quedan «sin mediciones».',
      kpis: {
        K1: { ...ratio(fast, registration.length), description: 'Registros completados en menos de 5 minutos (tiempo medido; «sin ayuda» se observa en la prueba de usabilidad).' },
        K2: { ...ratio(retained.length, enrolled.length), description: 'Inscritos con actividad en la semana 4.' },
        K3: { ...ratio(adherence.completed, adherence.planned), description: 'Sesiones declaradas realizadas sobre programadas vencidas; una sesión sin registro cuenta como no realizada.' },
        K5: { ...ratio(approved.ok, visible.total), description: 'Rutinas vigentes compuestas solo por contenido aprobado por el preparador físico (plantilla y ejercicios). El objetivo es 100 %.' },
        K6: { measured: 'k6', description: 'Se mide con la prueba de carga (p95 menor a 5 s con 10 clientes virtuales).' },
        K7: { measured: 'sondeo externo', description: 'Se mide con el sondeo de /health cada 5 minutos.' },
      },
    });
  });

  router.post('/admin/maintenance/run', admin, async (_req, res) => {
    res.json({ result: await runMaintenance(ctx) });
  });

  return router;
}
