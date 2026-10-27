// Alimentación: pautas de 7 días aprobadas por la nutricionista, ajustadas a las calorías de cada persona según su objetivo
// (déficit, mantenimiento o superávit), y el catálogo nutricional (alimentos y pautas) que gestiona la nutricionista.
import { Router } from 'express';
import { fail } from '../lib/errors.js';
import { audit, currentProfile, hasConsent, usageEvent } from '../lib/records.js';
import { requireRole } from '../lib/auth.js';
import { uuidParam } from '../lib/validate.js';
import { bodyOf } from '../lib/body.js';
import { energyTarget, OBJECTIVE_ENERGY } from '../lib/energy.js';
import { applySwaps, buildDays, DIETS, FOOD_CATEGORIES, itemKey, MEAL_LABELS, MEALS, swapRow, weekAverage } from '../lib/meal-plans.js';

const SLUG = /^[a-z0-9-]+$/;
const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DIET_LABELS = { mediterranea: 'Mediterránea', alta_proteina: 'Alta en proteína', baja_carbohidratos: 'Baja en carbohidratos', vegetariana: 'Vegetariana' };
export const DISCLAIMER = 'Pauta general aprobada por una nutricionista: no reemplaza una evaluación individual. Si estás embarazada o amamantando, tienes una enfermedad (por ejemplo, diabetes o enfermedad renal) o tomas medicamentos, consulta antes a un profesional.';

/** Reglas nutricionales vigentes (aprobadas por la nutricionista), o null. */
export async function approvedNutritionRules(tx) {
  return (await tx.query("SELECT id, version, content FROM rule_versions WHERE domain = 'nutricion' AND status = 'approved'")).rows[0] ?? null;
}

/**
 * Datos para personalizar la pauta: exige el perfil, los consentimientos de datos corporales y nutricionales, la estatura,
 * el peso, el sexo y la actividad, y reglas aprobadas. Devuelve el objetivo calórico o qué falta para calcularlo.
 */
export async function personalEnergy(tx, userId) {
  const [profile, rules] = [await currentProfile(tx, userId), await approvedNutritionRules(tx)];
  if (!profile) return { profile: null, target: null, missing: 'profile' };
  if (!rules) return { profile, target: null, missing: 'rules' };
  const consented = (await hasConsent(tx, userId, 'datos_corporales')) && (await hasConsent(tx, userId, 'datos_nutricionales'));
  if (!consented || profile.weight_kg === null || profile.sex_param === null) return { profile, target: null, missing: 'data' };
  const body = bodyOf(profile);
  const target = energyTarget(rules, {
    weightKg: Number(profile.weight_kg), heightCm: Number(profile.height_cm), age: profile.age, sex: profile.sex_param,
    activityLevel: profile.activity_level, objective: profile.objective, bmiCategory: body?.category ?? null,
  });
  return { profile, target, missing: null };
}

const MISSING_NOTICES = {
  profile: { code: 'profile_missing', text: 'Completa tu perfil para ajustar la pauta a tu objetivo. Mientras tanto ves porciones de referencia.' },
  rules: { code: 'rules_missing', text: 'Aún no hay reglas nutricionales aprobadas por la nutricionista: ves porciones de referencia.' },
  data: { code: 'nutrition_data_missing', text: 'Para ajustar los gramos a tus calorías indica en tu perfil tu estatura, peso, sexo y nivel de actividad (con su consentimiento). Mientras tanto ves porciones de referencia.' },
};

const foodView = row => ({
  id: row.id, code: row.code, name: row.name, category: row.category, kcal100g: Number(row.kcal_100g), protein100g: Number(row.protein_100g),
  carbs100g: Number(row.carbs_100g), fat100g: Number(row.fat_100g), unitName: row.unit_name, unitGrams: row.unit_grams === null ? null : Number(row.unit_grams),
  sourceNote: row.source_note, status: row.status,
});
const planView = row => ({ id: row.id, code: row.code, version: row.version, name: row.name, summary: row.summary, diet: row.diet, dietLabel: DIET_LABELS[row.diet], referenceKcal: row.reference_kcal, status: row.status, approvedAt: row.approved_at });

async function planRows(tx, templateId) {
  return (await tx.query(
    `SELECT i.day_no, i.meal, i.position, i.grams, f.code, f.name, f.category, f.kcal_100g, f.protein_100g, f.carbs_100g, f.fat_100g, f.unit_name, f.unit_grams, f.status AS food_status
       FROM meal_plan_items i JOIN foods f ON f.id = i.food_id WHERE i.template_id = $1 ORDER BY i.day_no, i.meal, i.position`, [templateId])).rows;
}

const labelDays = days => days.map(day => ({ ...day, dayLabel: DAY_LABELS[day.dayNo - 1] }));

/** Alimentos que la persona cambió en una pauta (se ignoran los que la nutricionista retiró después). */
async function swapRows(tx, userId, templateId) {
  return (await tx.query(
    `SELECT s.day_no, s.meal, s.position, f.code, f.name, f.category, f.kcal_100g, f.protein_100g, f.carbs_100g, f.fat_100g, f.unit_name, f.unit_grams
       FROM meal_plan_swaps s JOIN foods f ON f.id = s.food_id WHERE s.user_id = $1 AND s.template_id = $2 AND f.status = 'approved'`, [userId, templateId])).rows;
}

async function approvedTemplate(tx, id) {
  const template = (await tx.query("SELECT * FROM meal_plan_templates WHERE id = $1 AND status = 'approved'", [uuidParam(id, 'pauta')])).rows[0];
  if (!template) fail(404, 'NOT_FOUND', 'Esa pauta no existe o ya no está disponible.');
  return template;
}

/** La pauta de una persona: sus calorías, los ítems de la pauta y los mismos ítems con sus cambios de alimento. */
async function personalPlan(tx, userId, template) {
  const { target, missing } = await personalEnergy(tx, userId);
  const rows = await planRows(tx, template.id);
  const swaps = await swapRows(tx, userId, template.id);
  return { template, target, missing, kcal: target?.targetKcal ?? template.reference_kcal, rows, swaps, effective: applySwaps(rows, swaps) };
}

function detailView(plan) {
  const days = labelDays(buildDays(plan.effective, plan.kcal));
  return {
    plan: planView(plan.template),
    personalized: Boolean(plan.target),
    kcal: plan.kcal,
    target: plan.target,
    notices: [...(plan.target?.notices ?? []), ...(plan.missing ? [MISSING_NOTICES[plan.missing]] : [])],
    disclaimer: DISCLAIMER,
    swaps: plan.swaps.length,
    weekAverage: weekAverage(days),
    days,
  };
}

function itemParams(source) {
  const key = { day_no: Number(source.dayNo), meal: source.meal, position: Number(source.position) };
  if (!Number.isInteger(key.day_no) || key.day_no < 1 || key.day_no > 7 || !MEALS.includes(key.meal) || !Number.isInteger(key.position) || key.position < 1 || key.position > 12) {
    fail(400, 'INVALID_ITEM', 'Indica el día (1 a 7), la comida y la posición del alimento.');
  }
  return key;
}

/**
 * Alimentos por los que se puede cambiar uno de la pauta: aprobados, del mismo grupo, que la nutricionista incluyó en esa
 * pauta (así se respeta la dieta elegida) y que no estén ya en la misma comida. Primero los que la pauta usa en esa comida.
 */
function alternativesFor(plan, key) {
  const original = plan.rows.find(row => itemKey(row) === itemKey(key));
  if (!original) fail(404, 'ITEM_NOT_FOUND', 'Ese alimento no está en la pauta.');
  const inMeal = new Set(plan.effective.filter(row => row.day_no === key.day_no && row.meal === key.meal && row.position !== key.position).map(row => row.code));
  const foods = new Map();
  for (const row of plan.rows) {
    if (row.category !== original.category || row.food_status !== 'approved' || row.code === original.code || inMeal.has(row.code)) continue;
    const entry = foods.get(row.code) ?? { food: row, usual: 0 };
    if (row.meal === key.meal) entry.usual += 1;
    foods.set(row.code, entry);
  }
  return { original, foods: [...foods.values()].sort((a, b) => b.usual - a.usual || a.food.name.localeCompare(b.food.name, 'es')) };
}

/** Cómo queda el alimento del ítem con `food` (o con el de la pauta, si es null): el día se vuelve a ajustar a las calorías. */
function previewItem(plan, key, original, food) {
  const dayRows = plan.effective.filter(row => row.day_no === key.day_no).map(row => (itemKey(row) === itemKey(key) ? (food ? swapRow(original, food) : original) : row));
  const item = buildDays(dayRows, plan.kcal)[0].meals.find(meal => meal.meal === key.meal).items.find(entry => entry.position === key.position);
  return { code: item.code, name: item.name, grams: item.grams, household: item.household, kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat };
}

function validateFood(body) {
  const { code, name, category, kcal100g, protein100g, carbs100g, fat100g, unitName = null, unitGrams = null, sourceNote = null } = body ?? {};
  if (!SLUG.test(code ?? '') || !text(name, 1, 80)) fail(400, 'INVALID_FOOD', 'Indica código (minúsculas, números y guiones) y nombre (hasta 80 caracteres).');
  if (!FOOD_CATEGORIES.includes(category)) fail(400, 'INVALID_CATEGORY', `Grupo permitido: ${FOOD_CATEGORIES.join(', ')}.`);
  const number = (value, max) => typeof value === 'number' && value >= 0 && value <= max;
  if (!number(kcal100g, 900) || !number(protein100g, 100) || !number(carbs100g, 100) || !number(fat100g, 100) || protein100g + carbs100g + fat100g > 100) {
    fail(400, 'INVALID_COMPOSITION', 'La composición va por 100 g: energía entre 0 y 900 kcal, y proteínas, carbohidratos y grasas que no sumen más de 100 g.');
  }
  if ((unitName === null) !== (unitGrams === null) || (unitName !== null && (!text(unitName, 1, 30) || !number(unitGrams, 1000) || unitGrams === 0))) fail(400, 'INVALID_UNIT', 'La medida casera lleva nombre (hasta 30 caracteres) y gramos mayores que 0, o ninguno de los dos.');
  return { code, name: name.trim(), category, kcal100g, protein100g, carbs100g, fat100g, unitName: unitName?.trim() ?? null, unitGrams, sourceNote };
}

/** Una pauta tiene 7 días y en cada uno las 5 comidas, cada una con 1 a 12 alimentos del catálogo y sus gramos. */
function validateMealPlan(body) {
  if (!body || typeof body !== 'object') fail(400, 'INVALID_MEAL_PLAN', 'Envía una pauta válida.');
  if (!SLUG.test(body.code ?? '') || !text(body.name, 1, 80) || !text(body.summary, 1, 300)) fail(400, 'INVALID_MEAL_PLAN', 'Indica código, nombre (hasta 80) y resumen (hasta 300 caracteres).');
  if (!DIETS.includes(body.diet)) fail(400, 'INVALID_DIET', `Dieta permitida: ${DIETS.join(', ')}.`);
  if (!Number.isInteger(body.referenceKcal) || body.referenceKcal < 1200 || body.referenceKcal > 4000) fail(400, 'INVALID_REFERENCE_KCAL', 'La energía de referencia debe estar entre 1.200 y 4.000 kcal.');
  const days = body.days;
  if (!Array.isArray(days) || days.length !== 7 || new Set(days.map(day => day?.dayNo)).size !== 7 || days.some(day => !Number.isInteger(day?.dayNo) || day.dayNo < 1 || day.dayNo > 7)) {
    fail(400, 'INVALID_DAYS', 'La pauta tiene los 7 días de la semana (dayNo de 1 a 7, sin repetir).');
  }
  for (const day of days) {
    if (!day.meals || typeof day.meals !== 'object' || MEALS.some(meal => !Array.isArray(day.meals[meal])) || Object.keys(day.meals).some(meal => !MEALS.includes(meal))) {
      fail(400, 'INVALID_MEALS', `Cada día tiene sus 5 comidas: ${MEALS.join(', ')}.`);
    }
    for (const meal of MEALS) {
      const items = day.meals[meal];
      if (items.length < 1 || items.length > 12) fail(400, 'INVALID_MEALS', 'Cada comida lleva entre 1 y 12 alimentos.');
      if (items.some(item => !SLUG.test(item?.food ?? '') || typeof item.grams !== 'number' || !(item.grams > 0 && item.grams <= 1000))) fail(400, 'INVALID_GRAMS', 'Cada alimento se indica con su código y sus gramos (más de 0 y hasta 1.000).');
    }
  }
  return body;
}

export function nutritionRouter(ctx) {
  const { db, config, now } = ctx;
  const router = Router();
  const participant = requireRole('user');
  const reader = requireRole('nutritionist', 'trainer', 'admin');
  const nutritionist = requireRole('nutritionist');

  // ── Participante: pautas aprobadas, ajustadas a su objetivo ────────────────
  router.get('/meal-plans', participant, async (req, res) => {
    const { profile, target, missing } = await personalEnergy(db, req.auth.userId);
    const templates = (await db.query("SELECT * FROM meal_plan_templates WHERE status = 'approved' ORDER BY array_position(ARRAY['mediterranea','alta_proteina','baja_carbohidratos','vegetariana'], diet), name")).rows;
    const plans = [];
    for (const row of templates) plans.push({ ...planView(row), average: weekAverage(buildDays(await planRows(db, row.id), row.reference_kcal)) });
    res.json({
      objective: profile?.objective ?? null,
      objectiveLabel: profile ? OBJECTIVE_ENERGY[target?.effectiveObjective ?? profile.objective] : null,
      target,
      notices: [...(target?.notices ?? []), ...(missing ? [MISSING_NOTICES[missing]] : [])],
      disclaimer: DISCLAIMER,
      plans,
    });
  });

  router.get('/meal-plans/:id', participant, async (req, res) => {
    const plan = await personalPlan(db, req.auth.userId, await approvedTemplate(db, req.params.id));
    await usageEvent(db, config, now(), req.auth.userId, 'pauta_consultada');
    res.json(detailView(plan));
  });

  // ── Participante: cambiar un alimento que no tiene por un equivalente ──────
  router.get('/meal-plans/:id/alternatives', participant, async (req, res) => {
    const key = itemParams(req.query);
    const plan = await personalPlan(db, req.auth.userId, await approvedTemplate(db, req.params.id));
    const { original, foods } = alternativesFor(plan, key);
    const swapped = plan.swaps.some(swap => itemKey(swap) === itemKey(key));
    const current = plan.effective.find(row => itemKey(row) === itemKey(key));
    res.json({
      item: {
        dayNo: key.day_no, dayLabel: DAY_LABELS[key.day_no - 1], meal: key.meal, mealLabel: MEAL_LABELS[key.meal], position: key.position, category: original.category,
        current: previewItem(plan, key, original, swapped ? current : null),
        original: swapped ? previewItem(plan, key, original, null) : null,
      },
      sameFoodCount: plan.rows.filter(row => row.code === original.code).length,
      alternatives: foods.map(({ food, usual }) => ({ ...previewItem(plan, key, original, food), usual: usual > 0 })),
    });
  });

  /** Cambia un alimento (o el mismo alimento en toda la semana); elegir el de la pauta deshace el cambio. Devuelve la pauta. */
  router.put('/meal-plans/:id/swaps', participant, async (req, res) => {
    const key = itemParams(req.body ?? {});
    const { food, wholeWeek = false } = req.body;
    if (!SLUG.test(food ?? '') || typeof wholeWeek !== 'boolean') fail(400, 'INVALID_SWAP', 'Indica el código del alimento de reemplazo.');
    const outcome = await db.transaction(async tx => {
      const plan = await personalPlan(tx, req.auth.userId, await approvedTemplate(tx, req.params.id));
      const { original, foods } = alternativesFor(plan, key);
      const targets = wholeWeek ? plan.rows.filter(row => row.code === original.code) : [original];
      const where = 'user_id = $1 AND template_id = $2 AND day_no = $3 AND meal = $4 AND position = $5';
      let changed = 0;
      if (food === original.code) {
        for (const row of targets) changed += (await tx.query(`DELETE FROM meal_plan_swaps WHERE ${where}`, [req.auth.userId, plan.template.id, row.day_no, row.meal, row.position])).rowCount;
        return { template: plan.template, changed };
      }
      if (!foods.some(entry => entry.food.code === food)) fail(400, 'INVALID_SWAP', 'Elige un alimento aprobado del mismo grupo de esta pauta que no esté ya en esa comida.');
      const foodId = (await tx.query('SELECT id FROM foods WHERE code = $1', [food])).rows[0].id;
      for (const row of targets) {
        // En el resto de la semana se salta la comida que ya tiene ese alimento.
        if (row !== original && plan.effective.some(other => other.day_no === row.day_no && other.meal === row.meal && other.position !== row.position && other.code === food)) continue;
        await tx.query(
          `INSERT INTO meal_plan_swaps (user_id, template_id, day_no, meal, position, food_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, template_id, day_no, meal, position) DO UPDATE SET food_id = EXCLUDED.food_id, created_at = EXCLUDED.created_at`,
          [req.auth.userId, plan.template.id, row.day_no, row.meal, row.position, foodId, now()]);
        changed += 1;
      }
      return { template: plan.template, changed };
    });
    res.json({ changed: outcome.changed, ...detailView(await personalPlan(db, req.auth.userId, outcome.template)) });
  });

  router.delete('/meal-plans/:id/swaps', participant, async (req, res) => {
    const template = await approvedTemplate(db, req.params.id);
    const { rowCount } = await db.query('DELETE FROM meal_plan_swaps WHERE user_id = $1 AND template_id = $2', [req.auth.userId, template.id]);
    res.json({ changed: rowCount, ...detailView(await personalPlan(db, req.auth.userId, template)) });
  });

  // ── Nutricionista: alimentos ───────────────────────────────────────────────
  router.get('/catalog/foods', reader, async (_req, res) => {
    res.json({ foods: (await db.query('SELECT * FROM foods ORDER BY status, category, name')).rows.map(foodView) });
  });

  router.post('/catalog/foods', nutritionist, async (req, res) => {
    const food = validateFood(req.body);
    const row = await db.transaction(async tx => {
      if ((await tx.query('SELECT 1 FROM foods WHERE code = $1', [food.code])).rowCount) fail(409, 'CODE_TAKEN', 'Ya existe un alimento con ese código.');
      const inserted = (await tx.query(
        `INSERT INTO foods (code, name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_name, unit_grams, source_note, author_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [food.code, food.name, food.category, food.kcal100g, food.protein100g, food.carbs100g, food.fat100g, food.unitName, food.unitGrams, food.sourceNote, req.auth.userId, now()])).rows[0];
      await audit(tx, now(), { actor: req.auth, action: 'food.created', entityType: 'food', entityId: inserted.id });
      return inserted;
    });
    res.status(201).json({ food: foodView(row) });
  });

  router.post('/catalog/foods/:id/approve', nutritionist, async (req, res) => {
    const id = uuidParam(req.params.id, 'alimento');
    await db.transaction(async tx => {
      const result = await tx.query("UPDATE foods SET status = 'approved', approved_by = $2, approved_by_role = 'nutritionist', approved_at = $3 WHERE id = $1 AND status = 'draft'", [id, req.auth.userId, now()]);
      if (!result.rowCount) fail(409, 'NOT_A_DRAFT', 'Solo se aprueban alimentos en borrador.');
      await audit(tx, now(), { actor: req.auth, action: 'food.approved', entityType: 'food', entityId: id });
    });
    res.json({ food: { id, status: 'approved' } });
  });

  /** Retirar un alimento lo saca del catálogo; si una pauta vigente lo usa, primero hay que publicar otra versión. */
  router.post('/catalog/foods/:id/retire', nutritionist, async (req, res) => {
    const id = uuidParam(req.params.id, 'alimento');
    await db.transaction(async tx => {
      const inUse = await tx.query("SELECT DISTINCT t.code FROM meal_plan_items i JOIN meal_plan_templates t ON t.id = i.template_id WHERE i.food_id = $1 AND t.status = 'approved' LIMIT 3", [id]);
      if (inUse.rowCount) fail(409, 'FOOD_IN_USE', `Retira o reemplaza antes las pautas que lo usan: ${inUse.rows.map(row => row.code).join(', ')}.`);
      const result = await tx.query("UPDATE foods SET status = 'retired' WHERE id = $1 AND status = 'approved'", [id]);
      if (!result.rowCount) fail(409, 'NOT_APPROVED', 'Solo se retiran alimentos aprobados.');
      await audit(tx, now(), { actor: req.auth, action: 'food.retired', entityType: 'food', entityId: id });
    });
    res.json({ food: { id, status: 'retired' } });
  });

  // ── Nutricionista: pautas ──────────────────────────────────────────────────
  router.get('/catalog/meal-plans', reader, async (_req, res) => {
    res.json({ mealPlans: (await db.query('SELECT * FROM meal_plan_templates ORDER BY code, version DESC')).rows.map(planView) });
  });

  router.get('/catalog/meal-plans/:id', reader, async (req, res) => {
    const template = (await db.query('SELECT * FROM meal_plan_templates WHERE id = $1', [uuidParam(req.params.id, 'pauta')])).rows[0];
    if (!template) fail(404, 'NOT_FOUND', 'Pauta inexistente.');
    const rows = await planRows(db, template.id);
    const days = labelDays(buildDays(rows, template.reference_kcal));
    res.json({ mealPlan: { ...planView(template), pendingFoods: [...new Set(rows.filter(row => row.food_status !== 'approved').map(row => row.code))], weekAverage: weekAverage(days), days } });
  });

  router.post('/catalog/meal-plans', nutritionist, async (req, res) => {
    const body = validateMealPlan(req.body);
    const created = await db.transaction(async tx => {
      const codes = [...new Set(body.days.flatMap(day => MEALS.flatMap(meal => day.meals[meal].map(item => item.food))))];
      const known = new Map((await tx.query('SELECT id, code FROM foods WHERE code = ANY($1)', [codes])).rows.map(row => [row.code, row.id]));
      const missing = codes.filter(code => !known.has(code));
      if (missing.length) fail(400, 'UNKNOWN_FOOD', `Alimentos inexistentes en el catálogo: ${missing.join(', ')}.`);
      const version = ((await tx.query('SELECT coalesce(max(version), 0) AS v FROM meal_plan_templates WHERE code = $1', [body.code])).rows[0].v) + 1;
      const template = (await tx.query(
        `INSERT INTO meal_plan_templates (code, version, name, summary, diet, reference_kcal, author_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [body.code, version, body.name.trim(), body.summary.trim(), body.diet, body.referenceKcal, req.auth.userId, now()])).rows[0];
      const items = body.days.flatMap(day => MEALS.flatMap(meal => day.meals[meal].map((item, index) => [day.dayNo, meal, index + 1, known.get(item.food), item.grams])));
      await tx.query(
        `INSERT INTO meal_plan_items (template_id, day_no, meal, position, food_id, grams)
         SELECT $1, d, m, p, f, g FROM unnest($2::smallint[], $3::text[], $4::smallint[], $5::uuid[], $6::numeric[]) AS t(d, m, p, f, g)`,
        [template.id, items.map(item => item[0]), items.map(item => item[1]), items.map(item => item[2]), items.map(item => item[3]), items.map(item => item[4])]);
      await audit(tx, now(), { actor: req.auth, action: 'meal_plan.created', entityType: 'meal_plan', entityId: template.id, version });
      return template;
    });
    res.status(201).json({ mealPlan: planView(created) });
  });

  /** Aprobar publica la pauta para todas las personas y retira la versión aprobada anterior del mismo código. */
  router.post('/catalog/meal-plans/:id/approve', nutritionist, async (req, res) => {
    const id = uuidParam(req.params.id, 'pauta');
    const approved = await db.transaction(async tx => {
      const template = (await tx.query("SELECT id, code, version FROM meal_plan_templates WHERE id = $1 AND status = 'draft' FOR UPDATE", [id])).rows[0];
      if (!template) fail(409, 'NOT_A_DRAFT', 'Solo se aprueban pautas en borrador.');
      const pending = (await tx.query("SELECT DISTINCT f.code FROM meal_plan_items i JOIN foods f ON f.id = i.food_id WHERE i.template_id = $1 AND f.status <> 'approved' ORDER BY f.code", [id])).rows;
      if (pending.length) fail(409, 'FOODS_NOT_APPROVED', `Aprueba antes estos alimentos: ${pending.map(row => row.code).join(', ')}.`);
      await tx.query("UPDATE meal_plan_templates SET status = 'retired' WHERE code = $1 AND status = 'approved'", [template.code]);
      await tx.query("UPDATE meal_plan_templates SET status = 'approved', approved_by = $2, approved_by_role = 'nutritionist', approved_at = $3 WHERE id = $1", [id, req.auth.userId, now()]);
      await audit(tx, now(), { actor: req.auth, action: 'meal_plan.approved', entityType: 'meal_plan', entityId: id, version: template.version });
      return template;
    });
    res.json({ mealPlan: { id: approved.id, code: approved.code, version: approved.version, status: 'approved' } });
  });

  router.post('/catalog/meal-plans/:id/retire', nutritionist, async (req, res) => {
    const id = uuidParam(req.params.id, 'pauta');
    await db.transaction(async tx => {
      const result = await tx.query("UPDATE meal_plan_templates SET status = 'retired' WHERE id = $1 AND status = 'approved'", [id]);
      if (!result.rowCount) fail(409, 'NOT_APPROVED', 'Solo se retiran pautas aprobadas.');
      await audit(tx, now(), { actor: req.auth, action: 'meal_plan.retired', entityType: 'meal_plan', entityId: id });
    });
    res.json({ mealPlan: { id, status: 'retired' } });
  });

  return router;
}
