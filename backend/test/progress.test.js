import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, participantWithPlan, recommendedFor } from './helpers.js';
import { pseudonymOf } from '../src/lib/security.js';
import { runMaintenance } from '../src/modules/admin.js';

/** Participante que inicia su rutina el lunes 2 de noviembre: sesiones los días 4, 6, 9, 11, 13, 16... (miércoles, viernes y lunes). */
async function withPlan(ctx, extra = {}) {
  const { participant } = await participantWithPlan(ctx, { extra });
  return participant;
}

describe('Seguimiento de sesiones y progreso (RF007, K2, K3)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('no se puede registrar una sesión futura; una sesión vencida se registra una vez y la operación es idempotente', async () => {
    const participant = await withPlan(ctx);
    const sessions = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions;
    const [first, second] = sessions;
    assert.equal(first.plannedDate, '2026-11-04');
    assert.equal((await participant.api.post(`/api/sessions/${first.id}/complete`).send({})).body.error.code, 'FUTURE_SESSION');
    ctx.advanceDays(3); // jueves 5
    await ctx.reauth(participant);
    const done = await participant.api.post(`/api/sessions/${first.id}/complete`).send({ note: 'Sin molestias' });
    assert.equal(done.status, 200);
    assert.equal(done.body.session.completed, true);
    const completedAt = done.body.session.completedAt;
    const again = await participant.api.post(`/api/sessions/${first.id}/complete`).send({});
    assert.equal(again.body.session.completedAt, completedAt, 'registrar de nuevo no cambia la fecha');
    assert.equal((await participant.api.post(`/api/sessions/${second.id}/complete`).send({})).body.error.code, 'FUTURE_SESSION');
    ctx.advanceDays(-3);
  });

  test('la adherencia cuenta como no realizada la sesión sin registro y se agrupa por semana', async () => {
    const participant = await withPlan(ctx);
    const sessions = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions;
    ctx.advanceDays(8); // martes 10: vencieron el 4, el 6 y el 9
    await ctx.reauth(participant);
    await participant.api.post(`/api/sessions/${sessions[0].id}/complete`).send({});
    const progress = (await participant.api.get('/api/progress/me')).body;
    assert.equal(progress.planned, 3);
    assert.equal(progress.completed, 1);
    assert.equal(progress.adherence, 1 / 3);
    assert.deepEqual(progress.weeks.map(week => [week.weekStart, week.planned, week.completed]), [['2026-11-02', 2, 1], ['2026-11-09', 1, 0]]);
    ctx.advanceDays(-8);
  });

  test('sin sesiones vencidas no hay adherencia calculable', async () => {
    const participant = await withPlan(ctx);
    const progress = (await participant.api.get('/api/progress/me')).body;
    assert.deepEqual([progress.planned, progress.completed, progress.adherence], [0, 0, null]);
  });

  test('las sesiones de otro participante no se pueden registrar ni ver', async () => {
    const a = await withPlan(ctx);
    const b = await ctx.register();
    const sessions = (await a.api.get('/api/sessions/me?to=2026-12-31')).body.sessions;
    ctx.advanceDays(3);
    await ctx.reauth(b);
    assert.equal((await b.api.post(`/api/sessions/${sessions[0].id}/complete`).send({})).status, 404);
    assert.equal((await b.api.get('/api/sessions/me?to=2026-12-31')).body.sessions.length, 0);
    assert.equal((await b.api.post('/api/sessions/no-es-un-uuid/complete').send({})).status, 404);
    ctx.advanceDays(-3);
  });

  test('las sesiones de una rutina reemplazada ya no se pueden registrar', async () => {
    const participant = await withPlan(ctx);
    const old = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions[0];
    const [other] = await recommendedFor(participant);
    const next = await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: other.id, days: [2, 4] });
    assert.equal(next.status, 201);
    assert.equal(next.body.plan.replaced, true);
    ctx.advanceDays(3);
    await ctx.reauth(participant);
    const response = await participant.api.post(`/api/sessions/${old.id}/complete`).send({});
    assert.ok([404, 409].includes(response.status), 'la sesión futura del plan anterior ya no existe');
    ctx.advanceDays(-3);
  });

  test('el peso solo se guarda con consentimiento de seguimiento; sin él se rechaza el peso y la sesión sí queda guardada', async () => {
    const participant = await withPlan(ctx);
    const session = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions[0];
    ctx.advanceDays(3);
    await ctx.reauth(participant);
    await participant.api.post('/api/consents').send({ purpose: 'seguimiento_progreso', granted: false, policyVersion: 'politica-datos-2026-10-v1' });
    const refused = await participant.api.post(`/api/sessions/${session.id}/complete`).send({ weightKg: 71.5 });
    assert.equal(refused.status, 200);
    assert.equal(refused.body.session.completed, true);
    assert.match(refused.body.weightRejected, /consentimiento/);
    assert.equal((await participant.api.get('/api/weights/me')).body.enabled, false);
    assert.equal((await participant.api.post('/api/weights/me').send({ weightKg: 71.5 })).status, 403);

    await participant.api.post('/api/consents').send({ purpose: 'seguimiento_progreso', granted: true, policyVersion: 'politica-datos-2026-10-v1' });
    assert.equal((await participant.api.post('/api/weights/me').send({ weightKg: 71.5 })).status, 201);
    assert.equal((await participant.api.post('/api/weights/me').send({ weightKg: 71.2 })).status, 201, 'un registro por día: el segundo lo reemplaza');
    const weights = (await participant.api.get('/api/weights/me')).body;
    assert.deepEqual(weights.weights.map(item => item.weightKg), [71.2]);
    assert.equal((await participant.api.post('/api/weights/me').send({ weightKg: 0 })).body.error.code, 'INVALID_WEIGHT');
    assert.equal((await participant.api.post('/api/weights/me').send({ weightKg: 70, recordedOn: '2026-12-31' })).body.error.code, 'INVALID_DATE');
    const progress = (await participant.api.get('/api/progress/me')).body;
    assert.equal(progress.weightsEnabled, true);
    ctx.advanceDays(-3);
  });

  test('una cuenta real no registra peso mientras el tratamiento de datos no esté habilitado', async () => {
    const real = await ctx.register({ fictitious: false });
    const response = await real.api.post('/api/weights/me').send({ weightKg: 70 });
    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, 'WEIGHT_NOT_ENABLED');
    const enabled = await createContext({ config: { weightTrackingEnabled: true } });
    const person = await enabled.register({ fictitious: false });
    assert.equal((await person.api.post('/api/weights/me').send({ weightKg: 70 })).status, 201);
    await enabled.close();
  });

  test('los eventos de uso se guardan con seudónimo HMAC, sin identificar a la cuenta', async () => {
    const participant = await withPlan(ctx);
    const session = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions[0];
    ctx.advanceDays(3);
    await ctx.reauth(participant);
    await participant.api.post(`/api/sessions/${session.id}/complete`).send({});
    const pseudonym = pseudonymOf(ctx.config.pseudonymSecret, participant.user.id);
    const events = (await ctx.db.query('SELECT event_type FROM usage_events WHERE pseudonym = $1', [pseudonym])).rows.map(row => row.event_type);
    assert.ok(events.includes('sesion_registrada'));
    assert.match(pseudonym, /^[0-9a-f]{64}$/);
    assert.notEqual(pseudonym, participant.user.id);
    const columns = (await ctx.db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_events'")).rows.map(row => row.column_name);
    assert.ok(!columns.includes('user_id'), 'usage_events no referencia a la cuenta');
    ctx.advanceDays(-3);
  });
});

describe('Avisos internos y tareas periódicas (RF008)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('los avisos se listan, se marcan como leídos y solo pertenecen a su destinatario', async () => {
    const participant = await withPlan(ctx);
    const other = await ctx.register();
    const admin = await ctx.demo('admin');
    const { request } = (await participant.api.post('/api/data-requests').send({ type: 'acceso' })).body;
    await admin.post(`/api/admin/data-requests/${request.id}/resolve`).send({ outcome: 'resuelta' });
    const list = (await participant.api.get('/api/notifications/me')).body;
    assert.equal(list.unread, 1);
    const notice = list.notifications.find(item => item.type === 'solicitud_derechos');
    assert.equal(notice.read, false);
    assert.equal((await other.api.post(`/api/notifications/${notice.id}/read`)).status, 404);
    assert.equal((await participant.api.post(`/api/notifications/${notice.id}/read`)).status, 204);
    assert.equal((await participant.api.get('/api/notifications/me?unread=1')).body.notifications.some(item => item.id === notice.id), false);
    assert.equal((await participant.api.post('/api/notifications/read-all')).status, 204);
    assert.equal((await participant.api.get('/api/notifications/me')).body.unread, 0);
  });

  test('iniciar una rutina no genera avisos de revisión: la persona la recibe al instante', async () => {
    const participant = await withPlan(ctx);
    assert.equal((await participant.api.get('/api/notifications/me')).body.notifications.length, 0);
  });

  test('el recordatorio de sesiones solo llega a quien lo activó y no se repite en la semana', async () => {
    const withReminders = await withPlan(ctx);
    const without = await withPlan(ctx, { consents: { registro_cuenta: true, perfil_entrenamiento: true } });
    ctx.advanceDays(10); // viernes 13
    const result = await runMaintenance(ctx.app.context);
    assert.ok(result.sessionReminders >= 1);
    const noticesOf = async person => (await ctx.db.query("SELECT message FROM notifications WHERE user_id = $1 AND type = 'sesiones_pendientes'", [person.user.id])).rows;
    assert.equal((await noticesOf(withReminders)).length, 1);
    assert.match((await noticesOf(withReminders))[0].message, /sesiones? de la última semana sin registrar/);
    assert.equal((await noticesOf(without)).length, 0);
    assert.equal((await runMaintenance(ctx.app.context)).sessionReminders, 0);
    ctx.advanceDays(-10);
  });
});
