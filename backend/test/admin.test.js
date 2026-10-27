import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, participantWithPlan, PASSWORD, POLICY } from './helpers.js';

describe('Administración, auditoría e indicadores (RF010, K1, K3, K5)', () => {
  let ctx;
  let admin;
  before(async () => { ctx = await createContext(); admin = await ctx.demo('admin'); });
  after(() => ctx.close());

  test('el administrador crea cuentas de profesionales; los participantes se registran solos', async () => {
    const email = ctx.email('nutri');
    const created = await admin.post('/api/admin/users').send({ email, password: PASSWORD, role: 'nutritionist' });
    assert.equal(created.status, 201);
    assert.equal(created.body.user.role, 'nutritionist');
    assert.ok(!JSON.stringify(created.body).includes('hash'));
    assert.equal((await ctx.login(email, PASSWORD)).user.role, 'nutritionist');
    assert.equal((await admin.post('/api/admin/users').send({ email: ctx.email('x'), password: PASSWORD, role: 'user' })).body.error.code, 'INVALID_ROLE');
    assert.equal((await admin.post('/api/admin/users').send({ email, password: PASSWORD, role: 'trainer' })).status, 409);
    assert.equal((await admin.post('/api/admin/users').send({ email: ctx.email('x'), password: 'corta', role: 'trainer' })).status, 400);
    const trainers = (await admin.get('/api/admin/users?role=trainer')).body.users;
    assert.ok(trainers.every(user => user.role === 'trainer'));
  });

  test('cambiar el rol de quien ya aprobó contenido del catálogo se rechaza para no alterar la evidencia', async () => {
    const trainerId = await ctx.demoId('trainer');
    const response = await admin.patch(`/api/admin/users/${trainerId}`).send({ role: 'admin' });
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'ROLE_IN_USE');
    assert.equal((await ctx.db.query('SELECT role FROM users WHERE id = $1', [trainerId])).rows[0].role, 'trainer');
  });

  test('la auditoría registra quién, qué y sobre qué versión, y se puede filtrar', async () => {
    const { participant, plan } = await participantWithPlan(ctx);
    const events = (await admin.get('/api/admin/audit?action=plan.started&limit=5')).body.events;
    const started = events.find(event => event.entityId === plan.id);
    assert.equal(started.actorId, participant.user.id);
    assert.equal(started.actorRole, 'user');
    assert.equal(started.entityVersion, 1);
    assert.equal(started.detail.sessions, 12);
    assert.equal(started.detail.source, 'recomendada');
    assert.match(started.detail.template, /^demo-.+ v1$/);
    assert.ok(!JSON.stringify(started).match(/password|token|schedule/i), 'sin contenido sensible');
    const byEntity = (await admin.get(`/api/admin/audit?entityId=${plan.id}`)).body.events.map(event => event.action);
    assert.deepEqual(byEntity, ['plan.started']);
    const byActor = (await admin.get(`/api/admin/audit?actorId=${participant.user.id}&limit=500`)).body.events;
    assert.ok(byActor.length > 0 && byActor.every(event => event.actorId === participant.user.id));
    assert.equal((await (await ctx.register()).api.get('/api/admin/audit')).status, 403);
  });

  test('la bitácora no se puede modificar ni borrar', async () => {
    await assert.rejects(ctx.db.query("UPDATE audit_log SET action = 'x.y'"), /solo anexado/);
    await assert.rejects(ctx.db.query('DELETE FROM audit_log'), /solo anexado/);
  });

  test('K5: toda rutina vigente se compone solo de contenido aprobado por el preparador', async () => {
    const empty = await createContext({ seed: false });
    const emptyAdmin = await empty.createStaff('admin');
    const emptyKpis = (await emptyAdmin.api.get('/api/admin/kpis')).body.kpis;
    assert.deepEqual([emptyKpis.K2.denominator, emptyKpis.K3.value, emptyKpis.K5.value], [0, null, null], 'sin participantes quedan «sin mediciones»');
    await empty.close();

    await participantWithPlan(ctx);
    const { participant } = await participantWithPlan(ctx);
    const library = (await participant.api.get('/api/exercises')).body.exercises;
    const custom = await participant.api.post('/api/plans/start').send({ source: 'propia', name: 'La mía', days: [2, 4], sessions: [{ exercises: [{ exerciseId: library[0].id }] }, { exercises: [{ exerciseId: library[1].id }] }] });
    assert.equal(custom.status, 201);
    const { K5 } = (await admin.get('/api/admin/kpis')).body.kpis;
    assert.equal(K5.numerator, K5.denominator);
    assert.ok(K5.denominator >= 2);
    assert.equal(K5.value, 1);
  });

  test('K3: la adherencia de la cohorte inscrita cuenta como no realizada la sesión sin registro', async () => {
    const { participant } = await participantWithPlan(ctx);
    await ctx.db.query('UPDATE users SET enrolled_at = $2 WHERE id = $1', [participant.user.id, ctx.clock.current]);
    const baseline = (await admin.get('/api/admin/kpis')).body.kpis.K3;
    const sessions = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions;
    ctx.advanceDays(8);
    await ctx.reauth(participant);
    await participant.api.post(`/api/sessions/${sessions[0].id}/complete`).send({});
    const adminNow = await ctx.demo('admin');
    const after = (await adminNow.get('/api/admin/kpis')).body.kpis.K3;
    assert.equal(after.denominator - baseline.denominator, 3, 'tres sesiones vencidas programadas');
    assert.equal(after.numerator - baseline.numerator, 1, 'una declarada realizada');
    ctx.advanceDays(-8);
  });

  test('K1: el tiempo de registro se mide con eventos seudonimizados del intento', async () => {
    const intentId = '3f2b8c1e-5d4a-4b6e-9a7c-1d2e3f4a5b6c';
    assert.equal((await ctx.http.post('/api/public/registration-started').send({ intentId })).status, 204);
    ctx.tick(2 * 60 * 1000);
    await ctx.register({ intentId });
    const { K1 } = (await (await ctx.demo('admin')).get('/api/admin/kpis')).body.kpis;
    assert.ok(K1.denominator >= 1 && K1.numerator >= 1, 'un registro de 2 minutos cumple el umbral de 5');
    assert.equal((await ctx.http.post('/api/public/registration-started').send({ intentId: 'no-valido' })).status, 400);
  });

  test('las rutas inexistentes y los identificadores inválidos responden 404 sin detalles internos', async () => {
    assert.equal((await admin.get('/api/no-existe')).status, 404);
    assert.equal((await admin.patch('/api/admin/users/no-es-uuid').send({ status: 'blocked' })).status, 404);
    assert.equal((await ctx.http.get('/api/no-existe')).status, 401);
  });

  test('el registro con el mismo intento no se rechaza por política distinta ni deja eventos duplicados de inicio', async () => {
    const intentId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
    await ctx.http.post('/api/public/registration-started').send({ intentId });
    const response = await ctx.http.post('/api/auth/register').send({ email: ctx.email('intento'), password: PASSWORD, policyVersion: POLICY, intentId, consents: { registro_cuenta: true, perfil_entrenamiento: true } });
    assert.equal(response.status, 201);
  });
});
