import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { approve, createContext, participantWithDraft, PROFILE } from './helpers.js';

describe('Revisión profesional de rutinas (RF004, RF006, OE-b, K5)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());

  test('el borrador explica por qué se eligió la plantilla y el participante nunca ve su contenido', async () => {
    const { participant, draftId } = await participantWithDraft(ctx);
    const trainer = await ctx.demo('trainer');
    const detail = (await trainer.get(`/api/reviews/${draftId}`)).body.draft;
    assert.equal(detail.status, 'borrador');
    assert.equal(detail.template.code, 'demo-bajar-principiante-sin-equipo');
    assert.ok(detail.selectionReasons.some(reason => reason.criterio === 'plantilla' && reason.resultado === 'seleccionada'));
    assert.deepEqual(detail.content.schedule.map(entry => entry.day), [1, 3, 5]);
    assert.match(detail.content.notice, /No es una indicación personal hasta que lo apruebe/);

    const status = await participant.api.get('/api/drafts/me/status');
    assert.equal(status.body.request.status, 'borrador');
    assert.ok(!JSON.stringify(status.body).includes('schedule'), 'el estado no debe incluir el contenido');
    assert.equal((await participant.api.get(`/api/reviews/${draftId}`)).status, 403);
    assert.equal((await participant.api.get('/api/plans/me')).body.plan, null, 'sin aprobación no hay plan visible');
  });

  test('solicitar la rutina dos veces con el mismo perfil devuelve el mismo borrador', async () => {
    const { participant, draftId } = await participantWithDraft(ctx);
    const again = await participant.api.post('/api/drafts').send({ kind: 'rutina' });
    assert.equal(again.status, 200);
    assert.equal(again.body.draft.id, draftId);
  });

  test('solo el preparador asignado ve el caso; otro preparador y la nutricionista no', async () => {
    const { draftId } = await participantWithDraft(ctx);
    const otherTrainer = await ctx.createStaff('trainer');
    const nutritionist = await ctx.createStaff('nutritionist');
    assert.equal((await otherTrainer.api.get(`/api/reviews/${draftId}`)).status, 404);
    assert.equal((await nutritionist.api.get(`/api/reviews/${draftId}`)).status, 404);
    assert.equal((await nutritionist.api.post(`/api/reviews/${draftId}/decision`).send({ decision: 'aprobado' })).status, 404);
    assert.deepEqual((await nutritionist.api.get('/api/reviews/queue')).body.queue, []);
    assert.equal((await otherTrainer.api.get('/api/reviews/queue')).body.queue.length, 0);
  });

  test('tomar el caso lo pasa a «en revisión» y el participante ve el estado sin detalles', async () => {
    const { participant, draftId } = await participantWithDraft(ctx);
    const trainer = await ctx.demo('trainer');
    assert.equal((await trainer.post(`/api/reviews/${draftId}/claim`)).body.draft.status, 'en_revision');
    assert.equal((await trainer.post(`/api/reviews/${draftId}/claim`)).status, 200, 'tomarlo de nuevo es idempotente');
    const status = (await participant.api.get('/api/drafts/me/status')).body.request;
    assert.equal(status.status, 'en_revision');
    assert.match(status.message, /revisando/);
  });

  test('aprobar publica el plan, programa las sesiones, avisa al participante y deja auditoría', async () => {
    const { participant, draftId, trainerId } = await participantWithDraft(ctx);
    const response = await approve(ctx, draftId);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.result.sessionsScheduled, 12, '3 días por 4 semanas');

    const plan = (await participant.api.get('/api/plans/me')).body.plan;
    assert.equal(plan.approved, true);
    assert.equal(plan.version, 1);
    assert.equal((await participant.api.get('/api/drafts/me/status')).body.request.status, 'aprobado');

    const notifications = (await participant.api.get('/api/notifications/me')).body.notifications;
    assert.ok(notifications.some(item => item.type === 'plan_publicado'));
    assert.ok(notifications.every(item => !/schedule|series|repeticiones/i.test(item.message)), 'los avisos no llevan contenido');

    const review = (await ctx.db.query('SELECT reviewer_id, reviewer_role, decision, draft_version FROM reviews WHERE draft_id = $1', [draftId])).rows[0];
    assert.deepEqual({ ...review }, { reviewer_id: trainerId, reviewer_role: 'trainer', decision: 'aprobado', draft_version: 1 });
    const events = (await ctx.db.query("SELECT action, actor_role, entity_version FROM audit_log WHERE entity_id IN (SELECT id FROM reviews WHERE draft_id = $1) OR entity_id = $2 ORDER BY id", [draftId, plan.id])).rows.map(row => row.action);
    assert.deepEqual(events, ['review.approved', 'plan.published']);
  });

  test('las sesiones se programan desde el día siguiente en los días elegidos', async () => {
    const { participant, draftId } = await participantWithDraft(ctx);
    await approve(ctx, draftId);
    const sessions = (await participant.api.get('/api/sessions/me?from=2026-11-01&to=2026-12-31')).body.sessions;
    assert.equal(sessions[0].plannedDate, '2026-11-04', 'miércoles: el primer día elegido (lunes, miércoles, viernes) desde el martes 3');
    assert.deepEqual(sessions.slice(0, 3).map(session => session.plannedDate), ['2026-11-04', '2026-11-06', '2026-11-09']);
    assert.equal(sessions.length, 12);
  });

  test('el profesional puede corregir las indicaciones antes de aprobar y la corrección queda registrada', async () => {
    const { participant, draftId } = await participantWithDraft(ctx);
    const trainer = await ctx.demo('trainer');
    const content = (await trainer.get(`/api/reviews/${draftId}`)).body.draft.content;
    const corrected = structuredClone(content);
    corrected.schedule[0].exercises[0].prescription = 'Indicación corregida por el preparador: 3 series de 6.';
    const response = await trainer.post(`/api/reviews/${draftId}/decision`).send({ decision: 'aprobado', correctedContent: corrected });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.result.corrected, true);
    const plan = (await participant.api.get('/api/plans/me')).body.plan;
    assert.equal(plan.content.schedule[0].exercises[0].prescription, 'Indicación corregida por el preparador: 3 series de 6.');
    const review = (await ctx.db.query('SELECT corrected, corrected_content IS NOT NULL AS has_content FROM reviews WHERE draft_id = $1', [draftId])).rows[0];
    assert.deepEqual({ ...review }, { corrected: true, has_content: true });
  });

  test('la corrección no puede cambiar los días, inventar ejercicios ni cambiar ejercicios si la plantilla no lo permite', async () => {
    const { draftId } = await participantWithDraft(ctx);
    const trainer = await ctx.demo('trainer');
    const content = (await trainer.get(`/api/reviews/${draftId}`)).body.draft.content;
    const decide = correctedContent => trainer.post(`/api/reviews/${draftId}/decision`).send({ decision: 'aprobado', correctedContent });

    const otherDay = structuredClone(content); otherDay.schedule[0].day = 2;
    assert.equal((await decide(otherDay)).body.error.code, 'INVALID_CORRECTION');
    const fewerDays = structuredClone(content); fewerDays.schedule.pop();
    assert.equal((await decide(fewerDays)).body.error.code, 'INVALID_CORRECTION');
    const invented = structuredClone(content); invented.schedule[0].exercises[0].code = 'ejercicio-inventado';
    assert.equal((await decide(invented)).body.error.code, 'UNKNOWN_EXERCISE');
    const swapped = structuredClone(content); swapped.schedule[0].exercises[0].code = 'mini-sentadillas';
    assert.equal((await decide(swapped)).body.error.code, 'ADJUSTMENT_NOT_ALLOWED');
    const empty = structuredClone(content); empty.schedule[0].exercises[0].prescription = '   ';
    assert.equal((await decide(empty)).body.error.code, 'INVALID_PRESCRIPTION');
    const state = (await ctx.db.query('SELECT status FROM plan_drafts WHERE id = $1', [draftId])).rows[0].status;
    assert.equal(state, 'borrador', 'una corrección inválida no cambia nada');
    assert.equal((await ctx.db.query('SELECT 1 FROM approved_plans WHERE draft_id = $1', [draftId])).rowCount, 0);
  });

  test('el nombre y la descripción de los ejercicios corregidos se toman del catálogo, no del cliente', async () => {
    const { participant, draftId } = await participantWithDraft(ctx);
    const trainer = await ctx.demo('trainer');
    const content = (await trainer.get(`/api/reviews/${draftId}`)).body.draft.content;
    const corrected = structuredClone(content);
    corrected.schedule[0].exercises[0].name = 'Nombre falso';
    corrected.schedule[0].exercises[0].description = 'Descripción falsa';
    await trainer.post(`/api/reviews/${draftId}/decision`).send({ decision: 'aprobado', correctedContent: corrected });
    const exercise = (await participant.api.get('/api/plans/me')).body.plan.content.schedule[0].exercises[0];
    assert.notEqual(exercise.name, 'Nombre falso');
    assert.notEqual(exercise.description, 'Descripción falsa');
  });

  test('un rechazo exige motivo, conserva el último plan aprobado y no filtra el motivo al participante', async () => {
    const first = await participantWithDraft(ctx);
    await approve(ctx, first.draftId);
    const { participant } = first;
    assert.equal((await participant.api.put('/api/profiles/me').send({ ...PROFILE, days: [2, 4] })).status, 200);
    const second = (await participant.api.post('/api/drafts').send({ kind: 'rutina' })).body.draft;
    const trainer = await ctx.demo('trainer');
    assert.equal((await trainer.post(`/api/reviews/${second.id}/decision`).send({ decision: 'rechazado' })).body.error.code, 'NOTES_REQUIRED');
    const rejected = await trainer.post(`/api/reviews/${second.id}/decision`).send({ decision: 'rechazado', notes: 'Falta evaluar una molestia declarada en la entrevista.' });
    assert.equal(rejected.status, 200);

    const plan = (await participant.api.get('/api/plans/me')).body.plan;
    assert.equal(plan.version, 1, 'el plan anterior sigue vigente');
    assert.equal((await participant.api.get('/api/drafts/me/status')).body.request.status, 'rechazado');
    const notices = (await participant.api.get('/api/notifications/me')).body.notifications;
    const rejection = notices.find(item => item.type === 'borrador_rechazado');
    assert.ok(rejection);
    assert.doesNotMatch(rejection.message, /molestia/i);
    const admin = await ctx.demo('admin');
    assert.ok((await admin.get('/api/notifications/me')).body.notifications.some(item => item.type === 'caso_pendiente'));
  });

  test('aprobar un segundo borrador reemplaza el plan vigente y retira sus sesiones futuras no registradas', async () => {
    const { participant, draftId } = await participantWithDraft(ctx);
    await approve(ctx, draftId);
    const firstPlan = (await participant.api.get('/api/plans/me')).body.plan;
    await participant.api.put('/api/profiles/me').send({ ...PROFILE, days: [2, 4, 6] });
    const next = (await participant.api.post('/api/drafts').send({ kind: 'rutina' })).body.draft;
    assert.equal(next.version, 2);
    assert.equal((await approve(ctx, next.id)).status, 200);

    const current = (await participant.api.get('/api/plans/me')).body.plan;
    assert.equal(current.version, 2);
    assert.notEqual(current.id, firstPlan.id);
    const history = (await participant.api.get('/api/plans/me/history')).body.plans;
    assert.deepEqual(history.map(plan => plan.status).sort(), ['reemplazado', 'vigente']);
    const leftover = await ctx.db.query("SELECT 1 FROM training_sessions WHERE plan_id = $1 AND completed_at IS NULL AND planned_date >= '2026-11-03'", [firstPlan.id]);
    assert.equal(leftover.rowCount, 0, 'no quedan sesiones futuras del plan reemplazado');
    assert.equal((await ctx.db.query("SELECT count(*)::int AS n FROM approved_plans WHERE user_id = $1 AND status = 'vigente'", [participant.user.id])).rows[0].n, 1);
  });

  test('un cambio de perfil reemplaza el borrador activo sin tocar el plan vigente y la decisión sobre él se rechaza', async () => {
    const { participant, draftId } = await participantWithDraft(ctx);
    const changed = await participant.api.put('/api/profiles/me').send({ ...PROFILE, objective: 'mantener' });
    assert.equal(changed.body.draftsSuperseded, 1);
    assert.equal((await participant.api.get('/api/drafts/me/status')).body.request.status, 'reemplazado');
    const response = await approve(ctx, draftId);
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'INVALID_STATE');
  });

  test('si el perfil cambia mientras se decide, el borrador queda reemplazado y no se publica nada', async () => {
    const { participant, draftId } = await participantWithDraft(ctx);
    // Carrera simulada: otra versión del perfil llega sin pasar por la API que reemplaza los borradores.
    await ctx.db.query(
      `INSERT INTO profile_versions (user_id, version, age, objective, level, days, duration_minutes, equipment, is_fictitious)
       SELECT user_id, version + 1, age, 'subir', level, days, duration_minutes, equipment, is_fictitious FROM profile_versions WHERE user_id = $1 ORDER BY version DESC LIMIT 1`, [participant.user.id]);
    const response = await approve(ctx, draftId);
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'STALE_DRAFT');
    assert.equal((await ctx.db.query('SELECT status FROM plan_drafts WHERE id = $1', [draftId])).rows[0].status, 'reemplazado');
    assert.equal((await ctx.db.query('SELECT 1 FROM approved_plans WHERE draft_id = $1', [draftId])).rowCount, 0);
  });

  test('dos decisiones simultáneas sobre el mismo borrador: solo una prospera', async () => {
    const { draftId } = await participantWithDraft(ctx);
    const trainer = await ctx.demo('trainer');
    const [a, b] = await Promise.all([
      trainer.post(`/api/reviews/${draftId}/decision`).send({ decision: 'aprobado' }),
      trainer.post(`/api/reviews/${draftId}/decision`).send({ decision: 'rechazado', notes: 'Decisión simultánea.' }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal((await ctx.db.query('SELECT count(*)::int AS n FROM reviews WHERE draft_id = $1', [draftId])).rows[0].n, 1);
  });

  test('el plan aprobado es inmutable y no se puede borrar mientras la cuenta esté activa', async () => {
    const { draftId } = await participantWithDraft(ctx);
    await approve(ctx, draftId);
    await assert.rejects(ctx.db.query("UPDATE approved_plans SET content = '{}' WHERE draft_id = $1", [draftId]), /no se modifica/);
    await assert.rejects(ctx.db.query('DELETE FROM approved_plans WHERE draft_id = $1', [draftId]), /evidencia/);
  });

  test('la base de datos impide que la nutricionista apruebe una rutina aunque se intente saltar la API', async () => {
    const { draftId } = await participantWithDraft(ctx);
    const nutritionist = await ctx.createStaff('nutritionist');
    await assert.rejects(ctx.db.query(
      "INSERT INTO reviews (draft_id, draft_kind, draft_version, reviewer_id, reviewer_role, decision) VALUES ($1, 'rutina', 1, $2, 'nutritionist', 'aprobado')", [draftId, nutritionist.id]), /competent_reviewer/);
  });

  test('las minutas personales están bloqueadas hasta contar con nutricionista y habilitación de datos', async () => {
    const participant = await ctx.register();
    const response = await participant.api.post('/api/drafts').send({ kind: 'minuta' });
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'NUTRITION_NOT_ENABLED');
  });
});

describe('Casos pendientes (RF004)', () => {
  test('sin profesional asignado el caso queda pendiente, avisa a administración y pasa a la cola al asignar', async () => {
    const ctx = await createContext();
    const participant = await ctx.register();
    await participant.api.put('/api/profiles/me').send(PROFILE);
    const draft = (await participant.api.post('/api/drafts').send({ kind: 'rutina' })).body.draft;
    assert.equal(draft.status, 'pendiente');
    const admin = await ctx.demo('admin');
    assert.ok((await admin.get('/api/notifications/me')).body.notifications.some(item => item.type === 'caso_pendiente'));
    const trainer = await ctx.demo('trainer');
    assert.equal((await trainer.get('/api/reviews/queue')).body.queue.length, 0);

    await ctx.assign(participant.user.id, await ctx.demoId('trainer'));
    const queue = (await trainer.get('/api/reviews/queue')).body.queue;
    assert.equal(queue.length, 1);
    assert.equal(queue[0].status, 'borrador');
    await ctx.close();
  });

  test('sin plantilla aprobada para la combinación el caso queda pendiente con el motivo y no se inventa un plan', async () => {
    const ctx = await createContext();
    const trainer = await ctx.demo('trainer');
    const rules = (await ctx.db.query("SELECT content FROM rule_versions WHERE domain = 'entrenamiento' AND status = 'approved'")).rows[0].content;
    delete rules.matrix.subir;
    const created = await trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: rules, changeNote: 'Sin plantillas para subir de peso' });
    assert.equal(created.status, 201);
    assert.equal((await trainer.post(`/api/catalog/rules/${created.body.rules.id}/approve`)).status, 200);

    const participant = await ctx.register();
    await ctx.assign(participant.user.id, await ctx.demoId('trainer'));
    await participant.api.put('/api/profiles/me').send({ ...PROFILE, objective: 'subir' });
    const draft = (await participant.api.post('/api/drafts').send({ kind: 'rutina' })).body.draft;
    assert.equal(draft.status, 'pendiente');
    const row = (await ctx.db.query('SELECT pending_reason, selection_reasons, content FROM plan_drafts WHERE id = $1', [draft.id])).rows[0];
    assert.equal(row.pending_reason, 'sin_plantilla');
    assert.deepEqual(row.content, {});
    assert.ok(row.selection_reasons.some(reason => /sin coincidencia/.test(reason.resultado ?? '')));
    await ctx.close();
  });

  test('una plantilla que no corresponde al perfil o que no cabe en su disponibilidad se descarta', async () => {
    const ctx = await createContext();
    // La plantilla de «bajar, principiante, sin equipo» pasa a durar 60 minutos y el perfil dispone de 30.
    await ctx.db.query("UPDATE routine_templates SET session_minutes = 60 WHERE code = 'demo-bajar-principiante-sin-equipo'");
    const participant = await ctx.register();
    await ctx.assign(participant.user.id, await ctx.demoId('trainer'));
    await participant.api.put('/api/profiles/me').send(PROFILE);
    const draft = (await participant.api.post('/api/drafts').send({ kind: 'rutina' })).body.draft;
    assert.equal(draft.status, 'pendiente');
    const reasons = (await ctx.db.query('SELECT selection_reasons FROM plan_drafts WHERE id = $1', [draft.id])).rows[0].selection_reasons;
    assert.ok(reasons.some(reason => /sesiones de 60 min/.test(reason.resultado ?? '')));
    await ctx.close();
  });

  test('sin reglas aprobadas no se genera ningún borrador', async () => {
    const ctx = await createContext();
    await ctx.db.query("UPDATE rule_versions SET status = 'retired' WHERE domain = 'entrenamiento'");
    const participant = await ctx.register();
    await participant.api.put('/api/profiles/me').send(PROFILE);
    const response = await participant.api.post('/api/drafts').send({ kind: 'rutina' });
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, 'NO_APPROVED_RULES');
    await ctx.close();
  });

  test('sin consentimiento de perfil no se genera ningún borrador', async () => {
    const ctx = await createContext();
    const participant = await ctx.register();
    await participant.api.put('/api/profiles/me').send(PROFILE);
    assert.equal((await participant.api.post('/api/consents').send({ purpose: 'perfil_entrenamiento', granted: false, policyVersion: 'politica-datos-2026-10-v1' })).status, 201);
    assert.equal((await participant.api.post('/api/drafts').send({ kind: 'rutina' })).body.error.code, 'CONSENT_REQUIRED');
    assert.equal((await participant.api.put('/api/profiles/me').send(PROFILE)).status, 403);
    await ctx.close();
  });
});

describe('Catálogo y reglas aprobadas por el profesional competente (RF004, RF010)', () => {
  let ctx;
  before(async () => { ctx = await createContext(); });
  after(() => ctx.close());
  const template = (code, extra = {}) => ({
    code, name: 'Plantilla de prueba', objective: 'mantener', level: 'principiante', equipment: 'sin_equipo', minDays: 2, maxDays: 3, sessionMinutes: 30, weeks: 4,
    allowedAdjustments: { exerciseChanges: true },
    sessions: [{ sessionNo: 1, exercises: [{ code: 'caminata', prescription: '10 minutos' }] }, { sessionNo: 2, exercises: [{ code: 'marcha-en-el-lugar', prescription: '5 minutos' }] }], ...extra,
  });

  test('el preparador crea una plantilla en borrador y la aprueba; una versión nueva retira la anterior', async () => {
    const trainer = await ctx.demo('trainer');
    const v1 = await trainer.post('/api/catalog/templates').send(template('plantilla-de-prueba'));
    assert.equal(v1.status, 201);
    assert.equal(v1.body.template.version, 1);
    assert.equal(v1.body.template.status, 'draft');
    assert.equal((await trainer.post(`/api/catalog/templates/${v1.body.template.id}/approve`)).body.template.status, 'approved');
    const v2 = await trainer.post('/api/catalog/templates').send(template('plantilla-de-prueba'));
    assert.equal(v2.body.template.version, 2);
    assert.equal((await trainer.post(`/api/catalog/templates/${v2.body.template.id}/approve`)).status, 200);
    const status = (await ctx.db.query("SELECT version, status FROM routine_templates WHERE code = 'plantilla-de-prueba' ORDER BY version")).rows.map(row => `${row.version}:${row.status}`);
    assert.deepEqual(status, ['1:retired', '2:approved']);
    assert.equal((await trainer.post(`/api/catalog/templates/${v2.body.template.id}/approve`)).status, 409, 'solo se aprueban borradores');
    const approvedBy = (await ctx.db.query("SELECT approved_by_role FROM routine_templates WHERE code = 'plantilla-de-prueba' AND status = 'approved'")).rows[0];
    assert.equal(approvedBy.approved_by_role, 'trainer');
  });

  test('las plantillas validan sus datos y solo usan ejercicios del catálogo', async () => {
    const trainer = await ctx.demo('trainer');
    assert.equal((await trainer.post('/api/catalog/templates').send(template('con-ejercicio-inexistente', { sessions: [{ sessionNo: 1, exercises: [{ code: 'no-existe', prescription: 'x' }] }] }))).body.error.code, 'UNKNOWN_EXERCISE');
    assert.equal((await trainer.post('/api/catalog/templates').send(template('Mal Codigo'))).body.error.code, 'INVALID_CODE');
    assert.equal((await trainer.post('/api/catalog/templates').send(template('dias-invertidos', { minDays: 4, maxDays: 2 }))).body.error.code, 'INVALID_DAYS');
    assert.equal((await trainer.post('/api/catalog/templates').send(template('sin-indicacion', { sessions: [{ sessionNo: 1, exercises: [{ code: 'caminata', prescription: '' }] }] }))).body.error.code, 'INVALID_PRESCRIPTION');
  });

  test('una plantilla aprobada no admite cambios en sus ejercicios ni se borra', async () => {
    await assert.rejects(ctx.db.query("UPDATE template_exercises SET prescription = 'otra' WHERE template_id IN (SELECT id FROM routine_templates WHERE status = 'approved')"), /ya no es borrador/);
    await assert.rejects(ctx.db.query("DELETE FROM routine_templates WHERE status = 'approved'"), /Solo se pueden eliminar plantillas en borrador/);
  });

  test('cada profesional define y aprueba solo las reglas de su ámbito', async () => {
    const trainer = await ctx.demo('trainer');
    const nutritionist = await ctx.createStaff('nutritionist');
    const rules = (await trainer.get('/api/catalog/rules')).body.rules.find(item => item.domain === 'entrenamiento');
    assert.equal((await nutritionist.api.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: rules.content })).status, 403);
    assert.equal((await trainer.post('/api/catalog/rules').send({ domain: 'nutricion', content: {} })).status, 403);
    const own = await nutritionist.api.post('/api/catalog/rules').send({ domain: 'nutricion', content: { activityFactors: { sedentario: 1.2 } }, changeNote: 'Factores de ejemplo' });
    assert.equal(own.status, 201);
    assert.equal((await trainer.post(`/api/catalog/rules/${own.body.rules.id}/approve`)).status, 403, 'el preparador no aprueba reglas nutricionales');
    assert.equal((await nutritionist.api.post(`/api/catalog/rules/${own.body.rules.id}/approve`)).status, 200);
  });

  test('las reglas de entrenamiento validan la matriz', async () => {
    const trainer = await ctx.demo('trainer');
    assert.equal((await trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: { matrix: { volar: {} } } })).body.error.code, 'INVALID_RULES');
    assert.equal((await trainer.post('/api/catalog/rules').send({ domain: 'entrenamiento', content: {} })).body.error.code, 'INVALID_RULES');
  });

  test('el administrador consulta el catálogo pero no lo modifica; el participante no lo ve', async () => {
    const admin = await ctx.demo('admin');
    assert.equal((await admin.get('/api/catalog/templates')).status, 200);
    assert.equal((await admin.post('/api/catalog/exercises').send({ code: 'x', name: 'x', description: 'x' })).status, 403);
    const participant = await ctx.register();
    assert.equal((await participant.api.get('/api/catalog/templates')).status, 403);
  });
});
