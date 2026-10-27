// Datos de demostración: cuentas ficticias, catálogo de ejemplo y reglas aprobadas por el preparador de demostración.
// SOLO para desarrollo y presentaciones. El contenido profesional real lo redacta y aprueba el preparador físico del proyecto.
import { hashPassword } from '../lib/security.js';

export const DEMO_PASSWORD = 'FitGoal-Demo-2026!';
export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@fitgoal.demo', role: 'admin' },
  trainer: { email: 'preparador@fitgoal.demo', role: 'trainer' },
  participant: { email: 'participante@fitgoal.demo', role: 'user' },
};

const NHS_STRENGTH = 'Ejemplo de demostración basado en nombres generales de NHS: https://www.nhs.uk/live-well/exercise/strength-exercises/';
const NHS_FLEX = 'Ejemplo de demostración basado en NHS: https://www.nhs.uk/live-well/exercise/flexibility-exercises/';
const EXERCISES = [
  ['sentarse-y-levantarse', 'Sentarse y levantarse', 'Movimiento de sentarse y levantarse de una silla como ejemplo general.', false, NHS_STRENGTH],
  ['flexiones-en-pared', 'Flexiones en pared', 'Ejemplo de empuje del cuerpo con las manos apoyadas en una pared.', false, NHS_STRENGTH],
  ['elevacion-de-talones', 'Elevación de talones', 'Ejemplo de elevación de los talones desde una posición de pie.', false, NHS_STRENGTH],
  ['mini-sentadillas', 'Mini sentadillas', 'Ejemplo de flexión parcial de rodillas y caderas desde una posición de pie.', false, NHS_STRENGTH],
  ['elevacion-lateral-de-pierna', 'Elevación lateral de pierna', 'Ejemplo de desplazamiento de una pierna hacia un lado estando de pie.', false, NHS_STRENGTH],
  ['curl-de-biceps-con-mancuernas', 'Curl de bíceps con mancuernas', 'Ejemplo de flexión de los codos usando mancuernas como material de demostración.', true, NHS_STRENGTH],
  ['extension-de-pierna-de-pie', 'Extensión de pierna de pie', 'Ejemplo de llevar una pierna hacia atrás desde una posición de pie.', false, NHS_STRENGTH],
  ['rotacion-de-cuello', 'Rotación de cuello', 'Ejemplo de giro del cuello dentro de su movimiento habitual.', false, NHS_FLEX],
  ['inclinacion-lateral-del-tronco', 'Inclinación lateral del tronco', 'Ejemplo de inclinación del tronco hacia un lado.', false, NHS_FLEX],
  ['estiramiento-de-gemelos', 'Estiramiento de gemelos', 'Ejemplo general de estiramiento de la parte posterior de la pierna.', false, NHS_FLEX],
  ['caminata', 'Caminata', 'Desplazamiento a pie como ejemplo de actividad cotidiana.', false, 'Ejemplo de demostración'],
  ['movilidad-de-hombros', 'Movilidad de hombros', 'Movimientos de los hombros como ejemplo general de movilidad.', false, 'Ejemplo de demostración'],
  ['marcha-en-el-lugar', 'Marcha en el lugar', 'Ejemplo de alternar pasos sin desplazarse del lugar.', false, 'Ejemplo de demostración'],
];

const MAIN = {
  'principiante:sin_equipo': ['sentarse-y-levantarse', 'flexiones-en-pared', 'elevacion-de-talones'],
  'principiante:con_equipo': ['curl-de-biceps-con-mancuernas', 'sentarse-y-levantarse', 'elevacion-de-talones'],
  'con_experiencia:sin_equipo': ['mini-sentadillas', 'elevacion-lateral-de-pierna', 'flexiones-en-pared'],
  'con_experiencia:con_equipo': ['curl-de-biceps-con-mancuernas', 'mini-sentadillas', 'extension-de-pierna-de-pie'],
};
const MOBILITY = ['rotacion-de-cuello', 'inclinacion-lateral-del-tronco', 'estiramiento-de-gemelos'];
const GENTLE = ['caminata', 'movilidad-de-hombros', 'marcha-en-el-lugar'];
const OBJECTIVES = { bajar: 'Bajar de peso', mantener: 'Mantener peso', subir: 'Subir de peso' };
const slug = value => value.replaceAll('_', '-');

export const templateCode = (objective, level, equipment) => `demo-${objective}-${slug(level)}-${slug(equipment)}`;

export async function seedDemo(db, config) {
  const existing = await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [DEMO_ACCOUNTS.admin.email]);
  if (existing.rowCount) return { seeded: false };
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db.transaction(async tx => {
    const ids = {};
    for (const [key, account] of Object.entries(DEMO_ACCOUNTS)) {
      const row = (await tx.query('INSERT INTO users (email, password_hash, role, is_fictitious, enrolled_at) VALUES ($1, $2, $3, $4, $5) RETURNING id', [account.email, passwordHash, account.role, account.role === 'user', account.role === 'user' ? new Date() : null])).rows[0];
      ids[key] = row.id;
    }
    for (const purpose of ['registro_cuenta', 'perfil_entrenamiento', 'seguimiento_progreso', 'recordatorios']) {
      await tx.query('INSERT INTO consents (user_id, purpose, policy_version, granted) VALUES ($1, $2, $3, true)', [ids.participant, purpose, config.policyVersion]);
    }
    for (const [code, name, description, equipment, source] of EXERCISES) {
      await tx.query('INSERT INTO exercises (code, name, description, requires_equipment, source_note, created_by) VALUES ($1, $2, $3, $4, $5, $6)', [code, name, description, equipment, source, ids.trainer]);
    }
    const exerciseId = new Map((await tx.query('SELECT code, id FROM exercises')).rows.map(row => [row.code, row.id]));
    const matrix = {};
    for (const [objective, objectiveLabel] of Object.entries(OBJECTIVES)) {
      matrix[objective] = {};
      for (const [combo, main] of Object.entries(MAIN)) {
        const [level, equipment] = combo.split(':');
        const code = templateCode(objective, level, equipment);
        (matrix[objective][level] ??= {})[equipment] = code;
        const template = (await tx.query(
          `INSERT INTO routine_templates (code, version, name, objective, level, equipment, min_days, max_days, session_minutes, weeks, allowed_adjustments, author_id)
           VALUES ($1, 1, $2, $3, $4, $5, 1, 3, 20, 4, $6, $7) RETURNING id`,
          [code, `[Demo] ${objectiveLabel} · ${level === 'principiante' ? 'principiante' : 'con experiencia'} · ${equipment === 'sin_equipo' ? 'sin equipo' : 'con equipo'}`, objective, level, equipment, JSON.stringify({ exerciseChanges: false }), ids.trainer])).rows[0];
        const sessions = [main, MOBILITY, GENTLE];
        for (const [index, codes] of sessions.entries()) {
          for (const [position, exercise] of codes.entries()) {
            const prescription = index === 0 ? '[Demo] Indicación de ejemplo: 2 series de 8 repeticiones.' : '[Demo] Indicación de ejemplo: 5 minutos a ritmo cómodo.';
            await tx.query('INSERT INTO template_exercises (template_id, session_no, position, exercise_id, prescription) VALUES ($1, $2, $3, $4, $5)', [template.id, index + 1, position + 1, exerciseId.get(exercise), prescription]);
          }
        }
        // Se aprueba al final: una plantilla aprobada ya no admite cambios en sus ejercicios.
        await tx.query("UPDATE routine_templates SET status = 'approved', approved_by = $2, approved_by_role = 'trainer', approved_at = now() WHERE id = $1", [template.id, ids.trainer]);
      }
    }
    await tx.query(
      `INSERT INTO rule_versions (domain, version, content, change_note, status, author_id, approved_by, approved_by_role, approved_at)
       VALUES ('entrenamiento', 1, $1, 'Matriz de demostración', 'approved', $2, $2, 'trainer', now())`, [JSON.stringify({ matrix }), ids.trainer]);
    await tx.query("INSERT INTO case_assignments (participant_id, professional_id, professional_role, assigned_by) VALUES ($1, $2, 'trainer', $3)", [ids.participant, ids.trainer, ids.admin]);
  });
  return { seeded: true };
}
