// Identidad: registro con consentimiento, inicio y cierre de sesión, renovación rotativa y cambio de contraseña.
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { fail } from '../lib/errors.js';
import { audit, usageEvent } from '../lib/records.js';
import { dummyVerify, hashPassword, randomToken, sha256Hex, signAccessToken, validatePassword, verifyPassword } from '../lib/security.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGISTRATION_REJECTED = 'No se pudo completar el registro. Revisa los datos o inicia sesión si ya tienes una cuenta.';
const OPTIONAL_CONSENTS = ['datos_corporales', 'seguimiento_progreso', 'recordatorios', 'evaluacion_piloto'];

export const normalizeEmail = value => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const userView = row => ({ id: row.id, email: row.email, role: row.role, isFictitious: row.is_fictitious });

export function identityRouters(ctx) {
  const { db, config, now } = ctx;
  const router = Router(); // rutas públicas
  const authed = Router(); // rutas que exigen sesión

  /** Emite el par de tokens: JWT de acceso de corta duración y refresh token aleatorio con hash en servidor. */
  async function openSession(tx, user, { replacing = null } = {}) {
    const refreshToken = randomToken(32);
    const created = now();
    const expires = new Date(created.getTime() + config.refreshTokenDays * 24 * 60 * 60 * 1000);
    const sessionId = randomUUID();
    await tx.query(
      `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, session_version, created_at, expires_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $5)`,
      [sessionId, user.id, sha256Hex(refreshToken), user.session_version, created, expires],
    );
    if (replacing) await tx.query('UPDATE auth_sessions SET revoked_at = $2, replaced_by = $3 WHERE id = $1', [replacing, created, sessionId]);
    const accessToken = await signAccessToken({ userId: user.id, sessionId, role: user.role, version: user.session_version }, { secret: config.jwtSecret, seconds: config.accessTokenSeconds, now: now() });
    return { accessToken, refreshToken, expiresInSeconds: config.accessTokenSeconds, user: userView(user) };
  }

  router.post('/public/registration-started', (req, res) => {
    const intentId = req.body?.intentId;
    if (typeof intentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(intentId)) fail(400, 'INVALID_INTENT', 'Identificador de intento inválido.');
    return usageEvent(db, config, now(), `intent:${intentId}`, 'registro_iniciado').then(() => res.status(204).end());
  });

  router.post('/auth/register', async (req, res) => {
    const body = req.body ?? {};
    const email = normalizeEmail(body.email);
    const passwordError = validatePassword(body.password, email);
    if (!EMAIL.test(email) || email.length > 254 || passwordError) fail(400, 'INVALID_REGISTRATION', passwordError ?? 'Ingresa un correo válido.');
    const consents = body.consents ?? {};
    if (consents.registro_cuenta !== true || consents.perfil_entrenamiento !== true) fail(400, 'CONSENT_REQUIRED', 'Debes aceptar el tratamiento de tus datos para crear la cuenta y tu perfil de entrenamiento.');
    if (body.policyVersion !== config.policyVersion) fail(400, 'POLICY_VERSION_MISMATCH', 'La política de datos mostrada no es la vigente. Actualiza la app.');
    const fictitious = body.fictitious === true;
    if (fictitious && !config.allowFictitiousRegistration) fail(400, 'INVALID_REGISTRATION', 'Esta instalación no admite cuentas ficticias.');
    if (body.intentId !== undefined && !/^[0-9a-f-]{36}$/i.test(String(body.intentId))) fail(400, 'INVALID_INTENT', 'Identificador de intento inválido.');
    const passwordHash = await hashPassword(body.password);
    const session = await db.transaction(async tx => {
      const exists = await tx.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
      if (exists.rowCount) fail(400, 'REGISTRATION_REJECTED', REGISTRATION_REJECTED);
      const inserted = await tx.query(
        `INSERT INTO users (email, password_hash, role, is_fictitious) VALUES ($1, $2, 'user', $3)
         RETURNING id, email, role, is_fictitious, session_version`,
        [email, passwordHash, fictitious],
      );
      const user = inserted.rows[0];
      const granted = ['registro_cuenta', 'perfil_entrenamiento', ...OPTIONAL_CONSENTS.filter(purpose => consents[purpose] === true)];
      for (const purpose of granted) await tx.query('INSERT INTO consents (user_id, purpose, policy_version, granted) VALUES ($1, $2, $3, true)', [user.id, purpose, config.policyVersion]);
      await audit(tx, now(), { action: 'user.registered', entityType: 'user', entityId: user.id, detail: { consents: granted } });
      await usageEvent(tx, config, now(), `intent:${body.intentId ?? user.id}`, 'registro_completado');
      return openSession(tx, user);
    });
    res.status(201).json(session);
  });

  router.post('/auth/login', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const keys = [`acct:${email}`, `ip:${req.ip}`];
    for (const key of keys) {
      const status = ctx.authFailures.peek(key);
      if (status.blocked) fail(429, 'RATE_LIMITED', 'Demasiados intentos fallidos. Espera unos minutos antes de intentar de nuevo.', { retryAfterSeconds: status.retryAfterSeconds });
    }
    const rejected = () => {
      for (const key of keys) ctx.authFailures.hit(key);
      fail(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
    };
    if (typeof password !== 'string' || !EMAIL.test(email)) { await dummyVerify(String(password ?? '')); rejected(); }
    const found = await db.query('SELECT id, email, password_hash, role, status, is_fictitious, session_version FROM users WHERE lower(email) = $1', [email]);
    const user = found.rows[0];
    if (!user) { await dummyVerify(password); rejected(); }
    const matches = await verifyPassword(user.password_hash, password);
    if (!matches || user.status !== 'active') rejected();
    for (const key of keys) ctx.authFailures.reset(key);
    const session = await db.transaction(async tx => {
      const opened = await openSession(tx, user);
      await audit(tx, now(), { actor: { userId: user.id, role: user.role }, action: 'session.opened', entityType: 'user', entityId: user.id });
      return opened;
    });
    res.json(session);
  });

  router.post('/auth/refresh', async (req, res) => {
    const token = req.body?.refreshToken;
    if (typeof token !== 'string' || token.length < 20) fail(401, 'UNAUTHORIZED', 'La sesión expiró. Inicia sesión de nuevo.');
    const result = await db.transaction(async tx => {
      const found = await tx.query(
        `SELECT s.id, s.user_id, s.session_version AS session_ver, s.revoked_at, s.expires_at,
                u.id AS uid, u.email, u.role, u.status, u.is_fictitious, u.session_version
           FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.refresh_token_hash = $1 FOR UPDATE OF s`,
        [sha256Hex(token)],
      );
      const row = found.rows[0];
      if (!row) return { error: 'UNKNOWN' };
      if (row.revoked_at) {
        // Reutilización de un token ya rotado: se asume robo y se cierran todas las sesiones de la cuenta.
        await tx.query('UPDATE auth_sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id, now()]);
        await audit(tx, now(), { action: 'session.reuse_detected', entityType: 'user', entityId: row.user_id });
        return { error: 'REUSED' };
      }
      if (new Date(row.expires_at) <= now() || row.status !== 'active' || row.session_ver !== row.session_version) return { error: 'EXPIRED' };
      return { session: await openSession(tx, { id: row.uid, email: row.email, role: row.role, is_fictitious: row.is_fictitious, session_version: row.session_version }, { replacing: row.id }) };
    });
    if (result.error) fail(401, 'UNAUTHORIZED', 'La sesión expiró. Inicia sesión de nuevo.');
    res.json(result.session);
  });

  authed.post('/auth/logout', async (req, res) => {
    await db.query('UPDATE auth_sessions SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL', [req.auth.sessionId, now()]);
    res.status(204).end();
  });

  authed.post('/auth/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    const passwordError = validatePassword(newPassword, req.auth.email);
    if (passwordError) fail(400, 'INVALID_PASSWORD', passwordError);
    const found = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.auth.userId]);
    if (typeof currentPassword !== 'string' || !(await verifyPassword(found.rows[0].password_hash, currentPassword))) fail(403, 'INVALID_CREDENTIALS', 'La contraseña actual no es correcta.');
    const passwordHash = await hashPassword(newPassword);
    await db.transaction(async tx => {
      // Cambiar la contraseña invalida todas las sesiones: sube la versión de sesión y revoca los refresh tokens.
      await tx.query('UPDATE users SET password_hash = $2, session_version = session_version + 1, updated_at = $3 WHERE id = $1', [req.auth.userId, passwordHash, now()]);
      await tx.query('UPDATE auth_sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [req.auth.userId, now()]);
      await audit(tx, now(), { actor: req.auth, action: 'user.password_changed', entityType: 'user', entityId: req.auth.userId });
    });
    res.status(204).end();
  });

  authed.get('/auth/me', (req, res) => {
    res.json({ user: { id: req.auth.userId, email: req.auth.email, role: req.auth.role, isFictitious: req.auth.isFictitious } });
  });

  return { router, authed };
}
