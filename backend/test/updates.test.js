import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, participantWithProfile, POLICY, PROFILE } from './helpers.js';
import { mealPlanCode, templateCode } from '../src/seed/demo.js';
import { ROUTINE_NOTICES } from '../src/modules/catalog.js';
import { runMaintenance } from '../src/modules/admin.js';

const notices = async (person, type) => (await person.api.get('/api/notifications/me')).body.notifications.filter(item => item.type === type);

describe('Contenido aprobado que cambia después de que la persona lo eligió (observación F2)', () => {
  let ctx;
  let trainer;
  before(async () => { ctx = await createContext(); trainer = await ctx.demo('trainer'); });
  after(() => ctx.close());

  /** Participante que inicia una rutina aprobada concreta del catálogo, en lunes, miércoles y viernes. */
  async function following(code) {
    const participant = await participantWithProfile(ctx);
    const template = (await trainer.get('/api/catalog/templates')).body.templates.find(item => item.code === code && item.status === 'approved');
    const started = await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: template.id, days: [1, 3, 5] });
    assert.equal(started.status, 201, JSON.stringify(started.body));
    return { participant, template };
  }

  test('una versión nueva no cambia la rutina de quien ya la sigue: se le avisa y decide si la actualiza', async () => {
    const code = templateCode('mantener', 'principiante', 'sin_equipo', 'normal', 'full_body');
    const { participant, template: v1 } = await following(code);
    const bystander = (await following(templateCode('bajar', 'principiante', 'sin_equipo', 'general', 'full_body'))).participant;
    const v2 = (await trainer.get('/api/catalog/templates')).body.templates.find(item => item.code === code && item.status === 'draft');
    assert.equal((await trainer.post(`/api/catalog/templates/${v2.id}/approve`)).status, 200);

    const [notice] = await notices(participant, 'rutina_actualizada');
    assert.equal(notice?.message, ROUTINE_NOTICES.newVersion);
    assert.ok(!/IMC|normal|obesidad|sobrepeso/i.test(notice.message), 'el aviso no nombra la rutina: su nombre puede revelar la categoría de IMC');
    assert.equal((await notices(bystander, 'rutina_actualizada')).length, 0, 'solo se avisa a quien sigue esa rutina');
    const audited = (await ctx.db.query("SELECT detail FROM audit_log WHERE action = 'template.approved' AND entity_id = $1", [v2.id])).rows[0];
    assert.equal(audited.detail.notified, 1);

    const before = (await participant.api.get('/api/plans/me')).body.plan;
    assert.equal(before.template.version, v1.version, 'la rutina sigue siendo la copia que eligió');
    assert.deepEqual(before.templateUpdate, { kind: 'nueva_version', templateId: v2.id, version: v2.version, minDays: v2.minDays, maxDays: v2.maxDays, fitsDays: true });

    const updated = await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: before.templateUpdate.templateId, days: before.days });
    assert.equal(updated.status, 201, JSON.stringify(updated.body));
    const after = (await participant.api.get('/api/plans/me')).body.plan;
    assert.deepEqual([after.template.version, after.templateUpdate, after.days], [v2.version, null, before.days]);
    const history = (await participant.api.get('/api/plans/me/history')).body.plans;
    assert.deepEqual(history.map(plan => plan.status), ['vigente', 'reemplazado'], 'la versión anterior queda en el historial');
  });

  test('si el preparador retira la rutina, quien la sigue lo sabe y puede terminarla o elegir otra', async () => {
    const { participant, template } = await following(templateCode('subir', 'principiante', 'con_equipo', 'general', 'full_body'));
    assert.equal((await trainer.post(`/api/catalog/templates/${template.id}/retire`)).status, 200);
    assert.deepEqual((await notices(participant, 'rutina_actualizada')).map(item => item.message), [ROUTINE_NOTICES.retired]);
    const plan = (await participant.api.get('/api/plans/me')).body.plan;
    assert.deepEqual([plan.status, plan.templateUpdate], ['vigente', { kind: 'retirada' }]);
  });
});

describe('Pautas: una versión nueva conserva los cambios de alimentos que siguen siendo válidos', () => {
  let ctx;
  let nutritionist;
  before(async () => { ctx = await createContext(); nutritionist = await ctx.demo('nutritionist'); });
  after(() => ctx.close());

  test('al aprobar la versión nueva se trasladan los cambios válidos y se avisa', async () => {
    const participant = await ctx.register();
    await participant.api.post('/api/consents').send({ purpose: 'datos_nutricionales', granted: true, policyVersion: POLICY });
    await participant.api.put('/api/profiles/me').send({ ...PROFILE, sexParam: 'masculino', weightKg: 80, heightCm: 180, activityLevel: 'moderado' });
    const v1 = (await participant.api.get('/api/meal-plans')).body.plans.find(item => item.diet === 'mediterranea');
    const swap = await participant.api.put(`/api/meal-plans/${v1.id}/swaps`).send({ dayNo: 1, meal: 'cena', position: 1, food: 'salmon' });
    assert.equal(swap.status, 200, JSON.stringify(swap.body));

    const plans = (await nutritionist.get('/api/catalog/meal-plans')).body.mealPlans.filter(plan => plan.code === mealPlanCode('mediterranea'));
    const draft = plans.find(plan => plan.status === 'draft');
    const mote = (await nutritionist.get('/api/catalog/foods')).body.foods.find(food => food.code === 'mote');
    await nutritionist.post(`/api/catalog/foods/${mote.id}/approve`);
    assert.equal((await nutritionist.post(`/api/catalog/meal-plans/${draft.id}/approve`)).status, 200);

    const v2 = (await participant.api.get(`/api/meal-plans/${draft.id}`)).body;
    const dinner = v2.days[0].meals.find(meal => meal.meal === 'cena').items[0];
    assert.deepEqual([dinner.code, dinner.swappedFrom?.code], ['salmon', 'merluza'], 'el cambio sigue en la versión nueva');
    assert.deepEqual((await notices(participant, 'pauta_actualizada')).map(item => item.message), ['La nutricionista actualizó la pauta «Mediterránea». Tus cambios de alimentos se mantienen.']);
    const audited = (await ctx.db.query("SELECT detail FROM audit_log WHERE action = 'meal_plan.approved' AND entity_id = $1", [draft.id])).rows[0];
    assert.deepEqual(audited.detail.swaps, { users: 1, kept: 1, dropped: 0 });
  });
});

describe('Interruptor de la alimentación (RF005) y trazabilidad del perfil', () => {
  test('con la alimentación apagada la app la oculta y la API no entrega pautas ni calorías; el catálogo se conserva', async () => {
    const ctx = await createContext({ config: { features: { nutrition: false } } });
    try {
      assert.deepEqual((await ctx.http.get('/api/features')).body, { features: { nutrition: false } });
      const participant = await ctx.register();
      for (const url of ['/api/meal-plans', '/api/estimates/energy']) {
        const response = await participant.api.get(url);
        assert.deepEqual([response.status, response.body.error.code], [503, 'FEATURE_DISABLED'], url);
      }
      assert.equal((await (await ctx.demo('nutritionist')).get('/api/catalog/meal-plans')).status, 200, 'la nutricionista sigue viendo su catálogo');
    } finally {
      await ctx.close();
    }
  });

  test('la bitácora registra qué grupos del perfil cambiaron, sin sus valores', async () => {
    const ctx = await createContext();
    try {
      const participant = await participantWithProfile(ctx);
      await participant.api.put('/api/profiles/me').send({ ...PROFILE, objective: 'mantener', weightKg: 77.4, heightCm: 171 });
      const rows = (await ctx.db.query("SELECT detail FROM audit_log WHERE action = 'profile.updated' AND actor_id = $1 ORDER BY id", [participant.user.id])).rows;
      assert.deepEqual(rows.map(row => row.detail.changed), [['perfil_inicial'], ['objetivo', 'datos_corporales']]);
      assert.ok(!JSON.stringify(rows).includes('77'), 'la bitácora no guarda el peso');
      assert.equal((await runMaintenance(ctx.app.context)).skipped, undefined, 'una sola instancia ejecuta el mantenimiento');
    } finally {
      await ctx.close();
    }
  });
});
