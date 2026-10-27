// Calorías diarias para la pauta de alimentación: gasto en reposo (Mifflin-St Jeor) × factor de actividad, ajustado por
// objetivo (déficit, mantenimiento o superávit) con las reglas nutricionales aprobadas por la nutricionista.

export const FORMULA = { name: 'Mifflin-St Jeor', version: 1, reference: 'Mifflin et al., 1990' };
export const OBJECTIVE_ENERGY = { bajar: 'déficit', mantener: 'mantenimiento', subir: 'superávit' };
export const ACTIVITY_LEVELS = ['sedentario', 'ligero', 'moderado', 'intenso'];

/** Gasto energético en reposo (kcal/día): 10·peso + 6,25·talla − 5·edad + s, con s = +5 (masculino) o −161 (femenino). */
export function restingEnergy({ weightKg, heightCm, age, sex }) {
  const s = sex === 'masculino' ? 5 : -161;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + s);
}

const fmt = value => value.toLocaleString('es-CL');

/**
 * Calorías objetivo según las reglas aprobadas. `data` trae peso, estatura, edad, sexo, actividad, objetivo y categoría de IMC.
 * Aplica, en orden: ajuste de objetivo por seguridad (por ejemplo, sin déficit con bajo peso), porcentaje del objetivo,
 * tope del déficit y mínimo de calorías por sexo (sin superar el mantenimiento). Redondea a 50 kcal respetando el tope y el mínimo.
 */
export function energyTarget(rules, data) {
  const content = rules.content;
  const resting = restingEnergy(data);
  const factor = content.activityFactors[data.activityLevel];
  const maintenance = Math.round(resting * factor);
  const notices = [];
  const effectiveObjective = content.safety?.adjustObjective?.[data.bmiCategory]?.[data.objective] ?? data.objective;
  if (effectiveObjective !== data.objective) {
    notices.push({ code: 'objective_adjusted', text: content.safety?.notices?.[data.bmiCategory] ?? `Con tu IMC no recomendamos comer en ${OBJECTIVE_ENERGY[data.objective]}: te mostramos ${OBJECTIVE_ENERGY[effectiveObjective]}.` });
  }
  const percent = content.objectiveAdjustments[effectiveObjective] ?? 0;
  let target = maintenance * (1 + percent / 100);
  if (percent < 0 && content.maxDeficitKcal && maintenance - target > content.maxDeficitKcal) {
    target = maintenance - content.maxDeficitKcal;
    notices.push({ code: 'deficit_capped', text: `El déficit se limita a ${fmt(content.maxDeficitKcal)} kcal por día para bajar de forma gradual.` });
  }
  const floor = content.minimumKcal?.[data.sex];
  if (floor && target < floor && target < maintenance) {
    target = Math.min(floor, maintenance);
    notices.push({ code: 'minimum_applied', text: `No bajamos de ${fmt(floor)} kcal al día sin supervisión profesional.` });
  }
  // Se redondea a 50 kcal sin pasar el tope del déficit ni bajar del mínimo.
  let rounded = Math.round(target / 50) * 50;
  if (percent < 0 && content.maxDeficitKcal && maintenance - rounded > content.maxDeficitKcal) rounded += 50;
  if (rounded < target && notices.some(notice => notice.code === 'minimum_applied')) rounded += 50;
  return {
    formula: FORMULA,
    restingKcal: resting,
    activityFactor: factor,
    maintenanceKcal: maintenance,
    objective: data.objective,
    effectiveObjective,
    label: OBJECTIVE_ENERGY[effectiveObjective],
    adjustmentPercent: percent,
    targetKcal: rounded,
    rulesVersion: rules.version,
    notices,
  };
}
