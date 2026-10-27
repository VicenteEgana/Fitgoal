import { fail } from './errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida un identificador de ruta; evita que PostgreSQL falle con un error de sintaxis de uuid. */
export function uuidParam(value, what = 'recurso') {
  if (typeof value !== 'string' || !UUID.test(value)) fail(404, 'NOT_FOUND', `El ${what} indicado no existe.`);
  return value;
}

export const isIsoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
