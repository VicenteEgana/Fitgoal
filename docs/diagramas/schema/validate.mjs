// Aplica la migración generada en un PostgreSQL real (PGlite: el motor de PostgreSQL compilado a WebAssembly)
// y comprueba que las reglas de integridad del modelo se cumplen de verdad.
import { PGlite } from '@electric-sql/pglite';
import { fullMigration } from './sql.mjs';
import { TABLES } from './schema.mjs';

const db = new PGlite();
await db.exec(fullMigration());
const tables = (await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'")).rows[0].n;
console.log(`Tablas creadas: ${tables} (esperadas ${TABLES.length})`);
if (tables !== TABLES.length) process.exit(1);
console.log('Motor:', (await db.query('SELECT version() AS v')).rows[0].v.split(',')[0]);

let failures = 0;
let passed = 0;
const expectFail = async (name, sql, params = []) => {
  try { await db.query(sql, params); console.log(`  ✗ debía fallar: ${name}`); failures += 1; }
  catch (error) { passed += 1; console.log(`  ✓ rechazado: ${name} — ${error.message.split('\n')[0].slice(0, 100)}`); }
};
const expectOk = async (name, sql, params = []) => {
  try { const r = await db.query(sql, params); passed += 1; console.log(`  ✓ ok: ${name}`); return r; }
  catch (error) { console.log(`  ✗ falló: ${name} — ${error.message}`); failures += 1; }
};
const ARGON = '$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA';
const id = async (sql, params) => (await db.query(sql, params)).rows[0].id;
const PROFILE = 'INSERT INTO profile_versions (user_id, version, age, objective, level, days, duration_minutes, equipment';
const APPROVE_TRAINER = 'status = \'approved\', approved_by = $1, approved_by_role = \'trainer\', approved_at = now()';

console.log('Reglas de integridad:');
const user = await id("INSERT INTO users (email, password_hash, role) VALUES ('ana@example.cl', $1, 'user') RETURNING id", [ARGON]);
const trainer = await id("INSERT INTO users (email, password_hash, role) VALUES ('pf@example.cl', $1, 'trainer') RETURNING id", [ARGON]);
const nutri = await id("INSERT INTO users (email, password_hash, role) VALUES ('nu@example.cl', $1, 'nutritionist') RETURNING id", [ARGON]);
await expectFail('contraseña sin Argon2id', "INSERT INTO users (email, password_hash, role) VALUES ('x@example.cl', 'plano', 'user')");
await expectFail('correo duplicado sin distinguir mayúsculas', "INSERT INTO users (email, password_hash, role) VALUES ('ANA@example.cl', $1, 'user')", [ARGON]);
await expectFail('rol inexistente', "INSERT INTO users (email, password_hash, role) VALUES ('y@example.cl', $1, 'superuser')", [ARGON]);

await expectOk('perfil válido', `${PROFILE}) VALUES ($1, 1, 30, 'bajar', 'principiante', '{1,3,5}', 30, 'sin_equipo')`, [user]);
await expectFail('menor de edad', `${PROFILE}) VALUES ($1, 2, 17, 'bajar', 'principiante', '{1}', 30, 'sin_equipo')`, [user]);
await expectFail('días repetidos', `${PROFILE}) VALUES ($1, 2, 30, 'bajar', 'principiante', '{1,1}', 30, 'sin_equipo')`, [user]);
await expectFail('día fuera de 1 a 7', `${PROFILE}) VALUES ($1, 2, 30, 'bajar', 'principiante', '{0,2}', 30, 'sin_equipo')`, [user]);
await expectFail('duración no permitida', `${PROFILE}) VALUES ($1, 2, 30, 'bajar', 'principiante', '{1}', 25, 'sin_equipo')`, [user]);
await expectOk('perfil con estatura y peso', `${PROFILE}, height_cm, weight_kg) VALUES ($1, 2, 30, 'mantener', 'principiante', '{1,3}', 30, 'sin_equipo', 172, 70.5)`, [user]);
await expectFail('peso sin estatura', `${PROFILE}, weight_kg) VALUES ($1, 3, 30, 'bajar', 'principiante', '{1}', 30, 'sin_equipo', 70)`, [user]);
await expectFail('peso fuera del rango humano', `${PROFILE}, height_cm, weight_kg) VALUES ($1, 3, 30, 'bajar', 'principiante', '{1}', 30, 'sin_equipo', 172, 12)`, [user]);
await expectFail('estatura fuera del rango humano', `${PROFILE}, height_cm, weight_kg) VALUES ($1, 3, 30, 'bajar', 'principiante', '{1}', 30, 'sin_equipo', 20, 70)`, [user]);
await expectOk('cálculo energético completo en un perfil real (la API exige el consentimiento «datos_nutricionales»)', `${PROFILE}, height_cm, weight_kg, sex_param, activity_level) VALUES ($1, 3, 30, 'bajar', 'principiante', '{1}', 30, 'sin_equipo', 165, 60, 'femenino', 'ligero')`, [user]);
await expectFail('sexo sin actividad', `${PROFILE}, height_cm, weight_kg, sex_param) VALUES ($1, 4, 30, 'bajar', 'principiante', '{1}', 30, 'sin_equipo', 165, 60, 'femenino')`, [user]);
await expectFail('sexo y actividad sin estatura ni peso', `${PROFILE}, sex_param, activity_level) VALUES ($1, 4, 30, 'bajar', 'principiante', '{1}', 30, 'sin_equipo', 'femenino', 'ligero')`, [user]);

const profileId = await id('SELECT id FROM profile_versions WHERE user_id = $1 AND version = 2', [user]);
const rules = await id("INSERT INTO rule_versions (domain, version, content, author_id) VALUES ('entrenamiento', 1, '{}', $1) RETURNING id", [trainer]);
await expectFail('reglas de entrenamiento aprobadas por la nutricionista', "UPDATE rule_versions SET status='approved', approved_by=$1, approved_by_role='nutritionist', approved_at=now() WHERE id=$2", [nutri, rules]);
await expectFail('rol de aprobador que no coincide con el real', "UPDATE rule_versions SET status='approved', approved_by=$1, approved_by_role='trainer', approved_at=now() WHERE id=$2", [nutri, rules]);
await expectOk('reglas aprobadas por el preparador', "UPDATE rule_versions SET status='approved', approved_by=$1, approved_by_role='trainer', approved_at=now() WHERE id=$2", [trainer, rules]);

const EXERCISE = "INSERT INTO exercises (code, name, description, muscle_group, default_prescription, created_by) VALUES ($1, $2, 'Ejemplo general', $3, '2 series de 8 repeticiones', $4) RETURNING id";
const ex = await id(EXERCISE, ['sentarse-y-levantarse', 'Sentarse y levantarse', 'piernas', trainer]);
const ex2 = await id(EXERCISE, ['flexiones-en-pared', 'Flexiones en pared', 'empuje', trainer]);
await expectOk('ejercicio de alto impacto', "INSERT INTO exercises (code, name, description, muscle_group, high_impact, default_prescription, created_by) VALUES ('saltos', 'Saltos', 'Saltos de tijera', 'cardio', true, '30 segundos', $1) RETURNING id", [trainer]);
await expectFail('ejercicio sin grupo válido', "INSERT INTO exercises (code, name, description, muscle_group, default_prescription, created_by) VALUES ('x', 'X', 'x', 'cuello', 'x', $1)", [trainer]);
await expectFail('ejercicio aprobado sin aprobador', "UPDATE exercises SET status = 'approved' WHERE id = $1", [ex]);
await expectFail('ejercicio aprobado por la nutricionista', "UPDATE exercises SET status='approved', approved_by=$1, approved_by_role='trainer', approved_at=now() WHERE id=$2", [nutri, ex]);
await expectOk('ejercicio aprobado por el preparador', `UPDATE exercises SET ${APPROVE_TRAINER} WHERE id = $2`, [trainer, ex]);

const TEMPLATE = "INSERT INTO routine_templates (code, version, name, summary, objective, level, equipment, bmi_category, split, session_labels, min_days, max_days, session_minutes, author_id) VALUES ('mantener-inicio-sin-equipo', 1, 'Mantener · inicio', 'Rutina de inicio sin equipo.', 'mantener', 'principiante', 'sin_equipo', $2, $3, $4, 2, 4, 30, $1) RETURNING id";
await expectFail('plantilla sin categoría de IMC válida', TEMPLATE, [trainer, 'liviano', 'full_body', ['Cuerpo completo A']]);
await expectFail('plantilla sin división válida', TEMPLATE, [trainer, 'normal', 'brazo_pierna', ['Cuerpo completo A']]);
await expectFail('plantilla con un nombre de sesión vacío', TEMPLATE, [trainer, 'normal', 'upper_lower', ['Tren superior', ' ']]);
await expectFail('plantilla con más de 7 sesiones', TEMPLATE, [trainer, 'normal', 'push_pull_legs', ['E', 'T', 'P', 'E', 'T', 'P', 'E', 'T']]);
const tpl = await id(TEMPLATE, [trainer, 'normal', 'upper_lower', ['Tren superior A', 'Tren inferior A']]);
await expectOk('ejercicio en una plantilla en borrador', "INSERT INTO template_exercises (template_id, session_no, position, exercise_id, prescription) VALUES ($1, 1, 1, $2, '2 series de 8')", [tpl, ex]);
await expectFail('ejercicio en una sesión sin nombre en la plantilla', "INSERT INTO template_exercises (template_id, session_no, position, exercise_id, prescription) VALUES ($1, 3, 1, $2, '2 series de 8')", [tpl, ex]);
await expectFail('iniciar una plantilla que aún no está aprobada', "INSERT INTO user_plans (user_id, profile_version_id, source, template_id, rule_version_id, name, version, weeks, session_minutes, days, session_labels) VALUES ($1, $2, 'recomendada', $3, $4, 'Mantener', 1, 4, 30, '{1,3}', '{Tren superior A,Tren inferior A}')", [user, profileId, tpl, rules]);
await db.query(`UPDATE routine_templates SET ${APPROVE_TRAINER} WHERE id = $2`, [trainer, tpl]);
await expectFail('modificar los ejercicios de una plantilla aprobada', "UPDATE template_exercises SET prescription='3 series' WHERE template_id=$1", [tpl]);
await expectFail('borrar una plantilla aprobada', 'DELETE FROM routine_templates WHERE id=$1', [tpl]);

await expectFail('rutina recomendada sin plantilla', "INSERT INTO user_plans (user_id, profile_version_id, source, rule_version_id, name, version, weeks, session_minutes, days, session_labels) VALUES ($1, $2, 'recomendada', $3, 'Sin plantilla', 1, 4, 30, '{1,3}', '{Sesión 1,Sesión 2}')", [user, profileId, rules]);
await expectFail('rutina propia que dice venir de una plantilla', "INSERT INTO user_plans (user_id, profile_version_id, source, template_id, name, version, weeks, session_minutes, days, session_labels) VALUES ($1, $2, 'propia', $3, 'Mía', 1, 4, 30, '{1,3}', '{Sesión 1,Sesión 2}')", [user, profileId, tpl]);
await expectFail('rutina con el perfil de otro participante', "INSERT INTO user_plans (user_id, profile_version_id, source, template_id, rule_version_id, name, version, weeks, session_minutes, days, session_labels) VALUES ($1, $2, 'recomendada', $3, $4, 'Ajena', 1, 4, 30, '{1,3}', '{Tren superior A,Tren inferior A}')", [trainer, profileId, tpl, rules]);
await expectFail('rutina sin el nombre de la sesión de cada día', "INSERT INTO user_plans (user_id, profile_version_id, source, template_id, rule_version_id, name, version, weeks, session_minutes, days, session_labels) VALUES ($1, $2, 'recomendada', $3, $4, 'Mantener', 1, 4, 30, '{1,3,5}', '{Tren superior A,Tren inferior A}')", [user, profileId, tpl, rules]);
const plan = await id("INSERT INTO user_plans (user_id, profile_version_id, source, template_id, rule_version_id, name, version, weeks, session_minutes, days, session_labels) VALUES ($1, $2, 'recomendada', $3, $4, 'Mantener · inicio', 1, 4, 30, '{1,3}', '{Tren superior A,Tren inferior A}') RETURNING id", [user, profileId, tpl, rules]);
passed += 1; console.log('  ✓ ok: la persona inicia una rutina recomendada (plantilla aprobada)');
await expectFail('segunda rutina vigente del mismo participante', "INSERT INTO user_plans (user_id, profile_version_id, source, rule_version_id, name, version, weeks, session_minutes, days, session_labels) VALUES ($1, $2, 'propia', $3, 'Mía', 2, 4, 30, '{2,4}', '{Sesión 1,Sesión 2}')", [user, profileId, rules]);
await expectFail('modificar el contenido de una rutina iniciada', "UPDATE user_plans SET name = 'Otra', days = '{1,2}' WHERE id = $1", [plan]);
await expectFail('cambiar los nombres de sesión de una rutina iniciada', "UPDATE user_plans SET session_labels = '{Empuje,Tracción}' WHERE id = $1", [plan]);

await expectOk('ejercicio aprobado en la rutina', "INSERT INTO user_plan_exercises (plan_id, session_no, position, exercise_id, prescription) VALUES ($1, 1, 1, $2, '2 series de 8')", [plan, ex]);
await expectFail('ejercicio sin aprobar en la rutina', "INSERT INTO user_plan_exercises (plan_id, session_no, position, exercise_id, prescription) VALUES ($1, 1, 2, $2, '2 series de 8')", [plan, ex2]);
await expectFail('modificar la composición de una rutina iniciada', "UPDATE user_plan_exercises SET prescription = '9 series' WHERE plan_id = $1", [plan]);
await expectOk('sesión programada de la rutina', "INSERT INTO training_sessions (user_id, plan_id, session_no, label, planned_date) VALUES ($1, $2, 1, 'Sesión 1', '2026-11-16')", [user, plan]);
await expectFail('sesión con la rutina de otro participante', "INSERT INTO training_sessions (user_id, plan_id, session_no, label, planned_date) VALUES ($1, $2, 1, 'X', '2026-11-17')", [trainer, plan]);
await expectOk('mover la sesión a otro día guardando la fecha original', "UPDATE training_sessions SET planned_date = '2026-11-18', rescheduled_from = '2026-11-16' WHERE plan_id = $1", [plan]);
await expectFail('sesión movida con la fecha original igual a la nueva', "UPDATE training_sessions SET rescheduled_from = planned_date WHERE plan_id = $1", [plan]);

await db.query("UPDATE user_plans SET status = 'reemplazado', replaced_at = now() WHERE id = $1", [plan]);
passed += 1; console.log('  ✓ ok: al iniciar otra rutina la anterior queda reemplazada (solo cambian estado y fecha)');
await expectOk('segunda rutina vigente tras reemplazar la anterior', "INSERT INTO user_plans (user_id, profile_version_id, source, rule_version_id, name, version, weeks, session_minutes, days, session_labels) VALUES ($1, $2, 'propia', $3, 'Mía', 2, 4, 30, '{2,4}', '{Sesión 1,Sesión 2}')", [user, profileId, rules]);

const FOOD = "INSERT INTO foods (code, name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, unit_name, unit_grams, author_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id";
await expectFail('alimento con un grupo inexistente', FOOD, ['x', 'X', 'snacks', 100, 1, 1, 1, null, null, nutri]);
await expectFail('alimento con más de 100 g de macronutrientes por 100 g', FOOD, ['x', 'X', 'cereales', 400, 20, 80, 10, null, null, nutri]);
await expectFail('medida casera sin su peso', FOOD, ['x', 'X', 'cereales', 130, 2.7, 28.2, 0.3, 'taza', null, nutri]);
const rice = await id(FOOD, ['arroz-blanco', 'Arroz blanco cocido', 'cereales', 130, 2.7, 28.2, 0.3, 'taza', 160, nutri]);
const chicken = await id(FOOD, ['pechuga-de-pollo', 'Pechuga de pollo a la plancha', 'proteinas', 165, 31, 0, 3.6, null, null, nutri]);
await expectFail('alimento aprobado por el preparador', "UPDATE foods SET status='approved', approved_by=$1, approved_by_role='trainer', approved_at=now() WHERE id=$2", [trainer, rice]);
await expectOk('alimento aprobado por la nutricionista', "UPDATE foods SET status='approved', approved_by=$1, approved_by_role='nutritionist', approved_at=now() WHERE id=$2", [nutri, rice]);
const MEAL_PLAN = "INSERT INTO meal_plan_templates (code, version, name, summary, diet, reference_kcal, author_id) VALUES ('mediterranea', 1, 'Mediterránea', 'Pauta de ejemplo.', $2, $3, $1) RETURNING id";
await expectFail('pauta con una dieta inexistente', MEAL_PLAN, [nutri, 'cetogenica', 2000]);
await expectFail('pauta con una energía de referencia fuera de rango', MEAL_PLAN, [nutri, 'mediterranea', 800]);
const mealPlan = await id(MEAL_PLAN, [nutri, 'mediterranea', 2000]);
const ITEM = 'INSERT INTO meal_plan_items (template_id, day_no, meal, position, food_id, grams) VALUES ($1, $2, $3, $4, $5, $6)';
await expectOk('alimento en una pauta en borrador', ITEM, [mealPlan, 1, 'almuerzo', 1, rice, 120]);
await expectOk('alimento sin aprobar en una pauta en borrador', ITEM, [mealPlan, 1, 'almuerzo', 2, chicken, 120]);
const potato = await id(FOOD, ['papa', 'Papa cocida', 'cereales', 86, 1.7, 20, 0.1, 'unidad mediana', 150, nutri]);
const oats = await id(FOOD, ['avena', 'Avena en hojuelas', 'cereales', 379, 13.2, 67.7, 6.5, 'cucharada', 10, nutri]);
await db.query("UPDATE foods SET status='approved', approved_by=$1, approved_by_role='nutritionist', approved_at=now() WHERE id = ANY($2)", [nutri, [potato, oats]]);
await db.query(ITEM, [mealPlan, 1, 'cena', 1, potato, 150]);
await expectFail('comida inexistente en la pauta', ITEM, [mealPlan, 1, 'merienda', 3, rice, 50]);
await expectFail('día fuera de la semana', ITEM, [mealPlan, 8, 'cena', 1, rice, 50]);
await expectFail('gramos fuera de rango', ITEM, [mealPlan, 1, 'cena', 1, rice, 0]);
await expectFail('aprobar una pauta con un alimento sin aprobar', "UPDATE meal_plan_templates SET status='approved', approved_by=$1, approved_by_role='nutritionist', approved_at=now() WHERE id=$2", [nutri, mealPlan]);
await db.query("UPDATE foods SET status='approved', approved_by=$1, approved_by_role='nutritionist', approved_at=now() WHERE id=$2", [nutri, chicken]);
await expectFail('pauta aprobada por el preparador', "UPDATE meal_plan_templates SET status='approved', approved_by=$1, approved_by_role='trainer', approved_at=now() WHERE id=$2", [trainer, mealPlan]);
await expectOk('pauta aprobada por la nutricionista con todos sus alimentos aprobados', "UPDATE meal_plan_templates SET status='approved', approved_by=$1, approved_by_role='nutritionist', approved_at=now() WHERE id=$2", [nutri, mealPlan]);
await expectFail('cambiar los gramos de una pauta aprobada', 'UPDATE meal_plan_items SET grams = 200 WHERE template_id = $1', [mealPlan]);
await expectFail('borrar una pauta aprobada', 'DELETE FROM meal_plan_templates WHERE id = $1', [mealPlan]);
const SWAP = 'INSERT INTO meal_plan_swaps (user_id, template_id, day_no, meal, position, food_id) VALUES ($1, $2, $3, $4, $5, $6)';
await expectFail('cambiar un alimento por otro de distinto grupo', SWAP, [user, mealPlan, 1, 'almuerzo', 1, chicken]);
await expectFail('cambiar un alimento por el mismo', SWAP, [user, mealPlan, 1, 'almuerzo', 1, rice]);
await expectFail('cambiar por un alimento aprobado que la pauta no incluye', SWAP, [user, mealPlan, 1, 'almuerzo', 1, oats]);
await expectFail('cambiar un alimento que no está en la pauta', SWAP, [user, mealPlan, 2, 'cena', 1, potato]);
await expectOk('la persona cambia el arroz por papa: aprobada, del mismo grupo y en la pauta', SWAP, [user, mealPlan, 1, 'almuerzo', 1, potato]);
await expectFail('cambiar después el reemplazo por un alimento de otro grupo', 'UPDATE meal_plan_swaps SET food_id = $1 WHERE user_id = $2', [chicken, user]);
const draftPlan = await id("INSERT INTO meal_plan_templates (code, version, name, summary, diet, reference_kcal, author_id) VALUES ('borrador', 1, 'Borrador', 'Pauta de ejemplo.', 'vegetariana', 2000, $1) RETURNING id", [nutri]);
await db.query(ITEM, [draftPlan, 1, 'almuerzo', 1, rice, 120]);
await db.query(ITEM, [draftPlan, 1, 'almuerzo', 2, potato, 120]);
await expectFail('cambiar un alimento de una pauta en borrador', SWAP, [user, draftPlan, 1, 'almuerzo', 1, potato]);
await expectOk('evento de pauta consultada', "INSERT INTO usage_events (pseudonym, event_type) VALUES (repeat('b', 64), 'pauta_consultada')");

await db.query("INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id) VALUES ($1, 'trainer', 'template.approved', 'template', $2)", [trainer, tpl]);
await expectFail('modificar la bitácora de auditoría', "UPDATE audit_log SET action='template.retired'");
await expectFail('borrar de la bitácora de auditoría', 'DELETE FROM audit_log');
await expectFail('acción de auditoría con formato inválido', "INSERT INTO audit_log (action, entity_type) VALUES ('Aprobar', 'template')");
await expectOk('evento de uso seudonimizado', "INSERT INTO usage_events (pseudonym, event_type) VALUES (repeat('a', 64), 'rutina_iniciada')");
await expectFail('seudónimo con formato inválido', "INSERT INTO usage_events (pseudonym, event_type) VALUES ('ana', 'plan_consultado')");

console.log(failures === 0 ? `\nTodas las comprobaciones pasaron (${passed}).` : `\n${failures} comprobaciones fallaron.`);
process.exit(failures === 0 ? 0 : 1);
