export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const fail = (status, code, message, extra) => { throw new ApiError(status, code, message, extra); };

/** Traduce los errores de restricción de PostgreSQL a respuestas de la API. */
export function translateDatabaseError(error) {
  const code = error?.code;
  if (code === '23505') return new ApiError(409, 'CONFLICT', 'Ya existe un registro con esos datos o con ese estado.');
  if (code === '23514' || code === '23502') return new ApiError(400, 'INVALID_DATA', 'Los datos no cumplen las reglas de integridad.');
  if (code === '23503') return new ApiError(409, 'REFERENCE_ERROR', 'La operación referencia datos inexistentes o no permitidos.');
  return null;
}
