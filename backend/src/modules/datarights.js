// Derechos sobre datos personales: solicitud con comprobante y plazo, resolución por el administrador y ejecución por tipo.
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { fail } from '../lib/errors.js';
import { audit, consentState, consentTime, notify, notifyAdmins, profileView } from '../lib/records.js';
import { requireRole } from '../lib/auth.js';
import { pseudonymOf } from '../lib/security.js';
import { addBusinessDays, localDate } from '../lib/time.js';
import { uuidParam } from '../lib/validate.js';

export const REQUEST_TYPES = ['acceso', 'rectificacion', 'oposicion', 'bloqueo', 'exportacion', 'eliminacion'];
const OPTIONAL_PURPOSES = ['datos_corporales', 'datos_nutricionales', 'seguimiento_progreso', 'recordatorios', 'evaluacion_piloto'];

const view = row => ({ id: row.id, type: row.request_type, status: row.status, receiptCode: row.receipt_code, receivedAt: row.received_at, dueAt: row.due_at, extensionApplied: row.extension_applied, resolvedAt: row.resolved_at, resolutionNote: row.resolution_note });

/** Plazos del informe (art. 11 de la Ley 21.719): 30 días corridos; 2 días hábiles para el bloqueo. */
export function dueDate(type, received) {
  return type === 'bloqueo' ? addBusinessDays(received, 2) : new Date(received.getTime() + 30 * 24 * 60 * 60 * 1000);
}

/** Reúne los datos del titular para los derechos de acceso y exportación. */
export async function exportUserData(tx, userId) {
  const q = async (sql, params = [userId]) => (await tx.query(sql, params)).rows;
  const [user] = await q('SELECT id, email, role, is_fictitious, enrolled_at, created_at FROM users WHERE id = $1');
  return {
    generatedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, role: user.role, createdAt: user.created_at },
    profiles: (await q('SELECT * FROM profile_versions WHERE user_id = $1 ORDER BY version')).map(profileView),
    consents: Object.values(await consentState(tx, userId)).map(row => ({ purpose: row.purpose, granted: row.granted, policyVersion: row.policy_version, recordedAt: row.recorded_at })),
    plans: await Promise.all((await q('SELECT id, source, name, version, weeks, session_minutes, days, session_labels, status, started_at FROM user_plans WHERE user_id = $1 ORDER BY started_at')).map(async row => ({
      source: row.source, name: row.name, version: row.version, weeks: row.weeks, sessionMinutes: row.session_minutes, days: row.days.map(Number), sessionLabels: row.session_labels,
      status: row.status, startedAt: row.started_at,
      exercises: (await q(
        `SELECT pe.session_no, pe.position, e.name, pe.prescription FROM user_plan_exercises pe JOIN exercises e ON e.id = pe.exercise_id WHERE pe.plan_id = $1 ORDER BY pe.session_no, pe.position`, [row.id]))
        .map(item => ({ sessionNo: item.session_no, position: item.position, exercise: item.name, prescription: item.prescription })),
    }))),
    sessions: (await q('SELECT label, planned_date, completed_at, note FROM training_sessions WHERE user_id = $1 ORDER BY planned_date')).map(row => ({ label: row.label, plannedDate: row.planned_date, completedAt: row.completed_at, note: row.note })),
    mealSwaps: (await q(
      `SELECT t.name AS plan, s.day_no, s.meal, o.name AS replaced, f.name AS food, s.created_at
         FROM meal_plan_swaps s JOIN meal_plan_templates t ON t.id = s.template_id JOIN foods f ON f.id = s.food_id
         JOIN meal_plan_items i ON (i.template_id, i.day_no, i.meal, i.position) = (s.template_id, s.day_no, s.meal, s.position) JOIN foods o ON o.id = i.food_id
        WHERE s.user_id = $1 ORDER BY t.name, s.day_no, s.meal, s.position`))
      .map(row => ({ mealPlan: row.plan, dayNo: row.day_no, meal: row.meal, replaced: row.replaced, food: row.food, createdAt: row.created_at })),
    weights: (await q('SELECT recorded_on, weight_kg FROM weight_records WHERE user_id = $1 ORDER BY recorded_on')).map(row => ({ recordedOn: row.recorded_on, weightKg: Number(row.weight_kg) })),
    notifications: (await q('SELECT type, message, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at')).map(row => ({ type: row.type, message: row.message, createdAt: row.created_at })),
  };
}

/** Eliminación: la cuenta queda como registro mínimo sin datos personales y se borran los datos asociados. */
export async function eraseUser(tx, config, userId, now) {
  await tx.query(
    `UPDATE users SET email = 'eliminado-' || id || '@invalid', password_hash = '$argon2id$eliminado', status = 'deleted', deleted_at = $2,
            is_fictitious = false, enrolled_at = NULL, session_version = session_version + 1, updated_at = $2 WHERE id = $1`, [userId, now]);
  await tx.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
  for (const sql of [
    'DELETE FROM training_sessions WHERE user_id = $1', 'DELETE FROM user_plans WHERE user_id = $1',
    'DELETE FROM profile_versions WHERE user_id = $1', 'DELETE FROM weight_records WHERE user_id = $1',
    'DELETE FROM notifications WHERE user_id = $1', 'DELETE FROM consents WHERE user_id = $1', 'DELETE FROM meal_plan_swaps WHERE user_id = $1',
  ]) await tx.query(sql, [userId]);
  await tx.query('DELETE FROM usage_events WHERE pseudonym = $1', [pseudonymOf(config.pseudonymSecret, userId)]);
}

export function dataRightsRouter(ctx) {
  const { db, config, now } = ctx;
  const router = Router();
  const admin = requireRole('admin');

  router.post('/data-requests', requireRole('user'), async (req, res) => {
    const type = req.body?.type;
    if (!REQUEST_TYPES.includes(type)) fail(400, 'INVALID_REQUEST_TYPE', `Derecho permitido: ${REQUEST_TYPES.join(', ')}.`);
    const outcome = await db.transaction(async tx => {
      const open = (await tx.query("SELECT * FROM data_requests WHERE user_id = $1 AND request_type = $2 AND status IN ('recibida', 'en_curso')", [req.auth.userId, type])).rows[0];
      if (open) return { reused: true, request: open };
      const received = now();
      const code = `DR-${localDate(received, config.timezone).replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const request = (await tx.query(
        'INSERT INTO data_requests (user_id, request_type, receipt_code, received_at, due_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.auth.userId, type, code, received, dueDate(type, received)])).rows[0];
      await notifyAdmins(tx, now(), 'solicitud_derechos', 'Hay una solicitud de derechos sobre datos pendiente de resolver.', request.id);
      await audit(tx, now(), { actor: req.auth, action: 'datarequest.created', entityType: 'data_request', entityId: request.id, detail: { type } });
      return { reused: false, request };
    });
    res.status(outcome.reused ? 200 : 201).json({ request: view(outcome.request) });
  });

  router.get('/data-requests/me', requireRole('user'), async (req, res) => {
    const rows = (await db.query('SELECT * FROM data_requests WHERE user_id = $1 ORDER BY received_at DESC', [req.auth.userId])).rows;
    res.json({ requests: rows.map(view) });
  });

  /** El titular descarga sus datos una vez resuelta su solicitud de acceso o exportación. */
  router.get('/data-requests/:id/export', requireRole('user'), async (req, res) => {
    const id = uuidParam(req.params.id, 'solicitud');
    const request = (await db.query('SELECT * FROM data_requests WHERE id = $1 AND user_id = $2', [id, req.auth.userId])).rows[0];
    if (!request) fail(404, 'NOT_FOUND', 'La solicitud indicada no existe.');
    if (!['acceso', 'exportacion'].includes(request.request_type) || request.status !== 'resuelta') fail(409, 'EXPORT_NOT_READY', 'La exportación está disponible cuando se resuelve una solicitud de acceso o de exportación.');
    res.setHeader('Content-Disposition', `attachment; filename="fitgoal-datos-${request.receipt_code}.json"`);
    res.json(await exportUserData(db, req.auth.userId));
  });

  router.get('/admin/data-requests', admin, async (req, res) => {
    const open = req.query.open !== '0';
    const rows = (await db.query(`SELECT r.*, u.email FROM data_requests r JOIN users u ON u.id = r.user_id ${open ? "WHERE r.status IN ('recibida', 'en_curso')" : ''} ORDER BY r.due_at LIMIT 200`)).rows;
    res.json({ requests: rows.map(row => ({ ...view(row), userId: row.user_id, email: row.email.startsWith('eliminado-') ? null : row.email })) });
  });

  router.post('/admin/data-requests/:id/resolve', admin, async (req, res) => {
    const id = uuidParam(req.params.id, 'solicitud');
    const { outcome, note, extend } = req.body ?? {};
    if (extend !== true && !['resuelta', 'rechazada'].includes(outcome)) fail(400, 'INVALID_OUTCOME', 'Indica «resuelta» o «rechazada», o solicita la prórroga.');
    if (outcome === 'rechazada' && !(typeof note === 'string' && note.trim().length > 0 && note.length <= 500)) fail(400, 'NOTE_REQUIRED', 'Un rechazo necesita su fundamento (hasta 500 caracteres).');
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 500)) fail(400, 'INVALID_NOTE', 'La nota admite hasta 500 caracteres.');
    const result = await db.transaction(async tx => {
      const request = (await tx.query("SELECT * FROM data_requests WHERE id = $1 AND status IN ('recibida', 'en_curso') FOR UPDATE", [id])).rows[0];
      if (!request) fail(404, 'NOT_FOUND', 'No hay una solicitud abierta con ese identificador.');
      if (extend === true) {
        if (request.extension_applied) fail(409, 'EXTENSION_USED', 'La prórroga única ya fue aplicada.');
        if (request.request_type === 'bloqueo') fail(409, 'EXTENSION_NOT_ALLOWED', 'El bloqueo temporal no admite prórroga.');
        const updated = (await tx.query("UPDATE data_requests SET extension_applied = true, status = 'en_curso', due_at = due_at + interval '30 days' WHERE id = $1 RETURNING *", [id])).rows[0];
        await notify(tx, now(), request.user_id, 'solicitud_derechos', 'Aplicamos la prórroga única para responder tu solicitud de datos.', id);
        await audit(tx, now(), { actor: req.auth, action: 'datarequest.extended', entityType: 'data_request', entityId: id });
        return updated;
      }
      let erased = false;
      if (outcome === 'resuelta') {
        const when = now();
        if (request.request_type === 'oposicion') {
          for (const purpose of OPTIONAL_PURPOSES) await tx.query('INSERT INTO consents (user_id, purpose, policy_version, granted, recorded_at) VALUES ($1, $2, $3, false, $4)', [request.user_id, purpose, config.policyVersion, await consentTime(tx, request.user_id, purpose, when)]);
          await tx.query('UPDATE profile_versions SET weight_kg = NULL, height_cm = NULL, sex_param = NULL, activity_level = NULL WHERE user_id = $1', [request.user_id]);
        } else if (request.request_type === 'bloqueo') {
          await tx.query("UPDATE users SET status = 'blocked', session_version = session_version + 1, updated_at = $2 WHERE id = $1", [request.user_id, when]);
          await tx.query('UPDATE auth_sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [request.user_id, when]);
        } else if (request.request_type === 'eliminacion') {
          await eraseUser(tx, config, request.user_id, when);
          erased = true;
        }
      }
      const updated = (await tx.query(
        'UPDATE data_requests SET status = $2, resolved_at = $3, resolved_by = $4, resolution_note = $5 WHERE id = $1 RETURNING *', [id, outcome, now(), req.auth.userId, note?.trim() || null])).rows[0];
      if (!erased) await notify(tx, now(), request.user_id, 'solicitud_derechos', outcome === 'resuelta' ? 'Tu solicitud sobre datos personales fue resuelta.' : 'Tu solicitud sobre datos personales fue respondida con un fundamento.', id);
      await audit(tx, now(), { actor: req.auth, action: outcome === 'resuelta' ? 'datarequest.resolved' : 'datarequest.rejected', entityType: 'data_request', entityId: id, detail: { type: request.request_type } });
      return updated;
    });
    res.json({ request: view(result) });
  });

  return router;
}
