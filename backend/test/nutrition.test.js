import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, POLICY, PROFILE } from './helpers.js';
import { householdMeasure, roundGrams } from '../src/lib/meal-plans.js';
import { energyTarget } from '../src/lib/energy.js';
import { NUTRITION_RULES } from '../src/seed/nutrition.js';
import { mealPlanCode } from '../src/seed/demo.js';
import { exportUserData } from '../src/modules/datarights.js';

const RULES = { version: 1, content: NUTRITION_RULES };
const MAN = { weightKg: 80, heightCm: 180, age: 30, sex: 'masculino', activityLevel: 'moderado', bmiCategory: 'normal' };

/** Participante con los consentimientos y los datos para calcular sus calorías. */
async function withNutrition(ctx, patch = {}) {
  const participant = await ctx.register();
  await participant.api.post('/api/consents').send({ purpose: 'datos_nutricionales', granted: true, policyVersion: POLICY });
  const saved = await participant.api.put('/api/profiles/me').send({ ...PROFILE, age: 30, sexParam: 'masculino', weightKg: 80, heightCm: 180, activityLevel: 'moderado', ...patch });
  if (saved.status !== 200) throw new Error(`perfil falló: ${JSON.stringify(saved.body)}`);
  return participant;
}

describe('Calorías objetivo: déficit, mantenimiento y superávit (RF003)', () => {
  test('el objetivo fija el porcentaje sobre el mantenimiento (Mifflin-St Jeor × actividad)', () => {
    const maintenance = Math.round(1780 * 1.55);
    const [deficit, keep, surplus] = ['bajar', 'mantener', 'subir'].map(objective => energyTarget(RULES, { ...MAN, objective }));
    assert.deepEqual([deficit.maintenanceKcal, keep.maintenanceKcal, surplus.maintenanceKcal], [maintenance, maintenance, maintenance]);
    assert.deepEqual([deficit.targetKcal, keep.targetKcal, surplus.targetKcal], [2200, 2750, 3050]);
    assert.deepEqual([deficit.label, keep.label, surplus.label], ['déficit', 'mantenimiento', 'superávit']);
    assert.deepEqual([deficit.adjustmentPercent, surplus.adjustmentPercent], [-20, 10]);
  });

  test('el déficit tiene tope, no se baja del mínimo por sexo y con bajo peso u obesidad se usa el mantenimiento', () => {
    const big = energyTarget(RULES, { weightKg: 120, heightCm: 190, age: 30, sex: 'masculino', activityLevel: 'intenso', objective: 'bajar', bmiCategory: 'obesidad' });
    assert.equal(big.maintenanceKcal - big.targetKcal <= 750, true);
    assert.deepEqual(big.notices.map(notice => notice.code), ['deficit_capped']);
    const small = energyTarget(RULES, { weightKg: 50, heightCm: 160, age: 25, sex: 'femenino', activityLevel: 'sedentario', objective: 'bajar', bmiCategory: 'normal' });
    assert.equal(small.targetKcal, 1200);
    assert.deepEqual(small.notices.map(notice => notice.code), ['minimum_applied']);
    const underweight = energyTarget(RULES, { ...MAN, weightKg: 50, objective: 'bajar', bmiCategory: 'bajo_peso' });
    assert.deepEqual([underweight.effectiveObjective, underweight.label, underweight.targetKcal], ['mantener', 'mantenimiento', Math.round(underweight.maintenanceKcal / 50) * 50]);
    assert.match(underweight.notices[0].text, /no se recomienda comer en déficit/);
    const obese = energyTarget(RULES, { ...MAN, weightKg: 110, objective: 'subir', bmiCategory: 'obesidad' });
    assert.equal(obese.effectiveObjective, 'mantener');
  });

  test('los gramos se redondean a valores prácticos y se muestran en medidas caseras', () => {
    assert.deepEqual([roundGrams(4.4), roundGrams(12.6), roundGrams(23), roundGrams(118)], [4, 13, 25, 120]);
    assert.equal(householdMeasure(60, 'rebanada', 30), '≈ 2 rebanadas');
    assert.equal(householdMeasure(35, 'unidad', 140), '≈ ¼ unidad');
    assert.equal(householdMeasure(75, 'unidad', 50), '≈ 1½ unidades');
    assert.equal(householdMeasure(10, 'unidad', 1.2), '≈ 8 unidades');
    assert.equal(householdMeasure(150, 'unidad mediana', 150), '≈ 1 unidad mediana');
    assert.equal(householdMeasure(100, null, null), null);
  });
});

describe('Pautas de alimentación de 7 días aprobadas por la nutricionista (RF005)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('se ofrecen las cuatro dietas con sus macronutrientes; sin datos se ven porciones de referencia', async () => {
    const participant = await ctx.register();
    await participant.api.put('/api/profiles/me').send(PROFILE);
    const body = (await participant.api.get('/api/meal-plans')).body;
    assert.deepEqual(body.plans.map(plan => plan.diet), ['mediterranea', 'alta_proteina', 'baja_carbohidratos', 'vegetariana']);
    for (const plan of body.plans) {
      assert.ok(Math.abs(plan.average.kcal - 2000) <= 30, `${plan.diet}: ${plan.average.kcal} kcal`);
      const { protein, carbs, fat } = plan.average.percent;
      assert.ok(Math.abs(protein + carbs + fat - 100) <= 2);
    }
    const percent = diet => body.plans.find(plan => plan.diet === diet).average.percent;
    assert.ok(percent('alta_proteina').protein >= 30, 'alta en proteína: 30 % o más de la energía');
    assert.ok(percent('baja_carbohidratos').carbs <= 30, 'baja en carbohidratos: 30 % o menos');
    assert.ok(percent('mediterranea').fat >= 30, 'mediterránea: rica en grasas saludables');
    assert.equal(body.target, null);
    assert.equal(body.objectiveLabel, 'déficit');
    assert.deepEqual(body.notices.map(notice => notice.code), ['nutrition_data_missing']);
    assert.match(body.disclaimer, /no reemplaza una evaluación individual/);
  });

  test('cada pauta trae 7 días con 5 comidas que combinan carbohidratos, proteínas y grasas, en gramos y medidas caseras', async () => {
    const participant = await withNutrition(ctx);
    const { plans } = (await participant.api.get('/api/meal-plans')).body;
    const before = (await ctx.db.query("SELECT count(*)::int AS n FROM usage_events WHERE event_type = 'pauta_consultada'")).rows[0].n;
    for (const plan of plans) {
      const detail = (await participant.api.get(`/api/meal-plans/${plan.id}`)).body;
      assert.deepEqual(detail.days.map(day => day.dayLabel), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']);
      for (const day of detail.days) {
        const where = `${plan.diet} ${day.dayLabel}`;
        assert.deepEqual(day.meals.map(meal => meal.label), ['Desayuno', 'Colación', 'Almuerzo', 'Once', 'Cena'], where);
        for (const meal of day.meals) {
          assert.ok(meal.totals.protein > 0 && meal.totals.carbs > 0 && meal.totals.fat > 0, `${where} ${meal.label}: carbohidratos, proteínas y grasas`);
          assert.ok(meal.items.every(item => Number.isInteger(item.grams) && item.grams > 0 && item.kcal >= 0 && item.name), `${where} ${meal.label}: gramos enteros`);
        }
        for (const main of day.meals.filter(meal => ['desayuno', 'almuerzo', 'cena'].includes(meal.meal))) assert.ok(main.totals.protein >= 10, `${where} ${main.label}: proteína suficiente`);
      }
      const eggs = detail.days.flatMap(day => day.meals.flatMap(meal => meal.items.filter(item => item.code === 'huevo')));
      assert.ok(eggs.every(item => item.grams % 50 === 0), `${plan.diet}: los huevos van en unidades enteras`);
      assert.ok(detail.days[0].meals[0].items.some(item => item.household?.startsWith('≈')), 'con medidas caseras');
    }
    assert.equal((await ctx.db.query("SELECT count(*)::int AS n FROM usage_events WHERE event_type = 'pauta_consultada'")).rows[0].n, before + plans.length);
  });

  test('déficit, mantenimiento y superávit ajustan los gramos a las calorías de cada objetivo', async () => {
    const results = {};
    for (const objective of ['bajar', 'mantener', 'subir']) {
      const participant = await withNutrition(ctx, { objective });
      const list = (await participant.api.get('/api/meal-plans')).body;
      const plan = list.plans.find(item => item.diet === 'alta_proteina');
      results[objective] = (await participant.api.get(`/api/meal-plans/${plan.id}`)).body;
    }
    assert.deepEqual(['bajar', 'mantener', 'subir'].map(objective => [results[objective].kcal, results[objective].target.label]), [[2200, 'déficit'], [2750, 'mantenimiento'], [3050, 'superávit']]);
    for (const result of Object.values(results)) {
      assert.equal(result.personalized, true);
      for (const day of result.days) assert.ok(Math.abs(day.totals.kcal - result.kcal) <= 60, `${day.dayLabel}: ${day.totals.kcal} kcal de ${result.kcal}`);
    }
    const chicken = result => result.days[0].meals.find(meal => meal.meal === 'almuerzo').items.find(item => item.code === 'pechuga-de-pollo').grams;
    assert.ok(chicken(results.bajar) < chicken(results.mantener) && chicken(results.mantener) < chicken(results.subir), 'más gramos con más calorías');
    const lettuce = result => result.days[0].meals.find(meal => meal.meal === 'cena').items.find(item => item.code === 'lechuga')?.grams;
    assert.equal(lettuce(results.bajar), lettuce(results.subir), 'las verduras no se recortan');
  });

  test('con bajo peso no se muestra déficit, y revocar el consentimiento vuelve a las porciones de referencia', async () => {
    const thin = await withNutrition(ctx, { objective: 'bajar', weightKg: 50, heightCm: 180 });
    const list = (await thin.api.get('/api/meal-plans')).body;
    assert.deepEqual([list.target.effectiveObjective, list.objectiveLabel], ['mantener', 'mantenimiento']);
    assert.deepEqual(list.notices.map(notice => notice.code), ['objective_adjusted']);
    await thin.api.post('/api/consents').send({ purpose: 'datos_nutricionales', granted: false, policyVersion: POLICY });
    const after = (await thin.api.get(`/api/meal-plans/${list.plans[0].id}`)).body;
    assert.deepEqual([after.personalized, after.kcal, after.target], [false, 2000, null]);
    assert.deepEqual(after.notices.map(notice => notice.code), ['nutrition_data_missing']);
  });

  test('si no tienes un alimento lo cambias por uno aprobado del mismo grupo de la pauta, con la misma energía, y puedes volver al original', async () => {
    const participant = await withNutrition(ctx);
    const plan = (await participant.api.get('/api/meal-plans')).body.plans.find(item => item.diet === 'mediterranea');
    const alternatives = query => participant.api.get(`/api/meal-plans/${plan.id}/alternatives`).query(query);
    const fish = (await alternatives({ dayNo: 1, meal: 'cena', position: 1 })).body;
    assert.deepEqual([fish.item.current.code, fish.item.original, fish.item.mealLabel, fish.sameFoodCount], ['merluza', null, 'Cena', 2]);
    const codes = fish.alternatives.map(item => item.code);
    assert.ok(codes.includes('salmon') && codes.includes('huevo'), 'otras proteínas de la pauta');
    assert.ok(!codes.includes('merluza') && !codes.includes('tofu') && !codes.includes('papa'), 'ni el mismo alimento, ni uno que la pauta no usa, ni otro grupo');
    assert.equal(fish.alternatives[0].usual, true, 'primero los que la pauta usa en esa comida');
    const salmon = fish.alternatives.find(item => item.code === 'salmon');
    assert.ok(Math.abs(salmon.kcal - fish.item.current.kcal) <= 15 && salmon.grams < fish.item.current.grams, `misma energía, menos gramos: ${salmon.grams} g de salmón por ${fish.item.current.grams} g de merluza`);
    const lettuce = (await alternatives({ dayNo: 1, meal: 'almuerzo', position: 3 })).body;
    assert.ok(!lettuce.alternatives.some(item => item.code === 'tomate'), 'no ofrece lo que ya está en esa comida');
    assert.equal(lettuce.alternatives.find(item => item.code === 'pepino').grams, lettuce.item.current.grams, 'las verduras conservan sus gramos');

    const swapped = await participant.api.put(`/api/meal-plans/${plan.id}/swaps`).send({ dayNo: 1, meal: 'cena', position: 1, food: 'salmon' });
    assert.equal(swapped.status, 200);
    const dinner = body => body.days[0].meals.find(meal => meal.meal === 'cena').items[0];
    assert.deepEqual([swapped.body.changed, swapped.body.swaps, dinner(swapped.body).code, dinner(swapped.body).swappedFrom.code], [1, 1, 'salmon', 'merluza']);
    assert.ok(Math.abs(swapped.body.days[0].totals.kcal - swapped.body.kcal) <= 60, 'el día mantiene sus calorías');
    const reloaded = (await participant.api.get(`/api/meal-plans/${plan.id}`)).body;
    assert.equal(dinner(reloaded).code, 'salmon', 'el cambio queda guardado');
    assert.equal((await alternatives({ dayNo: 1, meal: 'cena', position: 1 })).body.item.original.code, 'merluza');
    const other = await withNutrition(ctx);
    assert.equal(dinner((await other.api.get(`/api/meal-plans/${plan.id}`)).body).code, 'merluza', 'solo cambia la pauta de quien lo pidió');

    const restored = (await participant.api.put(`/api/meal-plans/${plan.id}/swaps`).send({ dayNo: 1, meal: 'cena', position: 1, food: 'merluza' })).body;
    assert.deepEqual([restored.changed, restored.swaps, dinner(restored).code, dinner(restored).swappedFrom], [1, 0, 'merluza', undefined]);

    const swap = patch => participant.api.put(`/api/meal-plans/${plan.id}/swaps`).send({ dayNo: 1, meal: 'cena', position: 1, food: 'salmon', ...patch });
    assert.equal((await swap({ food: 'tofu' })).body.error.code, 'INVALID_SWAP', 'un alimento que esta pauta no usa');
    assert.equal((await swap({ food: 'papa' })).body.error.code, 'INVALID_SWAP', 'otro grupo');
    assert.equal((await swap({ position: 2, food: 'arroz-integral' })).status, 200, 'la papa de la cena por arroz');
    assert.equal((await swap({ position: 9 })).body.error.code, 'ITEM_NOT_FOUND');
    assert.equal((await swap({ dayNo: 8 })).body.error.code, 'INVALID_ITEM');
    assert.equal((await swap({ wholeWeek: 'sí' })).body.error.code, 'INVALID_SWAP');
    assert.equal((await (await ctx.demo('nutritionist')).put(`/api/meal-plans/${plan.id}/swaps`).send({ dayNo: 1, meal: 'cena', position: 1, food: 'salmon' })).status, 403);
  });

  test('cambiar un alimento en toda la semana lo reemplaza en todas sus comidas; se exporta con los datos y se deshace de una vez', async () => {
    const participant = await withNutrition(ctx);
    const plan = (await participant.api.get('/api/meal-plans')).body.plans.find(item => item.diet === 'mediterranea');
    const week = (await participant.api.put(`/api/meal-plans/${plan.id}/swaps`).send({ dayNo: 1, meal: 'cena', position: 1, food: 'salmon', wholeWeek: true })).body;
    const items = body => body.days.flatMap(day => day.meals.flatMap(meal => meal.items));
    assert.deepEqual([week.changed, week.swaps], [2, 2]);
    assert.ok(!items(week).some(item => item.code === 'merluza'), 'ya no queda merluza en la semana');
    assert.equal(items(week).filter(item => item.swappedFrom?.code === 'merluza').length, 2);
    const exported = await exportUserData(ctx.db, participant.user.id);
    assert.deepEqual(exported.mealSwaps.map(row => [row.dayNo, row.meal, row.replaced, row.food]), [[1, 'cena', 'Merluza al horno', 'Salmón al horno'], [6, 'almuerzo', 'Merluza al horno', 'Salmón al horno']]);
    const reset = (await participant.api.delete(`/api/meal-plans/${plan.id}/swaps`)).body;
    assert.deepEqual([reset.changed, reset.swaps], [2, 0]);
    assert.equal(items(reset).filter(item => item.code === 'merluza').length, 2);
  });

  test('un borrador no es visible y solo las personas participantes ven pautas', async () => {
    const participant = await ctx.register();
    const draft = (await ctx.db.query("SELECT id FROM meal_plan_templates WHERE status = 'draft'")).rows[0];
    assert.equal((await participant.api.get(`/api/meal-plans/${draft.id}`)).status, 404);
    assert.equal((await participant.api.get('/api/meal-plans/no-es-un-uuid')).status, 404);
    assert.equal((await participant.api.get('/api/meal-plans')).body.notices[0].code, 'profile_missing');
    assert.equal((await (await ctx.demo('trainer')).get('/api/meal-plans')).status, 403);
    assert.equal((await ctx.http.get('/api/meal-plans')).status, 401);
  });
});

describe('Catálogo nutricional: la nutricionista aprueba una vez, para todas las personas (RF005, RF006)', () => {
  let ctx;
  let nutritionist;
  before(async () => { ctx = await createContext(); nutritionist = await ctx.demo('nutritionist'); });
  after(() => ctx.close());

  const FOOD = { code: 'mote-con-huesillo', name: 'Mote con huesillo', category: 'frutas', kcal100g: 90, protein100g: 1, carbs100g: 21, fat100g: 0.2, unitName: 'vaso', unitGrams: 250 };

  test('un alimento nace en borrador; solo la nutricionista lo crea, aprueba o retira', async () => {
    const trainer = await ctx.demo('trainer');
    assert.equal((await trainer.post('/api/catalog/foods').send(FOOD)).status, 403);
    assert.equal((await trainer.get('/api/catalog/foods')).status, 200, 'el preparador puede leer');
    const check = async (patch, code) => assert.equal((await nutritionist.post('/api/catalog/foods').send({ ...FOOD, ...patch })).body.error.code, code, JSON.stringify(patch));
    await check({ category: 'snacks' }, 'INVALID_CATEGORY');
    await check({ protein100g: 50, carbs100g: 50, fat100g: 10 }, 'INVALID_COMPOSITION');
    await check({ kcal100g: 1000 }, 'INVALID_COMPOSITION');
    await check({ unitGrams: null }, 'INVALID_UNIT');
    await check({ code: 'Mote' }, 'INVALID_FOOD');
    const created = await nutritionist.post('/api/catalog/foods').send(FOOD);
    assert.equal(created.status, 201);
    assert.equal(created.body.food.status, 'draft');
    assert.equal((await nutritionist.post('/api/catalog/foods').send(FOOD)).body.error.code, 'CODE_TAKEN');
    assert.equal((await nutritionist.post(`/api/catalog/foods/${created.body.food.id}/approve`)).status, 200);
    assert.equal((await nutritionist.post(`/api/catalog/foods/${created.body.food.id}/retire`)).status, 200);
    const rice = (await nutritionist.get('/api/catalog/foods')).body.foods.find(food => food.code === 'arroz-blanco');
    const blocked = await nutritionist.post(`/api/catalog/foods/${rice.id}/retire`);
    assert.equal(blocked.body.error.code, 'FOOD_IN_USE', 'lo usan pautas vigentes');
  });

  test('una pauta con alimentos sin aprobar no se aprueba; al aprobarla, la versión anterior queda retirada', async () => {
    const plans = (await nutritionist.get('/api/catalog/meal-plans')).body.mealPlans.filter(plan => plan.code === mealPlanCode('mediterranea'));
    assert.deepEqual(plans.map(plan => [plan.version, plan.status]), [[2, 'draft'], [1, 'approved']]);
    const draft = plans[0];
    assert.deepEqual((await nutritionist.get(`/api/catalog/meal-plans/${draft.id}`)).body.mealPlan.pendingFoods, ['mote']);
    const blocked = await nutritionist.post(`/api/catalog/meal-plans/${draft.id}/approve`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.code, 'FOODS_NOT_APPROVED');
    const mote = (await nutritionist.get('/api/catalog/foods')).body.foods.find(food => food.code === 'mote');
    await nutritionist.post(`/api/catalog/foods/${mote.id}/approve`);
    assert.equal((await nutritionist.post(`/api/catalog/meal-plans/${draft.id}/approve`)).status, 200);
    const after = (await nutritionist.get('/api/catalog/meal-plans')).body.mealPlans.filter(plan => plan.code === mealPlanCode('mediterranea'));
    assert.deepEqual(after.map(plan => [plan.version, plan.status]), [[2, 'approved'], [1, 'retired']]);
    const participant = await ctx.register();
    const visible = (await participant.api.get('/api/meal-plans')).body.plans.find(plan => plan.diet === 'mediterranea');
    assert.equal(visible.version, 2, 'las personas ven la versión vigente');
    await assert.rejects(ctx.db.query("UPDATE meal_plan_items SET grams = 999 WHERE template_id = $1", [draft.id]), /ya no es borrador/);
  });

  test('valida la pauta: 7 días con sus 5 comidas, alimentos existentes y gramos', async () => {
    const source = (await nutritionist.get('/api/catalog/meal-plans')).body.mealPlans.find(plan => plan.diet === 'vegetariana');
    const detail = (await nutritionist.get(`/api/catalog/meal-plans/${source.id}`)).body.mealPlan;
    const days = detail.days.map(day => ({ dayNo: day.dayNo, meals: Object.fromEntries(day.meals.map(meal => [meal.meal, meal.items.map(item => ({ food: item.code, grams: item.grams }))])) }));
    const valid = { code: 'pauta-vegetariana', name: 'Vegetariana', summary: 'Versión 2.', diet: 'vegetariana', referenceKcal: 1800, days };
    const check = async (patch, code) => assert.equal((await nutritionist.post('/api/catalog/meal-plans').send({ ...valid, ...patch })).body.error.code, code, Object.keys(patch).join());
    await check({ diet: 'cetogenica' }, 'INVALID_DIET');
    await check({ referenceKcal: 900 }, 'INVALID_REFERENCE_KCAL');
    await check({ days: days.slice(0, 6) }, 'INVALID_DAYS');
    await check({ days: [{ ...days[0], meals: { ...days[0].meals, cena: undefined } }, ...days.slice(1)] }, 'INVALID_MEALS');
    await check({ days: [{ ...days[0], meals: { ...days[0].meals, merienda: [{ food: 'manzana', grams: 100 }] } }, ...days.slice(1)] }, 'INVALID_MEALS');
    await check({ days: [{ ...days[0], meals: { ...days[0].meals, cena: [{ food: 'manzana', grams: 0 }] } }, ...days.slice(1)] }, 'INVALID_GRAMS');
    await check({ days: [{ ...days[0], meals: { ...days[0].meals, cena: [{ food: 'no-existe', grams: 100 }] } }, ...days.slice(1)] }, 'UNKNOWN_FOOD');
    assert.equal((await (await ctx.demo('trainer')).post('/api/catalog/meal-plans').send(valid)).status, 403);
    const created = await nutritionist.post('/api/catalog/meal-plans').send(valid);
    assert.equal(created.status, 201);
    assert.deepEqual([created.body.mealPlan.version, created.body.mealPlan.status, created.body.mealPlan.referenceKcal], [2, 'draft', 1800]);
  });

  test('las reglas nutricionales se validan, solo la nutricionista las aprueba y cambian las calorías sin tocar el código', async () => {
    const check = async (content, code = 'INVALID_RULES') => assert.equal((await nutritionist.post('/api/catalog/rules').send({ domain: 'nutricion', content })).body.error.code, code, JSON.stringify(content).slice(0, 80));
    await check({ ...NUTRITION_RULES, activityFactors: { moderado: 1.55 } });
    await check({ ...NUTRITION_RULES, objectiveAdjustments: { bajar: -50, mantener: 0, subir: 10 } });
    await check({ ...NUTRITION_RULES, objectiveAdjustments: { bajar: -20, mantener: 0, subir: -5 } });
    await check({ ...NUTRITION_RULES, minimumKcal: { femenino: 800, masculino: 1500 } });
    await check({ ...NUTRITION_RULES, maxDeficitKcal: 5000 });
    await check({ ...NUTRITION_RULES, safety: { adjustObjective: { delgado: { bajar: 'mantener' } } } });
    const trainer = await ctx.demo('trainer');
    assert.equal((await trainer.post('/api/catalog/rules').send({ domain: 'nutricion', content: NUTRITION_RULES })).status, 403);
    const participant = await withNutrition(ctx, { objective: 'bajar' });
    assert.equal((await participant.api.get('/api/meal-plans')).body.target.targetKcal, 2200);
    const gentler = await nutritionist.post('/api/catalog/rules').send({ domain: 'nutricion', content: { ...NUTRITION_RULES, objectiveAdjustments: { bajar: -10, mantener: 0, subir: 10 } }, changeNote: 'Déficit más suave' });
    assert.equal(gentler.status, 201);
    assert.equal((await trainer.post(`/api/catalog/rules/${gentler.body.rules.id}/approve`)).status, 403);
    assert.equal((await nutritionist.post(`/api/catalog/rules/${gentler.body.rules.id}/approve`)).status, 200);
    const { target } = (await participant.api.get('/api/meal-plans')).body;
    assert.deepEqual([target.targetKcal, target.adjustmentPercent, target.rulesVersion], [2500, -10, 2], '2.759 kcal − 10 %');
  });
});
