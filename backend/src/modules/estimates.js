// Cálculo de calorías: Mifflin-St Jeor con unidades y versión, factor de actividad y ajuste por objetivo de las reglas
// nutricionales aprobadas. Exige los consentimientos de datos corporales y nutricionales.
import { Router } from 'express';
import { fail } from '../lib/errors.js';
import { currentProfile, hasConsent } from '../lib/records.js';
import { requireRole } from '../lib/auth.js';
import { FORMULA, restingEnergy } from '../lib/energy.js';
import { personalEnergy } from './nutrition.js';

export { FORMULA, restingEnergy };

export function estimatesRouter(ctx) {
  const { db } = ctx;
  const router = Router();

  router.get('/estimates/energy', requireRole('user'), async (req, res) => {
    const consented = (await hasConsent(db, req.auth.userId, 'datos_corporales')) && (await hasConsent(db, req.auth.userId, 'datos_nutricionales'));
    if (!consented) fail(403, 'NUTRITION_DATA_CONSENT_REQUIRED', 'Para calcular tus calorías necesitamos tus consentimientos de datos corporales y nutricionales.');
    const profile = await currentProfile(db, req.auth.userId);
    if (!profile || profile.weight_kg === null || profile.sex_param === null) fail(409, 'NUTRITION_DATA_REQUIRED', 'Completa sexo, estatura, peso y nivel de actividad en tu perfil.');
    const { target } = await personalEnergy(db, req.auth.userId);
    res.json({
      estimate: {
        formula: FORMULA,
        units: { weight: 'kg', height: 'cm', age: 'años', energy: 'kcal/día' },
        inputs: { weightKg: Number(profile.weight_kg), heightCm: Number(profile.height_cm), age: profile.age, sex: profile.sex_param, activityLevel: profile.activity_level, profileVersion: profile.version },
        restingEnergyKcal: target?.restingKcal ?? restingEnergy({ weightKg: Number(profile.weight_kg), heightCm: Number(profile.height_cm), age: profile.age, sex: profile.sex_param }),
        maintenanceKcal: target?.maintenanceKcal ?? null,
        targetKcal: target?.targetKcal ?? null,
        objectiveLabel: target?.label ?? null,
        adjustments: target ? `Factor de actividad ${String(target.activityFactor).replace('.', ',')} y ${target.label} (${target.adjustmentPercent > 0 ? '+' : ''}${target.adjustmentPercent} %) según las reglas nutricionales aprobadas v${target.rulesVersion}.` : 'Sin reglas nutricionales aprobadas por una nutricionista no se ajusta por actividad ni por objetivo.',
        notices: target?.notices ?? [],
        notice: 'Es una estimación de referencia: las ecuaciones tienen un error individual de ±10 % y no sustituyen una evaluación profesional.',
      },
    });
  });

  return router;
}
