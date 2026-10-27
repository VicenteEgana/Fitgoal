import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, participantWithProfile } from './helpers.js';
import { templateCode } from '../src/seed/demo.js';

const NEW_EXERCISE = { code: 'sentadilla-sumo', name: 'Sentadilla sumo', description: 'Sentadilla con los pies más separados que los hombros y las puntas hacia afuera.', muscleGroup: 'piernas', minLevel: 'principiante', requiresEquipment: false, defaultPrescription: '2 series de 10 repeticiones' };

describe('Catálogo profesional: el preparador aprueba una vez, las personas reciben lo aprobado (RF005, K5)', () => {
  let ctx;
  let trainer;
  before(async () => { ctx = await createContext(); trainer = await ctx.demo('trainer'); });
  after(() => ctx.close());

  test('un ejercicio nuevo nace en borrador, no aparece en la biblioteca y se publica al aprobarlo', async () => {
    const created = await trainer.post('/api/catalog/exercises').send(NEW_EXERCISE);
    assert.equal(created.status, 201);
    assert.equal(created.body.exercise.status, 'draft');
    const participant = await ctx.register();
    const names = async () => (await participant.api.get('/api/exercises')).body.exercises.map(item => item.code);
    assert.ok(!(await names()).includes('sentadilla-sumo'), 'un borrador no es visible para las personas');
    assert.equal((await trainer.post(`/api/catalog/exercises/${created.body.exercise.id}/approve`)).status, 200);
    assert.ok((await names()).includes('sentadilla-sumo'));
    assert.equal((await trainer.post(`/api/catalog/exercises/${created.body.exercise.id}/approve`)).body.error.code, 'NOT_A_DRAFT');
    const audited = (await (await ctx.demo('admin')).get(`/api/admin/audit?entityId=${created.body.exercise.id}`)).body.events.map(event => event.action).sort();
    assert.deepEqual(audited, ['exercise.approved', 'exercise.created']);
  });

  test('valida los datos del ejercicio y solo el preparador puede crearlo o aprobarlo', async () => {
    const bad = (patch, code) => trainer.post('/api/catalog/exercises').send({ ...NEW_EXERCISE, code: 'otro', ...patch }).then(response => { assert.equal(response.body.error.code, code, JSON.stringify(patch)); });
    await bad({ muscleGroup: 'cuello' }, 'INVALID_MUSCLE_GROUP');
    await bad({ minLevel: 'experto' }, 'INVALID_LEVEL');
    await bad({ defaultPrescription: '' }, 'INVALID_PRESCRIPTION');
    await bad({ code: 'Con Espacios' }, 'INVALID_EXERCISE');
    const nutritionist = await ctx.createStaff('nutritionist');
    assert.equal((await nutritionist.api.post('/api/catalog/exercises').send(NEW_EXERCISE)).status, 403);
    assert.equal((await nutritionist.api.get('/api/catalog/exercises')).status, 200, 'la nutricionista puede leer el catálogo');
    const participant = await ctx.register();
    assert.equal((await participant.api.get('/api/catalog/exercises')).status, 403);
  });

  test('una rutina con ejercicios sin aprobar no se puede aprobar', async () => {
    const draftExercise = (await trainer.post('/api/catalog/exercises').send({ ...NEW_EXERCISE, code: 'ejercicio-pendiente', name: 'Ejercicio pendiente' })).body.exercise;
    const body = { code: 'demo-propuesta', name: 'Propuesta', summary: 'Rutina propuesta.', objective: 'mantener', level: 'principiante', equipment: 'sin_equipo', bmiCategory: 'normal', split: 'full_body', minDays: 1, maxDays: 2, sessionMinutes: 30, sessions: [{ sessionNo: 1, label: 'Cuerpo completo', exercises: [{ code: 'ejercicio-pendiente', prescription: '2 series de 8 repeticiones' }] }] };
    const created = await trainer.post('/api/catalog/templates').send(body);
    assert.equal(created.status, 201);
    const blocked = await trainer.post(`/api/catalog/templates/${created.body.template.id}/approve`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.code, 'EXERCISES_NOT_APPROVED');
    await trainer.post(`/api/catalog/exercises/${draftExercise.id}/approve`);
    assert.equal((await trainer.post(`/api/catalog/templates/${created.body.template.id}/approve`)).status, 200);
    const listed = (await trainer.get('/api/catalog/templates')).body.templates.find(item => item.id === created.body.template.id);
    assert.equal(listed.status, 'approved');
  });

  test('valida la plantilla: categoría de IMC, división, resumen, días, sesiones con nombre y ejercicios existentes', async () => {
    const valid = {
      code: 'demo-valida', name: 'Válida', summary: 'Resumen.', objective: 'bajar', level: 'principiante', equipment: 'sin_equipo', bmiCategory: 'bajo_peso', split: 'upper_lower', minDays: 2, maxDays: 4, sessionMinutes: 20,
      sessions: [{ sessionNo: 2, label: 'Tren inferior', exercises: [{ code: 'mini-sentadillas', prescription: '2 series de 10' }] }, { sessionNo: 1, label: 'Tren superior', exercises: [{ code: 'flexiones-en-pared', prescription: '2 series de 8' }] }],
    };
    const check = (patch, code) => trainer.post('/api/catalog/templates').send({ ...valid, ...patch }).then(response => { assert.equal(response.body.error.code, code, JSON.stringify(patch)); });
    await check({ bmiCategory: 'liviano' }, 'INVALID_BMI_CATEGORY');
    await check({ summary: '' }, 'INVALID_SUMMARY');
    await check({ minDays: 4, maxDays: 2 }, 'INVALID_DAYS');
    await check({ sessionMinutes: 25 }, 'INVALID_DURATION');
    await check({ sessions: [] }, 'INVALID_SESSIONS');
    await check({ split: 'brazo_pierna' }, 'INVALID_SPLIT');
    await check({ sessions: [{ sessionNo: 1, exercises: [{ code: 'caminata', prescription: '10 minutos' }] }] }, 'INVALID_SESSIONS');
    await check({ sessions: [{ sessionNo: 2, label: 'Sesión', exercises: [{ code: 'caminata', prescription: '10 minutos' }] }] }, 'INVALID_SESSIONS');
    await check({ sessions: [{ sessionNo: 1, label: 'Sesión', exercises: [{ code: 'no-existe', prescription: 'x' }] }] }, 'UNKNOWN_EXERCISE');
    const created = await trainer.post('/api/catalog/templates').send(valid);
    assert.equal(created.status, 201);
    const detail = (await trainer.get(`/api/catalog/templates/${created.body.template.id}`)).body.template;
    assert.deepEqual([detail.split, detail.sessionLabels], ['upper_lower', ['Tren superior', 'Tren inferior']], 'los nombres quedan en el orden de las sesiones');
    assert.deepEqual(detail.sessions.map(session => [session.label, session.exercises[0].code]), [['Tren superior', 'flexiones-en-pared'], ['Tren inferior', 'mini-sentadillas']]);
  });

  test('aprobar una versión nueva retira la anterior, y las personas solo ven la vigente', async () => {
    const code = templateCode('mantener', 'principiante', 'sin_equipo', 'normal', 'full_body');
    const before = (await trainer.get('/api/catalog/templates')).body.templates.filter(item => item.code === code);
    assert.deepEqual(before.map(item => [item.version, item.status]), [[2, 'draft'], [1, 'approved']]);
    const v2 = before.find(item => item.version === 2);
    assert.equal((await trainer.post(`/api/catalog/templates/${v2.id}/approve`)).status, 200);
    const after = (await trainer.get('/api/catalog/templates')).body.templates.filter(item => item.code === code);
    assert.deepEqual(after.map(item => [item.version, item.status]), [[2, 'approved'], [1, 'retired']]);
    const participant = await ctx.register();
    const visible = (await participant.api.get(`/api/routines?objective=mantener&level=principiante&equipment=sin_equipo&bmiCategory=normal`)).body.routines;
    assert.deepEqual(visible.filter(item => item.code === code).map(item => [item.code, item.version]), [[code, 2]], 'solo la versión vigente');
  });

  test('retirar una rutina la oculta de la lista; un ejercicio que usa una rutina vigente no se retira', async () => {
    const template = (await trainer.get('/api/catalog/templates')).body.templates.find(item => item.code === templateCode('subir', 'con_experiencia', 'con_equipo', 'normal', 'full_body'));
    const exercises = (await trainer.get('/api/catalog/exercises')).body.exercises;
    const inUse = exercises.find(item => item.code === 'curl-de-biceps-con-mancuernas');
    const blocked = await trainer.post(`/api/catalog/exercises/${inUse.id}/retire`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.code, 'EXERCISE_IN_USE');
    assert.equal((await trainer.post(`/api/catalog/templates/${template.id}/retire`)).status, 200);
    assert.equal((await trainer.post(`/api/catalog/templates/${template.id}/retire`)).body.error.code, 'NOT_APPROVED');
    const participant = await participantWithProfile(ctx);
    assert.equal((await participant.api.get(`/api/routines/${template.id}`)).status, 404);
  });

  test('la base de datos impide editar los ejercicios de una rutina aprobada y borrar una plantilla aprobada', async () => {
    await assert.rejects(ctx.db.query("UPDATE template_exercises SET prescription = 'otra' WHERE template_id = (SELECT id FROM routine_templates WHERE status = 'approved' LIMIT 1)"), /ya no es borrador/);
    await assert.rejects(ctx.db.query("DELETE FROM routine_templates WHERE status = 'approved'"), /Solo se pueden eliminar plantillas en borrador/);
  });
});

describe('Reglas de recomendación aprobadas por el preparador', () => {
  let ctx;
  let trainer;
  before(async () => { ctx = await createContext(); trainer = await ctx.demo('trainer'); });
  after(() => ctx.close());

  const currentContent = async () => (await trainer.get('/api/catalog/rules')).body.rules.find(item => item.domain === 'entrenamiento' && item.status === 'approved').content;

  test('valida la matriz y los grupos sugeridos', async () => {
    const content = await currentContent();
    const check = (patch, code) => trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: { ...content, ...patch } }).then(response => { assert.equal(response.body.error.code, code, JSON.stringify(patch)); });
    await check({ matrix: null }, 'INVALID_RULES');
    await check({ matrix: { bajar: { experto: {} } } }, 'INVALID_RULES');
    await check({ matrix: { bajar: { principiante: { sin_equipo: { liviano: { full_body: 'demo-x' } } } } } }, 'INVALID_RULES');
    await check({ matrix: { bajar: { principiante: { sin_equipo: { normal: 'demo-x' } } } } }, 'INVALID_RULES');
    await check({ matrix: { bajar: { principiante: { sin_equipo: { normal: {} } } } } }, 'INVALID_RULES');
    await check({ matrix: { bajar: { principiante: { sin_equipo: { normal: { bro_split: 'demo-x' } } } } } }, 'INVALID_RULES');
    await check({ splitRules: [] }, 'INVALID_RULES');
    await check({ splitRules: [{ split: 'bro_split', reason: 'x' }] }, 'INVALID_RULES');
    await check({ splitRules: [{ split: 'full_body' }] }, 'INVALID_RULES');
    await check({ splitRules: [{ split: 'full_body', reason: 'x', level: 'experto' }] }, 'INVALID_RULES');
    await check({ splitRules: [{ split: 'full_body', reason: 'x', minDays: 5, maxDays: 2 }] }, 'INVALID_RULES');
    await check({ focusGroups: { bajar: ['cardio'] } }, 'INVALID_RULES');
    await check({ focusGroups: { ...content.focusGroups, subir: ['cuello'] } }, 'INVALID_RULES');
    await check({ safety: { adjustObjective: { delgado: { bajar: 'subir' } } } }, 'INVALID_RULES');
    await check({ safety: { adjustObjective: { bajo_peso: { bajar: 'bajar' } } } }, 'INVALID_RULES');
    await check({ safety: { avoidHighImpact: ['gigante'] } }, 'INVALID_RULES');
    await check({ safety: { notices: { obesidad: '' } } }, 'INVALID_RULES');
    await check({ safety: [] }, 'INVALID_RULES');
  });

  test('no se aprueban reglas que recomiendan una rutina inexistente o de otra combinación', async () => {
    const content = await currentContent();
    const wrong = structuredClone(content);
    wrong.matrix.bajar.principiante.sin_equipo.normal.full_body = templateCode('subir', 'con_experiencia', 'con_equipo', 'normal', 'full_body');
    const created = await trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: wrong, changeNote: 'Error de ejemplo' });
    assert.equal(created.status, 201);
    const refused = await trainer.post(`/api/catalog/rules/${created.body.rules.id}/approve`);
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error.code, 'RULES_REFERENCE_INVALID');
    const missing = structuredClone(content);
    missing.matrix.bajar.principiante.sin_equipo.normal.full_body = 'demo-no-existe';
    const second = await trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: missing });
    assert.equal((await trainer.post(`/api/catalog/rules/${second.body.rules.id}/approve`)).body.error.code, 'RULES_REFERENCE_INVALID');
    const swapped = structuredClone(content);
    swapped.matrix.bajar.principiante.sin_equipo.normal.full_body = templateCode('bajar', 'principiante', 'sin_equipo', 'normal', 'push_pull_legs');
    const third = await trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: swapped });
    const refusedSplit = await trainer.post(`/api/catalog/rules/${third.body.rules.id}/approve`);
    assert.equal(refusedSplit.body.error.code, 'RULES_REFERENCE_INVALID', 'una rutina push/pull/legs no puede ocupar el lugar de la full body');
    assert.match(refusedSplit.body.error.message, /full_body/);
    assert.equal(((await trainer.get('/api/catalog/rules')).body.rules.filter(item => item.domain === 'entrenamiento' && item.status === 'approved')).length, 1, 'sigue vigente la versión anterior');
  });

  test('una versión válida queda vigente, la anterior se retira y cambia lo que se sugiere', async () => {
    const content = await currentContent();
    const changed = { ...content, focusGroups: { ...content.focusGroups, bajar: ['movilidad', 'cardio'] } };
    const created = await trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: changed, changeNote: 'Más movilidad al inicio' });
    assert.equal((await trainer.post(`/api/catalog/rules/${created.body.rules.id}/approve`)).status, 200);
    const { version } = created.body.rules;
    const rules = (await trainer.get('/api/catalog/rules')).body.rules.filter(item => item.domain === 'entrenamiento');
    assert.deepEqual(rules.filter(item => item.status === 'approved').map(item => item.version), [version], 'una sola versión vigente');
    assert.equal(rules.find(item => item.version === 1).status, 'retired');
    const participant = await participantWithProfile(ctx);
    const suggestions = (await participant.api.get('/api/exercises/suggestions')).body;
    assert.equal(suggestions.rulesVersion, version);
    assert.equal(suggestions.exercises[0].muscleGroup, 'movilidad');
  });

  test('el preparador puede cambiar la regla que elige la división sin tocar el código', async () => {
    const participant = await participantWithProfile(ctx);
    assert.equal((await participant.api.get('/api/routines')).body.split, 'full_body', 'principiante: full body');
    const content = await currentContent();
    const changed = { ...content, splitRules: [{ split: 'push_pull_legs', reason: 'Prueba: todas las personas empiezan con push/pull/legs.' }] };
    const created = await trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: changed, changeNote: 'Cambio de división' });
    assert.equal((await trainer.post(`/api/catalog/rules/${created.body.rules.id}/approve`)).status, 200);
    const body = (await participant.api.get('/api/routines')).body;
    assert.deepEqual([body.split, body.splitReason], ['push_pull_legs', 'Prueba: todas las personas empiezan con push/pull/legs.']);
    assert.equal(body.routines[0].split, 'push_pull_legs');
    const { splitRules, ...withoutRules } = content;
    assert.ok(splitRules.length > 0);
    const plain = await trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: withoutRules });
    assert.equal((await trainer.post(`/api/catalog/rules/${plain.body.rules.id}/approve`)).status, 200);
    const fallback = (await participant.api.get('/api/routines')).body;
    assert.deepEqual([fallback.split, fallback.splitReason], ['full_body', null], 'sin regla de división se usa la primera disponible, sin motivo');
  });

  test('la nutricionista no puede crear ni aprobar reglas de entrenamiento', async () => {
    const nutritionist = await ctx.createStaff('nutritionist');
    const content = await currentContent();
    assert.equal((await nutritionist.api.post('/api/catalog/rules').send({ domain: 'entrenamiento', content })).status, 403);
    const draft = await trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content });
    assert.equal((await nutritionist.api.post(`/api/catalog/rules/${draft.body.rules.id}/approve`)).status, 403);
  });
});
