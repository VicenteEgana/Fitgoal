import { createHmac, randomBytes } from 'node:crypto';

/** Política de datos vigente: se registra junto a cada consentimiento. */
export const POLICY_VERSION = 'politica-datos-2026-10-v1';

/**
 * Lee la configuración desde variables de entorno.
 * En producción exige secretos explícitos; en desarrollo genera secretos efímeros.
 */
export function loadConfig(env = process.env, overrides = {}) {
  const production = env.NODE_ENV === 'production';
  const jwtSecret = env.JWT_SECRET ?? (production ? '' : randomBytes(32).toString('hex'));
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET es obligatorio en producción y debe tener al menos 32 caracteres.');
  const pseudonymSecret = env.PSEUDONYM_SECRET ?? (production ? '' : createHmac('sha256', jwtSecret).update('seudonimos').digest('hex'));
  if (pseudonymSecret.length < 32) throw new Error('PSEUDONYM_SECRET es obligatorio en producción y debe tener al menos 32 caracteres.');
  const list = value => (value ? value.split(',').map(item => item.trim()).filter(Boolean) : null);
  return {
    production,
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
    databaseUrl: env.DATABASE_URL ?? null,
    dataDir: env.FITGOAL_DATA_DIR ?? 'data/pgdata',
    jwtSecret,
    pseudonymSecret,
    corsOrigins: list(env.CORS_ORIGIN),
    trustProxy: env.TRUST_PROXY === '1',
    timezone: env.FITGOAL_TIMEZONE ?? 'America/Santiago',
    policyVersion: POLICY_VERSION,
    accessTokenSeconds: 15 * 60,
    refreshTokenDays: 7,
    rateLimit: { perMinute: 120, authFailures: 10, authWindowMinutes: 15 },
    // Interruptor ético y legal del informe: sin habilitación del tratamiento de datos, el peso solo se registra en cuentas ficticias.
    // Los datos de la estimación energética (sexo, peso, talla y actividad) solo existen en perfiles ficticios: lo exige la base de datos.
    weightTrackingEnabled: env.WEIGHT_TRACKING_ENABLED === '1',
    allowFictitiousRegistration: env.ALLOW_FICTITIOUS_REGISTRATION ? env.ALLOW_FICTITIOUS_REGISTRATION === '1' : !production,
    ...overrides,
  };
}
