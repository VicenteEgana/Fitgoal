// Horario semanal y racha de días cumpliendo el plan (ver docs/investigacion_ideas_apps_fitness.md).
// Un día suma a la racha si la persona registró la sesión programada o si era un día de descanso de su rutina: descansar también
// es parte del plan, así la racha nunca empuja a entrenar sin descanso. La racha empieza con una sesión registrada. Una sesión
// vencida sin registro la corta, salvo la primera de cada semana, que cubre el comodín semanal (no suma, pero no corta).
// La adherencia (K3) no cambia: una sesión cubierta por el comodín sigue contando como no realizada.
import { addDays, localDate, weekStart } from './time.js';

/** Hitos de la racha, en días. */
export const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

/**
 * Período que cubre cada rutina: desde el día en que se inició (ese día y los que no tienen sesión son de descanso) hasta el
 * final de su última semana, o hasta el día en que se reemplazó.
 */
export function planCoverage(plans, timeZone) {
  return plans.map(plan => {
    const from = localDate(plan.started_at, timeZone);
    const end = addDays(from, 7 * plan.weeks);
    const replaced = plan.replaced_at ? localDate(plan.replaced_at, timeZone) : null;
    return { from, to: replaced && replaced < end ? replaced : end };
  });
}

/**
 * Estado de cada día entre `from` y `to`: «hecho» (sesión registrada), «descanso» (día sin sesión dentro de una rutina),
 * «pendiente» (la sesión de hoy, aún sin registrar), «programada» (sesión futura), «comodin» (primera sesión vencida sin
 * registro de la semana), «perdido» (las siguientes) o «sin_rutina».
 */
export function dayStatuses({ sessions, plans, from, to, today }) {
  const completedOn = new Map();
  for (const session of sessions) completedOn.set(session.date, Boolean(completedOn.get(session.date)) || session.completed);
  const covered = date => plans.some(plan => plan.from <= date && date <= plan.to);
  const days = [];
  let week = null;
  let freezeUsed = false;
  // Se recorre desde el lunes de la primera semana para saber si el comodín de esa semana ya se usó.
  for (let date = weekStart(from); date <= to; date = addDays(date, 1)) {
    if (weekStart(date) !== week) { week = weekStart(date); freezeUsed = false; }
    let status;
    if (!completedOn.has(date)) status = covered(date) ? 'descanso' : 'sin_rutina';
    else if (completedOn.get(date)) status = 'hecho';
    else if (date > today) status = 'programada';
    else if (date === today) status = 'pendiente';
    else if (!freezeUsed) { status = 'comodin'; freezeUsed = true; }
    else status = 'perdido';
    if (date >= from) days.push({ date, status });
  }
  return days;
}

/** Racha actual y mejor racha hasta hoy, con el estado del comodín de esta semana y el próximo hito. */
export function streakSummary({ sessions, plans, today }) {
  const empty = { current: 0, best: 0, since: null, today: 'sin_rutina', atRisk: false, milestone: null, nextMilestone: { days: MILESTONES[0], remaining: MILESTONES[0] }, freeze: { available: true, usedOn: null }, lastMissedOn: null };
  if (!plans.length) return empty;
  const first = plans.reduce((min, plan) => (plan.from < min ? plan.from : min), plans[0].from);
  if (first > today) return empty;
  const days = dayStatuses({ sessions, plans, from: first, to: today, today });
  let current = 0;
  let best = 0;
  let since = null;
  let lastMissedOn = null;
  for (const { date, status } of days) {
    if (status === 'hecho') {
      since ??= date;
      current += 1;
    } else if (status === 'descanso') {
      if (since) current += 1; // los descansos suman solo dentro de una racha ya iniciada
    } else if (status === 'perdido' || (status === 'sin_rutina' && date !== today)) {
      if (status === 'perdido') lastMissedOn = date;
      current = 0;
      since = null;
    } // «comodin» y «pendiente» no suman ni cortan; hoy, «sin_rutina» todavía no corta.
    best = Math.max(best, current);
  }
  const todayStatus = days.at(-1).status;
  const freezeDay = days.find(day => day.date >= weekStart(today) && day.status === 'comodin');
  const next = MILESTONES.find(days => days > current);
  return {
    current, best, since, today: todayStatus,
    atRisk: todayStatus === 'pendiente' || (todayStatus === 'sin_rutina' && current > 0),
    milestone: ['hecho', 'descanso'].includes(todayStatus) && MILESTONES.includes(current) ? current : null,
    nextMilestone: next ? { days: next, remaining: next - current } : null,
    freeze: { available: !freezeDay, usedOn: freezeDay?.date ?? null },
    lastMissedOn,
  };
}
