import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { runMaintenance } from '../src/modules/admin.js';
import { usageEvent } from '../src/lib/records.js';
import { pseudonymOf } from '../src/lib/security.js';
import { createContext, participantWithPlan, participantWithProfile, PASSWORD, POLICY } from './helpers.js';

const DAY = 24 * 60 * 60 * 1000;
const count = async (ctx, sql, params) => (await ctx.db.query(sql, params)).rows[0].n;
const weights = (ctx, person) => count(ctx, 'SELECT count(*)::int AS n FROM weight_records WHERE user_id = $1', [person.user.id]);
const events = (ctx, person) => count(ctx, 'SELECT count(*)::int AS n FROM usage_events WHERE pseudonym = $1', [pseudonymOf(ctx.config.pseudonymSecret, person.user.id)]);
const enrolledAt = async (ctx, person) => (await ctx.db.query('SELECT enrolled_at FROM users WHERE id = $1', [person.user.id])).rows[0].enrolled_at;
const revoke = (person, purpose) => person.api.post('/api/consents').send({ purpose, granted: false, policyVersion: POLICY });

describe('Revocación: se borra lo que la finalidad autorizaba', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  for (const purpose of ['seguimiento_progreso', 'datos_corporales']) {
    test(`revocar ${purpose} borra el historial de peso de esa persona y de nadie más`, async () => {
      const person = await ctx.register();
      const other = await ctx.register();
      assert.equal((await person.api.post('/api/weights/me').send({ weightKg: 71.5 })).status, 201);
      assert.equal((await other.api.post('/api/weights/me').send({ weightKg: 80 })).status, 201);
      assert.equal((await revoke(person, purpose)).status, 201);
      assert.equal(await weights(ctx, person), 0);
      assert.equal(await weights(ctx, other), 1);
    });
  }

  test('revocar los datos nutricionales no borra el historial de peso', async () => {
    const person = await ctx.register();
    await person.api.post('/api/weights/me').send({ weightKg: 71.5 });
    await person.api.post('/api/consents').send({ purpose: 'datos_nutricionales', granted: true, policyVersion: POLICY });
    await revoke(person, 'datos_nutricionales');
    assert.equal(await weights(ctx, person), 1);
  });

  test('la oposición borra los pesos, los eventos de uso y la inscripción en el piloto', async () => {
    const person = await participantWithProfile(ctx);
    await person.api.post('/api/weights/me').send({ weightKg: 71.5 });
    await person.api.get('/api/plans/me');
    assert.ok(await events(ctx, person) > 0);
    const request = (await person.api.post('/api/data-requests').send({ type: 'oposicion' })).body.request;
    const admin = await ctx.demo('admin');
    assert.equal((await admin.post(`/api/admin/data-requests/${request.id}/resolve`).send({ outcome: 'resuelta' })).status, 200);
    assert.equal(await weights(ctx, person), 0);
    assert.equal(await events(ctx, person), 0);
    assert.equal(await enrolledAt(ctx, person), null);
  });
});

describe('Consentimiento de evaluación del piloto', () => {
  let ctx;
  const without = { consents: { registro_cuenta: true, perfil_entrenamiento: true } };
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('autorizarlo al registrarse inscribe a la persona en el piloto', async () => {
    const person = await ctx.register();
    assert.ok(await enrolledAt(ctx, person));
  });

  test('sin consentimiento no hay inscripción ni eventos de uso', async () => {
    const { participant: person } = await participantWithPlan(ctx, { extra: without });
    await person.api.get('/api/plans/me');
    assert.equal(await enrolledAt(ctx, person), null);
    assert.equal(await events(ctx, person), 0);
  });

  test('sin consentimiento el registro no deja el evento que mide K1', async () => {
    const before_ = await count(ctx, "SELECT count(*)::int AS n FROM usage_events WHERE event_type = 'registro_completado'");
    await ctx.register(without);
    assert.equal(await count(ctx, "SELECT count(*)::int AS n FROM usage_events WHERE event_type = 'registro_completado'"), before_);
  });

  test('otorgarlo después inscribe, y volver a otorgarlo conserva la fecha original', async () => {
    const person = await participantWithProfile(ctx, { extra: without });
    await person.api.post('/api/consents').send({ purpose: 'evaluacion_piloto', granted: true, policyVersion: POLICY });
    const first = await enrolledAt(ctx, person);
    assert.ok(first);
    ctx.tick(60 * 1000);
    await person.api.post('/api/consents').send({ purpose: 'evaluacion_piloto', granted: true, policyVersion: POLICY });
    assert.deepEqual(await enrolledAt(ctx, person), first);
  });

  test('revocarlo saca a la persona del piloto y borra sus eventos, sin afectar su rutina ni su perfil', async () => {
    const { participant: person } = await participantWithPlan(ctx);
    await person.api.get('/api/plans/me');
    assert.ok(await events(ctx, person) > 0);
    assert.equal((await revoke(person, 'evaluacion_piloto')).status, 201);
    assert.equal(await enrolledAt(ctx, person), null);
    assert.equal(await events(ctx, person), 0);
    await person.api.get('/api/plans/me');
    assert.equal(await events(ctx, person), 0, 'tampoco se registran eventos nuevos');
    assert.equal((await person.api.get('/api/profiles/me')).status, 200);
  });
});

describe('Plazos de conservación', () => {
  let ctx;
  const real = { fictitious: false };
  const backdate = (person, date) => ctx.db.query('UPDATE users SET created_at = $2 WHERE id = $1', [person.user.id, date]);
  const statusOf = async person => (await ctx.db.query('SELECT status FROM users WHERE id = $1', [person.user.id])).rows[0].status;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('solo se elimina la cuenta real inactiva: no la activa, la ficticia ni la que tiene una solicitud abierta', async () => {
    const start = ctx.clock.current;
    const inactive = await participantWithProfile(ctx, { extra: real });
    const active = await participantWithProfile(ctx, { extra: real });
    const fictitious = await participantWithProfile(ctx);
    const withRequest = await participantWithProfile(ctx, { extra: real });
    await withRequest.api.post('/api/data-requests').send({ type: 'acceso' });
    for (const person of [inactive, active, fictitious, withRequest]) await backdate(person, start);

    ctx.advanceDays(300);
    await ctx.login(active.email, PASSWORD);
    ctx.advanceDays(66);
    const result = await runMaintenance(ctx.app.context);

    assert.equal(result.accountsPurged, 1);
    assert.equal(await statusOf(inactive), 'deleted');
    assert.equal(await count(ctx, 'SELECT count(*)::int AS n FROM profile_versions WHERE user_id = $1', [inactive.user.id]), 0);
    assert.equal(await count(ctx, "SELECT count(*)::int AS n FROM audit_log WHERE action = 'user.purged' AND entity_id = $1", [inactive.user.id]), 1);
    for (const person of [active, fictitious, withRequest]) assert.equal(await statusOf(person), 'active');
    assert.equal((await runMaintenance(ctx.app.context)).accountsPurged, 0, 'la tarea es idempotente');
  });

  test('las cuentas del equipo no se eliminan por inactividad', async () => {
    assert.equal(await count(ctx, "SELECT count(*)::int AS n FROM users WHERE role <> 'user' AND status = 'deleted'"), 0);
  });

  test('las sesiones cerradas se borran, pero queda la última: de ella sale la fecha de última actividad', async () => {
    const person = await ctx.register(real);
    ctx.tick(60 * 1000);
    await ctx.login(person.email, PASSWORD);
    ctx.advanceDays(40);
    const result = await runMaintenance(ctx.app.context);
    assert.ok(result.sessionsPurged >= 1);
    assert.equal(await count(ctx, 'SELECT count(*)::int AS n FROM auth_sessions WHERE user_id = $1', [person.user.id]), 1);
  });

  test('los avisos y eventos de uso antiguos se borran; los recientes se conservan', async () => {
    const person = await ctx.register();
    const old = new Date(ctx.clock.current.getTime() - 800 * DAY);
    await ctx.db.query("INSERT INTO notifications (user_id, type, message, created_at) VALUES ($1, 'sesiones_pendientes', 'antiguo', $2), ($1, 'sesiones_pendientes', 'reciente', $3)", [person.user.id, old, ctx.clock.current]);
    await usageEvent(ctx.db, ctx.config, old, 'antiguo', 'plan_consultado');
    await usageEvent(ctx.db, ctx.config, ctx.clock.current, 'reciente', 'plan_consultado');
    const result = await runMaintenance(ctx.app.context);
    assert.ok(result.notificationsPurged >= 1);
    assert.ok(result.usageEventsPurged >= 1);
    assert.deepEqual((await ctx.db.query('SELECT message FROM notifications WHERE user_id = $1', [person.user.id])).rows.map(row => row.message), ['reciente']);
    assert.equal(await count(ctx, 'SELECT count(*)::int AS n FROM usage_events WHERE pseudonym = $1', [pseudonymOf(ctx.config.pseudonymSecret, 'reciente')]), 1);
  });
});
