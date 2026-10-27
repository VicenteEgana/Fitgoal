// Cálculos de las pautas de alimentación: gramos ajustados a las calorías, medidas caseras y totales de macronutrientes.

export const MEALS = ['desayuno', 'colacion', 'almuerzo', 'once', 'cena'];
export const MEAL_LABELS = { desayuno: 'Desayuno', colacion: 'Colación', almuerzo: 'Almuerzo', once: 'Once', cena: 'Cena' };
export const DIETS = ['mediterranea', 'alta_proteina', 'baja_carbohidratos', 'vegetariana'];
export const FOOD_CATEGORIES = ['proteinas', 'lacteos', 'cereales', 'legumbres', 'frutas', 'verduras', 'grasas'];

/** Gramos prácticos: hasta 20 g se redondea al gramo (aceite, frutos secos); sobre eso, de 5 en 5 g. */
export const roundGrams = grams => (grams < 20 ? Math.max(1, Math.round(grams)) : Math.round(grams / 5) * 5);

const FRACTIONS = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
const plural = name => name.split(' ').map(word => (/[aeiouáéíóú]$/.test(word) ? `${word}s` : `${word}es`)).join(' ');

/** Medida casera aproximada: «≈ 2 rebanadas», «≈ ½ unidad» o «≈ 8 unidades» (unidades pequeñas, en enteros). */
export function householdMeasure(grams, unitName, unitGrams) {
  if (!unitName || !unitGrams) return null;
  const count = grams / unitGrams;
  if (unitGrams < 10) {
    const whole = Math.max(1, Math.round(count));
    return `≈ ${whole} ${whole === 1 ? unitName : plural(unitName)}`;
  }
  const quarters = Math.max(0.25, Math.round(count * 4) / 4);
  const whole = Math.floor(quarters);
  const text = `${whole > 0 ? whole : ''}${FRACTIONS[quarters - whole] ?? ''}`;
  return `≈ ${text} ${quarters > 1 ? plural(unitName) : unitName}`;
}

const one = value => Math.round(value * 10) / 10;

/** Aporte de un alimento según sus gramos (composición por 100 g). */
export function itemNutrients(food, grams) {
  const ratio = grams / 100;
  return { kcal: Math.round(Number(food.kcal_100g) * ratio), protein: one(Number(food.protein_100g) * ratio), carbs: one(Number(food.carbs_100g) * ratio), fat: one(Number(food.fat_100g) * ratio) };
}

/** Suma de aportes y porcentaje de la energía que viene de cada macronutriente (4, 4 y 9 kcal por gramo). */
export function totals(items) {
  const sum = items.reduce((acc, item) => ({ kcal: acc.kcal + item.kcal, protein: acc.protein + item.protein, carbs: acc.carbs + item.carbs, fat: acc.fat + item.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const energy = sum.protein * 4 + sum.carbs * 4 + sum.fat * 9;
  const percent = energy > 0
    ? { protein: Math.round((sum.protein * 4 * 100) / energy), carbs: Math.round((sum.carbs * 4 * 100) / energy), fat: Math.round((sum.fat * 9 * 100) / energy) }
    : { protein: 0, carbs: 0, fat: 0 };
  return { kcal: Math.round(sum.kcal), protein: Math.round(sum.protein), carbs: Math.round(sum.carbs), fat: Math.round(sum.fat), percent };
}

// Lo que se cuenta por unidad (huevo, clara, rebanada, lámina, pote o marraqueta) se sirve en unidades enteras, o medias si la
// unidad pesa más de 60 g (salvo los potes). Se redondea hacia abajo, con margen, y el resto de los alimentos del día compensa
// la diferencia de calorías: así las porciones crecen sobre todo en los alimentos que se pesan.
const COUNTABLE_UNITS = new Set(['unidad', 'clara', 'rebanada', 'lámina', 'pote']);
const COUNTABLE_CATEGORIES = new Set(['proteinas', 'cereales', 'lacteos']);
const countable = row => COUNTABLE_UNITS.has(row.unit_name) && COUNTABLE_CATEGORIES.has(row.category) && Number(row.unit_grams) >= 10;
function roundToUnits(row, grams, nearest) {
  const unit = Number(row.unit_grams);
  const step = unit <= 60 || row.unit_name === 'pote' ? unit : unit / 2;
  return Math.round(Math.max(step, (nearest ? Math.round(grams / step) : Math.floor(grams / step + 0.2)) * step));
}

/**
 * Arma los 7 días de una pauta para una energía diaria: cada día se escala para sumar esa energía, salvo las verduras,
 * que quedan fijas como base libre. `rows` son los ítems de la pauta con la composición de su alimento. Con `nearestUnits`
 * (al escribir la pauta de referencia) las unidades se redondean al entero más cercano; al personalizar, hacia abajo.
 */
export function buildDays(rows, targetKcal, { nearestUnits = false } = {}) {
  const days = [];
  for (let dayNo = 1; dayNo <= 7; dayNo += 1) {
    const dayRows = rows.filter(row => row.day_no === dayNo);
    if (!dayRows.length) continue;
    const kcalOf = (row, grams) => Number(row.kcal_100g) * grams / 100;
    const energy = filter => dayRows.filter(filter).reduce((sum, row) => sum + kcalOf(row, Number(row.grams)), 0);
    const fixed = energy(row => row.category === 'verduras');
    const scalable = energy(row => row.category !== 'verduras');
    const factor = scalable > 0 ? Math.max(0.3, (targetKcal - fixed) / scalable) : 1;
    // Primero las unidades enteras; después, el factor del resto para que el día sume la energía buscada.
    const units = new Map(dayRows.filter(countable).map(row => [row, roundToUnits(row, Number(row.grams) * factor, nearestUnits)]));
    const unitsKcal = [...units].reduce((sum, [row, grams]) => sum + kcalOf(row, grams), 0);
    const rest = energy(row => row.category !== 'verduras' && !countable(row));
    const restFactor = rest > 0 ? Math.max(0.3, (targetKcal - fixed - unitsKcal) / rest) : factor;
    const meals = MEALS.map(meal => {
      const items = dayRows.filter(row => row.meal === meal).sort((a, b) => a.position - b.position).map(row => {
        const grams = row.category === 'verduras' ? Number(row.grams) : units.has(row) ? units.get(row) : roundGrams(Number(row.grams) * restFactor);
        return {
          code: row.code, name: row.name, category: row.category, position: row.position, grams, household: householdMeasure(grams, row.unit_name, row.unit_grams === null ? null : Number(row.unit_grams)), ...itemNutrients(row, grams),
          ...(row.swapped_from ? { swappedFrom: row.swapped_from } : {}),
        };
      });
      return { meal, label: MEAL_LABELS[meal], items, totals: totals(items) };
    }).filter(meal => meal.items.length);
    days.push({ dayNo, meals, totals: totals(meals.flatMap(meal => meal.items)) });
  }
  return days;
}

/**
 * Gramos de un alimento de reemplazo que aportan la misma energía que el original (sistema de intercambio de alimentos).
 * Las verduras, base libre de la pauta, conservan sus gramos.
 */
export function equivalentGrams(from, to, grams) {
  if (from.category === 'verduras' || !(Number(to.kcal_100g) > 0)) return grams;
  return (grams * Number(from.kcal_100g)) / Number(to.kcal_100g);
}

const FOOD_FIELDS = ['code', 'name', 'category', 'kcal_100g', 'protein_100g', 'carbs_100g', 'fat_100g', 'unit_name', 'unit_grams'];
export const itemKey = row => `${row.day_no}-${row.meal}-${row.position}`;

/** Reemplaza el alimento de un ítem de la pauta por otro, con los gramos equivalentes en energía. */
export function swapRow(row, food) {
  return { ...row, ...Object.fromEntries(FOOD_FIELDS.map(field => [field, food[field]])), grams: equivalentGrams(row, food, Number(row.grams)), swapped_from: { code: row.code, name: row.name } };
}

/** Aplica los cambios de alimento de una persona (cada uno con su día, comida y posición) a los ítems de la pauta. */
export function applySwaps(rows, swaps) {
  const byKey = new Map(swaps.map(swap => [itemKey(swap), swap]));
  return rows.map(row => (byKey.has(itemKey(row)) ? swapRow(row, byKey.get(itemKey(row))) : row));
}

/** Promedio semanal de energía y macronutrientes. */
export function weekAverage(days) {
  if (!days.length) return null;
  const avg = key => Math.round(days.reduce((sum, day) => sum + day.totals[key], 0) / days.length);
  const average = { kcal: avg('kcal'), protein: avg('protein'), carbs: avg('carbs'), fat: avg('fat') };
  const energy = average.protein * 4 + average.carbs * 4 + average.fat * 9;
  return { ...average, percent: { protein: Math.round((average.protein * 400) / energy), carbs: Math.round((average.carbs * 400) / energy), fat: Math.round((average.fat * 900) / energy) } };
}
