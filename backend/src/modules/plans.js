// Rutinas del participante: iniciar una rutina recomendada o armar la propia, consultar la vigente y ver el historial.
// Iniciar una rutina es inmediato: lo que la persona recibe viene del catálogo que el preparador ya aprobó.
import { Router } from 'express';
import { fail } from '../lib/errors.js';
import { audit, currentProfile, hasConsent, usageEvent } from '../lib/records.js';
import { requireRole } from '../lib/auth.js';
import { DAY_LABELS, addDays, daysBetween, localDate, nextWeekday } from '../lib/time.js';
import { uuidParam } from '../lib/validate.js';
import { approvedRules } from './recommend.js';

const MAX_EXERCISES_PER_SESSION = 12;

function validateDays(days) {
  if (!Array.isArray(days) || days.length < 1 || days.length > 7 || days.some(day => !Number.isInteger(day) || day < 1 || day > 7) || new Set(days).size !== days.length) {
    fail(400, 'INVALID_DAYS', 'Elige entre 1 y 7 días distintos (1 = lunes, 7 = domingo).');
  }
  return [...days].sort((a, b) => a - b);
}

/** Texto de la indicación de un ejercicio propio, con límites seguros; sin datos usa la indicación del profesional. */
export function prescriptionText({ sets, reps, seconds }, fallback) {
  if (sets === undefined && reps === undefined && seconds === undefined) return fallback;
  if (!Number.isInteger(sets) || sets < 1 || sets > 6) fail(400, 'INVALID_PRESCRIPTION', 'Las series deben ser un número entero entre 1 y 6.');
  if ((reps === undefined) === (seconds === undefined)) fail(400, 'INVALID_PRESCRIPTION', 'Indica las repeticiones o los segundos de cada serie, no ambos.');
  const series = `${sets} ${sets === 1 ? 'serie' : 'series'}`;
  if (reps !== undefined) {
    if (!Number.isInteger(reps) || reps < 1 || reps > 50) fail(400, 'INVALID_PRESCRIPTION', 'Las repeticiones deben ser un número entero entre 1 y 50.');
    return `${series} de ${reps} ${reps === 1 ? 'repetición' : 'repeticiones'}`;
  }
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 600) fail(400, 'INVALID_PRESCRIPTION', 'Los segundos deben ser un número entero entre 5 y 600.');
  return `${series} de ${seconds} segundos`;
}

export function plansRouter(ctx) {
  const { db, config, now } = ctx;
  const router = Router();
  const participant = requireRole('user');

  /**
   * Arma las sesiones de una plantilla para los días elegidos: el día k de la semana usa la sesión k de la plantilla, en ciclo
   * (por ejemplo, push/pull/legs en 6 días repite empuje, tracción y piernas dos veces).
   */
  async function templateSessions(tx, template, days) {
    const rows = (await tx.query(
      `SELECT te.session_no, te.position, te.exercise_id, te.prescription FROM template_exercises te WHERE te.template_id = $1 ORDER BY te.session_no, te.position`, [template.id])).rows;
    const count = template.session_labels.length;
    return {
      labels: days.map((_, index) => template.session_labels[index % count]),
      sessions: days.map((_, index) => rows.filter(row => row.session_no === (index % count) + 1).map(row => ({ exerciseId: row.exercise_id, prescription: row.prescription }))),
    };
  }

  async function customSessions(tx, body, days) {
    const input = body.sessions;
    if (!Array.isArray(input) || input.length !== days.length) fail(400, 'INVALID_SESSIONS', 'Define una sesión con ejercicios por cada día elegido.');
    const ids = new Set();
    for (const session of input) {
      if (!Array.isArray(session?.exercises) || session.exercises.length < 1 || session.exercises.length > MAX_EXERCISES_PER_SESSION) fail(400, 'INVALID_SESSIONS', `Cada sesión necesita entre 1 y ${MAX_EXERCISES_PER_SESSION} ejercicios.`);
      const inSession = new Set();
      for (const item of session.exercises) {
        const id = uuidParam(item?.exerciseId, 'ejercicio');
        if (inSession.has(id)) fail(400, 'DUPLICATE_EXERCISE', 'No repitas el mismo ejercicio dentro de una sesión.');
        inSession.add(id);
        ids.add(id);
      }
    }
    const known = (await tx.query("SELECT id, default_prescription FROM exercises WHERE id = ANY($1) AND status = 'approved'", [[...ids]])).rows;
    const byId = new Map(known.map(row => [row.id, row.default_prescription]));
    if (byId.size !== ids.size) fail(400, 'UNKNOWN_EXERCISE', 'Algún ejercicio no existe o ya no está disponible. Revisa la biblioteca.');
    return {
      labels: input.map((session, index) => sessionLabel(session.label, index)),
      sessions: input.map(session => session.exercises.map(item => ({ exerciseId: item.exerciseId, prescription: prescriptionText(item, byId.get(item.exerciseId)) }))),
    };
  }

  /** Nombre que la persona le dio a una sesión de su rutina propia (por ejemplo, «Piernas»); sin nombre, «Sesión k». */
  function sessionLabel(value, index) {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return `Sesión ${index + 1}`;
    if (typeof value !== 'string' || value.trim().length > 40) fail(400, 'INVALID_SESSIONS', 'El nombre de cada sesión admite hasta 40 caracteres.');
    return value.trim();
  }

  router.post('/plans/start', participant, async (req, res) => {
    const body = req.body ?? {};
    const source = body.source;
    if (!['recomendada', 'propia'].includes(source)) fail(400, 'INVALID_SOURCE', 'El origen debe ser «recomendada» o «propia».');
    const days = validateDays(body.days);
    const result = await db.transaction(async tx => {
      if (!(await hasConsent(tx, req.auth.userId, 'perfil_entrenamiento'))) fail(403, 'CONSENT_REQUIRED', 'Necesitamos tu consentimiento para tratar tu perfil de entrenamiento.');
      const profile = await currentProfile(tx, req.auth.userId);
      if (!profile) fail(409, 'PROFILE_REQUIRED', 'Completa tu perfil antes de iniciar una rutina.');
      const rules = await approvedRules(tx);

      let spec;
      let template = null;
      if (source === 'recomendada') {
        if (!rules) fail(409, 'NO_APPROVED_RULES', 'Aún no hay reglas de recomendación aprobadas por el preparador físico.');
        template = (await tx.query("SELECT * FROM routine_templates WHERE id = $1 AND status = 'approved'", [uuidParam(body.templateId, 'rutina')])).rows[0];
        if (!template) fail(409, 'TEMPLATE_NOT_AVAILABLE', 'Esa rutina ya no está disponible. Elige otra de la lista.');
        if (days.length < template.min_days || days.length > template.max_days) fail(400, 'INVALID_DAYS', `Esta rutina se hace entre ${template.min_days} y ${template.max_days} días por semana.`);
        spec = { name: template.name, weeks: template.weeks, sessionMinutes: template.session_minutes, ...(await templateSessions(tx, template, days)) };
      } else {
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (name.length < 1 || name.length > 80) fail(400, 'INVALID_NAME', 'Ponle un nombre a tu rutina (hasta 80 caracteres).');
        const weeks = body.weeks ?? 4;
        if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) fail(400, 'INVALID_WEEKS', 'Las semanas deben estar entre 1 y 12.');
        spec = { name, weeks, sessionMinutes: profile.duration_minutes, ...(await customSessions(tx, body, days)) };
      }

      const today = localDate(now(), config.timezone);
      const previous = (await tx.query("SELECT id FROM user_plans WHERE user_id = $1 AND status = 'vigente' FOR UPDATE", [req.auth.userId])).rows[0];
      if (previous) {
        await tx.query("UPDATE user_plans SET status = 'reemplazado', replaced_at = $2 WHERE id = $1", [previous.id, now()]);
        await tx.query('DELETE FROM training_sessions WHERE plan_id = $1 AND planned_date >= $2 AND completed_at IS NULL', [previous.id, today]);
      }
      const version = ((await tx.query('SELECT coalesce(max(version), 0) AS v FROM user_plans WHERE user_id = $1', [req.auth.userId])).rows[0].v) + 1;
      const plan = (await tx.query(
        `INSERT INTO user_plans (user_id, profile_version_id, source, template_id, rule_version_id, name, version, weeks, session_minutes, days, session_labels, started_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, version`,
        [req.auth.userId, profile.id, source, template?.id ?? null, rules?.id ?? null, spec.name, version, spec.weeks, spec.sessionMinutes, days, spec.labels, now()])).rows[0];

      for (const [sessionIndex, exercises] of spec.sessions.entries()) {
        for (const [position, exercise] of exercises.entries()) {
          await tx.query('INSERT INTO user_plan_exercises (plan_id, session_no, position, exercise_id, prescription) VALUES ($1, $2, $3, $4, $5)', [plan.id, sessionIndex + 1, position + 1, exercise.exerciseId, exercise.prescription]);
        }
      }
      const start = addDays(today, 1);
      let scheduled = 0;
      for (let week = 0; week < spec.weeks; week += 1) {
        for (const [index, day] of days.entries()) {
          await tx.query('INSERT INTO training_sessions (user_id, plan_id, session_no, label, planned_date) VALUES ($1, $2, $3, $4, $5)',
            [req.auth.userId, plan.id, index + 1, `${DAY_LABELS[day - 1]} · ${spec.labels[index]}`, addDays(nextWeekday(start, day), 7 * week)]);
          scheduled += 1;
        }
      }
      await usageEvent(tx, config, now(), req.auth.userId, 'rutina_iniciada');
      await audit(tx, now(), { actor: req.auth, action: 'plan.started', entityType: 'plan', entityId: plan.id, version: plan.version, detail: { source, template: template ? `${template.code} v${template.version}` : null, sessions: scheduled, replaced: Boolean(previous) } });
      return { id: plan.id, version: plan.version, source, name: spec.name, sessionsScheduled: scheduled, replaced: Boolean(previous) };
    });
    res.status(201).json({ plan: result });
  });

  router.get('/plans/me', participant, async (req, res) => {
    const plan = (await db.query(
      `SELECT p.*, pv.version AS profile_version, t.code AS template_code, t.version AS template_version, t.name AS template_name, t.split AS template_split, r.version AS rules_version
         FROM user_plans p JOIN profile_versions pv ON pv.id = p.profile_version_id
         LEFT JOIN routine_templates t ON t.id = p.template_id LEFT JOIN rule_versions r ON r.id = p.rule_version_id
        WHERE p.user_id = $1 AND p.status = 'vigente'`, [req.auth.userId])).rows[0];
    if (!plan) return res.json({ plan: null });
    const rows = (await db.query(
      `SELECT pe.session_no, pe.position, pe.prescription, e.code, e.name, e.description, e.muscle_group, e.requires_equipment
         FROM user_plan_exercises pe JOIN exercises e ON e.id = pe.exercise_id WHERE pe.plan_id = $1 ORDER BY pe.session_no, pe.position`, [plan.id])).rows;
    const days = plan.days.map(Number);
    const startedOn = localDate(plan.started_at, config.timezone);
    const elapsed = daysBetween(startedOn, localDate(now(), config.timezone));
    await usageEvent(db, config, now(), req.auth.userId, 'plan_consultado');
    const schedule = days.map((day, index) => ({
      day, dayLabel: DAY_LABELS[day - 1], sessionNo: index + 1, label: plan.session_labels[index],
      exercises: rows.filter(row => row.session_no === index + 1).map(row => ({ code: row.code, name: row.name, description: row.description, muscleGroup: row.muscle_group, requiresEquipment: row.requires_equipment, prescription: row.prescription })),
    }));
    res.json({
      plan: {
        id: plan.id, version: plan.version, source: plan.source, name: plan.name, weeks: plan.weeks, sessionMinutes: plan.session_minutes, days, status: plan.status, startedAt: plan.started_at,
        // La rutina empieza al día siguiente de iniciarla y dura `weeks` semanas; los días no elegidos son de descanso.
        startsOn: addDays(startedOn, 1), endsOn: addDays(startedOn, 7 * plan.weeks),
        currentWeek: elapsed < 1 ? 0 : Math.min(plan.weeks + 1, Math.ceil(elapsed / 7)),
        restDays: [1, 2, 3, 4, 5, 6, 7].filter(day => !days.includes(day)),
        profileVersion: plan.profile_version,
        template: plan.template_id ? { code: plan.template_code, version: plan.template_version, name: plan.template_name, split: plan.template_split } : null,
        rulesVersion: plan.rules_version,
        schedule,
        week: DAY_LABELS.map((dayLabel, index) => {
          const session = schedule.find(item => item.day === index + 1);
          return session ? { day: index + 1, dayLabel, type: 'entrenamiento', sessionNo: session.sessionNo, label: session.label } : { day: index + 1, dayLabel, type: 'descanso', sessionNo: null, label: 'Descanso' };
        }),
      },
    });
  });

  router.get('/plans/me/history', participant, async (req, res) => {
    const rows = (await db.query('SELECT id, source, name, version, status, started_at, replaced_at FROM user_plans WHERE user_id = $1 ORDER BY started_at DESC, version DESC', [req.auth.userId])).rows;
    res.json({ plans: rows.map(row => ({ id: row.id, source: row.source, name: row.name, version: row.version, status: row.status, startedAt: row.started_at, replacedAt: row.replaced_at })) });
  });

  return router;
}
