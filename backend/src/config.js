import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
  const dataDir = env.FITGOAL_DATA_DIR ?? 'data/pgdata';
  const dataKey = dataKeyFrom(env, production, jwtSecret, dataDir);
  const list = value => (value ? value.split(',').map(item => item.trim()).filter(Boolean) : null);
  return {
    production,
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1'),
    databaseUrl: env.DATABASE_URL ?? null,
    dataDir,
    jwtSecret,
    pseudonymSecret,
    // Clave AES-256 de los datos de salud (src/lib/health-data.js). Nunca se guarda en la base ni en los respaldos.
    dataKey,
    corsOrigins: list(env.CORS_ORIGIN),
    trustProxy: env.TRUST_PROXY === '1',
    timezone: env.FITGOAL_TIMEZONE ?? 'America/Santiago',
    policyVersion: POLICY_VERSION,
    accessTokenSeconds: 15 * 60,
    refreshTokenDays: 7,
    rateLimit: { perMinute: 120, authFailures: 10, authWindowMinutes: 15 },
    // Plazos de conservación publicados en docs/politica_de_datos.md: si cambian, se actualiza la política.
    retention: { inactiveAccountDays: 365, closedSessionDays: 30, notificationDays: 180, usageEventDays: 730 },
    // Interruptor ético y legal del informe: sin habilitación del tratamiento de datos, el peso solo se registra en cuentas ficticias.
    // Los datos de la estimación energética (sexo, peso, talla y actividad) solo existen en perfiles ficticios: lo exige la base de datos.
    weightTrackingEnabled: env.WEIGHT_TRACKING_ENABLED === '1',
    // Interruptor de la alimentación (RF005): «FITGOAL_NUTRITION=off» la retira de la app sin borrar el catálogo, por ejemplo
    // si no hay una nutricionista habilitada que responda por las pautas aprobadas.
    features: { nutrition: env.FITGOAL_NUTRITION !== 'off' },
    allowFictitiousRegistration: env.ALLOW_FICTITIOUS_REGISTRATION ? env.ALLOW_FICTITIOUS_REGISTRATION === '1' : !production,
    ...overrides,
  };
}

/**
 * Clave de cifrado de los datos de salud: 32 bytes en hexadecimal (64 caracteres) o base64 en DATA_ENCRYPTION_KEY.
 * Producción la exige. Las pruebas la derivan del secreto de prueba. En desarrollo la base local persiste entre reinicios,
 * así que la clave también: se crea una vez junto a la base (carpeta data/, fuera de git).
 */
function dataKeyFrom(env, production, jwtSecret, dataDir) {
  const given = env.DATA_ENCRYPTION_KEY;
  if (given) {
    const key = /^[0-9a-f]{64}$/i.test(given) ? Buffer.from(given, 'hex') : Buffer.from(given, 'base64');
    if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY debe tener 32 bytes: 64 caracteres hexadecimales o su equivalente en base64.');
    return key;
  }
  if (production) throw new Error('DATA_ENCRYPTION_KEY es obligatoria en producción: cifra los datos de salud.');
  if (env.NODE_ENV === 'test') return createHmac('sha256', jwtSecret).update('datos-de-salud').digest();
  const file = join(dirname(dataDir), 'clave-datos-salud.dev');
  if (existsSync(file)) return Buffer.from(readFileSync(file, 'utf8').trim(), 'hex');
  const key = randomBytes(32);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, key.toString('hex'), { mode: 0o600 });
  return key;
}
