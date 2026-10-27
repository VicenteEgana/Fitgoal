import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, participantWithProfile, recommendedFor } from './helpers.js';

test('flujo completo: registro, perfil, rutina recomendada aprobada, sesiones y adherencia', async () => {
  const ctx = await createContext();
  const participant = await participantWithProfile(ctx);

  const [routine] = await recommendedFor(participant);
  assert.ok(routine, 'el catálogo aprobado recomienda al menos una rutina para el perfil');

  const started = await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days: [1, 3, 5] });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  assert.equal(started.body.plan.sessionsScheduled, 12);

  const plan = await participant.api.get('/api/plans/me');
  assert.equal(plan.body.plan.schedule.length, 3);
  assert.equal(plan.body.plan.template.code, routine.code);
  const sessions = await participant.api.get('/api/sessions/me?to=2026-12-31');
  assert.equal(sessions.body.sessions.length, 12);
  await ctx.close();
});
