import { fail } from './errors.js';
import { verifyAccessToken } from './security.js';

/**
 * Autentica cada petición protegida: verifica el JWT y, además, que la sesión siga activa
 * y que su versión coincida con la de la cuenta (así un JWT previo pierde acceso al revocar o cambiar privilegios).
 */
export function createAuthenticate(ctx) {
  return async function authenticate(req, _res, next) {
    const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
    if (!token) fail(401, 'UNAUTHORIZED', 'Inicia sesión para continuar.');
    let payload;
    try {
      payload = await verifyAccessToken(token, ctx.config.jwtSecret, ctx.now());
    } catch {
      fail(401, 'UNAUTHORIZED', 'La sesión expiró o no es válida.');
    }
    const result = await ctx.db.query(
      `SELECT s.id AS sid, s.session_version AS session_ver, s.revoked_at, s.expires_at,
              u.id, u.email, u.role, u.status, u.is_fictitious, u.session_version AS user_ver
         FROM auth_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND u.id = $2`,
      [payload.sid, payload.sub],
    );
    const row = result.rows[0];
    const valid = row && !row.revoked_at && new Date(row.expires_at) > ctx.now() && row.status === 'active'
      && row.session_ver === row.user_ver && payload.ver === row.user_ver;
    if (!valid) fail(401, 'UNAUTHORIZED', 'La sesión expiró o no es válida.');
    req.auth = { userId: row.id, email: row.email, role: row.role, sessionId: row.sid, isFictitious: row.is_fictitious };
    const status = ctx.userLimiter.hit(row.id);
    if (!status.allowed) fail(429, 'RATE_LIMITED', 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.', { retryAfterSeconds: status.retryAfterSeconds });
    next();
  };
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.auth.role)) fail(403, 'FORBIDDEN', 'Tu rol no permite esta operación.');
    next();
  };
}
