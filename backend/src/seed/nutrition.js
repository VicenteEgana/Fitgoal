// Contenido nutricional de demostración: alimentos del mercado chileno, reglas nutricionales y pautas de 7 días.
// SOLO para desarrollo y presentaciones: la composición es referencial y las pautas las debe revisar y aprobar la nutricionista
// del proyecto. Fundamento en docs/investigacion_alimentacion.md.
import { buildDays } from '../lib/meal-plans.js';

const USDA = 'USDA FoodData Central (SR Legacy), por 100 g; verificar con la tabla de composición de alimentos chilena (INTA).';
const LABEL = 'Etiqueta de un producto del mercado chileno (referencial).';

// [código, nombre, grupo, kcal, proteínas, carbohidratos, grasas (por 100 g), medida casera, gramos de la medida, fuente]
export const FOODS = [
  ['pechuga-de-pollo', 'Pechuga de pollo a la plancha', 'proteinas', 165, 31, 0, 3.6, null, null, USDA],
  ['pechuga-de-pavo', 'Pechuga de pavo a la plancha', 'proteinas', 147, 30.1, 0, 2.1, null, null, USDA],
  ['posta-negra', 'Posta negra (vacuno magro) a la plancha', 'proteinas', 170, 29, 0, 5.5, null, null, USDA],
  ['carne-molida', 'Carne molida 5 % grasa, cocida', 'proteinas', 164, 25.5, 0, 6.4, null, null, USDA],
  ['merluza', 'Merluza al horno', 'proteinas', 105, 23, 0, 1.3, null, null, USDA],
  ['salmon', 'Salmón al horno', 'proteinas', 206, 22.1, 0, 12.4, null, null, USDA],
  ['jurel-en-lata', 'Jurel en lata al natural (escurrido)', 'proteinas', 156, 23.2, 0, 6.3, null, null, USDA],
  ['atun-en-agua', 'Atún en agua (escurrido)', 'proteinas', 116, 25.5, 0, 0.8, 'lata', 120, USDA],
  ['huevo', 'Huevo', 'proteinas', 155, 12.6, 1.1, 10.6, 'unidad', 50, USDA],
  ['clara-de-huevo', 'Clara de huevo', 'proteinas', 52, 10.9, 0.7, 0.2, 'clara', 33, USDA],
  ['jamon-de-pavo', 'Jamón de pavo', 'proteinas', 110, 18, 2, 3.5, 'lámina', 15, LABEL],
  ['tofu', 'Tofu firme', 'proteinas', 144, 17.3, 2.8, 8.7, null, null, USDA],
  ['leche-descremada', 'Leche descremada', 'lacteos', 34, 3.4, 5, 0.1, 'taza', 200, USDA],
  ['yogur-natural', 'Yogur natural descremado sin azúcar', 'lacteos', 56, 5.7, 7.7, 0.2, 'pote', 125, USDA],
  ['yogur-griego', 'Yogur griego natural descremado', 'lacteos', 59, 10.2, 3.6, 0.4, 'pote', 125, USDA],
  ['quesillo', 'Quesillo', 'lacteos', 135, 15, 3, 7, 'rebanada', 30, LABEL],
  ['queso-gauda', 'Queso gauda', 'lacteos', 356, 25, 2.2, 27.4, 'lámina', 15, USDA],
  ['avena', 'Avena en hojuelas', 'cereales', 379, 13.2, 67.7, 6.5, 'cucharada', 10, USDA],
  ['marraqueta', 'Pan marraqueta', 'cereales', 272, 9, 56, 1.5, 'unidad', 100, LABEL],
  ['pan-integral', 'Pan integral de molde', 'cereales', 252, 12.4, 42.7, 3.5, 'rebanada', 30, USDA],
  ['arroz-blanco', 'Arroz blanco cocido', 'cereales', 130, 2.7, 28.2, 0.3, 'taza', 160, USDA],
  ['arroz-integral', 'Arroz integral cocido', 'cereales', 123, 2.7, 25.6, 1, 'taza', 190, USDA],
  ['fideos', 'Fideos cocidos', 'cereales', 158, 5.8, 30.9, 0.9, 'taza', 140, USDA],
  ['quinoa', 'Quínoa cocida', 'cereales', 120, 4.4, 21.3, 1.9, 'taza', 185, USDA],
  ['papa', 'Papa cocida', 'cereales', 86, 1.7, 20, 0.1, 'unidad mediana', 150, USDA],
  ['choclo', 'Choclo cocido (granos)', 'cereales', 96, 3.4, 21, 1.5, 'taza', 150, USDA],
  ['galletas-de-arroz', 'Galletas de arroz', 'cereales', 387, 8.2, 81.5, 2.8, 'unidad', 9, USDA],
  ['lentejas', 'Lentejas cocidas', 'legumbres', 116, 9, 20.1, 0.4, 'taza', 200, USDA],
  ['porotos', 'Porotos cocidos', 'legumbres', 127, 8.7, 22.8, 0.5, 'taza', 180, USDA],
  ['garbanzos', 'Garbanzos cocidos', 'legumbres', 164, 8.9, 27.4, 2.6, 'taza', 165, USDA],
  ['hummus', 'Hummus', 'legumbres', 166, 7.9, 14.3, 9.6, 'cucharada', 15, USDA],
  ['platano', 'Plátano', 'frutas', 89, 1.1, 22.8, 0.3, 'unidad', 120, USDA],
  ['manzana', 'Manzana', 'frutas', 52, 0.3, 13.8, 0.2, 'unidad', 150, USDA],
  ['naranja', 'Naranja', 'frutas', 47, 0.9, 11.8, 0.1, 'unidad', 160, USDA],
  ['frutillas', 'Frutillas', 'frutas', 32, 0.7, 7.7, 0.3, 'taza', 150, USDA],
  ['arandanos', 'Arándanos', 'frutas', 57, 0.7, 14.5, 0.3, 'taza', 150, USDA],
  ['kiwi', 'Kiwi', 'frutas', 61, 1.1, 14.7, 0.5, 'unidad', 75, USDA],
  ['pera', 'Pera', 'frutas', 57, 0.4, 15.2, 0.1, 'unidad', 170, USDA],
  ['lechuga', 'Lechuga', 'verduras', 15, 1.4, 2.9, 0.2, 'taza', 50, USDA],
  ['tomate', 'Tomate', 'verduras', 18, 0.9, 3.9, 0.2, 'unidad', 120, USDA],
  ['zanahoria', 'Zanahoria', 'verduras', 41, 0.9, 9.6, 0.2, 'unidad', 80, USDA],
  ['pepino', 'Pepino', 'verduras', 15, 0.7, 3.6, 0.1, null, null, USDA],
  ['cebolla', 'Cebolla', 'verduras', 40, 1.1, 9.3, 0.1, null, null, USDA],
  ['pimenton', 'Pimentón', 'verduras', 26, 1, 6, 0.3, null, null, USDA],
  ['brocoli', 'Brócoli cocido', 'verduras', 35, 2.4, 7.2, 0.4, null, null, USDA],
  ['zapallo-italiano', 'Zapallo italiano cocido', 'verduras', 15, 1.1, 2.7, 0.4, null, null, USDA],
  ['espinaca', 'Espinaca cocida', 'verduras', 23, 3, 3.8, 0.3, null, null, USDA],
  ['porotos-verdes', 'Porotos verdes cocidos', 'verduras', 35, 1.9, 7.9, 0.3, null, null, USDA],
  ['zapallo', 'Zapallo camote cocido', 'verduras', 40, 0.9, 10.5, 0.1, null, null, USDA],
  ['champinones', 'Champiñones', 'verduras', 22, 3.1, 3.3, 0.3, null, null, USDA],
  ['palta', 'Palta Hass', 'grasas', 160, 2, 8.5, 14.7, 'unidad', 140, USDA],
  ['aceite-de-oliva', 'Aceite de oliva', 'grasas', 884, 0, 0, 100, 'cucharadita', 5, USDA],
  ['nueces', 'Nueces', 'grasas', 654, 15.2, 13.7, 65.2, null, null, USDA],
  ['almendras', 'Almendras', 'grasas', 579, 21.2, 21.6, 49.9, 'unidad', 1.2, USDA],
  ['mantequilla-de-mani', 'Mantequilla de maní sin azúcar', 'grasas', 588, 25, 20, 50, 'cucharada', 16, USDA],
  ['chia', 'Semillas de chía', 'grasas', 486, 16.5, 42.1, 30.7, 'cucharada', 12, USDA],
  ['aceitunas', 'Aceitunas', 'grasas', 145, 1, 3.8, 15.3, 'unidad', 4, USDA],
];

/**
 * Reglas nutricionales (las aprueba la nutricionista): factores de actividad sobre Mifflin-St Jeor, ajuste por objetivo
 * (déficit, mantenimiento o superávit), tope del déficit, mínimo de calorías y ajustes de seguridad según el IMC.
 */
export const NUTRITION_RULES = {
  activityFactors: { sedentario: 1.2, ligero: 1.375, moderado: 1.55, intenso: 1.725 },
  objectiveAdjustments: { bajar: -20, mantener: 0, subir: 10 },
  maxDeficitKcal: 750,
  minimumKcal: { femenino: 1200, masculino: 1500 },
  safety: {
    adjustObjective: { bajo_peso: { bajar: 'mantener' }, obesidad: { subir: 'mantener' } },
    notices: {
      bajo_peso: 'Con bajo peso no se recomienda comer en déficit: te mostramos las porciones de mantenimiento. Si tu peso bajó sin buscarlo, consulta a un profesional de la salud.',
      obesidad: 'Con obesidad no se recomienda comer en superávit: te mostramos las porciones de mantenimiento. Un profesional puede ayudarte a definir un déficit seguro.',
    },
  },
};

export const REFERENCE_KCAL = 2000;

// Pautas de 7 días. Cada día: desayuno, colación, almuerzo, once y cena, con [alimento, gramos]. Los gramos se ajustan
// después para que cada día sume la energía de referencia (las verduras quedan fijas).
export const MEAL_PLANS = {
  mediterranea: {
    name: 'Mediterránea',
    summary: 'Aceite de oliva, pescado, legumbres, cereales integrales, frutas, verduras y frutos secos. Es la dieta con más respaldo para la salud cardiovascular.',
    days: [
      {
        desayuno: [['pan-integral', 60], ['palta', 50], ['huevo', 50], ['tomate', 60]],
        colacion: [['yogur-natural', 125], ['nueces', 20], ['frutillas', 100]],
        almuerzo: [['lentejas', 220], ['arroz-integral', 80], ['lechuga', 50], ['tomate', 80], ['aceite-de-oliva', 10], ['naranja', 160]],
        once: [['pan-integral', 60], ['quesillo', 30], ['tomate', 40], ['aceite-de-oliva', 5]],
        cena: [['merluza', 120], ['papa', 150], ['lechuga', 50], ['zanahoria', 50], ['aceite-de-oliva', 10]],
      },
      {
        desayuno: [['avena', 40], ['leche-descremada', 200], ['platano', 100], ['nueces', 15]],
        colacion: [['manzana', 150], ['almendras', 20]],
        almuerzo: [['pechuga-de-pollo', 100], ['quinoa', 150], ['brocoli', 100], ['zanahoria', 50], ['aceite-de-oliva', 10]],
        once: [['marraqueta', 50], ['palta', 40], ['tomate', 40]],
        cena: [['garbanzos', 150], ['zapallo-italiano', 100], ['cebolla', 30], ['aceite-de-oliva', 10], ['pera', 170]],
      },
      {
        desayuno: [['yogur-griego', 125], ['avena', 30], ['arandanos', 100], ['chia', 10], ['nueces', 10]],
        colacion: [['pan-integral', 30], ['hummus', 30], ['pepino', 80]],
        almuerzo: [['salmon', 120], ['arroz-integral', 120], ['porotos-verdes', 100], ['tomate', 80], ['aceite-de-oliva', 10]],
        once: [['leche-descremada', 200], ['pan-integral', 60], ['palta', 30]],
        cena: [['huevo', 100], ['zapallo-italiano', 100], ['pan-integral', 30], ['aceite-de-oliva', 10], ['kiwi', 75]],
      },
      {
        desayuno: [['marraqueta', 50], ['palta', 50], ['tomate', 50], ['leche-descremada', 200]],
        colacion: [['naranja', 160], ['nueces', 20]],
        almuerzo: [['porotos', 200], ['fideos', 60], ['zapallo', 80], ['lechuga', 50], ['tomate', 50], ['aceite-de-oliva', 10]],
        once: [['yogur-natural', 125], ['avena', 20], ['frutillas', 100], ['almendras', 10]],
        cena: [['pechuga-de-pavo', 100], ['papa', 150], ['brocoli', 100], ['aceite-de-oliva', 10]],
      },
      {
        desayuno: [['avena', 40], ['yogur-natural', 125], ['manzana', 100], ['almendras', 15]],
        colacion: [['pan-integral', 30], ['hummus', 30], ['tomate', 40]],
        almuerzo: [['jurel-en-lata', 100], ['arroz-blanco', 120], ['lechuga', 50], ['tomate', 80], ['cebolla', 20], ['palta', 30], ['aceite-de-oliva', 10]],
        once: [['pan-integral', 60], ['huevo', 50], ['palta', 30]],
        cena: [['pechuga-de-pollo', 80], ['zapallo-italiano', 100], ['pimenton', 80], ['quinoa', 100], ['aceite-de-oliva', 10], ['pera', 170]],
      },
      {
        desayuno: [['pan-integral', 60], ['huevo', 50], ['palta', 40], ['tomate', 50], ['naranja', 160]],
        colacion: [['yogur-griego', 125], ['nueces', 20]],
        almuerzo: [['merluza', 120], ['arroz-integral', 120], ['lechuga', 50], ['tomate', 80], ['pepino', 50], ['aceite-de-oliva', 10]],
        once: [['leche-descremada', 200], ['marraqueta', 50], ['palta', 30]],
        cena: [['fideos', 120], ['atun-en-agua', 60], ['tomate', 100], ['champinones', 50], ['aceite-de-oliva', 10]],
      },
      {
        desayuno: [['avena', 40], ['leche-descremada', 200], ['frutillas', 100], ['chia', 10], ['almendras', 10]],
        colacion: [['platano', 120], ['nueces', 15]],
        almuerzo: [['posta-negra', 90], ['papa', 150], ['zapallo', 80], ['choclo', 60], ['porotos-verdes', 50], ['aceite-de-oliva', 5]],
        once: [['pan-integral', 60], ['quesillo', 30], ['tomate', 40], ['aceite-de-oliva', 5]],
        cena: [['salmon', 100], ['lechuga', 60], ['tomate', 80], ['pepino', 60], ['aceitunas', 20], ['aceite-de-oliva', 10], ['pan-integral', 30]],
      },
    ],
  },
  alta_proteina: {
    name: 'Alta en proteína',
    summary: 'Más proteína en cada comida (carnes magras, pescado, huevos, lácteos y legumbres). Ayuda a la saciedad, a conservar músculo en déficit y a ganarlo en superávit junto al entrenamiento de fuerza.',
    days: [
      {
        desayuno: [['huevo', 100], ['pan-integral', 60], ['tomate', 50], ['leche-descremada', 200]],
        colacion: [['yogur-griego', 150], ['arandanos', 80]],
        almuerzo: [['pechuga-de-pollo', 150], ['arroz-blanco', 150], ['brocoli', 120], ['aceite-de-oliva', 10]],
        once: [['pan-integral', 30], ['jamon-de-pavo', 45], ['quesillo', 30]],
        cena: [['atun-en-agua', 120], ['quinoa', 120], ['lechuga', 50], ['tomate', 80], ['pepino', 50], ['aceite-de-oliva', 5]],
      },
      {
        desayuno: [['avena', 40], ['leche-descremada', 200], ['yogur-griego', 100], ['frutillas', 100]],
        colacion: [['huevo', 100], ['manzana', 150]],
        almuerzo: [['posta-negra', 160], ['papa', 200], ['lechuga', 50], ['tomate', 80], ['aceite-de-oliva', 5]],
        once: [['marraqueta', 50], ['quesillo', 45], ['jamon-de-pavo', 30]],
        cena: [['merluza', 180], ['arroz-integral', 100], ['zapallo-italiano', 120], ['aceite-de-oliva', 5]],
      },
      {
        desayuno: [['pan-integral', 60], ['huevo', 100], ['quesillo', 30], ['tomate', 50]],
        colacion: [['yogur-griego', 150], ['almendras', 10]],
        almuerzo: [['pechuga-de-pavo', 170], ['fideos', 120], ['espinaca', 100], ['tomate', 50], ['aceite-de-oliva', 5]],
        once: [['leche-descremada', 250], ['platano', 100], ['avena', 20]],
        cena: [['salmon', 150], ['papa', 150], ['brocoli', 100]],
      },
      {
        desayuno: [['clara-de-huevo', 66], ['huevo', 50], ['espinaca', 50], ['pan-integral', 60], ['palta', 30], ['naranja', 160]],
        colacion: [['yogur-griego', 150], ['frutillas', 100]],
        almuerzo: [['carne-molida', 150], ['arroz-blanco', 130], ['lechuga', 50], ['tomate', 80], ['aceite-de-oliva', 5]],
        once: [['pan-integral', 60], ['atun-en-agua', 60], ['palta', 30]],
        cena: [['pechuga-de-pollo', 150], ['quinoa', 100], ['zapallo-italiano', 100], ['pimenton', 60], ['aceite-de-oliva', 5]],
      },
      {
        desayuno: [['avena', 40], ['leche-descremada', 200], ['yogur-griego', 100], ['arandanos', 80]],
        colacion: [['quesillo', 60], ['galletas-de-arroz', 18], ['tomate', 50]],
        almuerzo: [['merluza', 180], ['arroz-integral', 130], ['porotos-verdes', 100], ['aceite-de-oliva', 5]],
        once: [['marraqueta', 50], ['huevo', 50], ['jamon-de-pavo', 30], ['tomate', 40]],
        cena: [['posta-negra', 150], ['papa', 150], ['lechuga', 50], ['zanahoria', 50], ['aceite-de-oliva', 5]],
      },
      {
        desayuno: [['pan-integral', 60], ['huevo', 100], ['palta', 30], ['leche-descremada', 200]],
        colacion: [['yogur-griego', 150], ['nueces', 10]],
        almuerzo: [['pechuga-de-pollo', 160], ['papa', 200], ['brocoli', 100], ['aceite-de-oliva', 5]],
        once: [['pan-integral', 60], ['quesillo', 45], ['pechuga-de-pavo', 40]],
        cena: [['jurel-en-lata', 120], ['quinoa', 100], ['lechuga', 50], ['tomate', 80], ['cebolla', 20], ['aceite-de-oliva', 5]],
      },
      {
        desayuno: [['avena', 40], ['huevo', 50], ['clara-de-huevo', 66], ['platano', 60], ['yogur-griego', 100]],
        colacion: [['manzana', 150], ['almendras', 15]],
        almuerzo: [['pechuga-de-pavo', 160], ['papa', 150], ['zapallo', 80], ['choclo', 50], ['porotos-verdes', 50]],
        once: [['pan-integral', 60], ['jamon-de-pavo', 45], ['quesillo', 30]],
        cena: [['atun-en-agua', 120], ['fideos', 100], ['tomate', 100], ['champinones', 50], ['aceite-de-oliva', 5]],
      },
    ],
  },
  baja_carbohidratos: {
    name: 'Baja en carbohidratos (moderada)',
    summary: 'Menos cereales y pan, más proteína, verduras y grasas saludables (palta, aceite de oliva, frutos secos). Rinde igual que una dieta equilibrada para bajar de peso; elígela si te acomoda más.',
    days: [
      {
        desayuno: [['huevo', 100], ['palta', 50], ['tomate', 50], ['pan-integral', 30]],
        colacion: [['yogur-griego', 125], ['nueces', 15], ['frutillas', 100]],
        almuerzo: [['pechuga-de-pollo', 150], ['lechuga', 80], ['tomate', 80], ['pepino', 60], ['palta', 50], ['aceite-de-oliva', 10], ['quinoa', 60]],
        once: [['quesillo', 60], ['jamon-de-pavo', 30], ['palta', 30], ['tomate', 50]],
        cena: [['salmon', 150], ['brocoli', 150], ['zapallo-italiano', 100], ['aceite-de-oliva', 10]],
      },
      {
        desayuno: [['huevo', 100], ['queso-gauda', 30], ['espinaca', 50], ['champinones', 50], ['aceite-de-oliva', 5]],
        colacion: [['frutillas', 150], ['almendras', 20]],
        almuerzo: [['posta-negra', 150], ['porotos-verdes', 150], ['papa', 80], ['lechuga', 50], ['tomate', 80], ['aceite-de-oliva', 10]],
        once: [['yogur-griego', 150], ['chia', 10], ['arandanos', 60]],
        cena: [['merluza', 180], ['espinaca', 100], ['palta', 50], ['zanahoria', 50], ['aceite-de-oliva', 5]],
      },
      {
        desayuno: [['yogur-griego', 150], ['nueces', 15], ['frutillas', 100], ['chia', 10]],
        colacion: [['huevo', 100], ['pepino', 80]],
        almuerzo: [['carne-molida', 150], ['zapallo-italiano', 150], ['queso-gauda', 20], ['lechuga', 50], ['tomate', 80], ['aceite-de-oliva', 5], ['arroz-integral', 60]],
        once: [['pan-integral', 30], ['palta', 50], ['jamon-de-pavo', 30], ['quesillo', 30]],
        cena: [['pechuga-de-pollo', 150], ['brocoli', 150], ['pimenton', 80], ['aceite-de-oliva', 10]],
      },
      {
        desayuno: [['huevo', 100], ['palta', 50], ['tomate', 60], ['quesillo', 30]],
        colacion: [['yogur-natural', 125], ['almendras', 15]],
        almuerzo: [['salmon', 140], ['lechuga', 60], ['tomate', 80], ['pepino', 60], ['aceitunas', 20], ['aceite-de-oliva', 10], ['papa', 100]],
        once: [['quesillo', 60], ['tomate', 60], ['nueces', 15], ['pan-integral', 30]],
        cena: [['pechuga-de-pavo', 150], ['zapallo-italiano', 150], ['champinones', 80], ['aceite-de-oliva', 10]],
      },
      {
        desayuno: [['huevo', 100], ['espinaca', 60], ['queso-gauda', 20], ['aceite-de-oliva', 5], ['kiwi', 75]],
        colacion: [['yogur-griego', 150], ['arandanos', 60]],
        almuerzo: [['jurel-en-lata', 120], ['palta', 60], ['lechuga', 50], ['tomate', 80], ['cebolla', 20], ['aceite-de-oliva', 5], ['porotos', 80]],
        once: [['pan-integral', 30], ['quesillo', 45], ['palta', 30]],
        cena: [['posta-negra', 150], ['brocoli', 120], ['zapallo', 80], ['aceite-de-oliva', 10]],
      },
      {
        desayuno: [['yogur-griego', 150], ['almendras', 15], ['frutillas', 100]],
        colacion: [['huevo', 50], ['quesillo', 30], ['tomate', 50]],
        almuerzo: [['pechuga-de-pollo', 160], ['lechuga', 60], ['tomate', 80], ['palta', 50], ['aceite-de-oliva', 10], ['quinoa', 60]],
        once: [['pan-integral', 30], ['jamon-de-pavo', 45], ['palta', 40]],
        cena: [['merluza', 180], ['porotos-verdes', 150], ['zanahoria', 50], ['aceite-de-oliva', 10]],
      },
      {
        desayuno: [['huevo', 100], ['palta', 50], ['pan-integral', 30], ['tomate', 50]],
        colacion: [['nueces', 15], ['manzana', 100]],
        almuerzo: [['posta-negra', 150], ['tomate', 120], ['cebolla', 30], ['aceite-de-oliva', 10], ['papa', 100]],
        once: [['yogur-griego', 150], ['chia', 10], ['frutillas', 80]],
        cena: [['atun-en-agua', 120], ['palta', 60], ['lechuga', 60], ['pepino', 60], ['huevo', 50], ['aceite-de-oliva', 5]],
      },
    ],
  },
  vegetariana: {
    name: 'Vegetariana (ovolácteo)',
    summary: 'Sin carnes ni pescados: la proteína viene de legumbres, huevos, lácteos y tofu, combinados con cereales. Bien planificada cubre los requerimientos en todas las etapas de la vida.',
    days: [
      {
        desayuno: [['avena', 40], ['leche-descremada', 200], ['platano', 100], ['nueces', 10]],
        colacion: [['yogur-natural', 125], ['frutillas', 100]],
        almuerzo: [['lentejas', 250], ['arroz-integral', 80], ['lechuga', 50], ['tomate', 80], ['aceite-de-oliva', 5]],
        once: [['pan-integral', 60], ['quesillo', 40], ['tomate', 40]],
        cena: [['huevo', 100], ['espinaca', 80], ['papa', 150], ['aceite-de-oliva', 5]],
      },
      {
        desayuno: [['pan-integral', 60], ['huevo', 50], ['palta', 40], ['leche-descremada', 200]],
        colacion: [['manzana', 150], ['almendras', 15]],
        almuerzo: [['porotos', 200], ['fideos', 60], ['zapallo', 80], ['tomate', 80], ['aceite-de-oliva', 5]],
        once: [['yogur-griego', 150], ['avena', 20], ['arandanos', 60]],
        cena: [['tofu', 150], ['arroz-integral', 120], ['brocoli', 100], ['zanahoria', 50], ['aceite-de-oliva', 10]],
      },
      {
        desayuno: [['yogur-griego', 150], ['avena', 30], ['frutillas', 100], ['chia', 10]],
        colacion: [['pan-integral', 30], ['hummus', 45], ['pepino', 60]],
        almuerzo: [['garbanzos', 200], ['quinoa', 80], ['espinaca', 80], ['tomate', 80], ['aceite-de-oliva', 5]],
        once: [['leche-descremada', 200], ['marraqueta', 50], ['quesillo', 30]],
        cena: [['zapallo-italiano', 200], ['huevo', 50], ['quesillo', 40], ['choclo', 60], ['pan-integral', 30]],
      },
      {
        desayuno: [['avena', 40], ['leche-descremada', 200], ['platano', 100], ['mantequilla-de-mani', 16]],
        colacion: [['yogur-natural', 125], ['nueces', 10]],
        almuerzo: [['lentejas', 200], ['papa', 100], ['zanahoria', 50], ['lechuga', 50], ['tomate', 80], ['aceite-de-oliva', 5]],
        once: [['pan-integral', 60], ['huevo', 50], ['palta', 30]],
        cena: [['fideos', 140], ['tomate', 100], ['champinones', 80], ['queso-gauda', 20], ['aceite-de-oliva', 5]],
      },
      {
        desayuno: [['pan-integral', 60], ['quesillo', 40], ['tomate', 40], ['naranja', 160]],
        colacion: [['yogur-griego', 125], ['almendras', 10]],
        almuerzo: [['porotos', 200], ['arroz-blanco', 80], ['lechuga', 50], ['tomate', 80], ['cebolla', 20], ['aceite-de-oliva', 5]],
        once: [['marraqueta', 50], ['palta', 40], ['huevo', 50]],
        cena: [['huevo', 100], ['espinaca', 100], ['quinoa', 100], ['aceite-de-oliva', 5], ['pera', 170]],
      },
      {
        desayuno: [['yogur-griego', 150], ['avena', 30], ['arandanos', 80], ['nueces', 10]],
        colacion: [['pan-integral', 30], ['hummus', 30], ['zanahoria', 60]],
        almuerzo: [['garbanzos', 180], ['arroz-integral', 100], ['zapallo-italiano', 100], ['pimenton', 60], ['aceite-de-oliva', 5]],
        once: [['leche-descremada', 200], ['pan-integral', 60], ['quesillo', 30]],
        cena: [['tofu', 150], ['quinoa', 100], ['brocoli', 120], ['aceite-de-oliva', 10]],
      },
      {
        desayuno: [['huevo', 100], ['pan-integral', 60], ['palta', 40], ['leche-descremada', 200]],
        colacion: [['platano', 120], ['mantequilla-de-mani', 16]],
        almuerzo: [['porotos', 100], ['papa', 150], ['zapallo', 100], ['choclo', 60], ['porotos-verdes', 50], ['huevo', 50], ['aceite-de-oliva', 5], ['tomate', 80]],
        once: [['yogur-natural', 125], ['avena', 20], ['frutillas', 100]],
        cena: [['fideos', 120], ['lentejas', 100], ['tomate', 100], ['queso-gauda', 15], ['aceite-de-oliva', 5]],
      },
    ],
  },
};

const foodRow = new Map(FOODS.map(([code, name, category, kcal, protein, carbs, fat, unitName, unitGrams]) => [code, { code, name, category, kcal_100g: kcal, protein_100g: protein, carbs_100g: carbs, fat_100g: fat, unit_name: unitName, unit_grams: unitGrams }]));

/**
 * Ajusta los gramos de cada día para que sume la energía de referencia, con el mismo cálculo que usa la API al mostrar
 * la pauta (las verduras quedan fijas y lo que se cuenta por unidad va en unidades enteras o medias).
 */
export function normalizedMealPlans(referenceKcal = REFERENCE_KCAL) {
  return Object.fromEntries(Object.entries(MEAL_PLANS).map(([diet, plan]) => {
    const rows = plan.days.flatMap((day, index) => Object.entries(day).flatMap(([meal, list]) => list.map(([code, grams], position) => {
      if (!foodRow.has(code)) throw new Error(`Alimento desconocido en la pauta ${diet}: ${code}`);
      return { ...foodRow.get(code), day_no: index + 1, meal, position: position + 1, grams };
    })));
    const days = buildDays(rows, referenceKcal, { nearestUnits: true }).map(day => Object.fromEntries(day.meals.map(meal => [meal.meal, meal.items.map(item => [item.code, item.grams])])));
    return [diet, { ...plan, days }];
  }));
}
