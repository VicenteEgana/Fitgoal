import express from 'express';
import { fileURLToPath } from 'node:url';
import { WindowCounter } from './lib/rate-limit.js';
import { ApiError, translateDatabaseError } from './lib/errors.js';
import { createAuthenticate } from './lib/auth.js';
import { identityRouters } from './modules/identity.js';
import { profileRouter } from './modules/profile.js';
import { catalogRouter } from './modules/catalog.js';
import { recommendRouter } from './modules/recommend.js';
import { plansRouter } from './modules/plans.js';
import { progressRouter } from './modules/progress.js';
import { estimatesRouter } from './modules/estimates.js';
import { nutritionRouter } from './modules/nutrition.js';
import { dataRightsRouter } from './modules/datarights.js';
import { adminRouter } from './modules/admin.js';

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const WEB_BUILD = fileURLToPath(new URL('../../mobile/build/web/', import.meta.url));

/**
 * Crea la API REST de FitGoal (monolito modular).
 * @param {{ db: object, config: object, now?: () => Date, logger?: (line: string) => void, webBuild?: string|null }} options
 */
export function createApp({ db, config, now = () => new Date(), logger = null, webBuild = WEB_BUILD }) {
  const app = express();
  const minute = 60 * 1000;
  const ctx = {
    db, config, now,
    ipLimiter: new WindowCounter({ windowMs: minute, max: config.rateLimit.perMinute, now: () => now().getTime() }),
    userLimiter: new WindowCounter({ windowMs: minute, max: config.rateLimit.perMinute, now: () => now().getTime() }),
    authFailures: new WindowCounter({ windowMs: config.rateLimit.authWindowMinutes * minute, max: config.rateLimit.authFailures, now: () => now().getTime() }),
  };
  ctx.authenticate = createAuthenticate(ctx);

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    const origin = req.headers.origin;
    if (origin) {
      const allowed = config.corsOrigins ? config.corsOrigins.includes(origin) : !config.production && LOCAL_ORIGIN.test(origin);
      if (!allowed) return res.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origen no permitido.' } });
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    if (logger) {
      const started = Date.now();
      res.on('finish', () => logger(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`));
    }
    next();
  });

  app.use(express.json({ limit: '100kb' }));

  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  const health = async (_req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ ok: true, database: 'up', time: now().toISOString() });
    } catch {
      res.status(503).json({ ok: false, database: 'down' });
    }
  };
  app.get('/health', health);
  app.get('/api/health', health);

  app.use('/api', (req, _res, next) => {
    const status = ctx.ipLimiter.hit(req.ip);
    if (!status.allowed) throw new ApiError(429, 'RATE_LIMITED', 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.', { retryAfterSeconds: status.retryAfterSeconds });
    next();
  });

  // Rutas públicas (sin sesión): registro, inicio de sesión y renovación.
  const identity = identityRouters(ctx);
  app.use('/api', identity.router);

  // Rutas protegidas.
  app.use('/api', ctx.authenticate);
  app.use('/api', identity.authed);
  for (const router of [profileRouter, catalogRouter, recommendRouter, plansRouter, progressRouter, estimatesRouter, nutritionRouter, dataRightsRouter, adminRouter]) app.use('/api', router(ctx));

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Recurso inexistente.' } }));
  if (webBuild) app.use('/app', express.static(webBuild));

  app.use((error, _req, res, _next) => {
    const known = error instanceof ApiError ? error : translateDatabaseError(error);
    if (known) {
      if (known.extra?.retryAfterSeconds) res.setHeader('Retry-After', String(known.extra.retryAfterSeconds));
      return res.status(known.status).json({ error: { code: known.code, message: known.message, ...known.extra } });
    }
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo de la solicitud no es un JSON válido.' } });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'La solicitud supera el tamaño permitido.' } });
    logger?.(`ERROR ${error.code ?? ''} ${error.message}`);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'No se pudo completar la operación.' } });
  });

  app.context = ctx;
  return app;
}
