// Revisión profesional: cola de casos, decisión y publicación transaccional del plan aprobado.
import { Router } from 'express';
import { fail } from '../lib/errors.js';
import { audit, currentProfile, notify, notifyAdmins, profileView } from '../lib/records.js';
import { KIND_BY_ROLE, PROFESSIONAL_ROLES, requireRole } from '../lib/auth.js';
import { addDays, localDate, nextWeekday } from '../lib/time.js';
import { uuidParam } from '../lib/validate.js';

const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;

/**
 * Valida la corrección del profesional: no puede cambiar los días del participante ni inventar ejercicios.
 * Nombre y descripción se toman siempre del catálogo, nunca del cliente.
 */
export async function sanitizeCorrection(tx, original, corrected, allowedAdjustments) {
  const schedule = corrected?.schedule;
  if (!Array.isArray(schedule) || schedule.length !== original.schedule.length) fail(400, 'INVALID_CORRECTION', 'La corrección debe conservar los mismos días del plan.');
  const catalog = new Map((await tx.query('SELECT code, name, description FROM exercises')).rows.map(row => [row.code, row]));
  const exerciseChangesAllowed = allowedAdjustments?.exerciseChanges === true;
  const clean = schedule.map((entry, index) => {
    const base = original.schedule[index];
    if (entry?.day !== base.day) fail(400, 'INVALID_CORRECTION', 'La corrección no puede cambiar los días del plan.');
    if (!Array.isArray(entry.exercises) || entry.exercises.length < 1 || entry.exercises.length > 20) fail(400, 'INVALID_CORRECTION', 'Cada sesión debe tener entre 1 y 20 ejercicios.');
    const exercises = entry.exercises.map(exercise => {
      const known = catalog.get(exercise?.code);
      if (!known) fail(400, 'UNKNOWN_EXERCISE', 'Solo se pueden usar ejercicios del catálogo.');
      if (!text(exercise.prescription, 1, 200)) fail(400, 'INVALID_PRESCRIPTION', 'La indicación debe tener entre 1 y 200 caracteres.');
      return { code: known.code, name: known.name, description: known.description, prescription: exercise.prescription.trim() };
    });
    if (!exerciseChangesAllowed) {
      const before = base.exercises.map(exercise => exercise.code).join('|');
      if (exercises.map(exercise => exercise.code).join('|') !== before) fail(400, 'ADJUSTMENT_NOT_ALLOWED', 'La plantilla no permite cambiar los ejercicios; solo sus indicaciones.');
    }
    return { ...base, exercises };
  });
  return { ...original, schedule: clean };
}

export function reviewsRouter(ctx) {
  const { db, config, now } = ctx;
  const router = Router();
  const professional = requireRole(...PROFESSIONAL_ROLES);

  const summary = row => ({
    id: row.id, kind: row.kind, version: row.version, status: row.status, createdAt: row.created_at,
    participant: { label: `Participante ${row.user_id.slice(0, 8)}`, objective: row.objective, level: row.level, equipment: row.equipment, days: row.days.map(Number), durationMinutes: row.duration_minutes, age: row.age },
  });
  const joined = `SELECT d.id, d.user_id, d.kind, d.version, d.status, d.created_at, d.content, d.selection_reasons, d.template_id, d.profile_version_id, d.assigned_reviewer_id,
                         p.objective, p.level, p.equipment, p.days, p.duration_minutes, p.age
                    FROM plan_drafts d JOIN profile_versions p ON p.id = d.profile_version_id`;

  router.get('/reviews/queue', professional, async (req, res) => {
    const rows = (await db.query(`${joined} WHERE d.assigned_reviewer_id = $1 AND d.kind = $2 AND d.status IN ('borrador', 'en_revision') ORDER BY d.created_at`, [req.auth.userId, KIND_BY_ROLE[req.auth.role]])).rows;
    res.json({ queue: rows.map(summary) });
  });

  async function loadAssigned(req, tx = db, lock = false) {
    const id = uuidParam(req.params.draftId, 'borrador');
    const row = (await tx.query(`${joined} WHERE d.id = $1 ${lock ? 'FOR UPDATE OF d' : ''}`, [id])).rows[0];
    // Se responde 404 tanto si no existe como si pertenece a otro profesional, para no revelar casos ajenos.
    if (!row || row.assigned_reviewer_id !== req.auth.userId || row.kind !== KIND_BY_ROLE[req.auth.role]) fail(404, 'NOT_FOUND', 'El caso indicado no existe o no está asignado a ti.');
    return row;
  }

  router.get('/reviews/:draftId', professional, async (req, res) => {
    const row = await loadAssigned(req);
    const template = row.template_id ? (await db.query('SELECT code, version, name, allowed_adjustments FROM routine_templates WHERE id = $1', [row.template_id])).rows[0] : null;
    res.json({ draft: { ...summary(row), content: row.content, selectionReasons: row.selection_reasons, template: template ? { code: template.code, version: template.version, name: template.name, allowedAdjustments: template.allowed_adjustments } : null } });
  });

  router.post('/reviews/:draftId/claim', professional, async (req, res) => {
    const result = await db.transaction(async tx => {
      const row = await loadAssigned(req, tx, true);
      if (row.status === 'en_revision') return { id: row.id, status: 'en_revision' };
      if (row.status !== 'borrador') fail(409, 'INVALID_STATE', 'Solo se pueden tomar casos en la cola.');
      await tx.query("UPDATE plan_drafts SET status = 'en_revision', reviewing_since = $2 WHERE id = $1", [row.id, now()]);
      await audit(tx, now(), { actor: req.auth, action: 'review.claimed', entityType: 'draft', entityId: row.id, version: row.version });
      return { id: row.id, status: 'en_revision' };
    });
    res.json({ draft: result });
  });

  router.post('/reviews/:draftId/decision', professional, async (req, res) => {
    const { decision, notes, correctedContent } = req.body ?? {};
    if (!['aprobado', 'rechazado'].includes(decision)) fail(400, 'INVALID_DECISION', 'Decisión permitida: aprobado o rechazado.');
    if (decision === 'rechazado' && !text(notes, 1, 500)) fail(400, 'NOTES_REQUIRED', 'Un rechazo necesita un motivo de hasta 500 caracteres.');
    if (notes !== undefined && notes !== null && !text(notes, 0, 500)) fail(400, 'INVALID_NOTES', 'Las observaciones admiten hasta 500 caracteres.');
    if (decision === 'rechazado' && correctedContent !== undefined) fail(400, 'INVALID_DECISION', 'Un borrador rechazado no se corrige.');
    const outcome = await db.transaction(async tx => {
      const row = await loadAssigned(req, tx, true);
      if (!['borrador', 'en_revision'].includes(row.status)) fail(409, 'INVALID_STATE', 'Este borrador ya tiene una decisión o fue reemplazado.');
      // Un cambio de perfil invalida el borrador: no se reutiliza ninguna aprobación sobre un perfil anterior.
      const latest = await currentProfile(tx, row.user_id);
      if (!latest || latest.id !== row.profile_version_id) {
        await tx.query("UPDATE plan_drafts SET status = 'reemplazado', superseded_at = $2 WHERE id = $1", [row.id, now()]);
        await audit(tx, now(), { actor: req.auth, action: 'draft.superseded', entityType: 'draft', entityId: row.id, version: row.version });
        return { stale: true };
      }
      let content = row.content;
      let corrected = false;
      if (decision === 'aprobado' && correctedContent !== undefined) {
        const template = row.template_id ? (await tx.query('SELECT allowed_adjustments FROM routine_templates WHERE id = $1', [row.template_id])).rows[0] : null;
        content = await sanitizeCorrection(tx, row.content, correctedContent, template?.allowed_adjustments);
        corrected = true;
      }
      const review = (await tx.query(
        `INSERT INTO reviews (draft_id, draft_kind, draft_version, reviewer_id, reviewer_role, decision, corrected, corrected_content, notes, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [row.id, row.kind, row.version, req.auth.userId, req.auth.role, decision, corrected, corrected ? JSON.stringify(content) : null, notes?.trim() || null, now()])).rows[0];
      await tx.query('UPDATE plan_drafts SET status = $2, decided_at = $3 WHERE id = $1', [row.id, decision, now()]);

      if (decision === 'rechazado') {
        await notify(tx, now(), row.user_id, 'borrador_rechazado', 'Tu solicitud necesita ajustes. El equipo se pondrá en contacto contigo.', row.id);
        await notifyAdmins(tx, now(), 'caso_pendiente', 'Un borrador fue rechazado y requiere ajustar la plantilla o el perfil.', row.id);
        await audit(tx, now(), { actor: req.auth, action: 'review.rejected', entityType: 'review', entityId: review.id, version: row.version });
        return { status: 'rechazado' };
      }

      // Publicación: el plan vigente anterior pasa a «reemplazado» y se crean el plan, las sesiones, el aviso y la auditoría.
      const today = localDate(now(), config.timezone);
      const previous = (await tx.query("SELECT id FROM approved_plans WHERE user_id = $1 AND kind = $2 AND status = 'vigente' FOR UPDATE", [row.user_id, row.kind])).rows[0];
      if (previous) {
        await tx.query("UPDATE approved_plans SET status = 'reemplazado', replaced_at = $2 WHERE id = $1", [previous.id, now()]);
        await tx.query('DELETE FROM training_sessions WHERE plan_id = $1 AND planned_date >= $2 AND completed_at IS NULL', [previous.id, today]);
      }
      const plan = (await tx.query(
        `INSERT INTO approved_plans (draft_id, review_id, user_id, kind, version, content, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, version`,
        [row.id, review.id, row.user_id, row.kind, row.version, JSON.stringify(content), now()])).rows[0];
      const start = addDays(today, 1);
      let scheduled = 0;
      for (let week = 0; week < (content.weeks ?? 1); week += 1) {
        for (const entry of content.schedule) {
          const date = addDays(nextWeekday(start, entry.day), 7 * week);
          await tx.query('INSERT INTO training_sessions (user_id, plan_id, session_no, label, planned_date) VALUES ($1, $2, $3, $4, $5)', [row.user_id, plan.id, entry.sessionNo, `${entry.dayLabel} · ${entry.label}`, date]);
          scheduled += 1;
        }
      }
      await notify(tx, now(), row.user_id, 'plan_publicado', 'Tu rutina fue aprobada. Ya puedes consultarla.', plan.id);
      await audit(tx, now(), { actor: req.auth, action: 'review.approved', entityType: 'review', entityId: review.id, version: row.version, detail: { corrected } });
      await audit(tx, now(), { actor: req.auth, action: 'plan.published', entityType: 'plan', entityId: plan.id, version: plan.version, detail: { sessions: scheduled, replaced: Boolean(previous) } });
      return { status: 'aprobado', planId: plan.id, version: plan.version, sessionsScheduled: scheduled, corrected };
    });
    if (outcome.stale) fail(409, 'STALE_DRAFT', 'El participante cambió su perfil: este borrador quedó reemplazado y se generará otro.');
    res.json({ result: outcome });
  });

  router.get('/plans/me', requireRole('user'), async (req, res) => {
    const plan = (await db.query("SELECT id, kind, version, content, published_at FROM approved_plans WHERE user_id = $1 AND kind = 'rutina' AND status = 'vigente'", [req.auth.userId])).rows[0];
    if (!plan) return res.json({ plan: null });
    res.json({ plan: { id: plan.id, kind: plan.kind, version: plan.version, status: 'vigente', publishedAt: plan.published_at, approved: true, content: plan.content } });
  });

  router.get('/plans/me/history', requireRole('user'), async (req, res) => {
    const rows = (await db.query('SELECT id, kind, version, status, published_at, replaced_at FROM approved_plans WHERE user_id = $1 ORDER BY published_at DESC', [req.auth.userId])).rows;
    res.json({ plans: rows.map(row => ({ id: row.id, kind: row.kind, version: row.version, status: row.status, publishedAt: row.published_at, replacedAt: row.replaced_at })) });
  });

  return router;
}
