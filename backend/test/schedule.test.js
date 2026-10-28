import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, participantWithPlan, participantWithProfile } from './helpers.js';
import { MILESTONES, dayStatuses, planCoverage, streakSummary } from '../src/lib/streak.js';
import { seedDemoHistory } from '../src/seed/demo.js';

// Rutina de ejemplo: se inicia el lunes 2 de noviembre; sesiones miércoles, viernes y lunes.
const PLAN = [{ from: '2026-11-02', to: '2026-11-30' }];
const done = (...dates) => dates.map(date => ({ date, completed: true }));
const missed = (...dates) => dates.map(date => ({ date, completed: false }));

describe('Racha de días cumpliendo el plan (cálculo)', () => {
  test('los días de descanso suman dentro de una racha, que empieza con la primera sesión registrada', () => {
    const streak = streakSummary({ sessions: done('2026-11-04', '2026-11-06', '2026-11-09'), plans: PLAN, today: '2026-11-10' });
    assert.equal(streak.current, 7, 'del miércoles 4 al martes 10: 3 sesiones y 4 descansos');
    assert.equal(streak.since, '2026-11-04', 'el lunes 2 y el martes 3 (descansos antes de la primera sesión) no cuentan');
    assert.equal(streak.best, 7);
    assert.equal(streak.today, 'descanso');
    assert.equal(streak.milestone, 7, 'hoy alcanzó el hito de 7 días');
    assert.deepEqual(streak.nextMilestone, { days: 14, remaining: 7 });
    assert.equal(streak.atRisk, false);
  });

  test('la sesión de hoy sin registrar no corta la racha, pero la pone en riesgo', () => {
    const streak = streakSummary({ sessions: [...done('2026-11-04', '2026-11-06', '2026-11-09'), ...missed('2026-11-11')], plans: PLAN, today: '2026-11-11' });
    assert.equal(streak.current, 7);
    assert.equal(streak.today, 'pendiente');
    assert.equal(streak.atRisk, true);
    assert.equal(streak.milestone, null);
  });

  test('el comodín semanal cubre la primera sesión sin registro de cada semana; la segunda corta la racha', () => {
    const sessions = [...done('2026-11-04', '2026-11-09'), ...missed('2026-11-06', '2026-11-11', '2026-11-13')];
    const covered = streakSummary({ sessions, plans: PLAN, today: '2026-11-12' });
    assert.equal(covered.current, 7, 'el comodín no suma, pero no corta');
    assert.deepEqual(covered.freeze, { available: false, usedOn: '2026-11-11' });
    assert.equal(covered.lastMissedOn, null);
    const broken = streakSummary({ sessions, plans: PLAN, today: '2026-11-14' });
    assert.equal(broken.current, 0, 'el viernes 13 era la segunda sesión sin registro de la semana');
    assert.equal(broken.best, 7);
    assert.equal(broken.lastMissedOn, '2026-11-13');
    const statuses = dayStatuses({ sessions, plans: PLAN, from: '2026-11-09', to: '2026-11-15', today: '2026-11-14' });
    assert.deepEqual(statuses.map(day => day.status), ['hecho', 'descanso', 'comodin', 'descanso', 'perdido', 'descanso', 'descanso']);
  });

  test('registrar después una sesión vencida la cuenta y libera el comodín', () => {
    const sessions = [...done('2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11'), ...missed('2026-11-13')];
    const streak = streakSummary({ sessions, plans: PLAN, today: '2026-11-14' });
    assert.equal(streak.current, 10, 'del 4 al 14, sin contar el 13 cubierto por el comodín');
    assert.deepEqual(streak.freeze, { available: false, usedOn: '2026-11-13' });
  });

  test('sin rutina la racha se corta al día siguiente; empezar otra rutina ese día la mantiene', () => {
    const first = [{ from: '2026-11-02', to: '2026-11-09' }];
    const sessions = done('2026-11-04', '2026-11-06', '2026-11-09');
    const today = streakSummary({ sessions, plans: first, today: '2026-11-10' });
    assert.deepEqual([today.current, today.today, today.atRisk], [6, 'sin_rutina', true], 'hoy todavía no se corta');
    assert.equal(streakSummary({ sessions, plans: first, today: '2026-11-11' }).current, 0);
    const renewed = streakSummary({ sessions, plans: [...first, { from: '2026-11-10', to: '2026-12-08' }], today: '2026-11-11' });
    assert.equal(renewed.current, 8, 'el día en que se inicia la nueva rutina es de descanso');
  });

  test('sin rutinas no hay racha; los días futuros quedan como programados o de descanso', () => {
    assert.deepEqual([streakSummary({ sessions: [], plans: [], today: '2026-11-10' }).current, MILESTONES[0]], [0, 3]);
    const week = dayStatuses({ sessions: missed('2026-11-11', '2026-11-13'), plans: PLAN, from: '2026-11-09', to: '2026-11-15', today: '2026-11-10' });
    assert.deepEqual(week.map(day => day.status), ['descanso', 'descanso', 'programada', 'descanso', 'programada', 'descanso', 'descanso']);
  });

  test('el día del que se movió una sesión queda como «movida»: no suma ni corta la racha', () => {
    const moved = [...done('2026-11-04', '2026-11-06'), { date: '2026-11-10', completed: true, movedFrom: '2026-11-09' }];
    const statuses = dayStatuses({ sessions: moved, plans: PLAN, from: '2026-11-09', to: '2026-11-11', today: '2026-11-11' });
    assert.deepEqual(statuses.map(day => day.status), ['movida', 'hecho', 'descanso']);
    const streak = streakSummary({ sessions: moved, plans: PLAN, today: '2026-11-11' });
    assert.equal(streak.current, 7, 'del miércoles 4 al miércoles 11 sin contar el lunes 9');
    assert.deepEqual(streak.freeze, { available: true, usedOn: null }, 'mover una sesión no gasta el comodín');
  });

  test('una rutina cubre desde el día en que se inicia hasta el final de su última semana o hasta que se reemplaza', () => {
    const rows = [
      { started_at: new Date('2026-11-02T15:00:00Z'), weeks: 4, replaced_at: new Date('2026-11-12T15:00:00Z') },
      { started_at: new Date('2026-11-12T15:00:00Z'), weeks: 2, replaced_at: null },
    ];
    assert.deepEqual(planCoverage(rows, 'America/Santiago'), [{ from: '2026-11-02', to: '2026-11-12' }, { from: '2026-11-12', to: '2026-11-26' }]);
  });
});

describe('Horario semanal y racha en la API (RF007, K3)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('el horario muestra la semana de lunes a domingo con las sesiones del día y los días de descanso', async () => {
    const { participant } = await participantWithPlan(ctx);
    const week = (await participant.api.get('/api/schedule/me')).body;
    assert.deepEqual([week.today, week.weekStart, week.weekEnd, week.previousWeek, week.nextWeek], ['2026-11-02', '2026-11-02', '2026-11-08', null, '2026-11-09']);
    assert.deepEqual(week.days.map(day => [day.dayLabel, day.status, day.session?.name ?? null]), [
      ['Lunes', 'descanso', null], ['Martes', 'descanso', null], ['Miércoles', 'programada', 'Cuerpo completo B'], ['Jueves', 'descanso', null],
      ['Viernes', 'programada', 'Cuerpo completo C'], ['Sábado', 'descanso', null], ['Domingo', 'descanso', null],
    ]);
    assert.equal(week.days[0].isToday, true);
    const wednesday = week.days[2].session;
    assert.equal(wednesday.canRegister, false, 'una sesión futura no se registra');
    assert.equal(wednesday.minutes, 30);
    assert.ok(wednesday.exercises.length >= 4 && wednesday.exercises.every(exercise => exercise.prescription));
    assert.ok(wednesday.groups.includes('piernas'));
    assert.ok(week.restSuggestions.length >= 1 && week.restSuggestions.every(item => item.prescription), 'sugiere movilidad del catálogo aprobado para los días de descanso');
    assert.deepEqual([week.plan.startsOn, week.plan.endsOn], ['2026-11-03', '2026-11-30']);

    const next = (await participant.api.get('/api/schedule/me?date=2026-11-12')).body;
    assert.deepEqual([next.weekStart, next.previousWeek], ['2026-11-09', '2026-11-02']);
    assert.equal(next.days[0].session.name, 'Cuerpo completo A', 'el lunes hace la sesión 1');
    assert.equal((await participant.api.get('/api/schedule/me?date=2026-11-30')).body.nextWeek, null, 'la rutina termina en su cuarta semana');
  });

  test('la rutina vigente informa sus días de descanso, la semana tipo y la semana en curso', async () => {
    const { participant } = await participantWithPlan(ctx);
    let { plan } = (await participant.api.get('/api/plans/me')).body;
    assert.deepEqual(plan.restDays, [2, 4, 6, 7]);
    assert.deepEqual(plan.week.map(day => [day.dayLabel, day.type, day.label]), [
      ['Lunes', 'entrenamiento', 'Cuerpo completo A'], ['Martes', 'descanso', 'Descanso'], ['Miércoles', 'entrenamiento', 'Cuerpo completo B'],
      ['Jueves', 'descanso', 'Descanso'], ['Viernes', 'entrenamiento', 'Cuerpo completo C'], ['Sábado', 'descanso', 'Descanso'], ['Domingo', 'descanso', 'Descanso'],
    ]);
    assert.deepEqual([plan.startsOn, plan.endsOn, plan.currentWeek], ['2026-11-03', '2026-11-30', 0], 'empieza mañana');
    ctx.advanceDays(8);
    await ctx.reauth(participant);
    ({ plan } = (await participant.api.get('/api/plans/me')).body);
    assert.equal(plan.currentWeek, 2);
    ctx.advanceDays(-8);
  });

  test('registrar sesiones hace crecer la racha con los descansos; el comodín protege una sesión por semana y la adherencia no cambia', async () => {
    const { participant } = await participantWithPlan(ctx);
    const sessions = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions;
    let progress = (await participant.api.get('/api/progress/me')).body;
    assert.deepEqual([progress.streak.current, progress.streak.best, progress.streak.today], [0, 0, 'descanso']);
    assert.equal(progress.calendar.length, 35, 'cinco semanas de lunes a domingo');

    ctx.advanceDays(4); // viernes 6
    await ctx.reauth(participant);
    await participant.api.post(`/api/sessions/${sessions[0].id}/complete`).send({}); // miércoles 4
    progress = (await participant.api.get('/api/progress/me')).body;
    assert.deepEqual([progress.streak.current, progress.streak.today, progress.streak.atRisk], [2, 'pendiente', true], 'miércoles y jueves; la sesión de hoy está pendiente');
    await participant.api.post(`/api/sessions/${sessions[1].id}/complete`).send({}); // viernes 6, hoy
    progress = (await participant.api.get('/api/progress/me')).body;
    assert.deepEqual([progress.streak.current, progress.streak.milestone, progress.streak.today], [3, 3, 'hecho']);
    let week = (await participant.api.get('/api/schedule/me')).body;
    assert.deepEqual(week.days.map(day => day.status), ['descanso', 'descanso', 'hecho', 'descanso', 'hecho', 'descanso', 'descanso']);

    ctx.advanceDays(4); // martes 10: el lunes 9 quedó sin registro
    await ctx.reauth(participant);
    progress = (await participant.api.get('/api/progress/me')).body;
    assert.equal(progress.streak.current, 6, 'el comodín cubre el lunes 9: sábado, domingo y martes suman');
    assert.deepEqual(progress.streak.freeze, { available: false, usedOn: '2026-11-09' });
    assert.equal(progress.adherence, 2 / 3, 'la sesión cubierta por el comodín sigue contando como no realizada');
    week = (await participant.api.get('/api/schedule/me')).body;
    assert.equal(week.days[0].status, 'comodin');
    assert.equal(week.days[0].session.canRegister, true, 'si la hizo, aún puede registrarla');

    ctx.advanceDays(2); // jueves 12: el miércoles 11 también quedó sin registro
    await ctx.reauth(participant);
    progress = (await participant.api.get('/api/progress/me')).body;
    assert.deepEqual([progress.streak.current, progress.streak.best, progress.streak.lastMissedOn], [0, 6, '2026-11-11']);
    assert.ok(progress.calendar.some(day => day.date === '2026-11-11' && day.status === 'perdido'));
    ctx.advanceDays(-10);
  });

  test('una sesión que no se pudo hacer se mueve a un día libre: el día original queda como «movida» y la adherencia la cuenta en su nueva fecha', async () => {
    const { participant } = await participantWithPlan(ctx);
    const [wednesday, friday] = (await participant.api.get('/api/sessions/me')).body.sessions;
    ctx.advanceDays(3); // jueves 5: la del miércoles 4 quedó sin hacer
    await ctx.reauth(participant);

    const { options, name } = (await participant.api.get(`/api/sessions/${wednesday.id}/move-options`)).body;
    assert.equal(name, 'Cuerpo completo B');
    assert.deepEqual(options.map(option => option.date), ['2026-11-05', '2026-11-07', '2026-11-08', '2026-11-10'], 'de hoy a 6 días más, sin los días con sesión (viernes 6, lunes 9 y miércoles 11)');
    assert.ok(options.every(option => option.nextToSession), 'con lunes, miércoles y viernes, cualquier día libre queda junto a otra sesión');
    assert.equal(options[0].isToday, true);

    assert.equal((await participant.api.post(`/api/sessions/${wednesday.id}/move`).send({ date: '2026-11-06' })).body.error.code, 'DAY_TAKEN');
    assert.equal((await participant.api.post(`/api/sessions/${wednesday.id}/move`).send({ date: '2026-11-03' })).body.error.code, 'INVALID_DATE', 'nunca a un día pasado');
    assert.equal((await participant.api.post(`/api/sessions/${wednesday.id}/move`).send({ date: '2026-11-12' })).body.error.code, 'INVALID_DATE', 'como mucho 6 días después');
    assert.equal((await participant.api.post(`/api/sessions/${wednesday.id}/move`).send({ date: 'mañana' })).status, 400);

    const moved = await participant.api.post(`/api/sessions/${wednesday.id}/move`).send({ date: '2026-11-07' });
    assert.equal(moved.status, 200);
    assert.deepEqual([moved.body.session.plannedDate, moved.body.session.movedFrom, moved.body.session.label], ['2026-11-07', '2026-11-04', 'Sábado · Cuerpo completo B']);
    const week = (await participant.api.get('/api/schedule/me')).body;
    assert.deepEqual(week.days.map(day => day.status), ['descanso', 'descanso', 'movida', 'descanso', 'programada', 'programada', 'descanso']);
    assert.equal(week.days[2].movedTo, '2026-11-07');
    assert.deepEqual([week.days[5].session.name, week.days[5].session.movedFrom, week.days[5].session.canMove], ['Cuerpo completo B', '2026-11-04', true]);
    let progress = (await participant.api.get('/api/progress/me')).body;
    assert.equal(progress.adherence, null, 'ya no hay sesiones vencidas: la movida cuenta el sábado');
    assert.ok(progress.calendar.some(day => day.date === '2026-11-04' && day.status === 'movida'));

    // Moverla de nuevo conserva la fecha original; volver a ese día la deja como una sesión normal.
    const again = (await participant.api.post(`/api/sessions/${wednesday.id}/move`).send({ date: '2026-11-08' })).body.session;
    assert.deepEqual([again.plannedDate, again.movedFrom], ['2026-11-08', '2026-11-04']);
    const audit = (await ctx.db.query("SELECT detail FROM audit_log WHERE action = 'session.moved' AND entity_id = $1 ORDER BY occurred_at", [wednesday.id])).rows;
    assert.deepEqual(audit.map(row => row.detail), [{ from: '2026-11-04', to: '2026-11-07' }, { from: '2026-11-07', to: '2026-11-08' }]);

    // Una sesión registrada o de otra persona no se mueve.
    ctx.advanceDays(1); // viernes 6
    await ctx.reauth(participant);
    await participant.api.post(`/api/sessions/${friday.id}/complete`).send({});
    assert.equal((await participant.api.post(`/api/sessions/${friday.id}/move`).send({ date: '2026-11-10' })).body.error.code, 'ALREADY_COMPLETED');
    const other = await ctx.register();
    assert.equal((await other.api.post(`/api/sessions/${wednesday.id}/move`).send({ date: '2026-11-10' })).status, 404);

    // Pasada una semana desde que venció, ya no se puede mover: solo registrar.
    ctx.advanceDays(10); // lunes 16: la del domingo 8 quedó sin hacer hace 8 días
    await ctx.reauth(participant);
    assert.equal((await participant.api.get(`/api/sessions/${wednesday.id}/move-options`)).body.error.code, 'TOO_OLD');
    progress = (await participant.api.get('/api/progress/me')).body;
    assert.ok(progress.calendar.some(day => day.date === '2026-11-08' && ['comodin', 'perdido'].includes(day.status)), 'si no la hizo en su nueva fecha, cuenta como no realizada');
    ctx.advanceDays(-14);
  });

  test('una rutina propia lleva el nombre que la persona le da a cada sesión', async () => {
    const participant = await participantWithProfile(ctx);
    const library = (await participant.api.get('/api/exercises')).body.exercises;
    const id = code => library.find(exercise => exercise.code === code).id;
    const body = {
      source: 'propia', name: 'Mi semana', days: [1, 4],
      sessions: [{ label: '  Piernas ', exercises: [{ exerciseId: id('sentadilla') }] }, { exercises: [{ exerciseId: id('plancha') }] }],
    };
    assert.equal((await participant.api.post('/api/plans/start').send({ ...body, sessions: [{ ...body.sessions[0], label: 'x'.repeat(41) }, body.sessions[1]] })).body.error.code, 'INVALID_SESSIONS');
    assert.equal((await participant.api.post('/api/plans/start').send(body)).status, 201);
    const { plan } = (await participant.api.get('/api/plans/me')).body;
    assert.deepEqual(plan.schedule.map(day => day.label), ['Piernas', 'Sesión 2']);
    assert.deepEqual(plan.week.filter(day => day.type === 'descanso').map(day => day.day), [2, 3, 5, 6, 7]);
    const sessions = (await participant.api.get('/api/sessions/me?to=2026-11-10')).body.sessions;
    assert.deepEqual(sessions.map(session => session.label), ['Jueves · Sesión 2', 'Lunes · Piernas']);
  });

  test('el historial de demostración del servidor local muestra una racha con el comodín usado la semana anterior', async () => {
    assert.deepEqual(await seedDemoHistory(ctx.db, ctx.config, ctx.clock.current), { seeded: true });
    assert.deepEqual(await seedDemoHistory(ctx.db, ctx.config, ctx.clock.current), { seeded: false }, 'no se duplica');
    const demo = await ctx.demo('participant');
    const progress = (await demo.get('/api/progress/me')).body;
    assert.deepEqual([progress.streak.current, progress.streak.today, progress.streak.freeze.available], [13, 'pendiente', true], 'del lunes 19 de octubre a hoy, lunes 2 de noviembre');
    assert.equal(progress.adherence, 5 / 7, 'la sesión de hoy ya cuenta como programada en la adherencia');
    assert.ok(progress.calendar.some(day => day.date === '2026-10-23' && day.status === 'comodin'));
    const week = (await demo.get('/api/schedule/me')).body;
    assert.deepEqual([week.days[0].status, week.days[0].session.canRegister], ['pendiente', true]);
  });

  test('cada persona ve solo su horario y su racha', async () => {
    const { participant } = await participantWithPlan(ctx);
    const other = await ctx.register();
    const week = (await other.api.get('/api/schedule/me')).body;
    assert.equal(week.plan, null);
    assert.ok(week.days.every(day => day.status === 'sin_rutina' && day.session === null));
    assert.equal((await other.api.get('/api/progress/me')).body.streak.current, 0);
    assert.equal((await participant.api.get('/api/schedule/me')).body.plan.name.length > 0, true);
    const trainer = await ctx.demo('trainer');
    assert.equal((await trainer.get('/api/schedule/me')).status, 403);
  });
});
