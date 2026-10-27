// Índice de masa corporal (IMC) y su categoría.
// IMC = peso (kg) / estatura (m)². Es una referencia de tamizaje, no un diagnóstico: no distingue músculo de grasa.
//
// Cortes de categoría:
//  - Personas adultas (menos de 65 años), OMS: bajo peso < 18,5; normal 18,5–24,9; sobrepeso 25–29,9; obesidad ≥ 30.
//  - Personas mayores (65 años o más), Minsal de Chile (EMPAM): enflaquecido < 23; normal 23–27,9; sobrepeso 28–31,9; obesidad ≥ 32.
export const BMI_CATEGORIES = ['bajo_peso', 'normal', 'sobrepeso', 'obesidad'];
export const BMI_LABELS = { general: 'general', bajo_peso: 'bajo peso', normal: 'peso normal', sobrepeso: 'sobrepeso', obesidad: 'obesidad' };

const ADULT_CUTOFFS = [18.5, 25, 30];
const OLDER_ADULT_CUTOFFS = [23, 28, 32];

export function bodyMassIndex(weightKg, heightCm) {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

export function bmiCategory(bmi, age) {
  if (bmi === null || bmi === undefined) return null;
  const cutoffs = age >= 65 ? OLDER_ADULT_CUTOFFS : ADULT_CUTOFFS;
  const index = cutoffs.findIndex(limit => bmi < limit);
  return BMI_CATEGORIES[index === -1 ? 3 : index];
}

/** IMC y categoría de una fila de perfil, o null si no informó estatura y peso. */
export function bodyOf(row) {
  if (row?.weight_kg === null || row?.weight_kg === undefined || row?.height_cm === null || row?.height_cm === undefined) return null;
  const bmi = bodyMassIndex(Number(row.weight_kg), Number(row.height_cm));
  return { bmi, category: bmiCategory(bmi, row.age) };
}
