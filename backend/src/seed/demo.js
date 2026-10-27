// Datos de demostración: cuentas ficticias, catálogo de ejemplo y reglas aprobadas por el preparador de demostración.
// SOLO para desarrollo y presentaciones. El contenido profesional real lo redacta y aprueba el preparador físico del proyecto.
import { hashPassword } from '../lib/security.js';
import { DAY_LABELS, addDays, localDate, nextWeekday } from '../lib/time.js';
import { FOODS, NUTRITION_RULES, REFERENCE_KCAL, normalizedMealPlans } from './nutrition.js';

export const DEMO_PASSWORD = 'FitGoal-Demo-2026!';
export const DEMO_ACCOUNTS = {
  admin: { email: 'admin@fitgoal.demo', role: 'admin' },
  trainer: { email: 'preparador@fitgoal.demo', role: 'trainer' },
  nutritionist: { email: 'nutricionista@fitgoal.demo', role: 'nutritionist' },
  participant: { email: 'participante@fitgoal.demo', role: 'user' },
};
export const mealPlanCode = diet => `pauta-${diet.replaceAll('_', '-')}`;

const NHS_STRENGTH = 'Demostración basada en nombres generales de NHS: https://www.nhs.uk/live-well/exercise/strength-exercises/';
const NHS_FLEX = 'Demostración basada en NHS: https://www.nhs.uk/live-well/exercise/flexibility-exercises/';
const GENERAL = 'Contenido de demostración, pendiente de redacción del preparador físico';

// [código, nombre, descripción, grupo, nivel mínimo, requiere equipo, indicación sugerida, fuente, impacto]
// Grupos: piernas; empuje (pecho, hombros y tríceps); tracción (espalda y bíceps); core; cardio; movilidad.
const EXERCISES = [
  ['sentarse-y-levantarse', 'Sentarse y levantarse', 'Sentarse y levantarse de una silla sin apoyar las manos si es posible.', 'piernas', 'principiante', false, '2 series de 8 repeticiones', NHS_STRENGTH, false],
  ['mini-sentadillas', 'Mini sentadillas', 'Flexión parcial de rodillas y caderas desde una posición de pie.', 'piernas', 'principiante', false, '2 series de 10 repeticiones', NHS_STRENGTH, false],
  ['elevacion-de-talones', 'Elevación de talones', 'Elevar los talones y bajar de forma controlada, de pie y con apoyo si lo necesitas.', 'piernas', 'principiante', false, '2 series de 12 repeticiones', NHS_STRENGTH, false],
  ['elevacion-lateral-de-pierna', 'Elevación lateral de pierna', 'Llevar una pierna hacia un lado estando de pie, con apoyo.', 'piernas', 'principiante', false, '2 series de 10 repeticiones por lado', NHS_STRENGTH, false],
  ['extension-de-pierna-de-pie', 'Extensión de pierna de pie', 'Llevar una pierna hacia atrás desde una posición de pie, con apoyo.', 'piernas', 'principiante', false, '2 series de 10 repeticiones por lado', NHS_STRENGTH, false],
  ['puente-de-gluteos', 'Puente de glúteos', 'Boca arriba con las rodillas flexionadas, elevar la cadera apretando los glúteos y bajar de forma controlada.', 'piernas', 'principiante', false, '2 series de 12 repeticiones', GENERAL, false],
  ['subida-a-escalon', 'Subida a un escalón', 'Subir y bajar un escalón firme, alternando la pierna que inicia; usa la baranda si la necesitas.', 'piernas', 'principiante', false, '2 series de 10 repeticiones por pierna', GENERAL, false],
  ['zancadas-con-apoyo', 'Zancadas con apoyo', 'Paso largo hacia adelante con flexión de ambas rodillas, apoyándote en una pared o silla.', 'piernas', 'con_experiencia', false, '3 series de 8 repeticiones por pierna', GENERAL, false],
  ['sentadilla', 'Sentadilla', 'Bajar la cadera hacia atrás y abajo con la espalda recta y las rodillas en línea con los pies, y volver a subir.', 'piernas', 'con_experiencia', false, '3 series de 12 repeticiones', GENERAL, false],
  ['sentadilla-goblet', 'Sentadilla goblet con mancuerna', 'Sentadilla sosteniendo una mancuerna junto al pecho, con la espalda recta.', 'piernas', 'principiante', true, '3 series de 10 repeticiones', GENERAL, false],
  ['peso-muerto-rumano', 'Peso muerto rumano con mancuernas', 'Con las rodillas levemente flexionadas, llevar la cadera atrás bajando las mancuernas cerca de las piernas, con la espalda recta, y volver.', 'piernas', 'con_experiencia', true, '3 series de 10 repeticiones', GENERAL, false],
  ['flexiones-en-pared', 'Flexiones en pared', 'Empuje del cuerpo con las manos apoyadas en una pared.', 'empuje', 'principiante', false, '2 series de 8 repeticiones', NHS_STRENGTH, false],
  ['flexiones-inclinadas', 'Flexiones inclinadas', 'Flexiones con las manos apoyadas en una mesa o banco firme, con el cuerpo alineado.', 'empuje', 'principiante', false, '2 series de 8 repeticiones', GENERAL, false],
  ['flexiones-con-rodillas-apoyadas', 'Flexiones con rodillas apoyadas', 'Flexiones de brazos en el suelo con las rodillas apoyadas.', 'empuje', 'con_experiencia', false, '3 series de 8 repeticiones', GENERAL, false],
  ['fondos-en-silla', 'Fondos en silla', 'Con las manos en el borde de una silla firme y estable, flexionar y extender los codos.', 'empuje', 'con_experiencia', false, '3 series de 8 repeticiones', GENERAL, false],
  ['press-de-pecho-con-mancuernas', 'Press de pecho con mancuernas', 'Boca arriba en el suelo, empujar las mancuernas hacia arriba desde la altura del pecho y bajarlas controladas.', 'empuje', 'principiante', true, '3 series de 10 repeticiones', GENERAL, false],
  ['elevaciones-laterales', 'Elevaciones laterales con mancuernas', 'Elevar mancuernas livianas hacia los lados hasta la altura de los hombros, con los codos levemente flexionados.', 'empuje', 'principiante', true, '2 series de 12 repeticiones', GENERAL, false],
  ['press-de-hombros-con-mancuernas', 'Press de hombros con mancuernas', 'Elevar mancuernas livianas sobre la cabeza desde la altura de los hombros.', 'empuje', 'con_experiencia', true, '3 series de 8 repeticiones', GENERAL, false],
  ['extension-de-triceps', 'Extensión de tríceps con mancuerna', 'Sostener una mancuerna sobre la cabeza y bajarla detrás de la nuca flexionando los codos, sin mover los brazos.', 'empuje', 'con_experiencia', true, '3 series de 10 repeticiones', GENERAL, false],
  ['superman', 'Superman (extensión de espalda)', 'Boca abajo, elevar brazos y piernas unos centímetros mirando al suelo, y bajar de forma controlada.', 'traccion', 'principiante', false, '2 series de 10 repeticiones', GENERAL, false],
  ['elevacion-de-brazos-en-t', 'Elevación de brazos en T', 'Boca abajo con los brazos abiertos en T, juntar los omóplatos y elevar levemente los brazos.', 'traccion', 'principiante', false, '2 series de 12 repeticiones', GENERAL, false],
  ['remo-isometrico-con-toalla', 'Remo isométrico con toalla', 'Sentado con las piernas estiradas y una toalla bajo los pies, tirar de los extremos hacia el abdomen y sostener.', 'traccion', 'principiante', false, '3 series de 20 segundos', GENERAL, false],
  ['curl-de-biceps-con-mancuernas', 'Curl de bíceps con mancuernas', 'Flexión de los codos usando mancuernas livianas.', 'traccion', 'principiante', true, '2 series de 10 repeticiones', NHS_STRENGTH, false],
  ['remo-con-banda-elastica', 'Remo con banda elástica', 'Sentado con las piernas estiradas y la banda en los pies, tirar hacia el abdomen juntando los omóplatos.', 'traccion', 'principiante', true, '3 series de 12 repeticiones', GENERAL, false],
  ['remo-con-mancuerna', 'Remo con mancuerna', 'Llevar una mancuerna hacia la cadera con el torso inclinado y apoyo de una mano.', 'traccion', 'con_experiencia', true, '3 series de 10 repeticiones', GENERAL, false],
  ['pajaros-con-mancuernas', 'Pájaros con mancuernas', 'Con el torso inclinado hacia adelante, abrir los brazos hacia los lados con mancuernas livianas.', 'traccion', 'con_experiencia', true, '3 series de 12 repeticiones', GENERAL, false],
  ['plancha-sobre-rodillas', 'Plancha sobre rodillas', 'Mantener el cuerpo alineado apoyando antebrazos y rodillas.', 'core', 'principiante', false, '3 series de 20 segundos', GENERAL, false],
  ['elevacion-de-rodillas', 'Elevación de rodillas de pie', 'Subir una rodilla hacia el pecho alternando, de pie.', 'core', 'principiante', false, '2 series de 12 repeticiones', GENERAL, false],
  ['bicho-muerto', 'Bicho muerto', 'Boca arriba, extender un brazo y la pierna contraria sin despegar la zona lumbar del suelo, y alternar.', 'core', 'principiante', false, '2 series de 8 repeticiones por lado', GENERAL, false],
  ['plancha', 'Plancha', 'Mantener el cuerpo alineado apoyando antebrazos y puntas de los pies.', 'core', 'con_experiencia', false, '3 series de 30 segundos', GENERAL, false],
  ['caminata', 'Caminata', 'Desplazamiento a pie a un ritmo cómodo.', 'cardio', 'principiante', false, '10 minutos a ritmo cómodo', GENERAL, false],
  ['marcha-en-el-lugar', 'Marcha en el lugar', 'Alternar pasos sin desplazarse del lugar.', 'cardio', 'principiante', false, '5 minutos a ritmo cómodo', GENERAL, false],
  ['bicicleta-estatica', 'Bicicleta estática', 'Pedalear a un ritmo que permita conversar.', 'cardio', 'principiante', true, '10 minutos a ritmo cómodo', GENERAL, false],
  ['saltos-de-tijera', 'Saltos de tijera', 'Saltar abriendo y cerrando piernas y brazos.', 'cardio', 'con_experiencia', false, '3 series de 30 segundos', GENERAL, true],
  ['trote-suave', 'Trote suave', 'Trote a un ritmo que permita conversar.', 'cardio', 'con_experiencia', false, '10 minutos a ritmo cómodo', GENERAL, true],
  ['rotacion-de-cuello', 'Rotación de cuello', 'Giro del cuello dentro de su movimiento habitual.', 'movilidad', 'principiante', false, '5 repeticiones hacia cada lado', NHS_FLEX, false],
  ['inclinacion-lateral-del-tronco', 'Inclinación lateral del tronco', 'Inclinar el tronco hacia un lado y volver.', 'movilidad', 'principiante', false, '8 repeticiones hacia cada lado', NHS_FLEX, false],
  ['estiramiento-de-gemelos', 'Estiramiento de gemelos', 'Estirar la parte posterior de la pierna apoyando el talón en el suelo.', 'movilidad', 'principiante', false, '2 repeticiones de 30 segundos por pierna', NHS_FLEX, false],
  ['movilidad-de-hombros', 'Movilidad de hombros', 'Círculos suaves con los hombros.', 'movilidad', 'principiante', false, '10 círculos hacia cada lado', GENERAL, false],
];

const OBJECTIVES = { bajar: 'Bajar de peso', mantener: 'Mantener peso', subir: 'Subir de peso' };
const LEVELS = { principiante: 'principiante', con_experiencia: 'con experiencia' };
const EQUIPMENT = { sin_equipo: 'sin equipo', con_equipo: 'con equipo' };
// Categorías de IMC a las que se dirige cada rutina; «general» es la rutina conservadora de bajo impacto para quien no informa su estatura y peso.
const CATEGORIES = { general: 'general, de bajo impacto', bajo_peso: 'IMC bajo peso', normal: 'IMC normal', sobrepeso: 'IMC sobrepeso', obesidad: 'IMC obesidad' };
const CATEGORY_NAMES = { ...CATEGORIES, general: 'general' };

// Divisiones de la semana (ver docs/investigacion_divisiones_de_entrenamiento.md). Cada sesión: [nombre, grupos de sus ejercicios].
const FULL = ['piernas', 'empuje', 'traccion', 'core'];
const SPLITS = {
  full_body: {
    name: 'Full body', minDays: 2, maxDays: 3,
    summary: 'Cuerpo completo en cada sesión, 2 o 3 días por semana.',
    sessions: [['Cuerpo completo A', FULL], ['Cuerpo completo B', FULL], ['Cuerpo completo C', FULL]],
  },
  upper_lower: {
    name: 'Upper/Lower', minDays: 4, maxDays: 4,
    summary: 'Tren superior e inferior en días alternos, 4 días por semana: cada grupo se trabaja dos veces.',
    sessions: [
      ['Tren superior A', ['empuje', 'traccion', 'empuje', 'traccion']],
      ['Tren inferior A', ['piernas', 'piernas', 'piernas', 'core']],
      ['Tren superior B', ['traccion', 'empuje', 'traccion', 'empuje']],
      ['Tren inferior B', ['piernas', 'piernas', 'piernas', 'core']],
    ],
  },
  push_pull_legs: {
    name: 'Push/Pull/Legs', minDays: 3, maxDays: 6,
    summary: 'Empuje, tracción y piernas en días separados: 3 días (una vuelta) o 6 días (dos vueltas) por semana.',
    sessions: [
      ['Empuje: pecho, hombros y tríceps', ['empuje', 'empuje', 'empuje', 'core']],
      ['Tracción: espalda y bíceps', ['traccion', 'traccion', 'traccion', 'core']],
      ['Piernas y zona media', ['piernas', 'piernas', 'piernas', 'core']],
    ],
  },
};
// Lo que cada objetivo agrega a cada sesión: cardio al final para bajar de peso, movilidad al inicio para mantener; para subir, solo fuerza.
const OBJECTIVE_EXTRA = { bajar: { last: 'cardio' }, mantener: { first: 'movilidad' }, subir: {} };

// La regla que elige la división (el «if» aprobado por el preparador): se aplica la primera condición que se cumple.
const SPLIT_RULES = [
  { level: 'principiante', split: 'full_body', reason: 'Si estás empezando, conviene trabajar todo el cuerpo (full body) en cada sesión, 2 o 3 días por semana.' },
  { level: 'con_experiencia', minDays: 6, split: 'push_pull_legs', reason: 'Con 6 días, push/pull/legs trabaja cada grupo muscular dos veces por semana, con descanso entre sesiones del mismo grupo.' },
  { level: 'con_experiencia', minDays: 4, split: 'upper_lower', reason: 'Con 4 o 5 días, upper/lower trabaja cada grupo muscular dos veces por semana en 4 sesiones.' },
  { split: 'full_body', reason: 'Con 3 días o menos, full body trabaja cada grupo muscular en todas tus sesiones.' },
];
const FOCUS_GROUPS = { bajar: ['cardio', 'piernas', 'core'], mantener: ['piernas', 'empuje', 'traccion', 'core', 'movilidad'], subir: ['empuje', 'traccion', 'piernas', 'core'] };
// Reglas de seguridad de demostración: con bajo peso no se recomienda bajar de peso; con obesidad no se recomienda subir de peso;
// con sobrepeso u obesidad no se sugieren ejercicios de alto impacto.
const SAFETY = {
  adjustObjective: { bajo_peso: { bajar: 'subir' }, obesidad: { subir: 'bajar' } },
  avoidHighImpact: ['sobrepeso', 'obesidad'],
  notices: {
    bajo_peso: 'Con bajo peso conviene priorizar la fuerza y una alimentación suficiente. Si tu peso bajó sin buscarlo, consulta a un profesional de la salud.',
    sobrepeso: 'Empieza con ejercicios de bajo impacto y aumenta de a poco, hasta llegar a unos 150 minutos de actividad moderada por semana.',
    obesidad: 'Empieza con bajo impacto (por ejemplo, caminar), progresa de a poco y, si tienes alguna condición de salud, consulta antes a un profesional.',
  },
};
const slug = value => value.replaceAll('_', '-');

export const templateCode = (objective, level, equipment, category, split) => `demo-${objective}-${slug(level)}-${slug(equipment)}-${slug(category)}-${slug(split)}`;

/** ¿Se crea una rutina para esta combinación? Las que las reglas de seguridad reemplazan por otro objetivo no existen. */
const existsFor = (objective, category) => !(SAFETY.adjustObjective[category] && SAFETY.adjustObjective[category][objective]);

/**
 * Arma las sesiones de una división con ejercicios del catálogo aprobado, según nivel y equipo; sin IMC, con sobrepeso u obesidad
 * se evitan los de alto impacto, y con bajo peso se prioriza la fuerza (sin cardio extra), sea cuál sea el objetivo.
 */
function buildSessions(objective, level, equipment, category, split) {
  const categoryIndex = Object.keys(CATEGORIES).indexOf(category);
  const lowImpactOnly = ['general', 'sobrepeso', 'obesidad'].includes(category);
  const usable = EXERCISES.filter(([, , , , minLevel, needsEquipment, , , impact]) =>
    (level === 'con_experiencia' || minLevel === 'principiante') && (equipment === 'con_equipo' || !needsEquipment) && !(lowImpactOnly && impact));
  // Con equipo se prefieren los ejercicios con material, y con experiencia, los de su nivel.
  const preference = item => (equipment === 'con_equipo' && item[5] ? 2 : 0) + (level === 'con_experiencia' && item[4] === 'con_experiencia' ? 1 : 0);
  const extra = OBJECTIVE_EXTRA[category === 'bajo_peso' ? 'subir' : objective];
  return SPLITS[split].sessions.map(([label, groups], sessionIndex) => {
    const slots = [...(extra.first ? [extra.first] : []), ...groups, ...(extra.last ? [extra.last] : [])];
    // Primero los preferidos; dentro de cada nivel de preferencia se rota según la sesión para variar entre sesiones.
    const ordered = group => {
      const tiers = new Map();
      for (const item of usable.filter(candidate => candidate[3] === group)) {
        const score = preference(item);
        if (!tiers.has(score)) tiers.set(score, []);
        tiers.get(score).push(item);
      }
      return [...tiers.keys()].sort((a, b) => b - a).flatMap(score => {
        const tier = tiers.get(score);
        const offset = (sessionIndex + categoryIndex) % tier.length;
        return [...tier.slice(offset), ...tier.slice(0, offset)];
      });
    };
    const chosen = [];
    for (const group of slots) {
      const candidate = ordered(group).find(item => !chosen.includes(item));
      if (candidate) chosen.push(candidate);
    }
    return { label, exercises: chosen.map(item => ({ code: item[0], prescription: item[6] })) };
  });
}

/** Inserta los ejercicios de una plantilla en una sola consulta. */
async function insertTemplateExercises(tx, templateId, sessions, exerciseId) {
  const rows = sessions.flatMap((session, index) => session.exercises.map((item, position) => [index + 1, position + 1, exerciseId.get(item.code), item.prescription]));
  await tx.query(
    `INSERT INTO template_exercises (template_id, session_no, position, exercise_id, prescription)
     SELECT $1, s, p, e, r FROM unnest($2::smallint[], $3::smallint[], $4::uuid[], $5::text[]) AS t(s, p, e, r)`,
    [templateId, rows.map(row => row[0]), rows.map(row => row[1]), rows.map(row => row[2]), rows.map(row => row[3])]);
}

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
    for (const purpose of ['registro_cuenta', 'perfil_entrenamiento', 'datos_corporales', 'datos_nutricionales', 'seguimiento_progreso', 'recordatorios']) {
      await tx.query('INSERT INTO consents (user_id, purpose, policy_version, granted) VALUES ($1, $2, $3, true)', [ids.participant, purpose, config.policyVersion]);
    }
    for (const [code, name, description, group, minLevel, needsEquipment, prescription, source, impact] of EXERCISES) {
      await tx.query(
        `INSERT INTO exercises (code, name, description, muscle_group, min_level, requires_equipment, high_impact, default_prescription, source_note, status, created_by, approved_by, approved_by_role, approved_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved', $10, $10, 'trainer', now())`, [code, name, description, group, minLevel, needsEquipment, impact, prescription, source, ids.trainer]);
    }
    const exerciseId = new Map((await tx.query('SELECT code, id FROM exercises')).rows.map(row => [row.code, row.id]));

    const matrix = {};
    const sessionsByCode = new Map();
    for (const [objective, objectiveLabel] of Object.entries(OBJECTIVES)) {
      for (const level of Object.keys(LEVELS)) {
        for (const equipment of Object.keys(EQUIPMENT)) {
          for (const category of Object.keys(CATEGORIES)) {
            if (!existsFor(objective, category)) continue;
            for (const [split, spec] of Object.entries(SPLITS)) {
              const code = templateCode(objective, level, equipment, category, split);
              ((((matrix[objective] ??= {})[level] ??= {})[equipment] ??= {})[category] ??= {})[split] = code;
              const sessions = buildSessions(objective, level, equipment, category, split);
              sessionsByCode.set(code, sessions);
              const template = (await tx.query(
                `INSERT INTO routine_templates (code, version, name, summary, objective, level, equipment, bmi_category, split, session_labels, min_days, max_days, session_minutes, weeks, author_id)
                 VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 4, $13) RETURNING id`,
                [code, `${spec.name} · ${objectiveLabel} · ${LEVELS[level]} · ${EQUIPMENT[equipment]} · ${CATEGORY_NAMES[category]}`.slice(0, 80),
                  `${spec.summary} Para ${objectiveLabel.toLowerCase()} (${CATEGORIES[category]}).`.slice(0, 200),
                  objective, level, equipment, category, split, sessions.map(session => session.label), spec.minDays, spec.maxDays, level === 'principiante' ? 30 : 45, ids.trainer])).rows[0];
              await insertTemplateExercises(tx, template.id, sessions, exerciseId);
            }
          }
        }
      }
    }
    // Se aprueban al final: una plantilla aprobada ya no admite cambios en sus ejercicios.
    await tx.query("UPDATE routine_templates SET status = 'approved', approved_by = $1, approved_by_role = 'trainer', approved_at = now() WHERE status = 'draft'", [ids.trainer]);
    await tx.query(
      `INSERT INTO rule_versions (domain, version, content, change_note, status, author_id, approved_by, approved_by_role, approved_at)
       VALUES ('entrenamiento', 1, $1, 'Reglas de demostración', 'approved', $2, $2, 'trainer', now())`, [JSON.stringify({ matrix, splitRules: SPLIT_RULES, focusGroups: FOCUS_GROUPS, safety: SAFETY }), ids.trainer]);

    // Contenido en borrador para mostrar la aprobación del preparador: un ejercicio nuevo y una versión 2 de una rutina.
    await tx.query(
      `INSERT INTO exercises (code, name, description, muscle_group, min_level, requires_equipment, default_prescription, source_note, created_by)
       VALUES ('zancada-lateral', 'Zancada lateral', 'Paso largo hacia un lado flexionando la rodilla de ese lado, con apoyo.', 'piernas', 'con_experiencia', false, '3 series de 8 repeticiones por lado', $1, $2)`, [GENERAL, ids.trainer]);
    const draftCode = templateCode('mantener', 'principiante', 'sin_equipo', 'normal', 'full_body');
    const draftSessions = sessionsByCode.get(draftCode);
    const draft = (await tx.query(
      `INSERT INTO routine_templates (code, version, name, summary, objective, level, equipment, bmi_category, split, session_labels, min_days, max_days, session_minutes, weeks, author_id)
       VALUES ($1, 2, $2, $3, 'mantener', 'principiante', 'sin_equipo', 'normal', 'full_body', $4, 2, 3, 30, 6, $5) RETURNING id`,
      [draftCode, 'Full body · Mantener peso · principiante · sin equipo · IMC normal', 'Demostración: versión 2 con seis semanas en lugar de cuatro.', draftSessions.map(session => session.label), ids.trainer])).rows[0];
    await insertTemplateExercises(tx, draft.id, draftSessions, exerciseId);
    await seedNutrition(tx, ids);
  });
  return { seeded: true };
}

/**
 * Historial ficticio de la cuenta participante, solo para presentar la app en el servidor local (las pruebas no lo usan):
 * perfil completo y una rutina full body (lunes, miércoles y viernes) iniciada hace 15 días, con sus sesiones pasadas
 * registradas salvo una de la semana anterior, que cubre el comodín. Así se ven la racha, el horario y el calendario.
 */
export async function seedDemoHistory(db, config, now = new Date()) {
  const participant = (await db.query('SELECT id FROM users WHERE email = $1', [DEMO_ACCOUNTS.participant.email])).rows[0];
  if (!participant || (await db.query('SELECT 1 FROM user_plans WHERE user_id = $1', [participant.id])).rowCount) return { seeded: false };
  const today = localDate(now, config.timezone);
  const startedOn = addDays(today, -15);
  const days = [1, 3, 5];
  await db.transaction(async tx => {
    const profile = (await tx.query(
      `INSERT INTO profile_versions (user_id, version, age, objective, level, days, duration_minutes, equipment, sex_param, weight_kg, height_cm, activity_level, is_fictitious)
       VALUES ($1, 1, 29, 'bajar', 'principiante', $2, 30, 'sin_equipo', 'femenino', 64, 163, 'ligero', true) RETURNING id`, [participant.id, days])).rows[0];
    const template = (await tx.query("SELECT * FROM routine_templates WHERE code = $1 AND status = 'approved'", [templateCode('bajar', 'principiante', 'sin_equipo', 'normal', 'full_body')])).rows[0];
    const rules = (await tx.query("SELECT id FROM rule_versions WHERE domain = 'entrenamiento' AND status = 'approved'")).rows[0];
    const labels = days.map((_, index) => template.session_labels[index % template.session_labels.length]);
    const plan = (await tx.query(
      `INSERT INTO user_plans (user_id, profile_version_id, source, template_id, rule_version_id, name, version, weeks, session_minutes, days, session_labels, started_at)
       VALUES ($1, $2, 'recomendada', $3, $4, $5, 1, $6, $7, $8, $9, $10) RETURNING id`,
      [participant.id, profile.id, template.id, rules.id, template.name, template.weeks, template.session_minutes, days, labels, new Date(`${startedOn}T15:00:00Z`)])).rows[0];
    await tx.query(
      `INSERT INTO user_plan_exercises (plan_id, session_no, position, exercise_id, prescription)
       SELECT $1, session_no, position, exercise_id, prescription FROM template_exercises WHERE template_id = $2 AND session_no <= $3`, [plan.id, template.id, days.length]);
    const sessions = [];
    for (let week = 0; week < template.weeks; week += 1) {
      for (const [index, day] of days.entries()) sessions.push({ index, day, date: addDays(nextWeekday(addDays(startedOn, 1), day), 7 * week) });
    }
    sessions.sort((a, b) => a.date.localeCompare(b.date));
    const past = sessions.filter(session => session.date < today);
    const missed = past.at(-4)?.date; // una sesión de la semana anterior queda sin registrar: la cubre el comodín
    for (const session of sessions) {
      const completedAt = session.date < today && session.date !== missed ? new Date(`${session.date}T22:30:00Z`) : null;
      await tx.query('INSERT INTO training_sessions (user_id, plan_id, session_no, label, planned_date, completed_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [participant.id, plan.id, session.index + 1, `${DAY_LABELS[session.day - 1]} · ${labels[session.index]}`, session.date, completedAt]);
    }
  });
  return { seeded: true };
}

/** Inserta los alimentos de una pauta en una sola consulta. */
async function insertMealPlanItems(tx, templateId, days, foodId) {
  const rows = days.flatMap((day, index) => Object.entries(day).flatMap(([meal, list]) => list.map(([code, grams], position) => [index + 1, meal, position + 1, foodId.get(code), grams])));
  await tx.query(
    `INSERT INTO meal_plan_items (template_id, day_no, meal, position, food_id, grams)
     SELECT $1, d, m, p, f, g FROM unnest($2::smallint[], $3::text[], $4::smallint[], $5::uuid[], $6::numeric[]) AS t(d, m, p, f, g)`,
    [templateId, rows.map(row => row[0]), rows.map(row => row[1]), rows.map(row => row[2]), rows.map(row => row[3]), rows.map(row => row[4])]);
}

/** Contenido nutricional aprobado por la nutricionista de demostración, más un alimento y una pauta en borrador. */
async function seedNutrition(tx, ids) {
  const APPROVED = "'approved', $11, $11, 'nutritionist', now()";
  for (const [code, name, category, kcal, protein, carbs, fat, unitName, unitGrams, source] of FOODS) {
    await tx.query(
      `INSERT INTO foods (code, name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_name, unit_grams, source_note, status, author_id, approved_by, approved_by_role, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${APPROVED})`, [code, name, category, kcal, protein, carbs, fat, unitName, unitGrams, source, ids.nutritionist]);
  }
  await tx.query(
    `INSERT INTO foods (code, name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_name, unit_grams, source_note, author_id)
     VALUES ('mote', 'Mote de trigo cocido', 'cereales', 110, 3.5, 23, 0.6, 'taza', 160, 'Valor referencial pendiente de verificar por la nutricionista.', $1)`, [ids.nutritionist]);
  const foodId = new Map((await tx.query('SELECT code, id FROM foods')).rows.map(row => [row.code, row.id]));
  const plans = normalizedMealPlans(REFERENCE_KCAL);
  for (const [diet, plan] of Object.entries(plans)) {
    const template = (await tx.query(
      `INSERT INTO meal_plan_templates (code, version, name, summary, diet, reference_kcal, author_id) VALUES ($1, 1, $2, $3, $4, $5, $6) RETURNING id`,
      [mealPlanCode(diet), plan.name, plan.summary, diet, REFERENCE_KCAL, ids.nutritionist])).rows[0];
    await insertMealPlanItems(tx, template.id, plan.days, foodId);
  }
  await tx.query("UPDATE meal_plan_templates SET status = 'approved', approved_by = $1, approved_by_role = 'nutritionist', approved_at = now() WHERE status = 'draft'", [ids.nutritionist]);
  await tx.query(
    `INSERT INTO rule_versions (domain, version, content, change_note, status, author_id, approved_by, approved_by_role, approved_at)
     VALUES ('nutricion', 1, $1, 'Reglas nutricionales de demostración', 'approved', $2, $2, 'nutritionist', now())`, [JSON.stringify(NUTRITION_RULES), ids.nutritionist]);

  // Versión 2 en borrador de la mediterránea: el jueves cambia los fideos por mote, un alimento aún sin aprobar.
  const draftDays = plans.mediterranea.days.map((day, index) => (index === 3 ? Object.fromEntries(Object.entries(day).map(([meal, list]) => [meal, list.map(([code, grams]) => [code === 'fideos' ? 'mote' : code, grams])])) : day));
  const draft = (await tx.query(
    `INSERT INTO meal_plan_templates (code, version, name, summary, diet, reference_kcal, author_id) VALUES ($1, 2, $2, $3, 'mediterranea', $4, $5) RETURNING id`,
    [mealPlanCode('mediterranea'), plans.mediterranea.name, 'Versión 2: el jueves, porotos con mote en lugar de porotos con riendas.', REFERENCE_KCAL, ids.nutritionist])).rows[0];
  await insertMealPlanItems(tx, draft.id, draftDays, foodId);
}
