// Recomendación: rutinas prearmadas aprobadas, biblioteca de ejercicios y sugerencias para armar una rutina propia.
// Todo lo que se muestra proviene del catálogo aprobado por el preparador físico; nada se genera sin respaldo profesional.
// Si la persona informó estatura y peso (con su consentimiento), se calcula el IMC y, según su categoría, se aplican las reglas
// de recomendación y de seguridad aprobadas; si no, se ofrecen rutinas generales de bajo impacto. La división de la semana
// (full body, upper/lower o push/pull/legs) la eligen las reglas aprobadas según el nivel y los días disponibles.
import { Router } from 'express';
import { fail } from '../lib/errors.js';
import { currentProfile, hasConsent } from '../lib/records.js';
import { requireRole } from '../lib/auth.js';
import { uuidParam } from '../lib/validate.js';
import { BMI_LABELS, bodyOf } from '../lib/body.js';
import { MUSCLE_GROUPS, SPLITS, TEMPLATE_CATEGORIES, exerciseView, templateView } from './catalog.js';
import { EQUIPMENT, LEVELS, OBJECTIVES } from './profile.js';

const OBJECTIVE_TEXT = { bajar: 'bajar de peso', mantener: 'mantener tu peso', subir: 'subir de peso' };
const LEVEL_TEXT = { principiante: 'principiante', con_experiencia: 'con experiencia' };
const EQUIPMENT_TEXT = { sin_equipo: 'sin equipo', con_equipo: 'con equipo' };
const SPLIT_TEXT = { full_body: 'full body (cuerpo completo)', upper_lower: 'upper/lower (tren superior e inferior)', push_pull_legs: 'push/pull/legs (empuje, tracción y piernas)' };
const GROUP_TEXT = {
  piernas: 'las piernas', empuje: 'el empuje (pecho, hombros y tríceps)', traccion: 'la tracción (espalda y bíceps)',
  core: 'la zona media (core)', cardio: 'el sistema cardiovascular', movilidad: 'la movilidad',
};
const decimal = value => String(value).replace('.', ',');
const BMI_REFERENCE = 'El IMC es solo una referencia: no distingue músculo de grasa ni reemplaza una evaluación profesional.';

/** Reglas de entrenamiento vigentes (aprobadas por el preparador), o null si aún no existen. */
export async function approvedRules(tx) {
  return (await tx.query("SELECT id, version, content FROM rule_versions WHERE domain = 'entrenamiento' AND status = 'approved'")).rows[0] ?? null;
}

/**
 * Elige la división de la semana con las reglas aprobadas: la primera condición que se cumple (nivel y días disponibles) decide,
 * por ejemplo «principiante → full body» o «con experiencia y 6 días → push/pull/legs».
 */
export function splitFor(rules, profile) {
  const days = profile.days.length;
  const rule = (rules.content.splitRules ?? []).find(item => (item.level === undefined || item.level === profile.level)
    && (item.minDays === undefined || days >= item.minDays) && (item.maxDays === undefined || days <= item.maxDays));
  return rule ? { split: rule.split, reason: rule.reason } : null;
}

/**
 * Decide qué se recomienda: toma el IMC del perfil (si lo hay), aplica los ajustes de objetivo de las reglas de seguridad,
 * elige la división según el nivel y los días, y busca en la matriz aprobada la rutina de la combinación
 * objetivo × nivel × equipo × categoría × división. Las rutinas de las otras divisiones de la misma combinación quedan como alternativas.
 */
export function recommendationFor(rules, profile) {
  const safety = rules.content.safety ?? {};
  const category = profile.bmiCategory ?? 'general';
  const objective = safety.adjustObjective?.[category]?.[profile.objective] ?? profile.objective;
  const cell = rules.content.matrix?.[objective]?.[profile.level]?.[profile.equipment]?.[category] ?? {};
  const chosen = splitFor(rules, profile);
  // Si la división elegida no tiene rutina en esta combinación, se usa la primera disponible (sin motivo de división).
  const split = chosen && cell[chosen.split] ? chosen.split : SPLITS.find(item => cell[item]) ?? null;
  const code = split ? cell[split] : null;
  const alternatives = SPLITS.filter(item => item !== split && cell[item]).map(item => cell[item]);
  const notices = [];
  if (objective !== profile.objective) {
    notices.push({ code: 'objective_adjusted', text: `Con tu IMC (${decimal(profile.bmi)}, ${BMI_LABELS[category]}) no recomendamos rutinas para ${OBJECTIVE_TEXT[profile.objective]}: te mostramos rutinas para ${OBJECTIVE_TEXT[objective]}. Consulta a un profesional de la salud.` });
  }
  if (profile.bmiCategory && safety.notices?.[profile.bmiCategory]) notices.push({ code: 'category_guidance', text: safety.notices[profile.bmiCategory] });
  if (profile.bmi !== null) notices.push({ code: 'bmi_reference', text: BMI_REFERENCE });
  else notices.push({ code: 'body_data_missing', text: 'Sin tu estatura y peso te mostramos rutinas generales de bajo impacto. Indícalos en tu perfil (es opcional) para afinar las recomendaciones.' });
  return {
    category, objective, split, splitReason: chosen?.split === split ? chosen.reason : null, code, alternatives, notices,
    avoidHighImpact: Boolean(profile.bmiCategory && safety.avoidHighImpact?.includes(profile.bmiCategory)),
  };
}

const oneOf = (value, allowed, name) => {
  if (value === undefined || value === '') return null;
  if (!allowed.includes(value)) fail(400, 'INVALID_FILTER', `Valor inválido para ${name}. Permitidos: ${allowed.join(', ')}.`);
  return value;
};

export function recommendRouter(ctx) {
  const { db } = ctx;
  const router = Router();
  const participant = requireRole('user');

  /** Perfil de la persona con su IMC, solo si sigue vigente su consentimiento de datos corporales. */
  async function profileFor(tx, userId) {
    const row = await currentProfile(tx, userId);
    if (!row) return null;
    const body = row.weight_kg !== null && (await hasConsent(tx, userId, 'datos_corporales')) ? bodyOf(row) : null;
    return {
      objective: row.objective, level: row.level, equipment: row.equipment, days: row.days.map(Number), durationMinutes: row.duration_minutes,
      weightKg: body ? Number(row.weight_kg) : null, heightCm: body ? Number(row.height_cm) : null, bmi: body?.bmi ?? null, bmiCategory: body?.category ?? null,
    };
  }

  router.get('/routines', participant, async (req, res) => {
    const filters = {
      objective: oneOf(req.query.objective, OBJECTIVES, 'objective'),
      level: oneOf(req.query.level, LEVELS, 'level'),
      equipment: oneOf(req.query.equipment, EQUIPMENT, 'equipment'),
      bmi_category: oneOf(req.query.bmiCategory, TEMPLATE_CATEGORIES, 'bmiCategory'),
      split: oneOf(req.query.split, SPLITS, 'split'),
    };
    const conditions = ["status = 'approved'"];
    const params = [];
    for (const [column, value] of Object.entries(filters)) {
      if (value) { params.push(value); conditions.push(`${column} = $${params.length}`); }
    }
    const templates = (await db.query(`SELECT * FROM routine_templates WHERE ${conditions.join(' AND ')} ORDER BY name`, params)).rows;

    const profile = await profileFor(db, req.auth.userId);
    const rules = await approvedRules(db);
    const decision = profile && rules ? recommendationFor(rules, profile) : null;

    const routines = templates.map(row => {
      const recommended = Boolean(decision) && decision.code === row.code;
      const alternative = Boolean(decision) && decision.alternatives.includes(row.code);
      const reasons = [];
      if (recommended) {
        reasons.push(
          `Coincide con tu objetivo: ${OBJECTIVE_TEXT[decision.objective]}.`,
          `Es para nivel ${LEVEL_TEXT[profile.level]} y ${EQUIPMENT_TEXT[profile.equipment]}.`,
          profile.bmi !== null ? `Pensada para tu IMC (${decimal(profile.bmi)}): ${BMI_LABELS[row.bmi_category]}.` : 'Es una rutina general de bajo impacto; indica tu estatura y peso para afinar.',
        );
        if (decision.splitReason) reasons.push(decision.splitReason);
      } else if (alternative) {
        reasons.push(`Para tu mismo objetivo, nivel, equipo e IMC, organizada en ${SPLIT_TEXT[row.split]}.`);
      }
      const notes = [];
      if (profile && row.min_days > profile.days.length) notes.push(`Se hace al menos ${row.min_days} días por semana y tu perfil tiene ${profile.days.length}; puedes elegir otros días al iniciarla.`);
      if (profile && row.max_days < profile.days.length) notes.push(`Se hace hasta ${row.max_days} días por semana y tu perfil tiene ${profile.days.length}; al iniciarla elige ${row.max_days}.`);
      if (profile && row.session_minutes > profile.durationMinutes) notes.push(`Cada sesión dura ${row.session_minutes} minutos y tu perfil indica ${profile.durationMinutes}.`);
      return { ...templateView(row), sessionsCount: row.session_labels.length, recommended, alternative, reasons, fit: { ok: notes.length === 0, notes } };
    });
    const rank = routine => (routine.recommended ? 0 : routine.alternative ? 1 : decision && routine.objective === decision.objective ? 2 : 3);
    routines.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'es'));
    res.json({
      rulesVersion: rules?.version ?? null,
      profile,
      body: profile?.bmi !== null && profile ? { bmi: profile.bmi, category: profile.bmiCategory, label: BMI_LABELS[profile.bmiCategory] } : null,
      effectiveObjective: decision?.objective ?? null,
      split: decision?.split ?? null,
      splitReason: decision?.splitReason ?? null,
      notices: decision?.notices ?? [],
      routines,
    });
  });

  router.get('/routines/:id', participant, async (req, res) => {
    const template = (await db.query("SELECT * FROM routine_templates WHERE id = $1 AND status = 'approved'", [uuidParam(req.params.id, 'rutina')])).rows[0];
    if (!template) fail(404, 'NOT_FOUND', 'Esa rutina no existe o ya no está disponible.');
    const items = (await db.query(
      `SELECT te.session_no, te.position, te.prescription, e.id, e.code, e.name, e.description, e.muscle_group, e.requires_equipment, e.high_impact, e.default_prescription
         FROM template_exercises te JOIN exercises e ON e.id = te.exercise_id WHERE te.template_id = $1 ORDER BY te.session_no, te.position`, [template.id])).rows;
    // El identificador y la indicación sugerida permiten usar la rutina como base de una rutina propia.
    const sessions = template.session_labels.map((label, index) => ({
      sessionNo: index + 1,
      label,
      exercises: items.filter(item => item.session_no === index + 1).map(item => ({
        id: item.id, code: item.code, name: item.name, description: item.description, muscleGroup: item.muscle_group, requiresEquipment: item.requires_equipment,
        highImpact: item.high_impact, prescription: item.prescription, defaultPrescription: item.default_prescription,
      })),
    }));
    res.json({ routine: { ...templateView(template), sessions } });
  });

  /** Biblioteca: todos los ejercicios aprobados, para explorar o probar libremente (los de alto impacto vienen señalados). */
  router.get('/exercises', participant, async (req, res) => {
    const group = oneOf(req.query.group, MUSCLE_GROUPS, 'group');
    const equipment = oneOf(req.query.equipment, EQUIPMENT, 'equipment');
    const level = oneOf(req.query.level, LEVELS, 'level');
    const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 40) : '';
    const conditions = ["status = 'approved'"];
    const params = [];
    if (group) { params.push(group); conditions.push(`muscle_group = $${params.length}`); }
    if (equipment === 'sin_equipo') conditions.push('requires_equipment = false');
    if (level === 'principiante') conditions.push("min_level = 'principiante'");
    if (req.query.lowImpact === '1') conditions.push('high_impact = false');
    if (search) { params.push(`%${search.replaceAll('%', '').replaceAll('_', '')}%`); conditions.push(`name ILIKE $${params.length}`); }
    const rows = (await db.query(`SELECT * FROM exercises WHERE ${conditions.join(' AND ')} ORDER BY muscle_group, name LIMIT 200`, params)).rows;
    res.json({ groups: MUSCLE_GROUPS, exercises: rows.map(exerciseView) });
  });

  /**
   * Sugerencias para armar una rutina propia: priorizan los grupos que las reglas aprobadas indican para el objetivo y,
   * si el IMC está en una categoría de cuidado (sobrepeso u obesidad), dejan fuera los ejercicios de alto impacto.
   */
  router.get('/exercises/suggestions', participant, async (req, res) => {
    const profile = await profileFor(db, req.auth.userId);
    if (!profile) fail(409, 'PROFILE_REQUIRED', 'Completa tu perfil para recibir sugerencias de ejercicios.');
    const rules = await approvedRules(db);
    if (!rules) fail(409, 'NO_APPROVED_RULES', 'Aún no hay reglas de recomendación aprobadas por el preparador físico.');
    const decision = recommendationFor(rules, profile);
    const group = oneOf(req.query.group, MUSCLE_GROUPS, 'group');
    const focus = rules.content.focusGroups?.[decision.objective] ?? [];
    const conditions = ["status = 'approved'"];
    const params = [];
    if (profile.equipment === 'sin_equipo') conditions.push('requires_equipment = false');
    if (profile.level === 'principiante') conditions.push("min_level = 'principiante'");
    if (decision.avoidHighImpact) conditions.push('high_impact = false');
    if (group) { params.push(group); conditions.push(`muscle_group = $${params.length}`); }
    const rows = (await db.query(`SELECT * FROM exercises WHERE ${conditions.join(' AND ')} ORDER BY name`, params)).rows;
    const priority = row => { const index = focus.indexOf(row.muscle_group); return index === -1 ? focus.length : index; };
    const exercises = rows
      .map(row => ({ row, priority: priority(row) }))
      .sort((a, b) => a.priority - b.priority || a.row.name.localeCompare(b.row.name, 'es'))
      .slice(0, 80)
      .map(({ row, priority: rank }) => ({
        ...exerciseView(row),
        suggested: rank < focus.length,
        reason: rank < focus.length ? `Sugerido para ${OBJECTIVE_TEXT[decision.objective]}: trabaja ${GROUP_TEXT[row.muscle_group]}.` : 'Disponible para tu nivel y equipo.',
      }));
    res.json({ rulesVersion: rules.version, objective: decision.objective, focus, lowImpactOnly: decision.avoidHighImpact, notices: decision.notices, exercises });
  });

  return router;
}
