// Cifrado de los datos de salud en la API, campo por campo, con AES-256-GCM: estatura, peso, sexo y nivel de actividad del
// perfil, y cada registro de peso. La clave vive fuera de la base (variable DATA_ENCRYPTION_KEY), así que una copia de la base
// o de un respaldo no revela esos datos. Cada valor se cifra con un vector inicial aleatorio y queda ligado a su campo y a su
// titular (datos asociados), de modo que no se puede copiar el valor cifrado de una persona a otra ni de un campo a otro.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'v1.'; // formato y clave 1; una rotación de clave usaría «v2.» y conservaría la anterior para leer
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Crea un cifrador con una clave de 32 bytes. */
export function healthCipher(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('La clave de cifrado de los datos de salud debe tener 32 bytes.');
  const associated = (field, userId) => Buffer.from(`${field}:${userId}`, 'utf8');
  return {
    seal(value, field, userId) {
      if (value === null || value === undefined) return null;
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(associated(field, userId));
      const body = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
      return PREFIX + Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url');
    },
    open(text, field, userId) {
      if (text === null || text === undefined) return null;
      if (typeof text !== 'string' || !text.startsWith(PREFIX)) throw new Error(`El campo ${field} no está cifrado con el formato esperado.`);
      const raw = Buffer.from(text.slice(PREFIX.length), 'base64url');
      const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, IV_BYTES));
      decipher.setAAD(associated(field, userId));
      decipher.setAuthTag(raw.subarray(raw.length - TAG_BYTES));
      return Buffer.concat([decipher.update(raw.subarray(IV_BYTES, raw.length - TAG_BYTES)), decipher.final()]).toString('utf8');
    },
  };
}

let active = null;

/** Fija la clave del proceso. La API la fija al crearse; los scripts de datos de demostración, antes de escribir. */
export function useHealthKey(key) {
  active = healthCipher(key);
}

function cipher() {
  if (!active) throw new Error('Falta configurar la clave de cifrado de los datos de salud (DATA_ENCRYPTION_KEY).');
  return active;
}

const oneDecimal = value => Math.round(Number(value) * 10) / 10;

/** Campos cifrados del perfil y cómo se normalizan antes de cifrar y después de descifrar. */
const PROFILE_FIELDS = {
  weight_kg: { before: oneDecimal, after: Number },
  height_cm: { before: oneDecimal, after: Number },
  sex_param: { before: String, after: String },
  activity_level: { before: String, after: String },
};

/** Cifra los datos de salud de una versión del perfil (columnas weight_kg, height_cm, sex_param y activity_level). */
export function sealProfile(userId, values) {
  return Object.fromEntries(Object.entries(PROFILE_FIELDS).map(([column, { before }]) => {
    const value = values[column];
    return [column, value === null || value === undefined ? null : cipher().seal(before(value), `profile_versions.${column}`, userId)];
  }));
}

/** Descifra los datos de salud de una fila de profile_versions; el resto de la fila no cambia. */
export function openProfile(row) {
  if (!row) return row;
  const opened = { ...row };
  for (const [column, { after }] of Object.entries(PROFILE_FIELDS)) {
    const value = cipher().open(row[column], `profile_versions.${column}`, row.user_id);
    opened[column] = value === null ? null : after(value);
  }
  return opened;
}

export const sealWeight = (userId, weightKg) => cipher().seal(oneDecimal(weightKg), 'weight_records.weight_kg', userId);
export const openWeight = (userId, text) => Number(cipher().open(text, 'weight_records.weight_kg', userId));
