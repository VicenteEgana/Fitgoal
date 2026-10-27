import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, POLICY, PROFILE } from './helpers.js';
import { restingEnergy } from '../src/modules/estimates.js';

describe('Perfil, objetivo y disponibilidad (RF001, RF002, OE-a)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('guarda el perfil como versión 1 y cada cambio crea una versión nueva', async () => {
    const participant = await ctx.register();
    assert.equal((await participant.api.get('/api/profiles/me')).body.profile, null);
    const first = await participant.api.put('/api/profiles/me').send({ ...PROFILE, days: [5, 1, 3] });
    assert.equal(first.status, 200);
    assert.equal(first.body.profile.version, 1);
    assert.deepEqual(first.body.profile.days, [1, 3, 5], 'los días se guardan ordenados');
    const second = await participant.api.put('/api/profiles/me').send({ ...PROFILE, objective: 'subir' });
    assert.equal(second.body.profile.version, 2);
    assert.equal((await participant.api.get('/api/profiles/me')).body.profile.objective, 'subir');
    assert.deepEqual((await participant.api.get('/api/profiles/me/versions')).body.versions.map(item => item.version), [2, 1]);
  });

  test('rechaza valores fuera de las reglas con el código del campo afectado', async () => {
    const participant = await ctx.register();
    const cases = [
      [{ age: 17 }, 'INVALID_AGE'], [{ age: 121 }, 'INVALID_AGE'], [{ age: 30.5 }, 'INVALID_AGE'],
      [{ objective: 'volar' }, 'INVALID_OBJECTIVE'], [{ level: 'intermedio' }, 'INVALID_LEVEL'], [{ equipment: 'gimnasio' }, 'INVALID_EQUIPMENT'],
      [{ durationMinutes: 25 }, 'INVALID_DURATION'], [{ days: [] }, 'INVALID_DAYS'], [{ days: [1, 1] }, 'INVALID_DAYS'],
      [{ days: [0, 2] }, 'INVALID_DAYS'], [{ days: [1, 8] }, 'INVALID_DAYS'], [{ days: [1, 2, 3, 4, 5, 6, 7, 1] }, 'INVALID_DAYS'], [{ name: 'Ana' }, 'UNKNOWN_FIELD'],
    ];
    for (const [patch, code] of cases) {
      const response = await participant.api.put('/api/profiles/me').send({ ...PROFILE, ...patch });
      assert.equal(response.status, 400, JSON.stringify(patch));
      assert.equal(response.body.error.code, code, JSON.stringify(patch));
    }
    assert.equal((await participant.api.get('/api/profiles/me')).body.profile, null, 'ninguna escritura inválida deja datos');
  });

  test('acepta los siete días y las cuatro duraciones del catálogo', async () => {
    const participant = await ctx.register();
    for (const durationMinutes of [20, 30, 45, 60]) assert.equal((await participant.api.put('/api/profiles/me').send({ ...PROFILE, durationMinutes, days: [1, 2, 3, 4, 5, 6, 7] })).status, 200);
  });

  test('la estatura y el peso son datos normales del perfil: se guardan con su consentimiento y calculan el IMC', async () => {
    const participant = await ctx.register({ fictitious: false });
    const saved = await participant.api.put('/api/profiles/me').send({ ...PROFILE, weightKg: 70.5, heightCm: 172 });
    assert.equal(saved.status, 200);
    assert.deepEqual([saved.body.profile.weightKg, saved.body.profile.heightCm, saved.body.profile.bmi, saved.body.profile.bmiCategory], [70.5, 172, 23.8, 'normal']);
    assert.equal((await participant.api.get('/api/profiles/me')).body.profile.bmi, 23.8);
    const without = await participant.api.put('/api/profiles/me').send(PROFILE);
    assert.deepEqual([without.body.profile.weightKg, without.body.profile.bmi, without.body.profile.bmiCategory], [null, null, null], 'son opcionales');
  });

  test('sin el consentimiento específico no se guardan la estatura ni el peso', async () => {
    const participant = await ctx.register({ consents: { registro_cuenta: true, perfil_entrenamiento: true } });
    const refused = await participant.api.put('/api/profiles/me').send({ ...PROFILE, weightKg: 70, heightCm: 170 });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error.code, 'BODY_DATA_CONSENT_REQUIRED');
    assert.equal((await participant.api.get('/api/profiles/me')).body.profile, null, 'no se guardó nada');
    assert.equal((await participant.api.put('/api/profiles/me').send(PROFILE)).status, 200, 'el perfil sin esos datos sí se guarda');
    await participant.api.post('/api/consents').send({ purpose: 'datos_corporales', granted: true, policyVersion: 'politica-datos-2026-10-v1' });
    assert.equal((await participant.api.put('/api/profiles/me').send({ ...PROFILE, weightKg: 70, heightCm: 170 })).status, 200);
  });

  test('al revocar el consentimiento se borran la estatura y el peso de todas las versiones', async () => {
    const participant = await ctx.register();
    await participant.api.put('/api/profiles/me').send({ ...PROFILE, weightKg: 80, heightCm: 175 });
    await participant.api.put('/api/profiles/me').send({ ...PROFILE, weightKg: 79, heightCm: 175 });
    assert.equal((await participant.api.post('/api/consents').send({ purpose: 'datos_corporales', granted: false, policyVersion: 'politica-datos-2026-10-v1' })).status, 201);
    const profile = (await participant.api.get('/api/profiles/me')).body.profile;
    assert.deepEqual([profile.weightKg, profile.heightCm, profile.bmi], [null, null, null]);
    assert.equal((await ctx.db.query('SELECT 1 FROM profile_versions WHERE user_id = $1 AND (weight_kg IS NOT NULL OR height_cm IS NOT NULL)', [participant.user.id])).rowCount, 0);
  });

  test('valida la estatura y el peso: van juntos y dentro de rangos humanos', async () => {
    const participant = await ctx.register();
    const cases = [
      [{ weightKg: 70 }, 'INVALID_BODY_DATA'], [{ heightCm: 170 }, 'INVALID_BODY_DATA'],
      [{ weightKg: 29, heightCm: 170 }, 'INVALID_WEIGHT'], [{ weightKg: 301, heightCm: 170 }, 'INVALID_WEIGHT'], [{ weightKg: '70', heightCm: 170 }, 'INVALID_WEIGHT'],
      [{ weightKg: 70, heightCm: 99 }, 'INVALID_HEIGHT'], [{ weightKg: 70, heightCm: 251 }, 'INVALID_HEIGHT'],
    ];
    for (const [patch, code] of cases) {
      const response = await participant.api.put('/api/profiles/me').send({ ...PROFILE, ...patch });
      assert.equal(response.status, 400, JSON.stringify(patch));
      assert.equal(response.body.error.code, code, JSON.stringify(patch));
    }
    assert.equal((await participant.api.get('/api/profiles/me')).body.profile, null);
  });

  test('el sexo y la actividad exigen su consentimiento específico y van con la estatura y el peso', async () => {
    const real = await ctx.register({ fictitious: false });
    const data = { sexParam: 'femenino', weightKg: 60, heightCm: 165, activityLevel: 'ligero' };
    const rejected = await real.api.put('/api/profiles/me').send({ ...PROFILE, ...data });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.body.error.code, 'NUTRITION_DATA_CONSENT_REQUIRED');
    assert.equal((await real.api.put('/api/profiles/me').send({ ...PROFILE, weightKg: 60, heightCm: 165 })).status, 200, 'estatura y peso sí');
    await real.api.post('/api/consents').send({ purpose: 'datos_nutricionales', granted: true, policyVersion: POLICY });
    const accepted = await real.api.put('/api/profiles/me').send({ ...PROFILE, ...data });
    assert.equal(accepted.status, 200, 'una cuenta real también puede, con su consentimiento');
    assert.deepEqual([accepted.body.profile.sexParam, accepted.body.profile.activityLevel], ['femenino', 'ligero']);
    assert.equal((await real.api.put('/api/profiles/me').send({ ...PROFILE, sexParam: 'femenino', weightKg: 60, heightCm: 165 })).body.error.code, 'INVALID_NUTRITION_DATA');
    assert.equal((await real.api.put('/api/profiles/me').send({ ...PROFILE, sexParam: 'femenino', activityLevel: 'ligero' })).body.error.code, 'INVALID_NUTRITION_DATA', 'sin estatura ni peso');
    assert.equal((await real.api.put('/api/profiles/me').send({ ...PROFILE, ...data, sexParam: 'otro' })).body.error.code, 'INVALID_SEX');
    assert.equal((await real.api.put('/api/profiles/me').send({ ...PROFILE, ...data, activityLevel: 'extremo' })).body.error.code, 'INVALID_ACTIVITY');
  });

  test('al revocar el consentimiento nutricional se borran el sexo y la actividad, y se conservan la estatura y el peso', async () => {
    const participant = await ctx.register();
    await participant.api.post('/api/consents').send({ purpose: 'datos_nutricionales', granted: true, policyVersion: POLICY });
    await participant.api.put('/api/profiles/me').send({ ...PROFILE, sexParam: 'masculino', weightKg: 80, heightCm: 180, activityLevel: 'moderado' });
    await participant.api.post('/api/consents').send({ purpose: 'datos_nutricionales', granted: false, policyVersion: POLICY });
    const { profile } = (await participant.api.get('/api/profiles/me')).body;
    assert.deepEqual([profile.sexParam, profile.activityLevel, profile.weightKg, profile.heightCm], [null, null, 80, 180]);
    const stored = (await ctx.db.query('SELECT count(*)::int AS n FROM profile_versions WHERE user_id = $1 AND sex_param IS NOT NULL', [participant.user.id])).rows[0].n;
    assert.equal(stored, 0, 'en ninguna versión del perfil');
  });

  test('la base de datos garantiza las mismas reglas aunque se omita la API', async () => {
    const real = await ctx.register({ fictitious: false });
    const insert = values => ctx.db.query(
      `INSERT INTO profile_versions (user_id, version, age, objective, level, days, duration_minutes, equipment, ${Object.keys(values).join(', ')})
       VALUES ($1, 1, 30, 'bajar', 'principiante', '{1}', 30, 'sin_equipo', ${Object.keys(values).map((_, index) => `$${index + 2}`).join(', ')})`, [real.user.id, ...Object.values(values)]);
    await assert.rejects(insert({ sex_param: 'femenino', activity_level: 'ligero' }), /estimate_needs_body/);
    await assert.rejects(insert({ sex_param: 'femenino', weight_kg: 60, height_cm: 165 }), /estimate_needs_body/);
    await assert.rejects(insert({ weight_kg: 60 }), /body_pair/);
    await assert.rejects(insert({ weight_kg: 10, height_cm: 165 }), /weight_kg_range/);
  });

  test('un participante no puede leer ni modificar el perfil de otro', async () => {
    const a = await ctx.register();
    const b = await ctx.register();
    await a.api.put('/api/profiles/me').send(PROFILE);
    assert.equal((await b.api.get('/api/profiles/me')).body.profile, null);
  });

  test('los consentimientos se registran con versión de política y la revocación queda como un registro nuevo', async () => {
    const participant = await ctx.register();
    const initial = (await participant.api.get('/api/consents')).body;
    assert.equal(initial.policyVersion, 'politica-datos-2026-10-v1');
    assert.ok(initial.consents.find(item => item.purpose === 'recordatorios').granted);
    assert.equal((await participant.api.post('/api/consents').send({ purpose: 'recordatorios', granted: false, policyVersion: initial.policyVersion })).status, 201);
    const after = (await participant.api.get('/api/consents')).body.consents;
    assert.equal(after.find(item => item.purpose === 'recordatorios').granted, false);
    assert.equal((await ctx.db.query("SELECT count(*)::int AS n FROM consents WHERE user_id = $1 AND purpose = 'recordatorios'", [participant.user.id])).rows[0].n, 2, 'el historial se conserva');
    assert.equal((await participant.api.post('/api/consents').send({ purpose: 'registro_cuenta', granted: false, policyVersion: initial.policyVersion })).status, 400);
    assert.equal((await participant.api.post('/api/consents').send({ purpose: 'recordatorios', granted: true, policyVersion: 'otra' })).body.error.code, 'POLICY_VERSION_MISMATCH');
  });
});

describe('Estimación energética (RF003, OE-a)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('Mifflin-St Jeor da los resultados de referencia con tolerancia de redondeo de 1 kcal', () => {
    assert.equal(restingEnergy({ weightKg: 80, heightCm: 180, age: 30, sex: 'masculino' }), 1780);
    assert.equal(restingEnergy({ weightKg: 60, heightCm: 165, age: 28, sex: 'femenino' }), 1330);
    assert.ok(Math.abs(restingEnergy({ weightKg: 72.4, heightCm: 171.5, age: 41, sex: 'masculino' }) - (10 * 72.4 + 6.25 * 171.5 - 5 * 41 + 5)) <= 1);
  });

  const withNutritionData = async (patch = {}) => {
    const participant = await ctx.register({ fictitious: false });
    await participant.api.post('/api/consents').send({ purpose: 'datos_nutricionales', granted: true, policyVersion: POLICY });
    const saved = await participant.api.put('/api/profiles/me').send({ ...PROFILE, age: 30, sexParam: 'masculino', weightKg: 80, heightCm: 180, activityLevel: 'moderado', ...patch });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    return participant;
  };

  test('la estimación indica fórmula, versión, unidades, factor de actividad y ajuste por objetivo', async () => {
    const participant = await withNutritionData({ objective: 'bajar' });
    const { estimate } = (await participant.api.get('/api/estimates/energy')).body;
    assert.equal(estimate.formula.name, 'Mifflin-St Jeor');
    assert.equal(estimate.formula.version, 1);
    assert.deepEqual(estimate.units, { weight: 'kg', height: 'cm', age: 'años', energy: 'kcal/día' });
    assert.equal(estimate.restingEnergyKcal, 1780);
    assert.equal(estimate.maintenanceKcal, Math.round(1780 * 1.55));
    assert.equal(estimate.targetKcal, 2200, '2.759 kcal − 20 % = 2.207, redondeado a 50');
    assert.equal(estimate.objectiveLabel, 'déficit');
    assert.match(estimate.adjustments, /Factor de actividad 1,55 y déficit \(-20 %\) según las reglas nutricionales aprobadas v1/);
    assert.match(estimate.notice, /±10 %/);
  });

  test('sin reglas nutricionales aprobadas no se ajusta por actividad ni por objetivo', async () => {
    const bare = await createContext();
    await bare.db.query("UPDATE rule_versions SET status = 'retired' WHERE domain = 'nutricion'");
    const participant = await bare.register();
    await participant.api.post('/api/consents').send({ purpose: 'datos_nutricionales', granted: true, policyVersion: POLICY });
    await participant.api.put('/api/profiles/me').send({ ...PROFILE, age: 30, sexParam: 'masculino', weightKg: 80, heightCm: 180, activityLevel: 'moderado' });
    const { estimate } = (await participant.api.get('/api/estimates/energy')).body;
    assert.deepEqual([estimate.restingEnergyKcal, estimate.maintenanceKcal, estimate.targetKcal], [1780, null, null]);
    assert.match(estimate.adjustments, /Sin reglas nutricionales aprobadas/);
    await bare.close();
  });

  test('sin los consentimientos se rechaza y sin los datos se piden', async () => {
    const participant = await ctx.register();
    await participant.api.put('/api/profiles/me').send(PROFILE);
    const blocked = await participant.api.get('/api/estimates/energy');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'NUTRITION_DATA_CONSENT_REQUIRED');
    await participant.api.post('/api/consents').send({ purpose: 'datos_nutricionales', granted: true, policyVersion: POLICY });
    assert.equal((await participant.api.get('/api/estimates/energy')).body.error.code, 'NUTRITION_DATA_REQUIRED');
  });

});
