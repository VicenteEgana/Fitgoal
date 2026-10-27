// Catálogo profesional: ejercicios, rutinas prearmadas (plantillas) y reglas de recomendación.
// El preparador físico define y aprueba cada elemento una sola vez, con versión; las personas solo ven lo aprobado.
import { Router } from 'express';
import { fail } from '../lib/errors.js';
import { audit } from '../lib/records.js';
import { requireRole } from '../lib/auth.js';
import { uuidParam } from '../lib/validate.js';
import { BMI_CATEGORIES } from '../lib/body.js';
import { DURATIONS, EQUIPMENT, LEVELS, OBJECTIVES } from './profile.js';
import { ACTIVITY_LEVELS } from '../lib/energy.js';

export const MUSCLE_GROUPS = ['piernas', 'empuje', 'traccion', 'core', 'cardio', 'movilidad'];
/** Divisiones de la semana: cuerpo completo, tren superior e inferior, o empuje, tracción y piernas. */
export const SPLITS = ['full_body', 'upper_lower', 'push_pull_legs'];
/** «general» es la rutina conservadora de bajo impacto para quien no informa su estatura y peso. */
export const TEMPLATE_CATEGORIES = ['general', ...BMI_CATEGORIES];
const SLUG = /^[a-z0-9-]+$/;
const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const RULE_ROLE = { entrenamiento: 'trainer', nutricion: 'nutritionist' };

export const exerciseView = row => ({
  id: row.id, code: row.code, name: row.name, description: row.description, muscleGroup: row.muscle_group, minLevel: row.min_level,
  requiresEquipment: row.requires_equipment, highImpact: row.high_impact, defaultPrescription: row.default_prescription, sourceNote: row.source_note, status: row.status,
});
export const templateView = row => ({
  id: row.id, code: row.code, version: row.version, name: row.name, summary: row.summary, objective: row.objective, level: row.level, equipment: row.equipment,
  bmiCategory: row.bmi_category, split: row.split, sessionLabels: row.session_labels, minDays: row.min_days, maxDays: row.max_days, sessionMinutes: row.session_minutes, weeks: row.weeks,
  status: row.status, approvedAt: row.approved_at,
});

function validateExercise(body) {
  const { code, name, description, muscleGroup, minLevel = 'principiante', requiresEquipment = false, highImpact = false, defaultPrescription, sourceNote = null } = body ?? {};
  if (!SLUG.test(code ?? '') || !text(name, 1, 80) || !text(description, 1, 600)) fail(400, 'INVALID_EXERCISE', 'Indica código (minúsculas, números y guiones), nombre (hasta 80) y descripción (hasta 600).');
  if (!MUSCLE_GROUPS.includes(muscleGroup)) fail(400, 'INVALID_MUSCLE_GROUP', `Grupo permitido: ${MUSCLE_GROUPS.join(', ')}.`);
  if (!LEVELS.includes(minLevel)) fail(400, 'INVALID_LEVEL', 'Nivel mínimo permitido: principiante o con_experiencia.');
  if (typeof requiresEquipment !== 'boolean' || typeof highImpact !== 'boolean') fail(400, 'INVALID_EXERCISE', 'Los indicadores de equipo y de alto impacto deben ser verdadero o falso.');
  if (!text(defaultPrescription, 1, 200)) fail(400, 'INVALID_PRESCRIPTION', 'La indicación sugerida debe tener entre 1 y 200 caracteres.');
  return { code, name: name.trim(), description: description.trim(), muscleGroup, minLevel, requiresEquipment, highImpact, defaultPrescription: defaultPrescription.trim(), sourceNote };
}

function validateTemplate(body) {
  if (!body || typeof body !== 'object') fail(400, 'INVALID_TEMPLATE', 'Envía una plantilla válida.');
  if (!SLUG.test(body.code ?? '')) fail(400, 'INVALID_CODE', 'El código solo admite minúsculas, números y guiones.');
  if (!text(body.name, 1, 80)) fail(400, 'INVALID_NAME', 'El nombre debe tener entre 1 y 80 caracteres.');
  if (!text(body.summary, 1, 200)) fail(400, 'INVALID_SUMMARY', 'El resumen debe tener entre 1 y 200 caracteres.');
  if (!OBJECTIVES.includes(body.objective)) fail(400, 'INVALID_OBJECTIVE', 'Objetivo inválido.');
  if (!LEVELS.includes(body.level)) fail(400, 'INVALID_LEVEL', 'Nivel inválido.');
  if (!EQUIPMENT.includes(body.equipment)) fail(400, 'INVALID_EQUIPMENT', 'Equipo inválido.');
  if (!TEMPLATE_CATEGORIES.includes(body.bmiCategory)) fail(400, 'INVALID_BMI_CATEGORY', `Categoría de IMC permitida: ${TEMPLATE_CATEGORIES.join(', ')}.`);
  if (!SPLITS.includes(body.split)) fail(400, 'INVALID_SPLIT', `División permitida: ${SPLITS.join(', ')}.`);
  const { minDays, maxDays } = body;
  if (!Number.isInteger(minDays) || !Number.isInteger(maxDays) || minDays < 1 || maxDays > 7 || minDays > maxDays) fail(400, 'INVALID_DAYS', 'Los días por semana deben cumplir 1 ≤ mínimo ≤ máximo ≤ 7.');
  if (!DURATIONS.includes(body.sessionMinutes)) fail(400, 'INVALID_DURATION', 'Duración permitida: 20, 30, 45 o 60 minutos.');
  const weeks = body.weeks ?? 4;
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) fail(400, 'INVALID_WEEKS', 'Las semanas de la rutina deben estar entre 1 y 12.');
  const sessions = body.sessions;
  if (!Array.isArray(sessions) || sessions.length < 1 || sessions.length > 7) fail(400, 'INVALID_SESSIONS', 'Define entre 1 y 7 sesiones.');
  const numbers = new Set();
  for (const session of sessions) {
    if (!Number.isInteger(session.sessionNo) || session.sessionNo < 1 || session.sessionNo > sessions.length || numbers.has(session.sessionNo)) fail(400, 'INVALID_SESSIONS', `Numera las sesiones de 1 a ${sessions.length}, sin repetir.`);
    numbers.add(session.sessionNo);
    if (!text(session.label, 1, 40)) fail(400, 'INVALID_SESSIONS', 'Cada sesión necesita un nombre de hasta 40 caracteres (por ejemplo, «Tren superior A»).');
    if (!Array.isArray(session.exercises) || session.exercises.length < 1 || session.exercises.length > 20) fail(400, 'INVALID_SESSIONS', 'Cada sesión debe tener entre 1 y 20 ejercicios.');
    for (const exercise of session.exercises) {
      if (!SLUG.test(exercise.code ?? '')) fail(400, 'INVALID_EXERCISE', 'Cada ejercicio se indica con el código del catálogo.');
      if (!text(exercise.prescription, 1, 200)) fail(400, 'INVALID_PRESCRIPTION', 'La indicación del ejercicio debe tener entre 1 y 200 caracteres y la define el preparador.');
    }
  }
  const sessionLabels = [...sessions].sort((a, b) => a.sessionNo - b.sessionNo).map(session => session.label.trim());
  return { ...body, weeks, sessionLabels };
}

/**
 * Reglas de entrenamiento:
 *  - matrix[objetivo][nivel][equipo][categoría de IMC][división] = código de la rutina («general» si no informa estatura y peso);
 *  - splitRules (opcional) = lista ordenada de condiciones { level?, minDays?, maxDays?, split, reason }: la primera que se cumple
 *    elige la división que se recomienda (por ejemplo, principiante → full body; con experiencia y 6 días → push/pull/legs);
 *  - focusGroups[objetivo] = grupos de ejercicios que se sugieren, en orden de prioridad;
 *  - safety (opcional): adjustObjective[categoría][objetivo] = objetivo con el que se recomienda en su lugar (por ejemplo, con bajo peso no se
 *    recomienda bajar de peso), avoidHighImpact = categorías a las que no se sugieren ejercicios de alto impacto y notices[categoría] = orientación.
 */
function validateTrainingRules(content) {
  const { matrix, focusGroups, safety } = content ?? {};
  if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) fail(400, 'INVALID_RULES', 'Las reglas de entrenamiento necesitan una matriz «matrix».');
  for (const [objective, levels] of Object.entries(matrix)) {
    if (!OBJECTIVES.includes(objective)) fail(400, 'INVALID_RULES', `Objetivo desconocido en la matriz: ${objective}.`);
    for (const [level, equipments] of Object.entries(levels ?? {})) {
      if (!LEVELS.includes(level)) fail(400, 'INVALID_RULES', `Nivel desconocido en la matriz: ${level}.`);
      for (const [equipment, categories] of Object.entries(equipments ?? {})) {
        if (!EQUIPMENT.includes(equipment)) fail(400, 'INVALID_RULES', `Equipo desconocido en la matriz: ${equipment}.`);
        for (const [category, splits] of Object.entries(categories ?? {})) {
          if (!TEMPLATE_CATEGORIES.includes(category) || !splits || typeof splits !== 'object' || Array.isArray(splits) || Object.keys(splits).length === 0) {
            fail(400, 'INVALID_RULES', 'La matriz solo admite categorías de IMC válidas, cada una con las rutinas de una o más divisiones.');
          }
          for (const [split, code] of Object.entries(splits)) {
            if (!SPLITS.includes(split) || !SLUG.test(code ?? '')) fail(400, 'INVALID_RULES', `Cada rutina de la matriz va bajo una división válida (${SPLITS.join(', ')}) con el código de la rutina.`);
          }
        }
      }
    }
  }
  if (!focusGroups || typeof focusGroups !== 'object' || Array.isArray(focusGroups)) fail(400, 'INVALID_RULES', 'Las reglas necesitan «focusGroups»: los grupos de ejercicios sugeridos por objetivo.');
  for (const objective of OBJECTIVES) {
    const groups = focusGroups[objective];
    if (!Array.isArray(groups) || groups.length < 1 || groups.some(group => !MUSCLE_GROUPS.includes(group))) fail(400, 'INVALID_RULES', `Indica al menos un grupo válido para el objetivo ${objective}.`);
  }
  validateSplitRules(content.splitRules);
  if (safety === undefined) return;
  if (!safety || typeof safety !== 'object' || Array.isArray(safety)) fail(400, 'INVALID_RULES', 'Las reglas de seguridad «safety» deben ser un objeto.');
  for (const [category, changes] of Object.entries(safety.adjustObjective ?? {})) {
    if (!BMI_CATEGORIES.includes(category)) fail(400, 'INVALID_RULES', `Categoría de IMC desconocida en los ajustes de objetivo: ${category}.`);
    for (const [from, to] of Object.entries(changes ?? {})) {
      if (!OBJECTIVES.includes(from) || !OBJECTIVES.includes(to) || from === to) fail(400, 'INVALID_RULES', 'Cada ajuste de objetivo cambia un objetivo válido por otro distinto.');
    }
  }
  if (safety.avoidHighImpact !== undefined && (!Array.isArray(safety.avoidHighImpact) || safety.avoidHighImpact.some(category => !BMI_CATEGORIES.includes(category)))) fail(400, 'INVALID_RULES', 'avoidHighImpact es una lista de categorías de IMC.');
  for (const [category, notice] of Object.entries(safety.notices ?? {})) {
    if (!BMI_CATEGORIES.includes(category) || !text(notice, 1, 300)) fail(400, 'INVALID_RULES', 'Cada orientación por categoría de IMC lleva un texto de hasta 300 caracteres.');
  }
}

/**
 * Reglas nutricionales: activityFactors[nivel de actividad] (factor sobre Mifflin-St Jeor), objectiveAdjustments[objetivo]
 * (% sobre el mantenimiento: déficit ≤ 0, superávit ≥ 0), minimumKcal[sexo], maxDeficitKcal (opcional) y safety (opcional):
 * adjustObjective[categoría de IMC][objetivo] = objetivo que se usa en su lugar, y notices[categoría] = orientación.
 */
function validateNutritionRules(content) {
  const { activityFactors, objectiveAdjustments, minimumKcal, maxDeficitKcal, safety } = content ?? {};
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const between = (value, min, max) => typeof value === 'number' && value >= min && value <= max;
  if (!object(activityFactors) || ACTIVITY_LEVELS.some(level => !between(activityFactors[level], 1, 2.5))) fail(400, 'INVALID_RULES', `Indica un factor de actividad entre 1 y 2,5 para cada nivel: ${ACTIVITY_LEVELS.join(', ')}.`);
  if (!object(objectiveAdjustments) || !between(objectiveAdjustments.bajar, -30, 0) || !between(objectiveAdjustments.mantener, -5, 5) || !between(objectiveAdjustments.subir, 0, 25)) {
    fail(400, 'INVALID_RULES', 'Los ajustes por objetivo son porcentajes: bajar entre −30 y 0, mantener entre −5 y 5, subir entre 0 y 25.');
  }
  if (!object(minimumKcal) || !between(minimumKcal.femenino, 1000, 2000) || !between(minimumKcal.masculino, 1000, 2000)) fail(400, 'INVALID_RULES', 'Indica el mínimo de calorías diarias por sexo (entre 1.000 y 2.000).');
  if (maxDeficitKcal !== undefined && !between(maxDeficitKcal, 100, 1000)) fail(400, 'INVALID_RULES', 'El tope del déficit debe estar entre 100 y 1.000 kcal.');
  if (safety === undefined) return;
  if (!object(safety)) fail(400, 'INVALID_RULES', 'Las reglas de seguridad «safety» deben ser un objeto.');
  for (const [category, changes] of Object.entries(safety.adjustObjective ?? {})) {
    if (!BMI_CATEGORIES.includes(category)) fail(400, 'INVALID_RULES', `Categoría de IMC desconocida en los ajustes de objetivo: ${category}.`);
    for (const [from, to] of Object.entries(changes ?? {})) {
      if (!OBJECTIVES.includes(from) || !OBJECTIVES.includes(to) || from === to) fail(400, 'INVALID_RULES', 'Cada ajuste de objetivo cambia un objetivo válido por otro distinto.');
    }
  }
  for (const [category, notice] of Object.entries(safety.notices ?? {})) {
    if (!BMI_CATEGORIES.includes(category) || !text(notice, 1, 300)) fail(400, 'INVALID_RULES', 'Cada orientación por categoría de IMC lleva un texto de hasta 300 caracteres.');
  }
}

function validateSplitRules(splitRules) {
  if (splitRules === undefined) return;
  if (!Array.isArray(splitRules) || splitRules.length < 1 || splitRules.length > 20) fail(400, 'INVALID_RULES', 'splitRules es una lista de 1 a 20 condiciones.');
  const day = value => value === undefined || (Number.isInteger(value) && value >= 1 && value <= 7);
  for (const rule of splitRules) {
    if (!rule || typeof rule !== 'object' || !SPLITS.includes(rule.split)) fail(400, 'INVALID_RULES', `Cada condición de división indica una división válida: ${SPLITS.join(', ')}.`);
    if (rule.level !== undefined && !LEVELS.includes(rule.level)) fail(400, 'INVALID_RULES', 'El nivel de una condición de división debe ser principiante o con_experiencia.');
    if (!day(rule.minDays) || !day(rule.maxDays) || (rule.minDays !== undefined && rule.maxDays !== undefined && rule.minDays > rule.maxDays)) fail(400, 'INVALID_RULES', 'Los días de una condición de división cumplen 1 ≤ mínimo ≤ máximo ≤ 7.');
    if (!text(rule.reason, 1, 200)) fail(400, 'INVALID_RULES', 'Cada condición de división explica su motivo en hasta 200 caracteres.');
  }
}

export function catalogRouter(ctx) {
  const { db, now } = ctx;
  const router = Router();
  const reader = requireRole('trainer', 'nutritionist', 'admin');
  const trainer = requireRole('trainer');

  // ── Ejercicios ──────────────────────────────────────────────────────────────
  router.get('/catalog/exercises', reader, async (_req, res) => {
    const rows = (await db.query('SELECT * FROM exercises ORDER BY status, name')).rows;
    res.json({ exercises: rows.map(exerciseView) });
  });

  router.post('/catalog/exercises', trainer, async (req, res) => {
    const body = validateExercise(req.body);
    const row = await db.transaction(async tx => {
      const inserted = await tx.query(
        `INSERT INTO exercises (code, name, description, muscle_group, min_level, requires_equipment, high_impact, default_prescription, source_note, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, code, name, status`,
        [body.code, body.name, body.description, body.muscleGroup, body.minLevel, body.requiresEquipment, body.highImpact, body.defaultPrescription, body.sourceNote, req.auth.userId, now()]);
      await audit(tx, now(), { actor: req.auth, action: 'exercise.created', entityType: 'exercise', entityId: inserted.rows[0].id });
      return inserted.rows[0];
    });
    res.status(201).json({ exercise: { id: row.id, code: row.code, name: row.name, status: row.status } });
  });

  router.post('/catalog/exercises/:id/approve', trainer, async (req, res) => {
    const id = uuidParam(req.params.id, 'ejercicio');
    const exercise = await db.transaction(async tx => {
      const row = (await tx.query("SELECT id, code FROM exercises WHERE id = $1 AND status = 'draft' FOR UPDATE", [id])).rows[0];
      if (!row) fail(409, 'NOT_A_DRAFT', 'Solo se aprueban ejercicios en borrador.');
      await tx.query("UPDATE exercises SET status = 'approved', approved_by = $2, approved_by_role = 'trainer', approved_at = $3 WHERE id = $1", [id, req.auth.userId, now()]);
      await audit(tx, now(), { actor: req.auth, action: 'exercise.approved', entityType: 'exercise', entityId: id });
      return row;
    });
    res.json({ exercise: { id: exercise.id, code: exercise.code, status: 'approved' } });
  });

  /** Retirar un ejercicio lo oculta de la biblioteca; las rutinas ya iniciadas lo conservan. */
  router.post('/catalog/exercises/:id/retire', trainer, async (req, res) => {
    const id = uuidParam(req.params.id, 'ejercicio');
    await db.transaction(async tx => {
      const inUse = await tx.query("SELECT t.code FROM template_exercises te JOIN routine_templates t ON t.id = te.template_id WHERE te.exercise_id = $1 AND t.status = 'approved' LIMIT 3", [id]);
      if (inUse.rowCount) fail(409, 'EXERCISE_IN_USE', `Retira antes las rutinas que lo usan: ${inUse.rows.map(row => row.code).join(', ')}.`);
      const result = await tx.query("UPDATE exercises SET status = 'retired' WHERE id = $1 AND status = 'approved'", [id]);
      if (!result.rowCount) fail(409, 'NOT_APPROVED', 'Solo se retiran ejercicios aprobados.');
      await audit(tx, now(), { actor: req.auth, action: 'exercise.retired', entityType: 'exercise', entityId: id });
    });
    res.json({ exercise: { id, status: 'retired' } });
  });

  // ── Plantillas (rutinas prearmadas) ─────────────────────────────────────────
  router.get('/catalog/templates', reader, async (_req, res) => {
    const rows = (await db.query('SELECT * FROM routine_templates ORDER BY code, version DESC')).rows;
    res.json({ templates: rows.map(templateView) });
  });

  router.get('/catalog/templates/:id', reader, async (req, res) => {
    const template = (await db.query('SELECT * FROM routine_templates WHERE id = $1', [uuidParam(req.params.id, 'plantilla')])).rows[0];
    if (!template) fail(404, 'NOT_FOUND', 'Plantilla inexistente.');
    const items = (await db.query(
      `SELECT te.session_no, te.position, te.prescription, e.code, e.name, e.status FROM template_exercises te JOIN exercises e ON e.id = te.exercise_id
        WHERE te.template_id = $1 ORDER BY te.session_no, te.position`, [template.id])).rows;
    const sessions = template.session_labels.map((label, index) => ({ sessionNo: index + 1, label, exercises: items.filter(item => item.session_no === index + 1).map(item => ({ code: item.code, name: item.name, prescription: item.prescription, status: item.status })) }));
    res.json({ template: { ...templateView(template), sessions } });
  });

  router.post('/catalog/templates', trainer, async (req, res) => {
    const body = validateTemplate(req.body);
    const created = await db.transaction(async tx => {
      const codes = [...new Set(body.sessions.flatMap(session => session.exercises.map(exercise => exercise.code)))];
      const known = (await tx.query('SELECT id, code FROM exercises WHERE code = ANY($1)', [codes])).rows;
      const byCode = new Map(known.map(row => [row.code, row.id]));
      const missing = codes.filter(code => !byCode.has(code));
      if (missing.length) fail(400, 'UNKNOWN_EXERCISE', `Ejercicios inexistentes en el catálogo: ${missing.join(', ')}.`);
      const version = ((await tx.query('SELECT coalesce(max(version), 0) AS v FROM routine_templates WHERE code = $1', [body.code])).rows[0].v) + 1;
      const inserted = await tx.query(
        `INSERT INTO routine_templates (code, version, name, summary, objective, level, equipment, bmi_category, split, session_labels, min_days, max_days, session_minutes, weeks, author_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id, code, version, status`,
        [body.code, version, body.name.trim(), body.summary.trim(), body.objective, body.level, body.equipment, body.bmiCategory, body.split, body.sessionLabels, body.minDays, body.maxDays, body.sessionMinutes, body.weeks, req.auth.userId, now()],
      );
      const template = inserted.rows[0];
      for (const session of body.sessions) {
        for (const [index, exercise] of session.exercises.entries()) {
          await tx.query('INSERT INTO template_exercises (template_id, session_no, position, exercise_id, prescription) VALUES ($1, $2, $3, $4, $5)', [template.id, session.sessionNo, index + 1, byCode.get(exercise.code), exercise.prescription.trim()]);
        }
      }
      await audit(tx, now(), { actor: req.auth, action: 'template.created', entityType: 'template', entityId: template.id, version });
      return template;
    });
    res.status(201).json({ template: created });
  });

  /** Aprobar publica la rutina para todas las personas; la versión aprobada anterior del mismo código queda retirada. */
  router.post('/catalog/templates/:id/approve', trainer, async (req, res) => {
    const id = uuidParam(req.params.id, 'plantilla');
    const approved = await db.transaction(async tx => {
      const template = (await tx.query("SELECT id, code, version FROM routine_templates WHERE id = $1 AND status = 'draft' FOR UPDATE", [id])).rows[0];
      if (!template) fail(409, 'NOT_A_DRAFT', 'Solo se aprueban plantillas en borrador.');
      const pending = (await tx.query("SELECT DISTINCT e.code FROM template_exercises te JOIN exercises e ON e.id = te.exercise_id WHERE te.template_id = $1 AND e.status <> 'approved' ORDER BY e.code", [id])).rows;
      if (pending.length) fail(409, 'EXERCISES_NOT_APPROVED', `Aprueba antes estos ejercicios: ${pending.map(row => row.code).join(', ')}.`);
      await tx.query("UPDATE routine_templates SET status = 'retired' WHERE code = $1 AND status = 'approved'", [template.code]);
      await tx.query("UPDATE routine_templates SET status = 'approved', approved_by = $2, approved_by_role = 'trainer', approved_at = $3 WHERE id = $1", [id, req.auth.userId, now()]);
      await audit(tx, now(), { actor: req.auth, action: 'template.approved', entityType: 'template', entityId: id, version: template.version });
      return template;
    });
    res.json({ template: { id: approved.id, code: approved.code, version: approved.version, status: 'approved' } });
  });

  router.post('/catalog/templates/:id/retire', trainer, async (req, res) => {
    const id = uuidParam(req.params.id, 'plantilla');
    await db.transaction(async tx => {
      const result = await tx.query("UPDATE routine_templates SET status = 'retired' WHERE id = $1 AND status = 'approved'", [id]);
      if (!result.rowCount) fail(409, 'NOT_APPROVED', 'Solo se retiran plantillas aprobadas.');
      await audit(tx, now(), { actor: req.auth, action: 'template.retired', entityType: 'template', entityId: id });
    });
    res.json({ template: { id, status: 'retired' } });
  });

  // ── Reglas ───────────────────────────────────────────────────────────────────
  router.get('/catalog/rules', reader, async (_req, res) => {
    const rows = (await db.query('SELECT id, domain, version, status, content, change_note, approved_at FROM rule_versions ORDER BY domain, version DESC')).rows;
    res.json({ rules: rows.map(row => ({ id: row.id, domain: row.domain, version: row.version, status: row.status, content: row.content, changeNote: row.change_note, approvedAt: row.approved_at })) });
  });

  router.post('/catalog/rules', requireRole('trainer', 'nutritionist'), async (req, res) => {
    const { domain, content, changeNote = null } = req.body ?? {};
    if (!RULE_ROLE[domain]) fail(400, 'INVALID_DOMAIN', 'Ámbito permitido: entrenamiento o nutricion.');
    if (RULE_ROLE[domain] !== req.auth.role) fail(403, 'FORBIDDEN', 'Cada profesional define solo las reglas de su ámbito.');
    if (!content || typeof content !== 'object' || Array.isArray(content)) fail(400, 'INVALID_RULES', 'Las reglas deben ser un objeto.');
    if (domain === 'entrenamiento') validateTrainingRules(content);
    if (domain === 'nutricion') validateNutritionRules(content);
    const created = await db.transaction(async tx => {
      const version = ((await tx.query('SELECT coalesce(max(version), 0) AS v FROM rule_versions WHERE domain = $1', [domain])).rows[0].v) + 1;
      const inserted = await tx.query('INSERT INTO rule_versions (domain, version, content, change_note, author_id, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, domain, version, status', [domain, version, JSON.stringify(content), changeNote, req.auth.userId, now()]);
      await audit(tx, now(), { actor: req.auth, action: 'rules.created', entityType: 'rules', entityId: inserted.rows[0].id, version });
      return inserted.rows[0];
    });
    res.status(201).json({ rules: created });
  });

  router.post('/catalog/rules/:id/approve', requireRole('trainer', 'nutritionist'), async (req, res) => {
    const id = uuidParam(req.params.id, 'reglas');
    const approved = await db.transaction(async tx => {
      const rules = (await tx.query("SELECT id, domain, version, content FROM rule_versions WHERE id = $1 AND status = 'draft' FOR UPDATE", [id])).rows[0];
      if (!rules) fail(409, 'NOT_A_DRAFT', 'Solo se aprueban reglas en borrador.');
      if (RULE_ROLE[rules.domain] !== req.auth.role) fail(403, 'FORBIDDEN', 'Solo el profesional competente aprueba estas reglas.');
      if (rules.domain === 'entrenamiento') {
        // Cada rutina recomendada debe existir, estar aprobada y corresponder a la combinación que la referencia.
        const cells = [];
        for (const [objective, levels] of Object.entries(rules.content.matrix)) for (const [level, equipments] of Object.entries(levels)) for (const [equipment, categories] of Object.entries(equipments)) for (const [category, splits] of Object.entries(categories)) {
          for (const [split, code] of Object.entries(splits)) cells.push({ objective, level, equipment, category, split, code });
        }
        const found = new Map((await tx.query("SELECT code, objective, level, equipment, bmi_category, split FROM routine_templates WHERE code = ANY($1) AND status = 'approved'", [cells.map(cell => cell.code)])).rows.map(row => [row.code, row]));
        for (const { objective, level, equipment, category, split, code } of cells) {
          const template = found.get(code);
          if (!template || template.objective !== objective || template.level !== level || template.equipment !== equipment || template.bmi_category !== category || template.split !== split) {
            fail(409, 'RULES_REFERENCE_INVALID', `La rutina «${code}» no está aprobada o no corresponde a ${objective} · ${level} · ${equipment} · ${category} · ${split}.`);
          }
        }
      }
      await tx.query("UPDATE rule_versions SET status = 'retired' WHERE domain = $1 AND status = 'approved'", [rules.domain]);
      await tx.query("UPDATE rule_versions SET status = 'approved', approved_by = $2, approved_by_role = $3, approved_at = $4 WHERE id = $1", [id, req.auth.userId, req.auth.role, now()]);
      await audit(tx, now(), { actor: req.auth, action: 'rules.approved', entityType: 'rules', entityId: id, version: rules.version });
      return rules;
    });
    res.json({ rules: { id: approved.id, domain: approved.domain, version: approved.version, status: 'approved' } });
  });

  return router;
}
