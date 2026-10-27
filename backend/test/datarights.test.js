import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, participantWithPlan, PASSWORD } from './helpers.js';
import { pseudonymOf } from '../src/lib/security.js';

const DAY = 24 * 60 * 60 * 1000;

describe('Derechos sobre datos personales (RF009, Ley 21.719)', () => {
  let ctx;
  let admin;
  before(async () => { ctx = await createContext(); admin = await ctx.demo('admin'); });
  after(() => ctx.close());

  const open = (participant, type) => participant.api.post('/api/data-requests').send({ type });
  const resolve = (id, body) => admin.post(`/api/admin/data-requests/${id}/resolve`).send(body);

  test('la solicitud recibe un comprobante, un plazo de 30 días corridos y avisa a administración', async () => {
    const participant = await ctx.register();
    const response = await open(participant, 'acceso');
    assert.equal(response.status, 201);
    const { request } = response.body;
    assert.match(request.receiptCode, /^DR-20261102-[0-9A-F]{6}$/);
    assert.equal(new Date(request.dueAt).getTime() - new Date(request.receivedAt).getTime(), 30 * DAY);
    assert.equal(request.status, 'recibida');
    assert.ok((await admin.get('/api/notifications/me')).body.notifications.some(item => item.type === 'solicitud_derechos'));
    const duplicate = await open(participant, 'acceso');
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.body.request.id, request.id, 'una solicitud abierta del mismo tipo se reutiliza');
    assert.equal((await participant.api.get('/api/data-requests/me')).body.requests.length, 1);
  });

  test('el bloqueo temporal tiene un plazo de 2 días hábiles', async () => {
    const participant = await ctx.register();
    const { request } = (await open(participant, 'bloqueo')).body;
    assert.equal(new Date(request.dueAt).toISOString(), '2026-11-04T15:00:00.000Z', 'lunes 2 → miércoles 4');
    ctx.advanceDays(4); // viernes 6: dos días hábiles después son el martes 10
    await ctx.reauth(participant);
    assert.equal(new Date((await open(participant, 'rectificacion')).body.request.dueAt).getTime() - ctx.clock.current.getTime(), 30 * DAY);
    ctx.advanceDays(-4);
  });

  test('solo se admiten los seis derechos del titular', async () => {
    const participant = await ctx.register();
    assert.equal((await open(participant, 'venta')).body.error.code, 'INVALID_REQUEST_TYPE');
  });

  test('acceso y exportación: el titular descarga sus datos solo cuando la solicitud está resuelta', async () => {
    const { participant } = await participantWithPlan(ctx);
    const { request } = (await open(participant, 'exportacion')).body;
    assert.equal((await participant.api.get(`/api/data-requests/${request.id}/export`)).body.error.code, 'EXPORT_NOT_READY');
    assert.equal((await resolve(request.id, { outcome: 'resuelta' })).status, 200);
    const exported = await participant.api.get(`/api/data-requests/${request.id}/export`);
    assert.equal(exported.status, 200);
    assert.match(exported.headers['content-disposition'], /attachment; filename="fitgoal-datos-DR-/);
    assert.equal(exported.body.account.email, participant.email);
    assert.equal(exported.body.profiles.length, 1);
    assert.equal(exported.body.plans[0].status, 'vigente');
    assert.equal(exported.body.plans[0].source, 'recomendada');
    assert.ok(exported.body.plans[0].exercises.length > 0, 'la exportación incluye los ejercicios de la rutina');
    assert.ok(exported.body.sessions.length > 0 && exported.body.consents.length >= 3);
    assert.ok(!JSON.stringify(exported.body).includes('password'), 'la exportación no incluye credenciales');
    assert.ok(!JSON.stringify(exported.body).includes('argon2'));
    const other = await ctx.register();
    assert.equal((await other.api.get(`/api/data-requests/${request.id}/export`)).status, 404, 'otro participante no la descarga');
  });

  test('un rechazo exige fundamento y la prórroga solo se aplica una vez y no al bloqueo', async () => {
    const participant = await ctx.register();
    const { request } = (await open(participant, 'rectificacion')).body;
    assert.equal((await resolve(request.id, { outcome: 'rechazada' })).body.error.code, 'NOTE_REQUIRED');
    const extended = await resolve(request.id, { extend: true });
    assert.equal(extended.status, 200);
    assert.equal(extended.body.request.extensionApplied, true);
    assert.equal(new Date(extended.body.request.dueAt).getTime() - new Date(request.dueAt).getTime(), 30 * DAY);
    assert.equal((await resolve(request.id, { extend: true })).body.error.code, 'EXTENSION_USED');
    const rejected = await resolve(request.id, { outcome: 'rechazada', note: 'No se pudo verificar la identidad del titular.' });
    assert.equal(rejected.body.request.status, 'rechazada');
    assert.equal((await resolve(request.id, { outcome: 'resuelta' })).status, 404, 'una solicitud cerrada no se vuelve a resolver');
    const block = (await open(participant, 'bloqueo')).body.request;
    assert.equal((await resolve(block.id, { extend: true })).body.error.code, 'EXTENSION_NOT_ALLOWED');
  });

  test('oposición: se revocan los consentimientos opcionales, se borran los datos corporales y se conserva el historial', async () => {
    const participant = await ctx.register();
    await participant.api.put('/api/profiles/me').send({ age: 30, objective: 'bajar', level: 'principiante', days: [1, 3], durationMinutes: 30, equipment: 'sin_equipo', weightKg: 82, heightCm: 172 });
    assert.equal((await ctx.db.query('SELECT 1 FROM profile_versions WHERE user_id = $1 AND weight_kg IS NOT NULL', [participant.user.id])).rowCount, 1);
    const { request } = (await open(participant, 'oposicion')).body;
    await resolve(request.id, { outcome: 'resuelta' });
    const consents = (await participant.api.get('/api/consents')).body.consents;
    assert.equal(consents.find(item => item.purpose === 'recordatorios').granted, false);
    assert.equal(consents.find(item => item.purpose === 'seguimiento_progreso').granted, false);
    assert.equal(consents.find(item => item.purpose === 'perfil_entrenamiento').granted, true, 'lo esencial del servicio se mantiene');
    assert.equal((await ctx.db.query('SELECT 1 FROM profile_versions WHERE user_id = $1 AND weight_kg IS NOT NULL', [participant.user.id])).rowCount, 0, 'la estatura y el peso se borran al oponerse');
    assert.ok((await ctx.db.query("SELECT count(*)::int AS n FROM consents WHERE user_id = $1 AND purpose = 'recordatorios'", [participant.user.id])).rows[0].n >= 2);
  });

  test('bloqueo: se suspende el tratamiento, se cierran las sesiones y no se puede iniciar sesión', async () => {
    const participant = await ctx.register();
    const { request } = (await open(participant, 'bloqueo')).body;
    assert.equal((await resolve(request.id, { outcome: 'resuelta' })).status, 200);
    assert.equal((await participant.api.get('/api/auth/me')).status, 401);
    assert.equal((await ctx.http.post('/api/auth/login').send({ email: participant.email, password: PASSWORD })).status, 401);
    assert.equal((await ctx.db.query('SELECT status FROM users WHERE id = $1', [participant.user.id])).rows[0].status, 'blocked');
  });

  test('eliminación: se borran los datos personales, la rutina y los eventos, y queda solo un registro mínimo', async () => {
    const { participant } = await participantWithPlan(ctx);
    const session = (await participant.api.get('/api/sessions/me?to=2026-12-31')).body.sessions[0];
    await ctx.db.query('UPDATE training_sessions SET completed_at = $2 WHERE id = $1', [session.id, ctx.clock.current]);
    assert.equal((await participant.api.post('/api/weights/me').send({ weightKg: 70 })).status, 201);
    const { request } = (await open(participant, 'eliminacion')).body;
    const userId = participant.user.id;
    assert.ok((await ctx.db.query('SELECT 1 FROM user_plans WHERE user_id = $1', [userId])).rowCount > 0);

    assert.equal((await resolve(request.id, { outcome: 'resuelta' })).status, 200);
    const user = (await ctx.db.query('SELECT email, status, password_hash, deleted_at FROM users WHERE id = $1', [userId])).rows[0];
    assert.match(user.email, /^eliminado-.+@invalid$/);
    assert.equal(user.status, 'deleted');
    assert.ok(user.deleted_at);
    assert.ok(!user.password_hash.includes('$argon2id$v='), 'el hash original se destruye');
    for (const table of ['profile_versions', 'user_plans', 'training_sessions', 'weight_records', 'notifications', 'consents', 'auth_sessions']) {
      assert.equal((await ctx.db.query(`SELECT 1 FROM ${table} WHERE user_id = $1`, [userId])).rowCount, 0, `${table} debe quedar vacía`);
    }
    assert.equal((await ctx.db.query('SELECT 1 FROM user_plan_exercises WHERE plan_id NOT IN (SELECT id FROM user_plans)')).rowCount, 0, 'no quedan ejercicios huérfanos de rutinas');
    assert.equal((await ctx.db.query('SELECT 1 FROM usage_events WHERE pseudonym = $1', [pseudonymOf(ctx.config.pseudonymSecret, userId)])).rowCount, 0);
    assert.equal((await ctx.http.post('/api/auth/login').send({ email: participant.email, password: PASSWORD })).status, 401);
    assert.equal((await participant.api.get('/api/auth/me')).status, 401);
    // La trazabilidad se conserva sin datos personales: la solicitud y la auditoría permanecen.
    assert.equal((await ctx.db.query('SELECT status FROM data_requests WHERE id = $1', [request.id])).rows[0].status, 'resuelta');
    assert.ok((await ctx.db.query("SELECT 1 FROM audit_log WHERE action = 'datarequest.resolved' AND entity_id = $1", [request.id])).rowCount === 1);
    const listed = (await admin.get('/api/admin/data-requests?open=0')).body.requests.find(item => item.id === request.id);
    assert.equal(listed.email, null, 'administración ya no ve el correo');
  });

  test('solo administración resuelve solicitudes y el participante no ve las de otros', async () => {
    const a = await ctx.register();
    const b = await ctx.register();
    const { request } = (await open(a, 'acceso')).body;
    assert.equal((await a.api.post(`/api/admin/data-requests/${request.id}/resolve`).send({ outcome: 'resuelta' })).status, 403);
    assert.equal((await b.api.get('/api/data-requests/me')).body.requests.length, 0);
    assert.equal((await b.api.get(`/api/data-requests/${request.id}/export`)).status, 404);
    const listed = (await admin.get('/api/admin/data-requests')).body.requests;
    assert.ok(listed.some(item => item.id === request.id));
    assert.deepEqual(listed.map(item => item.dueAt), [...listed.map(item => item.dueAt)].sort(), 'ordenadas por plazo');
  });

  test('las solicitudes y su resolución quedan auditadas sin contenido sensible', async () => {
    const participant = await ctx.register();
    const { request } = (await open(participant, 'acceso')).body;
    await resolve(request.id, { outcome: 'resuelta' });
    const events = (await admin.get(`/api/admin/audit?entityId=${request.id}`)).body.events.map(event => event.action).sort();
    assert.deepEqual(events, ['datarequest.created', 'datarequest.resolved']);
  });
});
