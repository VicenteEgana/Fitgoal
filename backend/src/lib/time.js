const DAY_MS = 24 * 60 * 60 * 1000;

/** Fecha local (AAAA-MM-DD) en la zona horaria dada. */
export function localDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

const parse = iso => new Date(`${iso}T00:00:00Z`);
const format = date => date.toISOString().slice(0, 10);

export const addDays = (iso, days) => format(new Date(parse(iso).getTime() + days * DAY_MS));

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export const isoWeekday = iso => ((parse(iso).getUTCDay() + 6) % 7) + 1;

/** Lunes de la semana de la fecha. */
export const weekStart = iso => addDays(iso, 1 - isoWeekday(iso));

/** Días entre dos fechas (positivo si `toIso` es posterior). */
export const daysBetween = (fromIso, toIso) => Math.round((parse(toIso).getTime() - parse(fromIso).getTime()) / DAY_MS);

/** Primera fecha igual o posterior a `fromIso` que cae en el día de semana indicado (1 a 7). */
export function nextWeekday(fromIso, weekday) {
  const delta = (weekday - isoWeekday(fromIso) + 7) % 7;
  return addDays(fromIso, delta);
}

/** Suma días hábiles (lunes a viernes) a un instante; no considera feriados. */
export function addBusinessDays(date, count) {
  const result = new Date(date.getTime());
  let remaining = count;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const weekday = result.getUTCDay();
    if (weekday !== 0 && weekday !== 6) remaining -= 1;
  }
  return result;
}

export const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
