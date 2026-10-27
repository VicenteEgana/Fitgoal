import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { SignJWT, jwtVerify } from 'jose';

// Parámetros mínimos recomendados por OWASP para Argon2id: 19 MiB de memoria, 2 iteraciones, 1 hilo.
const ARGON2 = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const ISSUER = 'fitgoal';

export const hashPassword = password => hash(password, ARGON2);
export const verifyPassword = (passwordHash, password) => verify(passwordHash, password).catch(() => false);

let dummyHash;
/** Verifica contra un hash falso para que el tiempo de respuesta no revele si el correo existe. */
export async function dummyVerify(password) {
  dummyHash ??= await hashPassword('contraseña-inexistente-para-igualar-tiempos');
  await verifyPassword(dummyHash, password);
}

export const sha256Hex = value => createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const pseudonymOf = (secret, identifier) => createHmac('sha256', secret).update(String(identifier)).digest('hex');

export function validatePassword(password, email) {
  if (typeof password !== 'string') return 'La contraseña es obligatoria.';
  if (password.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (password.length > 128) return 'La contraseña no puede superar los 128 caracteres.';
  if (email && password.toLowerCase() === email.toLowerCase()) return 'La contraseña no puede ser igual al correo.';
  return null;
}

const keyOf = secret => new TextEncoder().encode(secret);

export function signAccessToken({ userId, sessionId, role, version }, { secret, seconds, now = new Date() }) {
  const issued = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sid: sessionId, role, ver: version })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt(issued)
    .setExpirationTime(issued + seconds)
    .sign(keyOf(secret));
}

export async function verifyAccessToken(token, secret, now = new Date()) {
  const { payload } = await jwtVerify(token, keyOf(secret), { issuer: ISSUER, algorithms: ['HS256'], currentDate: now });
  return payload;
}
