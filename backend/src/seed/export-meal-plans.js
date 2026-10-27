// Escribe docs/pautas_de_alimentacion.md con las pautas de demostración tal como las ve la app (2.000 kcal de referencia).
// Uso: node src/seed/export-meal-plans.js
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FOODS, NUTRITION_RULES, REFERENCE_KCAL, normalizedMealPlans } from './nutrition.js';
import { buildDays, MEAL_LABELS, weekAverage } from '../lib/meal-plans.js';
import { energyTarget } from '../lib/energy.js';

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const food = new Map(FOODS.map(([code, name, category, kcal, protein, carbs, fat, unitName, unitGrams]) => [code, { code, name, category, kcal_100g: kcal, protein_100g: protein, carbs_100g: carbs, fat_100g: fat, unit_name: unitName, unit_grams: unitGrams }]));
const n = value => value.toLocaleString('es-CL');

const rowsOf = plan => plan.days.flatMap((day, index) => Object.entries(day).flatMap(([meal, list]) => list.map(([code, grams], position) => ({ ...food.get(code), day_no: index + 1, meal, position: position + 1, grams }))));

const plans = normalizedMealPlans(REFERENCE_KCAL);
const examples = [
  ['Mujer, 30 años, 165 cm, 62 kg, actividad ligera, quiere bajar de peso', { weightKg: 62, heightCm: 165, age: 30, sex: 'femenino', activityLevel: 'ligero', objective: 'bajar', bmiCategory: 'normal' }],
  ['Hombre, 30 años, 180 cm, 80 kg, actividad moderada, quiere mantener su peso', { weightKg: 80, heightCm: 180, age: 30, sex: 'masculino', activityLevel: 'moderado', objective: 'mantener', bmiCategory: 'normal' }],
  ['Hombre, 25 años, 175 cm, 68 kg, actividad intensa, quiere subir de peso', { weightKg: 68, heightCm: 175, age: 25, sex: 'masculino', activityLevel: 'intenso', objective: 'subir', bmiCategory: 'normal' }],
];

const lines = [
  '# Pautas de alimentación de 7 días (demostración)',
  '',
  'Generado desde `backend/src/seed/nutrition.js` con `node src/seed/export-meal-plans.js`: es exactamente lo que muestra la app con las porciones de referencia. **Es contenido de demostración**: la nutricionista del proyecto debe revisarlo y aprobarlo antes del piloto. Fundamento en `docs/investigacion_alimentacion.md`.',
  '',
  '## Cómo se ajustan los gramos a cada persona',
  '',
  `Cada pauta está escrita para ${n(REFERENCE_KCAL)} kcal al día. Si la persona indicó estatura, peso, sexo y nivel de actividad (con sus consentimientos), la app estima su mantenimiento con Mifflin-St Jeor × factor de actividad y aplica su objetivo: **déficit ${NUTRITION_RULES.objectiveAdjustments.bajar} %** (con un tope de ${n(NUTRITION_RULES.maxDeficitKcal)} kcal y un mínimo de ${n(NUTRITION_RULES.minimumKcal.femenino)} kcal en mujeres y ${n(NUTRITION_RULES.minimumKcal.masculino)} kcal en hombres), **mantenimiento** o **superávit +${NUTRITION_RULES.objectiveAdjustments.subir} %**. Luego multiplica los gramos de cada día por la misma proporción, salvo las verduras, que quedan fijas. Lo que se cuenta por unidad (huevos, claras, rebanadas, láminas, potes y marraquetas) se sirve en unidades enteras, o medias en la marraqueta, y el resto de los alimentos compensa la diferencia; los demás gramos se redondean al gramo hasta 20 g y de 5 en 5 g sobre eso.`,
  '',
  '| Ejemplo | Mantenimiento | Objetivo | Calorías de la pauta |',
  '|---|---|---|---|',
  ...examples.map(([label, data]) => { const target = energyTarget({ version: 1, content: NUTRITION_RULES }, data); return `| ${label} | ${n(target.maintenanceKcal)} kcal | ${target.label} | **${n(target.targetKcal)} kcal** |`; }),
  '',
  'Por ejemplo, 100 g de pechuga de pollo en la pauta de referencia pasan a unos 80 g con 1.600 kcal y a unos 125 g con 2.500 kcal.',
  '',
];

for (const [diet, plan] of Object.entries(plans)) {
  const days = buildDays(rowsOf(plan), REFERENCE_KCAL);
  const average = weekAverage(days);
  lines.push(`## ${plan.name}`, '', plan.summary, '', `Promedio semanal: ${n(average.kcal)} kcal · proteínas ${average.protein} g (${average.percent.protein} %) · carbohidratos ${average.carbs} g (${average.percent.carbs} %) · grasas ${average.fat} g (${average.percent.fat} %).`, '');
  for (const day of days) {
    lines.push(`### ${DAY_LABELS[day.dayNo - 1]} · ${n(day.totals.kcal)} kcal · P ${day.totals.protein} g · C ${day.totals.carbs} g · G ${day.totals.fat} g`, '', '| Comida | Alimentos | kcal | P | C | G |', '|---|---|---|---|---|---|');
    for (const meal of day.meals) {
      const items = meal.items.map(item => `${item.name} ${item.grams} g${item.household ? ` (${item.household})` : ''}`).join('; ');
      lines.push(`| ${MEAL_LABELS[meal.meal]} | ${items} | ${meal.totals.kcal} | ${meal.totals.protein} | ${meal.totals.carbs} | ${meal.totals.fat} |`);
    }
    lines.push('');
  }
}

lines.push('## Alimentos usados (composición por 100 g)', '', '| Alimento | Grupo | kcal | Proteínas (g) | Carbohidratos (g) | Grasas (g) | Medida casera |', '|---|---|---|---|---|---|---|');
for (const [, name, category, kcal, protein, carbs, fat, unitName, unitGrams] of FOODS) {
  lines.push(`| ${name} | ${category} | ${n(kcal)} | ${n(protein)} | ${n(carbs)} | ${n(fat)} | ${unitName ? `1 ${unitName} = ${n(unitGrams)} g` : '—'} |`);
}
lines.push('', 'Valores referenciales de USDA FoodData Central y de etiquetas de productos chilenos; deben verificarse con la tabla de composición de alimentos chilena (INTA) y los productos que se usen en el piloto.', '');

const target = fileURLToPath(new URL('../../../docs/pautas_de_alimentacion.md', import.meta.url));
writeFileSync(target, lines.join('\n'), 'utf8');
console.log(`Escrito: ${target}`);
