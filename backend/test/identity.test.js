import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, PASSWORD, POLICY } from './helpers.js';

describe('Identidad y autenticación (RF001, RF010, RNF002)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('el registro crea una cuenta de participante con hash Argon2id, consentimientos y sesión', async () => {
    const email = ctx.email('registro');
    const response = await ctx.http.post('/api/auth/register').send({ email, password: PASSWORD, policyVersion: POLICY, consents: { registro_cuenta: true, perfil_entrenamiento: true, recordatorios: true } });
    assert.equal(response.status, 201);
    assert.equal(response.body.user.role, 'user');
    assert.ok(response.body.accessToken && response.body.refreshToken);
    assert.equal(response.body.expiresInSeconds, 900);
    assert.ok(!JSON.stringify(response.body).includes('argon2'), 'la respuesta no debe incluir el hash');
    const row = (await ctx.db.query('SELECT password_hash, role FROM users WHERE email = $1', [email])).rows[0];
    assert.match(row.password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    const consents = (await ctx.db.query('SELECT purpose, policy_version FROM consents c JOIN users u ON u.id = c.user_id WHERE u.email = $1 ORDER BY purpose', [email])).rows;
    assert.deepEqual(consents.map(consent => consent.purpose), ['perfil_entrenamiento', 'recordatorios', 'registro_cuenta']);
    assert.ok(consents.every(consent => consent.policy_version === POLICY));
  });

  test('el registro exige consentimientos, política vigente y contraseña segura', async () => {
    const base = { email: ctx.email('invalido'), password: PASSWORD, policyVersion: POLICY, consents: { registro_cuenta: true, perfil_entrenamiento: true } };
    const cases = [
      [{ ...base, consents: { registro_cuenta: true } }, 'CONSENT_REQUIRED'],
      [{ ...base, policyVersion: 'otra' }, 'POLICY_VERSION_MISMATCH'],
      [{ ...base, password: 'corta' }, 'INVALID_REGISTRATION'],
      [{ ...base, email: 'no-es-correo' }, 'INVALID_REGISTRATION'],
    ];
    for (const [body, code] of cases) {
      const response = await ctx.http.post('/api/auth/register').send(body);
      assert.equal(response.status, 400, code);
      assert.equal(response.body.error.code, code);
    }
  });

  test('un correo repetido recibe un mensaje genérico que no revela si la cuenta existe', async () => {
    const first = await ctx.register();
    const repeated = await ctx.http.post('/api/auth/register').send({ email: first.email.toUpperCase(), password: PASSWORD, policyVersion: POLICY, consents: { registro_cuenta: true, perfil_entrenamiento: true } });
    assert.equal(repeated.status, 400);
    assert.equal(repeated.body.error.code, 'REGISTRATION_REJECTED');
    assert.doesNotMatch(repeated.body.error.message, /existe|registrado/i);
  });

  test('el inicio de sesión responde igual ante correo inexistente y contraseña errónea', async () => {
    const user = await ctx.register();
    const wrongPassword = await ctx.http.post('/api/auth/login').send({ email: user.email, password: 'Otra-clave-incorrecta' });
    const unknown = await ctx.http.post('/api/auth/login').send({ email: 'nadie@prueba.cl', password: 'Otra-clave-incorrecta' });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(wrongPassword.body, unknown.body);
  });

  test('las rutas protegidas exigen un JWT válido y firmado', async () => {
    assert.equal((await ctx.http.get('/api/profiles/me')).status, 401);
    assert.equal((await ctx.http.get('/api/profiles/me').set('Authorization', 'Bearer abc.def.ghi')).status, 401);
    const user = await ctx.register();
    const [header, payload, signature] = user.accessToken.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), role: 'admin' })).toString('base64url');
    assert.equal((await ctx.http.get('/api/admin/users').set('Authorization', `Bearer ${header}.${forged}.${signature}`)).status, 401);
    assert.equal((await user.api.get('/api/admin/users')).status, 403);
  });

  test('el JWT vence a los 15 minutos y el refresh token lo renueva', async () => {
    const user = await ctx.register();
    assert.equal((await user.api.get('/api/auth/me')).status, 200);
    ctx.tick(16 * 60 * 1000);
    assert.equal((await user.api.get('/api/auth/me')).status, 401);
    const refreshed = await ctx.http.post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    assert.equal(refreshed.status, 200);
    assert.equal((await ctx.as(refreshed.body.accessToken).get('/api/auth/me')).status, 200);
  });

  test('el refresh token rota y su reutilización cierra todas las sesiones de la cuenta', async () => {
    const user = await ctx.register();
    const first = await ctx.http.post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    assert.equal(first.status, 200);
    assert.notEqual(first.body.refreshToken, user.refreshToken);
    const reused = await ctx.http.post('/api/auth/refresh').send({ refreshToken: user.refreshToken });
    assert.equal(reused.status, 401);
    const audit = await ctx.db.query("SELECT 1 FROM audit_log WHERE action = 'session.reuse_detected' AND entity_id = $1", [user.user.id]);
    assert.equal(audit.rowCount, 1);
    // La sesión legítima emitida después también queda revocada: se asume robo del token.
    assert.equal((await ctx.http.post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken })).status, 401);
    assert.equal((await ctx.as(first.body.accessToken).get('/api/auth/me')).status, 401);
  });

  test('el refresh token vence a los 7 días', async () => {
    const user = await ctx.register();
    ctx.advanceDays(7);
    ctx.tick(60 * 1000);
    assert.equal((await ctx.http.post('/api/auth/refresh').send({ refreshToken: user.refreshToken })).status, 401);
  });

  test('cerrar sesión revoca el acceso y el refresh token', async () => {
    const user = await ctx.register();
    assert.equal((await user.api.post('/api/auth/logout')).status, 204);
    assert.equal((await user.api.get('/api/auth/me')).status, 401);
    assert.equal((await ctx.http.post('/api/auth/refresh').send({ refreshToken: user.refreshToken })).status, 401);
  });

  test('solo se guarda el hash del refresh token, nunca el token', async () => {
    const user = await ctx.register();
    const rows = (await ctx.db.query('SELECT refresh_token_hash FROM auth_sessions WHERE user_id = $1', [user.user.id])).rows;
    assert.ok(rows.every(row => row.refresh_token_hash !== user.refreshToken && /^[0-9a-f]{64}$/.test(row.refresh_token_hash)));
  });

  test('cambiar la contraseña invalida las sesiones anteriores', async () => {
    const user = await ctx.register();
    const other = await ctx.login(user.email, PASSWORD);
    const wrong = await user.api.post('/api/auth/change-password').send({ currentPassword: 'incorrecta-123', newPassword: 'Nueva-clave-2026' });
    assert.equal(wrong.status, 403);
    assert.equal((await user.api.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'Nueva-clave-2026' })).status, 204);
    assert.equal((await user.api.get('/api/auth/me')).status, 401);
    assert.equal((await ctx.as(other.accessToken).get('/api/auth/me')).status, 401);
    assert.equal((await ctx.http.post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status, 401);
    assert.equal((await ctx.http.post('/api/auth/login').send({ email: user.email, password: 'Nueva-clave-2026' })).status, 200);
  });

  test('cambiar el rol de una cuenta invalida su JWT previo y nadie modifica sus propios privilegios', async () => {
    const admin = await ctx.demo('admin');
    const staff = await ctx.createStaff('trainer');
    assert.equal((await staff.api.get('/api/catalog/exercises')).status, 200);
    const changed = await admin.patch(`/api/admin/users/${staff.id}`).send({ role: 'admin' });
    assert.equal(changed.status, 200);
    assert.equal((await staff.api.get('/api/catalog/exercises')).status, 401);
    const adminId = await ctx.demoId('admin');
    assert.equal((await admin.patch(`/api/admin/users/${adminId}`).send({ role: 'user' })).status, 403);
  });

  test('una cuenta bloqueada no puede iniciar sesión ni usar sus tokens', async () => {
    const admin = await ctx.demo('admin');
    const user = await ctx.register();
    assert.equal((await admin.patch(`/api/admin/users/${user.user.id}`).send({ status: 'blocked' })).status, 200);
    assert.equal((await user.api.get('/api/auth/me')).status, 401);
    assert.equal((await ctx.http.post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status, 401);
  });

  test('un participante no puede acceder a datos ni funciones de otros roles', async () => {
    const user = await ctx.register();
    for (const url of ['/api/catalog/exercises', '/api/admin/audit', '/api/catalog/templates']) assert.equal((await user.api.get(url)).status, 403, url);
    assert.equal((await user.api.post('/api/catalog/exercises').send({ code: 'x', name: 'x', description: 'x' })).status, 403);
  });
});

describe('Límites de solicitudes y cabeceras (RNF002)', () => {
  test('10 intentos fallidos en 15 minutos bloquean el inicio de sesión con 429 y se liberan al vencer la ventana', async () => {
    const ctx = await createContext({ limits: { perMinute: 1_000_000, authFailures: 10, authWindowMinutes: 15 } });
    const user = await ctx.register();
    for (let i = 0; i < 10; i += 1) assert.equal((await ctx.http.post('/api/auth/login').send({ email: user.email, password: 'incorrecta-123' })).status, 401);
    const blocked = await ctx.http.post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers['retry-after']) > 0);
    ctx.tick(16 * 60 * 1000);
    assert.equal((await ctx.http.post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status, 200);
    await ctx.close();
  });

  test('un inicio de sesión correcto reinicia el contador de fallos', async () => {
    const ctx = await createContext({ limits: { perMinute: 1_000_000, authFailures: 3, authWindowMinutes: 15 } });
    const user = await ctx.register();
    for (let i = 0; i < 2; i += 1) await ctx.http.post('/api/auth/login').send({ email: user.email, password: 'incorrecta-123' });
    assert.equal((await ctx.http.post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status, 200);
    for (let i = 0; i < 2; i += 1) assert.equal((await ctx.http.post('/api/auth/login').send({ email: user.email, password: 'incorrecta-123' })).status, 401);
    await ctx.close();
  });

  test('más de 120 solicitudes por minuto reciben 429 y la ventana se reinicia', async () => {
    const ctx = await createContext({ limits: { perMinute: 120, authFailures: 1000, authWindowMinutes: 15 }, seed: false });
    let limited = null;
    for (let i = 0; i < 125 && !limited; i += 1) {
      const response = await ctx.http.get('/api/profiles/me');
      if (response.status === 429) limited = response;
    }
    assert.ok(limited, 'debió responder 429');
    assert.equal(limited.body.error.code, 'RATE_LIMITED');
    ctx.tick(61 * 1000);
    assert.notEqual((await ctx.http.get('/api/profiles/me')).status, 429);
    await ctx.close();
  });

  test('las respuestas llevan cabeceras de seguridad y las rutas /api no se almacenan en caché', async () => {
    const ctx = await createContext({ seed: false });
    const response = await ctx.http.get('/api/health');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['x-powered-by'], undefined);
    await ctx.close();
  });

  test('CORS admite orígenes locales y rechaza orígenes externos', async () => {
    const ctx = await createContext({ seed: false });
    const local = await ctx.http.get('/api/health').set('Origin', 'http://localhost:5000');
    assert.equal(local.headers['access-control-allow-origin'], 'http://localhost:5000');
    assert.equal((await ctx.http.get('/api/health').set('Origin', 'https://sitio-externo.example')).status, 403);
    await ctx.close();
  });

  test('un JSON inválido o demasiado grande se rechaza sin detalles internos', async () => {
    const ctx = await createContext({ seed: false });
    const invalid = await ctx.http.post('/api/auth/login').set('Content-Type', 'application/json').send('{no es json');
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error.code, 'INVALID_JSON');
    const large = await ctx.http.post('/api/auth/login').send({ email: 'a@b.cl', password: 'x'.repeat(150_000) });
    assert.equal(large.status, 413);
    await ctx.close();
  });

  test('GET /health comprueba la API y la base de datos sin sesión', async () => {
    const ctx = await createContext({ seed: false });
    const response = await ctx.http.get('/health');
    assert.equal(response.status, 200);
    assert.deepEqual({ ok: response.body.ok, database: response.body.database }, { ok: true, database: 'up' });
    await ctx.close();
  });
});
