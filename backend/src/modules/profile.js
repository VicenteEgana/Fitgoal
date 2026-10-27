// Perfil versionado y consentimientos. Cada cambio del perfil crea una versión nueva.
import { Router } from 'express';
import { fail } from '../lib/errors.js';
import { audit, consentState, consentTime, currentProfile, hasConsent, profileView } from '../lib/records.js';
import { requireRole } from '../lib/auth.js';

export const OBJECTIVES = ['bajar', 'mantener', 'subir'];
export const LEVELS = ['principiante', 'con_experiencia'];
export const EQUIPMENT = ['sin_equipo', 'con_equipo'];
export const DURATIONS = [20, 30, 45, 60];
const SEX = ['masculino', 'femenino'];
const ACTIVITY = ['sedentario', 'ligero', 'moderado', 'intenso'];
const FIELDS = ['age', 'objective', 'level', 'days', 'durationMinutes', 'equipment', 'weightKg', 'heightCm', 'sexParam', 'activityLevel'];
const TOGGLEABLE = ['perfil_entrenamiento', 'datos_corporales', 'datos_nutricionales', 'seguimiento_progreso', 'recordatorios', 'evaluacion_piloto'];

/**
 * Valida el cuerpo del perfil. La estatura y el peso son opcionales (y exigen el consentimiento «datos_corporales»); el sexo
 * y la actividad del cálculo de calorías también son opcionales, exigen estatura y peso y el consentimiento «datos_nutricionales».
 */
export function validateProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INVALID_PROFILE', 'Envía un perfil válido.');
  if (Object.keys(body).some(key => !FIELDS.includes(key))) fail(400, 'UNKNOWN_FIELD', 'El perfil solo admite edad, objetivo, nivel, días, duración, equipo y, opcionales, estatura, peso, sexo y nivel de actividad.');
  if (!Number.isInteger(body.age) || body.age < 18 || body.age > 120) fail(400, 'INVALID_AGE', 'La edad debe ser un entero entre 18 y 120: FitGoal es para personas adultas.');
  if (!OBJECTIVES.includes(body.objective)) fail(400, 'INVALID_OBJECTIVE', 'Objetivo permitido: bajar, mantener o subir.');
  if (!LEVELS.includes(body.level)) fail(400, 'INVALID_LEVEL', 'Nivel permitido: principiante o con_experiencia.');
  if (!EQUIPMENT.includes(body.equipment)) fail(400, 'INVALID_EQUIPMENT', 'Equipo permitido: sin_equipo o con_equipo.');
  if (!DURATIONS.includes(body.durationMinutes)) fail(400, 'INVALID_DURATION', 'Duración permitida: 20, 30, 45 o 60 minutos.');
  const days = body.days;
  if (!Array.isArray(days) || days.length < 1 || days.length > 7 || days.some(day => !Number.isInteger(day) || day < 1 || day > 7) || new Set(days).size !== days.length) fail(400, 'INVALID_DAYS', 'Selecciona entre 1 y 7 días únicos (1 = lunes, 7 = domingo).');
  const given = key => body[key] !== undefined && body[key] !== null;
  const hasBody = given('weightKg') || given('heightCm');
  if (hasBody) {
    if (!given('weightKg') || !given('heightCm')) fail(400, 'INVALID_BODY_DATA', 'Indica la estatura y el peso juntos, o ninguno.');
    if (typeof body.weightKg !== 'number' || !(body.weightKg >= 30 && body.weightKg <= 300)) fail(400, 'INVALID_WEIGHT', 'El peso debe estar entre 30 y 300 kg.');
    if (typeof body.heightCm !== 'number' || !(body.heightCm >= 100 && body.heightCm <= 250)) fail(400, 'INVALID_HEIGHT', 'La estatura debe estar entre 100 y 250 cm.');
  }
  const hasEstimate = given('sexParam') || given('activityLevel');
  if (hasEstimate) {
    if (!given('sexParam') || !given('activityLevel') || !hasBody) fail(400, 'INVALID_NUTRITION_DATA', 'Para calcular tus calorías informa sexo, estatura, peso y nivel de actividad completos, o ninguno.');
    if (!SEX.includes(body.sexParam)) fail(400, 'INVALID_SEX', 'Parámetro de sexo permitido: masculino o femenino.');
    if (!ACTIVITY.includes(body.activityLevel)) fail(400, 'INVALID_ACTIVITY', 'Nivel de actividad permitido: sedentario, ligero, moderado o intenso.');
  }
  return {
    age: body.age, objective: body.objective, level: body.level, days: [...days].sort((a, b) => a - b), durationMinutes: body.durationMinutes, equipment: body.equipment,
    weightKg: hasBody ? body.weightKg : null, heightCm: hasBody ? body.heightCm : null,
    sexParam: hasEstimate ? body.sexParam : null, activityLevel: hasEstimate ? body.activityLevel : null,
  };
}

export function profileRouter(ctx) {
  const { db, config, now } = ctx;
  const router = Router();

  router.get('/profiles/me', requireRole('user'), async (req, res) => {
    res.json({ profile: profileView(await currentProfile(db, req.auth.userId)) });
  });

  router.get('/profiles/me/versions', requireRole('user'), async (req, res) => {
    const rows = (await db.query('SELECT id, version, created_at FROM profile_versions WHERE user_id = $1 ORDER BY version DESC', [req.auth.userId])).rows;
    res.json({ versions: rows.map(row => ({ id: row.id, version: row.version, createdAt: row.created_at })) });
  });

  router.put('/profiles/me', requireRole('user'), async (req, res) => {
    const values = validateProfile(req.body);
    const result = await db.transaction(async tx => {
      if (!(await hasConsent(tx, req.auth.userId, 'perfil_entrenamiento'))) fail(403, 'CONSENT_REQUIRED', 'Necesitamos tu consentimiento para tratar tu perfil de entrenamiento.');
      // La estatura y el peso son datos de salud: solo se guardan con su consentimiento específico.
      if (values.weightKg !== null && !(await hasConsent(tx, req.auth.userId, 'datos_corporales'))) fail(403, 'BODY_DATA_CONSENT_REQUIRED', 'Para usar tu estatura y peso necesitamos tu consentimiento específico. Puedes dejarlos en blanco.');
      // El sexo y la actividad solo se usan para calcular las calorías de la pauta de alimentación, con otro consentimiento específico.
      if (values.sexParam !== null && !(await hasConsent(tx, req.auth.userId, 'datos_nutricionales'))) fail(403, 'NUTRITION_DATA_CONSENT_REQUIRED', 'Para usar tu sexo y nivel de actividad en tu pauta de alimentación necesitamos tu consentimiento específico. Puedes dejarlos en blanco.');
      const previous = await currentProfile(tx, req.auth.userId);
      const version = (previous?.version ?? 0) + 1;
      const inserted = await tx.query(
        `INSERT INTO profile_versions (user_id, version, age, objective, level, days, duration_minutes, equipment, sex_param, weight_kg, height_cm, activity_level, is_fictitious, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [req.auth.userId, version, values.age, values.objective, values.level, values.days, values.durationMinutes, values.equipment, values.sexParam, values.weightKg, values.heightCm, values.activityLevel, req.auth.isFictitious, now()],
      );
      // Cambiar el perfil no modifica la rutina vigente: la persona decide cuándo iniciar otra.
      await audit(tx, now(), { actor: req.auth, action: 'profile.updated', entityType: 'profile', entityId: inserted.rows[0].id, version });
      return { profile: profileView(inserted.rows[0]) };
    });
    res.json(result);
  });

  router.get('/consents', async (req, res) => {
    const state = await consentState(db, req.auth.userId);
    res.json({ policyVersion: config.policyVersion, consents: Object.values(state).map(row => ({ purpose: row.purpose, granted: row.granted, policyVersion: row.policy_version, recordedAt: row.recorded_at })) });
  });

  router.post('/consents', requireRole('user'), async (req, res) => {
    const { purpose, granted } = req.body ?? {};
    if (!TOGGLEABLE.includes(purpose)) fail(400, 'INVALID_PURPOSE', `Finalidad permitida: ${TOGGLEABLE.join(', ')}.`);
    if (typeof granted !== 'boolean') fail(400, 'INVALID_CONSENT', 'Indica si otorgas o revocas el consentimiento.');
    if (req.body.policyVersion !== config.policyVersion) fail(400, 'POLICY_VERSION_MISMATCH', 'La política de datos mostrada no es la vigente.');
    await db.transaction(async tx => {
      await tx.query('INSERT INTO consents (user_id, purpose, policy_version, granted, recorded_at) VALUES ($1, $2, $3, $4, $5)', [req.auth.userId, purpose, config.policyVersion, granted, await consentTime(tx, req.auth.userId, purpose, now())]);
      // Minimización: al revocar el consentimiento de los datos corporales se borran de todas las versiones del perfil.
      if (purpose === 'datos_corporales' && !granted) await tx.query('UPDATE profile_versions SET weight_kg = NULL, height_cm = NULL, sex_param = NULL, activity_level = NULL WHERE user_id = $1', [req.auth.userId]);
      if (purpose === 'datos_nutricionales' && !granted) await tx.query('UPDATE profile_versions SET sex_param = NULL, activity_level = NULL WHERE user_id = $1', [req.auth.userId]);
      await audit(tx, now(), { actor: req.auth, action: granted ? 'consent.granted' : 'consent.revoked', entityType: 'consent', detail: { purpose } });
    });
    res.status(201).json({ purpose, granted, policyVersion: config.policyVersion });
  });

  return router;
}
