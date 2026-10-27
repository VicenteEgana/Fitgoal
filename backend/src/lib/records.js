import { pseudonymOf } from './security.js';
import { bodyOf } from './body.js';

/** Registra un evento en la bitácora de solo anexado. No incluir tokens ni contenido sensible en `detail`. */
export async function audit(tx, at, { actor = null, action, entityType, entityId = null, version = null, detail = {} }) {
  await tx.query(
    'INSERT INTO audit_log (occurred_at, actor_id, actor_role, action, entity_type, entity_id, entity_version, detail) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [at, actor?.userId ?? null, actor?.role ?? null, action, entityType, entityId, version, JSON.stringify(detail)],
  );
}

/** Crea un aviso interno. El mensaje no debe contener datos de salud. */
export async function notify(tx, at, userId, type, message, refId = null) {
  await tx.query('INSERT INTO notifications (user_id, type, ref_id, message, created_at) VALUES ($1, $2, $3, $4, $5)', [userId, type, refId, message, at]);
}

/** Avisa a todos los administradores activos. */
export async function notifyAdmins(tx, at, type, message, refId = null) {
  const admins = await tx.query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'");
  for (const admin of admins.rows) await notify(tx, at, admin.id, type, message, refId);
}

/** Evento de uso seudonimizado: el seudónimo es un HMAC del identificador, sin clave foránea hacia la cuenta. */
export async function usageEvent(tx, config, at, identifier, eventType) {
  await tx.query('INSERT INTO usage_events (pseudonym, event_type, occurred_at) VALUES ($1, $2, $3)', [pseudonymOf(config.pseudonymSecret, identifier), eventType, at]);
}

/** Último consentimiento otorgado o revocado por finalidad. */
export async function consentState(tx, userId) {
  const result = await tx.query(
    `SELECT DISTINCT ON (purpose) purpose, granted, policy_version, recorded_at
       FROM consents WHERE user_id = $1 ORDER BY purpose, recorded_at DESC, id`,
    [userId],
  );
  return Object.fromEntries(result.rows.map(row => [row.purpose, row]));
}

/** Instante estrictamente posterior al último registro de la finalidad: así el estado vigente nunca queda ambiguo. */
export async function consentTime(tx, userId, purpose, now) {
  const last = (await tx.query('SELECT max(recorded_at) AS at FROM consents WHERE user_id = $1 AND purpose = $2', [userId, purpose])).rows[0].at;
  return last && new Date(last) >= now ? new Date(new Date(last).getTime() + 1) : now;
}

export async function hasConsent(tx, userId, purpose) {
  return Boolean((await consentState(tx, userId))[purpose]?.granted);
}

export async function currentProfile(tx, userId) {
  const result = await tx.query('SELECT * FROM profile_versions WHERE user_id = $1 ORDER BY version DESC LIMIT 1', [userId]);
  return result.rows[0] ?? null;
}

export function profileView(row) {
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    age: row.age,
    objective: row.objective,
    level: row.level,
    days: row.days.map(Number),
    durationMinutes: row.duration_minutes,
    equipment: row.equipment,
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
    bmi: bodyOf(row)?.bmi ?? null,
    bmiCategory: bodyOf(row)?.category ?? null,
    sexParam: row.sex_param,
    activityLevel: row.activity_level,
    isFictitious: row.is_fictitious,
    createdAt: row.created_at,
  };
}
