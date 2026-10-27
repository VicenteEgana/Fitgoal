// Seguimiento: horario semanal con días de descanso, registro de sesión realizada, peso con consentimiento, adherencia, racha
// y avisos internos.
import { Router } from 'express';
import { fail } from '../lib/errors.js';
import { hasConsent, usageEvent } from '../lib/records.js';
import { requireRole } from '../lib/auth.js';
import { DAY_LABELS, addDays, isoWeekday, localDate, weekStart } from '../lib/time.js';
import { isIsoDate, uuidParam } from '../lib/validate.js';
import { dayStatuses, planCoverage, streakSummary } from '../lib/streak.js';

const iso = value => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10));
const sessionView = row => ({ id: row.id, planId: row.plan_id, sessionNo: row.session_no, label: row.label, plannedDate: iso(row.planned_date), completed: Boolean(row.completed_at), completedAt: row.completed_at, note: row.note, planStatus: row.plan_status });
/** Semanas que muestra el calendario de progreso: las 4 anteriores y la actual. */
const CALENDAR_WEEKS = 5;

export function progressRouter(ctx) {
  const { db, config, now } = ctx;
  const router = Router();
  const participant = requireRole('user');
  const today = () => localDate(now(), config.timezone);

  /** Rutinas del participante (para saber qué días son de descanso) y sus sesiones hasta una fecha. */
  async function history(tx, userId, until) {
    const plans = (await tx.query('SELECT id, name, weeks, days, session_labels, session_minutes, status, started_at, replaced_at FROM user_plans WHERE user_id = $1 ORDER BY started_at', [userId])).rows;
    const sessions = (await tx.query('SELECT planned_date, completed_at FROM training_sessions WHERE user_id = $1 AND planned_date <= $2', [userId, until])).rows
      .map(row => ({ date: iso(row.planned_date), completed: Boolean(row.completed_at) }));
    return { plans, coverage: planCoverage(plans, config.timezone), sessions };
  }

  /**
   * Horario de una semana (lunes a domingo): cada día trae su sesión con los ejercicios, o es de descanso. Los días de descanso
   * sugieren, como opción, los ejercicios de movilidad del catálogo aprobado.
   */
  router.get('/schedule/me', participant, async (req, res) => {
    const current = today();
    const start = weekStart(isIsoDate(req.query.date) ? req.query.date : current);
    const end = addDays(start, 6);
    const { plans, coverage } = await history(db, req.auth.userId, end);
    const sessions = (await db.query(
      `SELECT s.*, p.status AS plan_status, p.session_minutes, p.session_labels FROM training_sessions s JOIN user_plans p ON p.id = s.plan_id
        WHERE s.user_id = $1 AND s.planned_date BETWEEN $2 AND $3 ORDER BY s.planned_date, s.completed_at NULLS LAST`, [req.auth.userId, start, end])).rows;
    const planIds = [...new Set(sessions.map(row => row.plan_id))];
    const exercises = planIds.length ? (await db.query(
      `SELECT pe.plan_id, pe.session_no, pe.prescription, e.code, e.name, e.description, e.muscle_group, e.requires_equipment
         FROM user_plan_exercises pe JOIN exercises e ON e.id = pe.exercise_id WHERE pe.plan_id = ANY($1) ORDER BY pe.session_no, pe.position`, [planIds])).rows : [];
    const statuses = dayStatuses({ sessions: sessions.map(row => ({ date: iso(row.planned_date), completed: Boolean(row.completed_at) })), plans: coverage, from: start, to: end, today: current });
    const rest = (await db.query("SELECT code, name, description, default_prescription FROM exercises WHERE status = 'approved' AND muscle_group = 'movilidad' ORDER BY name LIMIT 6")).rows;
    const vigente = plans.find(plan => plan.status === 'vigente');
    const vigenteCoverage = vigente ? coverage[plans.indexOf(vigente)] : null;
    const firstDay = coverage.length ? coverage.reduce((min, item) => (item.from < min ? item.from : min), coverage[0].from) : null;
    const lastDay = coverage.length ? coverage.reduce((max, item) => (item.to > max ? item.to : max), coverage[0].to) : null;
    res.json({
      today: current, weekStart: start, weekEnd: end,
      previousWeek: firstDay && firstDay < start ? addDays(start, -7) : null,
      nextWeek: lastDay && lastDay > end ? addDays(start, 7) : null,
      plan: vigente ? { id: vigente.id, name: vigente.name, startsOn: addDays(vigenteCoverage.from, 1), endsOn: vigenteCoverage.to } : null,
      days: statuses.map(({ date, status }) => {
        const row = sessions.find(item => iso(item.planned_date) === date);
        const items = row ? exercises.filter(item => item.plan_id === row.plan_id && item.session_no === row.session_no) : [];
        return {
          date, weekday: isoWeekday(date), dayLabel: DAY_LABELS[isoWeekday(date) - 1], isToday: date === current, status,
          session: row ? {
            id: row.id, sessionNo: row.session_no, name: row.session_labels[row.session_no - 1] ?? row.label, label: row.label, minutes: row.session_minutes,
            completed: Boolean(row.completed_at), completedAt: row.completed_at, note: row.note, planStatus: row.plan_status,
            canRegister: row.plan_status === 'vigente' && !row.completed_at && date <= current,
            groups: [...new Set(items.map(item => item.muscle_group))],
            exercises: items.map(item => ({ code: item.code, name: item.name, description: item.description, muscleGroup: item.muscle_group, requiresEquipment: item.requires_equipment, prescription: item.prescription })),
          } : null,
        };
      }),
      restSuggestions: rest.map(row => ({ code: row.code, name: row.name, description: row.description, prescription: row.default_prescription })),
    });
  });

  /** El peso solo se guarda con consentimiento de seguimiento y datos habilitados (o cuenta ficticia). */
  async function weightAllowed(tx, auth) {
    if (!(config.weightTrackingEnabled || auth.isFictitious)) return { allowed: false, reason: 'El registro de peso aún no está habilitado: requiere nutricionista y habilitación del tratamiento de datos.' };
    if (!(await hasConsent(tx, auth.userId, 'seguimiento_progreso'))) return { allowed: false, reason: 'Para registrar tu peso necesitas dar tu consentimiento de seguimiento.' };
    return { allowed: true };
  }
  const validWeight = value => typeof value === 'number' && value > 0 && value <= 500;

  router.get('/sessions/me', participant, async (req, res) => {
    const from = isIsoDate(req.query.from) ? req.query.from : addDays(today(), -7);
    const to = isIsoDate(req.query.to) ? req.query.to : addDays(today(), 28);
    const rows = (await db.query(
      `SELECT s.*, p.status AS plan_status FROM training_sessions s JOIN user_plans p ON p.id = s.plan_id
        WHERE s.user_id = $1 AND s.planned_date BETWEEN $2 AND $3 ORDER BY s.planned_date`, [req.auth.userId, from, to])).rows;
    res.json({ today: today(), sessions: rows.map(sessionView) });
  });

  router.post('/sessions/:id/complete', participant, async (req, res) => {
    const id = uuidParam(req.params.id, 'sesión');
    const { note, weightKg } = req.body ?? {};
    if (note !== undefined && note !== null && (typeof note !== 'string' || note.length > 200)) fail(400, 'INVALID_NOTE', 'La nota admite hasta 200 caracteres.');
    if (weightKg !== undefined && weightKg !== null && !validWeight(weightKg)) fail(400, 'INVALID_WEIGHT', 'El peso debe ser mayor que 0 y no superar 500 kg.');
    const result = await db.transaction(async tx => {
      const session = (await tx.query(
        `SELECT s.*, p.status AS plan_status FROM training_sessions s JOIN user_plans p ON p.id = s.plan_id WHERE s.id = $1 AND s.user_id = $2 FOR UPDATE OF s`, [id, req.auth.userId])).rows[0];
      if (!session) fail(404, 'NOT_FOUND', 'La sesión indicada no existe.');
      if (session.plan_status !== 'vigente') fail(409, 'PLAN_REPLACED', 'Esa sesión pertenece a un plan que ya fue reemplazado.');
      if (iso(session.planned_date) > today()) fail(400, 'FUTURE_SESSION', 'No puedes registrar una sesión que aún no ocurre.');
      let weightRejected = null;
      if (!session.completed_at) {
        await tx.query('UPDATE training_sessions SET completed_at = $2, note = $3 WHERE id = $1', [id, now(), note?.trim() || null]);
        await usageEvent(tx, config, now(), req.auth.userId, 'sesion_registrada');
      }
      if (weightKg !== undefined && weightKg !== null) {
        const gate = await weightAllowed(tx, req.auth);
        if (!gate.allowed) weightRejected = gate.reason;
        else {
          await tx.query('INSERT INTO weight_records (user_id, recorded_on, weight_kg) VALUES ($1, $2, $3) ON CONFLICT (user_id, recorded_on) DO UPDATE SET weight_kg = EXCLUDED.weight_kg', [req.auth.userId, today(), weightKg]);
          await usageEvent(tx, config, now(), req.auth.userId, 'peso_registrado');
        }
      }
      const updated = (await tx.query('SELECT s.*, p.status AS plan_status FROM training_sessions s JOIN user_plans p ON p.id = s.plan_id WHERE s.id = $1', [id])).rows[0];
      return { session: sessionView(updated), weightRejected };
    });
    res.json(result);
  });

  router.get('/weights/me', participant, async (req, res) => {
    const gate = await weightAllowed(db, req.auth);
    if (!gate.allowed) return res.json({ enabled: false, reason: gate.reason, weights: [] });
    const rows = (await db.query('SELECT recorded_on, weight_kg FROM weight_records WHERE user_id = $1 ORDER BY recorded_on DESC LIMIT 120', [req.auth.userId])).rows;
    res.json({ enabled: true, weights: rows.map(row => ({ recordedOn: iso(row.recorded_on), weightKg: Number(row.weight_kg) })) });
  });

  router.post('/weights/me', participant, async (req, res) => {
    const { weightKg, recordedOn } = req.body ?? {};
    if (!validWeight(weightKg)) fail(400, 'INVALID_WEIGHT', 'El peso debe ser mayor que 0 y no superar 500 kg.');
    const date = recordedOn ?? today();
    if (!isIsoDate(date) || date > today()) fail(400, 'INVALID_DATE', 'La fecha del peso no puede ser futura.');
    await db.transaction(async tx => {
      const gate = await weightAllowed(tx, req.auth);
      if (!gate.allowed) fail(403, 'WEIGHT_NOT_ENABLED', gate.reason);
      await tx.query('INSERT INTO weight_records (user_id, recorded_on, weight_kg) VALUES ($1, $2, $3) ON CONFLICT (user_id, recorded_on) DO UPDATE SET weight_kg = EXCLUDED.weight_kg', [req.auth.userId, date, weightKg]);
      await usageEvent(tx, config, now(), req.auth.userId, 'peso_registrado');
    });
    res.status(201).json({ recordedOn: date, weightKg });
  });

  /**
   * Adherencia = sesiones declaradas realizadas / sesiones programadas ya vencidas. Una sesión sin registro cuenta como no realizada.
   * También entrega la racha (días seguidos cumpliendo el plan, con los descansos incluidos) y el calendario de las últimas semanas.
   */
  router.get('/progress/me', participant, async (req, res) => {
    const current = today();
    const calendarFrom = addDays(weekStart(current), -7 * (CALENDAR_WEEKS - 1));
    const calendarTo = addDays(weekStart(current), 6);
    const { coverage, sessions } = await history(db, req.auth.userId, calendarTo);
    const streak = streakSummary({ sessions: sessions.filter(item => item.date <= current), plans: coverage, today: current });
    const calendar = dayStatuses({ sessions, plans: coverage, from: calendarFrom, to: calendarTo, today: current });
    const rows = (await db.query('SELECT planned_date, completed_at FROM training_sessions WHERE user_id = $1 AND planned_date <= $2 ORDER BY planned_date', [req.auth.userId, current])).rows;
    const weeks = new Map();
    for (const row of rows) {
      const date = iso(row.planned_date);
      const weekStart = addDays(date, -(isoWeekday(date) - 1));
      const week = weeks.get(weekStart) ?? { weekStart, planned: 0, completed: 0 };
      week.planned += 1;
      if (row.completed_at) week.completed += 1;
      weeks.set(weekStart, week);
    }
    const planned = rows.length;
    const completed = rows.filter(row => row.completed_at).length;
    const gate = await weightAllowed(db, req.auth);
    const weights = gate.allowed ? (await db.query('SELECT recorded_on, weight_kg FROM weight_records WHERE user_id = $1 ORDER BY recorded_on', [req.auth.userId])).rows.map(row => ({ recordedOn: iso(row.recorded_on), weightKg: Number(row.weight_kg) })) : [];
    res.json({ today: current, planned, completed, adherence: planned ? completed / planned : null, weeks: [...weeks.values()], streak, calendar, weightsEnabled: gate.allowed, weights });
  });

  router.get('/notifications/me', async (req, res) => {
    const unreadOnly = req.query.unread === '1';
    const rows = (await db.query(
      `SELECT id, type, ref_id, message, created_at, read_at FROM notifications WHERE user_id = $1 ${unreadOnly ? 'AND read_at IS NULL' : ''} ORDER BY created_at DESC, id LIMIT 100`, [req.auth.userId])).rows;
    res.json({ unread: rows.filter(row => !row.read_at).length, notifications: rows.map(row => ({ id: row.id, type: row.type, refId: row.ref_id, message: row.message, createdAt: row.created_at, read: Boolean(row.read_at) })) });
  });

  router.post('/notifications/:id/read', async (req, res) => {
    const id = uuidParam(req.params.id, 'aviso');
    const result = await db.query('UPDATE notifications SET read_at = coalesce(read_at, $3) WHERE id = $1 AND user_id = $2', [id, req.auth.userId, now()]);
    if (!result.rowCount) fail(404, 'NOT_FOUND', 'El aviso indicado no existe.');
    res.status(204).end();
  });

  router.post('/notifications/read-all', async (req, res) => {
    await db.query('UPDATE notifications SET read_at = $2 WHERE user_id = $1 AND read_at IS NULL', [req.auth.userId, now()]);
    res.status(204).end();
  });

  return router;
}
