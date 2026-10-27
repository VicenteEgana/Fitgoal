import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, participantWithPlan, participantWithProfile, PROFILE, POLICY, recommendedFor } from './helpers.js';
import { pseudonymOf } from '../src/lib/security.js';
import { prescriptionText } from '../src/modules/plans.js';

describe('Iniciar una rutina recomendada (RF004, RF006)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('la rutina empieza al instante, sin revisión, con los ejercicios y la indicación que aprobó el preparador', async () => {
    const participant = await participantWithProfile(ctx);
    assert.equal((await participant.api.get('/api/plans/me')).body.plan, null);
    const [routine] = await recommendedFor(participant);
    const detail = (await participant.api.get(`/api/routines/${routine.id}`)).body.routine;
    const started = await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days: [5, 1, 3] });
    assert.equal(started.status, 201);
    assert.deepEqual([started.body.plan.version, started.body.plan.sessionsScheduled, started.body.plan.replaced], [1, 12, false]);

    const { plan } = (await participant.api.get('/api/plans/me')).body;
    assert.equal(plan.source, 'recomendada');
    assert.deepEqual(plan.days, [1, 3, 5], 'los días se guardan ordenados');
    assert.equal(plan.status, 'vigente');
    assert.equal(plan.weeks, 4);
    assert.deepEqual(plan.template, { code: routine.code, version: 1, name: routine.name, split: 'full_body' });
    assert.equal(plan.rulesVersion, 1);
    assert.equal(plan.profileVersion, 1);
    assert.deepEqual(plan.schedule.map(day => [day.dayLabel, day.label]), [['Lunes', 'Cuerpo completo A'], ['Miércoles', 'Cuerpo completo B'], ['Viernes', 'Cuerpo completo C']]);
    for (const [index, day] of plan.schedule.entries()) {
      assert.deepEqual(day.exercises.map(exercise => [exercise.code, exercise.prescription]), detail.sessions[index].exercises.map(exercise => [exercise.code, exercise.prescription]));
    }
    const sessions = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions;
    assert.equal(sessions.length, 12);
    assert.deepEqual(sessions.slice(0, 3).map(session => [session.plannedDate, session.label]), [['2026-11-04', 'Miércoles · Cuerpo completo B'], ['2026-11-06', 'Viernes · Cuerpo completo C'], ['2026-11-09', 'Lunes · Cuerpo completo A']]);
  });

  test('push/pull/legs en 6 días repite empuje, tracción y piernas dos veces por semana', async () => {
    const days = [1, 2, 3, 4, 5, 6];
    const participant = await participantWithProfile(ctx, { profile: { ...PROFILE, level: 'con_experiencia', days, durationMinutes: 45 } });
    const [routine] = await recommendedFor(participant);
    assert.equal(routine.split, 'push_pull_legs');
    const started = await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days });
    assert.equal(started.body.plan.sessionsScheduled, 24);
    const { plan } = (await participant.api.get('/api/plans/me')).body;
    const labels = ['Empuje: pecho, hombros y tríceps', 'Tracción: espalda y bíceps', 'Piernas y zona media'];
    assert.deepEqual(plan.schedule.map(day => day.label), [...labels, ...labels]);
    assert.deepEqual(plan.schedule[3].exercises, plan.schedule[0].exercises, 'el segundo empuje repite el primero');
    const sessions = (await participant.api.get('/api/sessions/me?to=2026-11-08')).body.sessions;
    assert.deepEqual(sessions.map(session => session.label), ['Martes · Tracción: espalda y bíceps', 'Miércoles · Piernas y zona media', 'Jueves · Empuje: pecho, hombros y tríceps', 'Viernes · Tracción: espalda y bíceps', 'Sábado · Piernas y zona media']);
  });

  test('upper/lower se inicia con 4 días: tren superior e inferior alternados', async () => {
    const participant = await participantWithProfile(ctx, { profile: { ...PROFILE, level: 'con_experiencia', days: [1, 2, 4, 5], durationMinutes: 45 } });
    const [routine] = await recommendedFor(participant);
    assert.equal(routine.split, 'upper_lower');
    assert.equal((await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days: [1, 2, 4] })).body.error.code, 'INVALID_DAYS');
    assert.equal((await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days: [1, 2, 4, 5] })).status, 201);
    const { plan } = (await participant.api.get('/api/plans/me')).body;
    assert.deepEqual(plan.schedule.map(day => `${day.dayLabel} · ${day.label}`), ['Lunes · Tren superior A', 'Martes · Tren inferior A', 'Jueves · Tren superior B', 'Viernes · Tren inferior B']);
  });

  test('con menos días que sesiones usa las primeras sesiones; con más días que la rutina contempla se rechaza', async () => {
    const participant = await participantWithProfile(ctx);
    const [routine] = await recommendedFor(participant);
    assert.equal(routine.minDays, 2);
    assert.equal((await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days: [2] })).body.error.code, 'INVALID_DAYS');
    assert.equal((await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days: [1, 2, 3, 4] })).body.error.code, 'INVALID_DAYS');
    assert.equal((await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days: [1, 1] })).body.error.code, 'INVALID_DAYS');
    const two = await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days: [2, 6] });
    assert.equal(two.status, 201);
    assert.equal(two.body.plan.sessionsScheduled, 8);
    assert.equal((await participant.api.get('/api/plans/me')).body.plan.schedule.length, 2);
  });

  test('exige perfil y consentimiento, y solo las personas participantes inician rutinas', async () => {
    const participant = await ctx.register();
    const [any] = (await participant.api.get('/api/routines')).body.routines;
    const start = { source: 'recomendada', templateId: any.id, days: [1, 3] };
    assert.equal((await participant.api.post('/api/plans/start').send(start)).body.error.code, 'PROFILE_REQUIRED');
    await participant.api.put('/api/profiles/me').send(PROFILE);
    await participant.api.post('/api/consents').send({ purpose: 'perfil_entrenamiento', granted: false, policyVersion: POLICY });
    assert.equal((await participant.api.post('/api/plans/start').send(start)).body.error.code, 'CONSENT_REQUIRED');
    const trainer = await ctx.demo('trainer');
    assert.equal((await trainer.post('/api/plans/start').send(start)).status, 403);
    assert.equal((await trainer.get('/api/plans/me')).status, 403);
    assert.equal((await ctx.http.post('/api/plans/start').send(start)).status, 401);
  });

  test('valida el origen y no acepta rutinas que no están aprobadas o ya no están vigentes', async () => {
    const participant = await participantWithProfile(ctx);
    const send = body => participant.api.post('/api/plans/start').send(body);
    assert.equal((await send({ source: 'otra', days: [1, 3] })).body.error.code, 'INVALID_SOURCE');
    assert.equal((await send({ source: 'recomendada', days: [1, 3] })).status, 404, 'falta el identificador de la rutina');
    const draft = (await ctx.db.query("SELECT id FROM routine_templates WHERE status = 'draft'")).rows[0];
    assert.equal((await send({ source: 'recomendada', templateId: draft.id, days: [1, 3] })).body.error.code, 'TEMPLATE_NOT_AVAILABLE');
    assert.equal((await send({ source: 'recomendada', templateId: '3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c', days: [1, 3] })).body.error.code, 'TEMPLATE_NOT_AVAILABLE');
    assert.equal((await participant.api.get('/api/plans/me')).body.plan, null, 'ningún intento fallido deja una rutina a medias');
  });

  test('iniciar otra rutina reemplaza la anterior: conserva lo registrado y quita las sesiones futuras sin hacer', async () => {
    const { participant, routine } = await participantWithPlan(ctx);
    const sessions = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions;
    ctx.advanceDays(3); // jueves 5: venció la sesión del miércoles 4
    await ctx.reauth(participant);
    await participant.api.post(`/api/sessions/${sessions[0].id}/complete`).send({});
    const others = (await participant.api.get('/api/routines?objective=mantener')).body.routines;
    const next = await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: others[0].id, days: [2, 4] });
    assert.equal(next.status, 201);
    assert.deepEqual([next.body.plan.version, next.body.plan.replaced], [2, true]);
    const history = (await participant.api.get('/api/plans/me/history')).body.plans;
    assert.deepEqual(history.map(item => [item.version, item.status]), [[2, 'vigente'], [1, 'reemplazado']]);
    assert.ok(history[1].replacedAt);
    const kept = (await ctx.db.query('SELECT planned_date, completed_at FROM training_sessions WHERE user_id = $1 AND plan_id = $2', [participant.user.id, sessions[0].planId])).rows;
    assert.equal(kept.length, 1, 'solo queda la sesión registrada de la rutina anterior');
    assert.ok(kept[0].completed_at);
    assert.equal((await participant.api.get('/api/plans/me')).body.plan.template.code, others[0].code);
    assert.notEqual(others[0].code, routine.code);
    ctx.advanceDays(-3);
  });

  test('cambiar el perfil no modifica la rutina vigente; la persona decide cuándo iniciar otra', async () => {
    const { participant } = await participantWithPlan(ctx);
    const before = (await participant.api.get('/api/plans/me')).body.plan;
    await participant.api.put('/api/profiles/me').send({ ...PROFILE, objective: 'subir' });
    const after = (await participant.api.get('/api/plans/me')).body.plan;
    assert.equal(after.id, before.id);
    assert.equal(after.profileVersion, 1, 'la rutina recuerda con qué versión del perfil se inició');
    assert.equal((await participant.api.get('/api/profiles/me')).body.profile.version, 2);
  });

  test('una rutina ya iniciada conserva su contenido aunque el preparador publique una versión nueva o retire la rutina', async () => {
    const trainer = await ctx.demo('trainer');
    const templates = (await trainer.get('/api/catalog/templates')).body.templates;
    const v1 = templates.find(item => item.code === 'demo-mantener-principiante-sin-equipo-normal-full-body' && item.status === 'approved');
    const v2 = templates.find(item => item.code === v1.code && item.status === 'draft');
    const participant = await participantWithProfile(ctx);
    assert.equal((await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: v1.id, days: [1, 3, 5] })).status, 201);
    const original = (await participant.api.get('/api/plans/me')).body.plan;

    assert.equal((await trainer.post(`/api/catalog/templates/${v2.id}/approve`)).status, 200, 'versión 2 vigente; la 1 queda retirada');
    const afterV2 = (await participant.api.get('/api/plans/me')).body.plan;
    assert.deepEqual(afterV2.schedule, original.schedule);
    assert.equal(afterV2.template.version, 1, 'la rutina recuerda la versión con la que se inició');
    assert.equal(afterV2.weeks, 4, 'la versión 2 tiene seis semanas y no cambia la rutina ya iniciada');

    assert.equal((await trainer.post(`/api/catalog/templates/${v2.id}/retire`)).status, 200);
    assert.deepEqual((await participant.api.get('/api/plans/me')).body.plan.schedule, original.schedule);
    assert.equal((await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions.length, 12, 'sus sesiones siguen programadas');
  });

  test('la base de datos impide modificar una rutina iniciada y sus ejercicios', async () => {
    const { plan } = await participantWithPlan(ctx);
    await assert.rejects(ctx.db.query("UPDATE user_plans SET name = 'Otra' WHERE id = $1", [plan.id]), /no se modifica/);
    await assert.rejects(ctx.db.query("UPDATE user_plan_exercises SET prescription = '99 series' WHERE plan_id = $1", [plan.id]), /solo anexado/);
  });

  test('inicio y consulta quedan como eventos seudonimizados, sin identificar a la cuenta', async () => {
    const { participant } = await participantWithPlan(ctx);
    await participant.api.get('/api/plans/me');
    const events = (await ctx.db.query('SELECT event_type FROM usage_events WHERE pseudonym = $1', [pseudonymOf(ctx.config.pseudonymSecret, participant.user.id)])).rows.map(row => row.event_type);
    assert.ok(events.includes('rutina_iniciada') && events.includes('plan_consultado'));
  });

  test('una persona no ve la rutina ni el historial de otra', async () => {
    const { participant } = await participantWithPlan(ctx);
    const other = await participantWithProfile(ctx);
    assert.equal((await other.api.get('/api/plans/me')).body.plan, null);
    assert.deepEqual((await other.api.get('/api/plans/me/history')).body.plans, []);
    assert.equal((await participant.api.get('/api/plans/me/history')).body.plans.length, 1);
  });
});

describe('Armar una rutina propia con ejercicios aprobados (RF005)', () => {
  let ctx;
  let library;
  before(async () => {
    ctx = await createContext();
    library = (await (await ctx.register()).api.get('/api/exercises')).body.exercises;
  });
  after(() => ctx.close());

  const byCode = code => library.find(exercise => exercise.code === code);
  const custom = (overrides = {}) => ({
    source: 'propia', name: 'Mi rutina', days: [2, 4],
    sessions: [
      { exercises: [{ exerciseId: byCode('caminata').id }, { exerciseId: byCode('mini-sentadillas').id, sets: 3, reps: 12 }] },
      { exercises: [{ exerciseId: byCode('plancha-sobre-rodillas').id, sets: 2, seconds: 30 }] },
    ],
    ...overrides,
  });

  test('la persona elige libremente los ejercicios y su rutina empieza al instante', async () => {
    const participant = await participantWithProfile(ctx);
    const started = await participant.api.post('/api/plans/start').send(custom({ weeks: 2 }));
    assert.equal(started.status, 201, JSON.stringify(started.body));
    assert.deepEqual([started.body.plan.source, started.body.plan.sessionsScheduled], ['propia', 4]);
    const { plan } = (await participant.api.get('/api/plans/me')).body;
    assert.equal(plan.name, 'Mi rutina');
    assert.equal(plan.template, null);
    assert.equal(plan.weeks, 2);
    assert.equal(plan.sessionMinutes, 30, 'toma la duración del perfil');
    assert.deepEqual(plan.schedule.map(day => [day.dayLabel, day.label]), [['Martes', 'Sesión 1'], ['Jueves', 'Sesión 2']]);
    assert.deepEqual(plan.schedule[0].exercises.map(exercise => [exercise.code, exercise.prescription]), [
      ['caminata', '10 minutos a ritmo cómodo'], ['mini-sentadillas', '3 series de 12 repeticiones'],
    ]);
    assert.equal(plan.schedule[1].exercises[0].prescription, '2 series de 30 segundos');
    const sessions = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions;
    assert.deepEqual(sessions.map(session => session.plannedDate), ['2026-11-03', '2026-11-05', '2026-11-10', '2026-11-12']);
  });

  test('sin indicación propia se usa la sugerida por el profesional, y los textos respetan el singular', () => {
    assert.equal(prescriptionText({}, '2 series de 8 repeticiones'), '2 series de 8 repeticiones');
    assert.equal(prescriptionText({ sets: 1, reps: 1 }, 'x'), '1 serie de 1 repetición');
    assert.equal(prescriptionText({ sets: 4, seconds: 45 }, 'x'), '4 series de 45 segundos');
  });

  test('limita las series, repeticiones y segundos a valores seguros', async () => {
    const participant = await participantWithProfile(ctx);
    const exercise = byCode('plancha').id;
    const attempt = item => participant.api.post('/api/plans/start').send(custom({ days: [1], sessions: [{ exercises: [{ exerciseId: exercise, ...item }] }] }));
    for (const item of [{ sets: 7, reps: 10 }, { sets: 0, reps: 10 }, { sets: 2, reps: 51 }, { sets: 2, seconds: 4 }, { sets: 2, seconds: 601 }, { sets: 2 }, { reps: 10 }, { sets: 2, reps: 10, seconds: 30 }, { sets: 2.5, reps: 10 }]) {
      assert.equal((await attempt(item)).body.error.code, 'INVALID_PRESCRIPTION', JSON.stringify(item));
    }
    assert.equal((await participant.api.get('/api/plans/me')).body.plan, null);
  });

  test('valida el nombre, las sesiones y los ejercicios', async () => {
    const participant = await participantWithProfile(ctx);
    const send = body => participant.api.post('/api/plans/start').send(body);
    assert.equal((await send(custom({ name: '  ' }))).body.error.code, 'INVALID_NAME');
    assert.equal((await send(custom({ weeks: 13 }))).body.error.code, 'INVALID_WEEKS');
    assert.equal((await send(custom({ days: [1, 2, 3] }))).body.error.code, 'INVALID_SESSIONS', 'una sesión por cada día elegido');
    assert.equal((await send(custom({ days: [1], sessions: [{ exercises: [] }] }))).body.error.code, 'INVALID_SESSIONS');
    const many = Array.from({ length: 13 }, (_, index) => ({ exerciseId: library[index].id }));
    assert.equal((await send(custom({ days: [1], sessions: [{ exercises: many }] }))).body.error.code, 'INVALID_SESSIONS');
    const same = { exerciseId: byCode('caminata').id };
    assert.equal((await send(custom({ days: [1], sessions: [{ exercises: [same, same] }] }))).body.error.code, 'DUPLICATE_EXERCISE');
    assert.equal((await send(custom({ days: [1], sessions: [{ exercises: [{ exerciseId: 'no-es-un-uuid' }] }] }))).status, 404);
    const draft = (await ctx.db.query("SELECT id FROM exercises WHERE status = 'draft'")).rows[0];
    assert.equal((await send(custom({ days: [1], sessions: [{ exercises: [{ exerciseId: draft.id }] }] }))).body.error.code, 'UNKNOWN_EXERCISE', 'un ejercicio sin aprobar no se puede usar');
    assert.equal((await participant.api.get('/api/plans/me')).body.plan, null, 'ningún intento fallido deja una rutina a medias');
  });

  test('una rutina propia puede reemplazar a una recomendada y viceversa', async () => {
    const { participant } = await participantWithPlan(ctx);
    const own = await participant.api.post('/api/plans/start').send(custom());
    assert.equal(own.body.plan.replaced, true);
    const [routine] = await recommendedFor(participant);
    const back = await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days: [1, 3] });
    assert.deepEqual([back.body.plan.version, back.body.plan.replaced], [3, true]);
    assert.deepEqual((await participant.api.get('/api/plans/me/history')).body.plans.map(item => [item.source, item.status]), [['recomendada', 'vigente'], ['propia', 'reemplazado'], ['recomendada', 'reemplazado']]);
  });

  test('la base de datos solo admite ejercicios aprobados en una rutina, aunque se omita la API', async () => {
    const { plan } = await participantWithPlan(ctx);
    const draft = (await ctx.db.query("SELECT id FROM exercises WHERE status = 'draft'")).rows[0];
    await assert.rejects(ctx.db.query("INSERT INTO user_plan_exercises (plan_id, session_no, position, exercise_id, prescription) VALUES ($1, 1, 15, $2, 'x')", [plan.id, draft.id]), /Solo se pueden usar ejercicios aprobados/);
  });
});
