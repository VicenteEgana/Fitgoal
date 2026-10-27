import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, participantWithProfile, PROFILE } from './helpers.js';

describe('Rutinas recomendadas según el objetivo, el nivel, el equipo y el IMC (RF004, OE-b)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  const recommendedOf = async (participant) => (await participant.api.get('/api/routines')).body;
  const withBody = (patch = {}) => participantWithProfile(ctx, { profile: { ...PROFILE, ...patch } });

  test('sin perfil se muestran las rutinas aprobadas pero ninguna se marca como recomendada', async () => {
    const participant = await ctx.register();
    const response = await participant.api.get('/api/routines');
    assert.equal(response.status, 200);
    assert.equal(response.body.profile, null);
    assert.equal(response.body.routines.length, 156, '(3 objetivos × 5 categorías, sin las 2 que reemplazan las reglas de seguridad) × 2 niveles × 2 equipos × 3 divisiones');
    assert.ok(response.body.routines.every(routine => !routine.recommended));
  });

  test('sin estatura ni peso se recomienda la rutina general de bajo impacto y se invita a indicarlos', async () => {
    const participant = await withBody();
    const body = await recommendedOf(participant);
    const recommended = body.routines.filter(routine => routine.recommended);
    assert.equal(recommended.length, 1);
    assert.deepEqual([recommended[0].bmiCategory, recommended[0].objective, recommended[0].level, recommended[0].equipment, recommended[0].split], ['general', 'bajar', 'principiante', 'sin_equipo', 'full_body']);
    assert.match(recommended[0].reasons[0], /bajar de peso/);
    assert.match(recommended[0].reasons[2], /general de bajo impacto/);
    assert.equal(body.body, null);
    assert.deepEqual(body.notices.map(notice => notice.code), ['body_data_missing']);
  });

  test('con estatura y peso se calcula el IMC y se recomienda la rutina de su categoría', async () => {
    const cases = [
      [{ weightKg: 70, heightCm: 175 }, 22.9, 'normal'],
      [{ weightKg: 85, heightCm: 175 }, 27.8, 'sobrepeso'],
      [{ weightKg: 100, heightCm: 170 }, 34.6, 'obesidad'],
    ];
    for (const [data, bmi, category] of cases) {
      const participant = await withBody({ objective: 'mantener', ...data });
      const body = await recommendedOf(participant);
      const recommended = body.routines.filter(routine => routine.recommended);
      assert.equal(recommended.length, 1, category);
      assert.equal(recommended[0].bmiCategory, category);
      assert.equal(recommended[0].objective, 'mantener');
      assert.deepEqual([body.body.bmi, body.body.category], [bmi, category]);
      assert.equal(recommended[0].reasons[2].startsWith(`Pensada para tu IMC (${String(bmi).replace('.', ',')}):`), true, 'el decimal va con coma');
      assert.ok(body.notices.some(notice => notice.code === 'bmi_reference' && /no distingue músculo de grasa/.test(notice.text)), 'el IMC se presenta solo como referencia');
    }
  });

  test('con bajo peso no se recomienda bajar de peso: se muestran rutinas para subir y se avisa', async () => {
    const participant = await withBody({ objective: 'bajar', weightKg: 50, heightCm: 170 });
    const body = await recommendedOf(participant);
    const [only] = body.routines.filter(routine => routine.recommended);
    assert.deepEqual([only.objective, only.bmiCategory], ['subir', 'bajo_peso']);
    assert.equal(body.effectiveObjective, 'subir');
    const codes = body.notices.map(notice => notice.code);
    assert.deepEqual(codes, ['objective_adjusted', 'category_guidance', 'bmi_reference']);
    assert.match(body.notices[0].text, /no recomendamos rutinas para bajar de peso/);
    assert.match(body.notices[1].text, /bajó sin buscarlo/);
    assert.equal(body.routines.some(routine => routine.objective === 'bajar' && routine.bmiCategory === 'bajo_peso'), false, 'no existe esa rutina');
  });

  test('con obesidad no se recomienda subir de peso: se muestran rutinas para bajar de bajo impacto', async () => {
    const participant = await withBody({ objective: 'subir', weightKg: 100, heightCm: 170 });
    const body = await recommendedOf(participant);
    const [only] = body.routines.filter(routine => routine.recommended);
    assert.deepEqual([only.objective, only.bmiCategory], ['bajar', 'obesidad']);
    assert.match(body.notices[0].text, /no recomendamos rutinas para subir de peso/);
    const detail = (await participant.api.get(`/api/routines/${only.id}`)).body.routine;
    assert.ok(detail.sessions.flatMap(session => session.exercises).every(exercise => exercise.highImpact === false), 'sin saltos ni trote');
  });

  test('las personas mayores (65 años o más) usan los cortes del Minsal', async () => {
    const young = await withBody({ objective: 'mantener', age: 30, weightKg: 62, heightCm: 170 });
    const older = await withBody({ objective: 'mantener', age: 70, weightKg: 62, heightCm: 170 });
    assert.equal((await recommendedOf(young)).body.category, 'normal', 'IMC 21,5: normal con los cortes de la OMS');
    assert.equal((await recommendedOf(older)).body.category, 'bajo_peso', 'IMC 21,5: enflaquecido con los cortes del Minsal');
  });

  test('avisa cuando la rutina pide más días o minutos de los que indica el perfil, sin impedir verla', async () => {
    const participant = await participantWithProfile(ctx, { profile: { ...PROFILE, days: [2], durationMinutes: 20 } });
    const recommended = (await recommendedOf(participant)).routines.filter(routine => routine.recommended);
    assert.ok(recommended.length > 0);
    for (const routine of recommended) {
      assert.equal(routine.fit.ok, false);
      assert.match(routine.fit.notes.join(' '), /al menos 2 días/);
      assert.match(routine.fit.notes.join(' '), /30 minutos/);
    }
    const good = (await recommendedOf(await participantWithProfile(ctx))).routines.find(routine => routine.recommended);
    assert.deepEqual(good.fit, { ok: true, notes: [] });
  });

  test('la división de la semana se elige según el nivel y los días disponibles', async () => {
    const cases = [
      ['principiante', [1, 3, 5], 'full_body', /Si estás empezando/, []],
      ['principiante', [1, 2, 3, 4, 5, 6], 'full_body', /Si estás empezando/, [/hasta 3 días por semana y tu perfil tiene 6; al iniciarla elige 3/]],
      ['con_experiencia', [1, 3, 5], 'full_body', /3 días o menos/, []],
      ['con_experiencia', [1, 2, 4, 5], 'upper_lower', /4 o 5 días/, []],
      ['con_experiencia', [1, 2, 3, 4, 5], 'upper_lower', /4 o 5 días/, [/hasta 4 días por semana y tu perfil tiene 5/]],
      ['con_experiencia', [1, 2, 3, 4, 5, 6], 'push_pull_legs', /Con 6 días/, []],
    ];
    for (const [level, days, split, reason, notes] of cases) {
      const label = `${level} con ${days.length} días`;
      const participant = await withBody({ level, days, durationMinutes: 45, objective: 'mantener', weightKg: 70, heightCm: 175 });
      const body = await recommendedOf(participant);
      assert.equal(body.split, split, label);
      assert.match(body.splitReason, reason, label);
      const [first, second, third] = body.routines;
      assert.equal(first.recommended, true, label);
      assert.deepEqual([first.split, first.level, first.bmiCategory], [split, level, 'normal'], label);
      assert.match(first.reasons[3], reason, 'el motivo de la división acompaña a la recomendación');
      assert.equal(first.fit.notes.length, notes.length, label);
      notes.forEach((note, index) => assert.match(first.fit.notes[index], note, label));
      // Las otras divisiones de la misma combinación se muestran a continuación como alternativas.
      assert.deepEqual([second, third].map(routine => routine.alternative), [true, true], label);
      assert.deepEqual([second, third].map(routine => routine.split).sort(), ['full_body', 'push_pull_legs', 'upper_lower'].filter(item => item !== split), label);
      assert.ok([second, third].every(routine => routine.objective === 'mantener' && routine.level === level && routine.bmiCategory === 'normal' && /organizada en/.test(routine.reasons[0])));
      assert.equal(body.routines.filter(routine => routine.alternative).length, 2);
    }
  });

  test('cada división organiza sus sesiones con nombre y con los grupos que le corresponden', async () => {
    const participant = await participantWithProfile(ctx);
    const find = async split => (await participant.api.get(`/api/routines?objective=subir&level=con_experiencia&equipment=con_equipo&bmiCategory=normal&split=${split}`)).body.routines;
    const groupsOf = async routine => (await participant.api.get(`/api/routines/${routine.id}`)).body.routine.sessions.map(session => [session.label, [...new Set(session.exercises.map(exercise => exercise.muscleGroup))].sort()]);
    const [ppl] = await find('push_pull_legs');
    assert.deepEqual([ppl.minDays, ppl.maxDays, ppl.sessionsCount], [3, 6, 3]);
    assert.deepEqual(await groupsOf(ppl), [
      ['Empuje: pecho, hombros y tríceps', ['core', 'empuje']],
      ['Tracción: espalda y bíceps', ['core', 'traccion']],
      ['Piernas y zona media', ['core', 'piernas']],
    ]);
    const [upperLower] = await find('upper_lower');
    assert.deepEqual([upperLower.minDays, upperLower.maxDays], [4, 4]);
    assert.deepEqual(await groupsOf(upperLower), [
      ['Tren superior A', ['empuje', 'traccion']], ['Tren inferior A', ['core', 'piernas']],
      ['Tren superior B', ['empuje', 'traccion']], ['Tren inferior B', ['core', 'piernas']],
    ]);
    const [fullBody] = await find('full_body');
    assert.deepEqual(await groupsOf(fullBody), ['A', 'B', 'C'].map(letter => [`Cuerpo completo ${letter}`, ['core', 'empuje', 'piernas', 'traccion']]));
    const detail = (await participant.api.get(`/api/routines/${ppl.id}`)).body.routine;
    assert.ok(detail.sessions.flatMap(session => session.exercises).some(exercise => exercise.requiresEquipment), 'con equipo usa ejercicios con material');
  });

  test('se puede explorar todo el catálogo con filtros y los valores inválidos se rechazan', async () => {
    const participant = await participantWithProfile(ctx);
    const subir = (await participant.api.get('/api/routines?objective=subir&equipment=con_equipo')).body.routines;
    assert.equal(subir.length, 24, '4 categorías × 2 niveles × 3 divisiones (sin obesidad: allí se recomienda bajar)');
    assert.ok(subir.every(routine => routine.objective === 'subir' && routine.equipment === 'con_equipo'));
    assert.ok(subir.every(routine => !routine.recommended), 'explorar otro objetivo no cambia la recomendación del perfil');
    assert.equal((await participant.api.get('/api/routines?bmiCategory=obesidad&objective=subir')).body.routines.length, 0);
    assert.equal((await participant.api.get('/api/routines?bmiCategory=normal')).body.routines.length, 36);
    const ppl = (await participant.api.get('/api/routines?split=push_pull_legs')).body.routines;
    assert.ok(ppl.length === 52 && ppl.every(routine => routine.split === 'push_pull_legs'));
    assert.equal((await participant.api.get('/api/routines?split=bro_split')).body.error.code, 'INVALID_FILTER');
    assert.equal((await participant.api.get('/api/routines?objective=volar')).body.error.code, 'INVALID_FILTER');
    assert.equal((await participant.api.get('/api/routines?bmiCategory=delgado')).body.error.code, 'INVALID_FILTER');
  });

  test('el detalle muestra las sesiones y ejercicios; un borrador o un rol ajeno no acceden', async () => {
    const participant = await participantWithProfile(ctx);
    const [routine] = (await participant.api.get('/api/routines')).body.routines;
    const detail = (await participant.api.get(`/api/routines/${routine.id}`)).body.routine;
    assert.equal(detail.sessions.length, 3);
    assert.deepEqual(detail.sessions.map(session => session.label), ['Cuerpo completo A', 'Cuerpo completo B', 'Cuerpo completo C']);
    assert.deepEqual(detail.sessionLabels, detail.sessions.map(session => session.label));
    assert.ok(detail.sessions[0].exercises.every(exercise => exercise.name && exercise.prescription && exercise.muscleGroup));
    const draft = (await ctx.db.query("SELECT id FROM routine_templates WHERE status = 'draft'")).rows[0];
    assert.equal((await participant.api.get(`/api/routines/${draft.id}`)).status, 404, 'un borrador del preparador no es visible');
    assert.equal((await participant.api.get('/api/routines/no-es-un-uuid')).status, 404);
    const trainer = await ctx.demo('trainer');
    assert.equal((await trainer.get('/api/routines')).status, 403);
    assert.equal((await ctx.http.get('/api/routines')).status, 401);
  });

  test('sin reglas aprobadas no hay recomendaciones ni sugerencias, pero el catálogo se puede explorar', async () => {
    const bare = await createContext();
    await bare.db.query("UPDATE rule_versions SET status = 'retired'");
    const participant = await participantWithProfile(bare);
    const { routines, rulesVersion } = (await participant.api.get('/api/routines')).body;
    assert.equal(rulesVersion, null);
    assert.ok(routines.length > 0 && routines.every(routine => !routine.recommended));
    assert.equal((await participant.api.get('/api/exercises/suggestions')).body.error.code, 'NO_APPROVED_RULES');
    assert.equal((await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routines[0].id, days: [1, 3] })).body.error.code, 'NO_APPROVED_RULES');
    await bare.close();
  });
});

describe('Biblioteca de ejercicios y sugerencias para armar una rutina propia (RF005)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('la biblioteca lista solo ejercicios aprobados y se filtra por grupo, equipo, nivel y texto', async () => {
    const participant = await ctx.register();
    const all = (await participant.api.get('/api/exercises')).body;
    assert.equal(all.exercises.length, 39, 'el ejercicio en borrador no aparece');
    assert.ok(!all.exercises.some(exercise => exercise.code === 'zancada-lateral'));
    assert.deepEqual(all.groups, ['piernas', 'empuje', 'traccion', 'core', 'cardio', 'movilidad']);
    const pull = (await participant.api.get('/api/exercises?group=traccion&equipment=sin_equipo')).body.exercises;
    assert.ok(pull.length >= 3 && pull.every(exercise => exercise.muscleGroup === 'traccion' && !exercise.requiresEquipment), 'hay tracción sin equipo para push/pull/legs en casa');
    const core = (await participant.api.get('/api/exercises?group=core')).body.exercises;
    assert.ok(core.length >= 3 && core.every(exercise => exercise.muscleGroup === 'core'));
    const noEquipment = (await participant.api.get('/api/exercises?equipment=sin_equipo')).body.exercises;
    assert.ok(noEquipment.length < all.exercises.length && noEquipment.every(exercise => !exercise.requiresEquipment));
    const beginner = (await participant.api.get('/api/exercises?level=principiante')).body.exercises;
    assert.ok(beginner.every(exercise => exercise.minLevel === 'principiante'));
    const found = (await participant.api.get('/api/exercises?q=plancha')).body.exercises.map(exercise => exercise.code).sort();
    assert.deepEqual(found, ['plancha', 'plancha-sobre-rodillas']);
    assert.equal((await participant.api.get('/api/exercises?group=cuello')).body.error.code, 'INVALID_FILTER');
    assert.equal((await participant.api.get('/api/exercises?q=%25')).status, 200, 'los comodines se neutralizan');
  });

  test('las sugerencias priorizan los grupos que las reglas aprobadas indican para el objetivo', async () => {
    const participant = await participantWithProfile(ctx);
    const body = (await participant.api.get('/api/exercises/suggestions')).body;
    assert.deepEqual(body.focus, ['cardio', 'piernas', 'core']);
    const firstOther = body.exercises.findIndex(exercise => !exercise.suggested);
    assert.ok(firstOther > 0, 'primero van las sugeridas');
    assert.ok(body.exercises.slice(0, firstOther).every(exercise => body.focus.includes(exercise.muscleGroup)));
    assert.equal(body.exercises[0].muscleGroup, 'cardio');
    assert.match(body.exercises[0].reason, /Sugerido para bajar de peso: trabaja el sistema cardiovascular/);
    assert.ok(body.exercises.every(exercise => exercise.minLevel === 'principiante' && !exercise.requiresEquipment), 'respeta nivel y equipo del perfil');
    const only = (await participant.api.get('/api/exercises/suggestions?group=core')).body.exercises;
    assert.ok(only.length > 0 && only.every(exercise => exercise.muscleGroup === 'core'));
  });

  test('con más nivel y equipo se sugieren más ejercicios, según el objetivo', async () => {
    const participant = await participantWithProfile(ctx, { profile: { ...PROFILE, objective: 'subir', level: 'con_experiencia', equipment: 'con_equipo' } });
    const body = (await participant.api.get('/api/exercises/suggestions')).body;
    assert.deepEqual(body.focus, ['empuje', 'traccion', 'piernas', 'core']);
    assert.equal(body.exercises[0].muscleGroup, 'empuje');
    assert.match(body.exercises[0].reason, /trabaja el empuje \(pecho, hombros y tríceps\)/);
    const codes = body.exercises.map(exercise => exercise.code);
    assert.ok(codes.includes('press-de-hombros-con-mancuernas') && codes.includes('remo-con-mancuerna') && codes.includes('zancadas-con-apoyo'));
  });

  test('los ejercicios de alto impacto vienen señalados y no se sugieren con sobrepeso u obesidad', async () => {
    const experienced = { ...PROFILE, level: 'con_experiencia', objective: 'bajar' };
    const normal = await participantWithProfile(ctx, { profile: { ...experienced, weightKg: 70, heightCm: 175 } });
    const heavy = await participantWithProfile(ctx, { profile: { ...experienced, weightKg: 100, heightCm: 170 } });
    const library = (await normal.api.get('/api/exercises')).body.exercises;
    assert.deepEqual(library.filter(exercise => exercise.highImpact).map(exercise => exercise.code).sort(), ['saltos-de-tijera', 'trote-suave']);
    assert.ok((await normal.api.get('/api/exercises?lowImpact=1')).body.exercises.every(exercise => !exercise.highImpact));
    const forNormal = (await normal.api.get('/api/exercises/suggestions')).body;
    assert.equal(forNormal.lowImpactOnly, false);
    assert.ok(forNormal.exercises.some(exercise => exercise.code === 'saltos-de-tijera'));
    const forHeavy = (await heavy.api.get('/api/exercises/suggestions')).body;
    assert.equal(forHeavy.lowImpactOnly, true);
    assert.ok(forHeavy.exercises.every(exercise => !exercise.highImpact), 'sin saltos ni trote');
    assert.ok(forHeavy.notices.some(notice => notice.code === 'category_guidance' && /bajo impacto/.test(notice.text)));
  });

  test('las sugerencias piden completar el perfil primero', async () => {
    const participant = await ctx.register();
    assert.equal((await participant.api.get('/api/exercises/suggestions')).body.error.code, 'PROFILE_REQUIRED');
  });
});
