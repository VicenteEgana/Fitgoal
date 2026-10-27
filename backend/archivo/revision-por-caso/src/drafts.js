// Borradores: selección de una plantilla aprobada y generación explicable del borrador de rutina.
import { Router } from 'express';
import { fail } from '../lib/errors.js';
import { audit, currentProfile, hasConsent, notify, notifyAdmins, profileView } from '../lib/records.js';
import { requireRole } from '../lib/auth.js';
import { DAY_LABELS } from '../lib/time.js';

const OBJECTIVE_LABELS = { bajar: 'Bajar de peso', mantener: 'Mantener peso', subir: 'Subir de peso' };

/** Elige `count` días repartidos de forma pareja entre los días disponibles (ya ordenados). */
export function spreadDays(days, count) {
  if (count >= days.length) return [...days];
  if (count === 1) return [days[0]];
  return Array.from({ length: count }, (_, index) => days[Math.round((index * (days.length - 1)) / (count - 1))]);
}

/** Arma el contenido propuesto a partir de la plantilla; no inventa ejercicios ni indicaciones. */
export function buildDraftContent({ profile, template, sessions }) {
  const perWeek = Math.min(profile.days.length, template.max_days);
  const chosenDays = spreadDays([...profile.days].sort((a, b) => a - b), perWeek);
  const sessionNumbers = sessions.map(session => session.sessionNo);
  return {
    title: `${OBJECTIVE_LABELS[profile.objective]} · ${template.name}`,
    templateCode: template.code,
    templateVersion: template.version,
    weeks: template.weeks,
    sessionMinutes: template.session_minutes,
    daysPerWeek: perWeek,
    schedule: chosenDays.map((day, index) => {
      const sessionNo = sessionNumbers[index % sessionNumbers.length];
      const session = sessions.find(item => item.sessionNo === sessionNo);
      return { day, dayLabel: DAY_LABELS[day - 1], sessionNo, label: `Sesión ${sessionNo}`, exercises: session.exercises };
    }),
    notice: 'Borrador generado por el sistema. No es una indicación personal hasta que lo apruebe un profesional.',
  };
}

export function draftsRouter(ctx) {
  const { db, now } = ctx;
  const router = Router();

  router.post('/drafts', requireRole('user'), async (req, res) => {
    const kind = req.body?.kind ?? 'rutina';
    if (kind === 'minuta') fail(409, 'NUTRITION_NOT_ENABLED', 'Las minutas personales requieren nutricionista y habilitación de datos; en esta etapa solo existe el prototipo con perfiles ficticios.');
    if (kind !== 'rutina') fail(400, 'INVALID_KIND', 'Tipo permitido: rutina.');
    const outcome = await db.transaction(async tx => {
      if (!(await hasConsent(tx, req.auth.userId, 'perfil_entrenamiento'))) fail(403, 'CONSENT_REQUIRED', 'Necesitamos tu consentimiento para tratar tu perfil de entrenamiento.');
      const profileRow = await currentProfile(tx, req.auth.userId);
      if (!profileRow) fail(409, 'PROFILE_REQUIRED', 'Completa tu perfil antes de solicitar una rutina.');
      const profile = { ...profileView(profileRow), days: profileRow.days.map(Number) };

      const active = (await tx.query(
        `SELECT id, version, status, profile_version_id FROM plan_drafts WHERE user_id = $1 AND kind = 'rutina' AND status IN ('pendiente', 'borrador', 'en_revision') FOR UPDATE`,
        [req.auth.userId])).rows[0];
      if (active && active.profile_version_id === profile.id && active.status !== 'pendiente') return { reused: true, draft: active };
      if (active) await tx.query("UPDATE plan_drafts SET status = 'reemplazado', pending_reason = NULL, superseded_at = $2 WHERE id = $1", [active.id, now()]);

      const rules = (await tx.query("SELECT id, content FROM rule_versions WHERE domain = 'entrenamiento' AND status = 'approved'")).rows[0];
      if (!rules) fail(409, 'NO_APPROVED_RULES', 'Aún no hay reglas de entrenamiento aprobadas por el preparador físico.');

      const assignment = (await tx.query("SELECT professional_id FROM case_assignments WHERE participant_id = $1 AND professional_role = 'trainer' AND ended_at IS NULL", [req.auth.userId])).rows[0];
      const reasons = [
        { criterio: 'objetivo', valor: profile.objective },
        { criterio: 'nivel', valor: profile.level },
        { criterio: 'equipo', valor: profile.equipment },
        { criterio: 'disponibilidad', valor: `${profile.days.length} días, ${profile.durationMinutes} minutos` },
      ];

      // Selección: la matriz aprobada propone una plantilla; se descarta si no está vigente o no cabe en la disponibilidad.
      const code = rules.content?.matrix?.[profile.objective]?.[profile.level]?.[profile.equipment] ?? null;
      let template = null;
      let pendingReason = null;
      if (!code) {
        reasons.push({ criterio: 'plantilla', resultado: 'sin coincidencia en la matriz aprobada' });
        pendingReason = 'sin_plantilla';
      } else {
        template = (await tx.query("SELECT * FROM routine_templates WHERE code = $1 AND status = 'approved'", [code])).rows[0] ?? null;
        if (!template) {
          reasons.push({ criterio: 'plantilla', valor: code, resultado: 'descartada: no hay versión aprobada vigente' });
          pendingReason = 'sin_plantilla';
        } else if (template.objective !== profile.objective || template.level !== profile.level || template.equipment !== profile.equipment) {
          reasons.push({ criterio: 'plantilla', valor: `${code} v${template.version}`, resultado: 'descartada: no corresponde al objetivo, nivel y equipo del perfil' });
          template = null;
          pendingReason = 'sin_plantilla';
        } else if (template.min_days > profile.days.length) {
          reasons.push({ criterio: 'plantilla', valor: `${code} v${template.version}`, resultado: `descartada: exige al menos ${template.min_days} días y el perfil tiene ${profile.days.length}` });
          template = null;
          pendingReason = 'sin_plantilla';
        } else if (template.session_minutes > profile.durationMinutes) {
          reasons.push({ criterio: 'plantilla', valor: `${code} v${template.version}`, resultado: `descartada: sesiones de ${template.session_minutes} min y el perfil dispone de ${profile.durationMinutes}` });
          template = null;
          pendingReason = 'sin_plantilla';
        } else {
          reasons.push({ criterio: 'plantilla', valor: `${code} v${template.version}`, resultado: 'seleccionada' });
        }
      }
      if (!pendingReason && !assignment) pendingReason = 'sin_profesional';

      let content = {};
      if (template) {
        const rows = (await tx.query(
          `SELECT te.session_no, te.position, te.prescription, e.code, e.name, e.description FROM template_exercises te JOIN exercises e ON e.id = te.exercise_id
            WHERE te.template_id = $1 ORDER BY te.session_no, te.position`, [template.id])).rows;
        const sessions = [...new Set(rows.map(row => row.session_no))].map(sessionNo => ({
          sessionNo,
          exercises: rows.filter(row => row.session_no === sessionNo).map(row => ({ code: row.code, name: row.name, description: row.description, prescription: row.prescription })),
        }));
        content = buildDraftContent({ profile, template, sessions });
      }

      const version = ((await tx.query("SELECT coalesce(max(version), 0) AS v FROM plan_drafts WHERE user_id = $1 AND kind = 'rutina'", [req.auth.userId])).rows[0].v) + 1;
      const status = pendingReason ? 'pendiente' : 'borrador';
      const inserted = await tx.query(
        `INSERT INTO plan_drafts (user_id, profile_version_id, kind, version, status, pending_reason, template_id, rule_version_id, selection_reasons, content, assigned_reviewer_id, created_at)
         VALUES ($1, $2, 'rutina', $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, version, status, pending_reason`,
        [req.auth.userId, profile.id, version, status, pendingReason, template?.id ?? null, rules.id, JSON.stringify(reasons), JSON.stringify(content), assignment?.professional_id ?? null, now()],
      );
      const draft = inserted.rows[0];
      if (status === 'borrador') await notify(tx, now(), assignment.professional_id, 'revision_pendiente', 'Tienes un borrador de rutina pendiente de revisión.', draft.id);
      else await notifyAdmins(tx, now(), 'caso_pendiente', pendingReason === 'sin_profesional' ? 'Hay un caso sin profesional asignado.' : 'Hay un caso pendiente por falta de plantilla aprobada.', draft.id);
      await audit(tx, now(), { actor: req.auth, action: 'draft.generated', entityType: 'draft', entityId: draft.id, version, detail: { status, pendingReason, template: template ? `${template.code} v${template.version}` : null } });
      return { reused: false, draft };
    });
    res.status(outcome.reused ? 200 : 201).json({ draft: { id: outcome.draft.id, kind: 'rutina', version: outcome.draft.version, status: outcome.draft.status } });
  });

  /** Estado de la solicitud: el participante nunca ve el contenido de un borrador. */
  router.get('/drafts/me/status', requireRole('user'), async (req, res) => {
    const row = (await db.query(
      `SELECT d.id, d.version, d.status, d.pending_reason, d.created_at, d.decided_at, d.profile_version_id, p.version AS profile_version
         FROM plan_drafts d JOIN profile_versions p ON p.id = d.profile_version_id
        WHERE d.user_id = $1 AND d.kind = 'rutina' ORDER BY d.version DESC LIMIT 1`, [req.auth.userId])).rows[0];
    if (!row) return res.json({ request: null });
    const labels = { pendiente: 'Pendiente: el equipo está preparando tu caso', borrador: 'En revisión: un profesional revisará tu rutina', en_revision: 'En revisión: un profesional está revisando tu rutina', aprobado: 'Aprobada: ya puedes consultar tu plan', rechazado: 'Requiere ajustes: el equipo se pondrá en contacto', reemplazado: 'Reemplazada por una solicitud más reciente' };
    res.json({ request: { id: row.id, version: row.version, status: row.status, message: labels[row.status], profileVersion: row.profile_version, createdAt: row.created_at, decidedAt: row.decided_at } });
  });

  return router;
}
