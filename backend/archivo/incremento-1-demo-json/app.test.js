import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createApp } from '../src/app.js';
import { JsonRepository, MemoryRepository } from '../src/repository.js';

const profile = { name: 'Persona ficticia', age: 25, objective: 'mantener', level: 'principiante', days: [1, 3, 5], durationMinutes: 30, equipment: 'sin_equipo' };
async function fixture(t, repository = new MemoryRepository()) {
  const app = createApp({ repository });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (method, path, body, token, headers = {}) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, data, headers: response.headers };
  };
  const user = (await request('POST', '/api/demo/login', { role: 'user' })).data.token;
  const save = async (values = profile, token = user) => {
    const response = await request('PUT', '/api/profiles/me', values, token);
    assert.equal(response.status, 200);
    return response.data.profile;
  };
  return { request, user, save, repository };
}
function temporaryState(t) {
  const directory = mkdtempSync(join(tmpdir(), 'fitgoal-test-'));
  t.after(() => {
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith('fitgoal-test-'));
    rmSync(target, { recursive: true, force: true });
  });
  return join(directory, 'state.json');
}

test('El perfil valida adultos, enums, días sin duplicados y campos permitidos', async t => {
  const { request, user, repository } = await fixture(t);
  for (const invalid of [
    { ...profile, age: 17 }, { ...profile, age: 25.5 }, { ...profile, name: '' },
    { ...profile, days: [] }, { ...profile, days: [1, 1] }, { ...profile, days: [8] },
    { ...profile, durationMinutes: 25 }, { ...profile, objective: 'curar' },
    { ...profile, level: 'avanzado' }, { ...profile, equipment: 'desconocido' }, { ...profile, weight: 70 },
  ]) assert.equal((await request('PUT', '/api/profiles/me', invalid, user)).status, 400);
  assert.equal(repository.snapshot().profile, null);
  const valid = await request('PUT', '/api/profiles/me', { ...profile, age: 18, days: [5, 1] }, user);
  assert.equal(valid.status, 200);
  assert.deepEqual(valid.data.profile.days, [1, 5]);
  assert.equal(valid.data.profile.version, 1);
});

test('Sesión demo solo user; los recursos requieren un token válido', async t => {
  const { request, user } = await fixture(t);
  assert.equal((await request('POST', '/api/demo/login', { role: 'trainer' })).status, 400);
  assert.equal((await request('POST', '/api/demo/login', { role: 'admin' })).status, 400);
  assert.equal((await request('GET', '/api/demo/state')).status, 401);
  assert.equal((await request('GET', '/api/routines', undefined, 'token-inventado')).status, 401);
  assert.equal((await request('POST', '/api/plans/generate', { profileVersion: 1 })).status, 401);
  assert.equal((await request('GET', '/api/demo/state', undefined, user)).status, 200);
});

test('El catálogo expone seis ejemplos reales con niveles y material explícitos', async t => {
  const { request, user } = await fixture(t);
  const result = await request('GET', '/api/routines', undefined, user);
  assert.equal(result.status, 200);
  assert.equal(result.data.demo, true);
  const routines = result.data.routines;
  assert.equal(routines.length, 6);
  assert.equal(new Set(routines.map(routine => routine.id)).size, 6);
  assert.ok(routines.some(routine => routine.id === 'movilidad-general'));
  assert.ok(routines.some(routine => routine.id === 'actividad-suave'));
  for (const routine of routines) {
    assert.equal(routine.demo, true);
    assert.ok(routine.title && routine.focus);
    assert.ok(routine.levels.length >= 1);
    assert.ok(routine.equipmentOptions.length >= 1);
    assert.equal(routine.exercises.length, 3);
    for (const exercise of routine.exercises) {
      assert.ok(exercise.name.length > 0 && exercise.description.length > 0);
      assert.equal(exercise.name.includes('Bloque de ejemplo'), false);
      assert.deepEqual(Object.keys(exercise).sort(), ['description', 'name']);
    }
  }
  assert.ok(routines.flatMap(routine => routine.exercises).some(exercise => exercise.name === 'Sentarse y levantarse'));
  assert.ok(routines.flatMap(routine => routine.exercises).some(exercise => exercise.name === 'Curl de bíceps con mancuernas'));
});

test('Generación directa publica ejemplo inmediatamente sin aprobación individual', async t => {
  const { request, user, save } = await fixture(t);
  assert.deepEqual((await request('GET', '/api/demo/state', undefined, user)).data, { demo: true, profile: null, plan: null });
  const saved = await save({ ...profile, days: [7, 1, 4] });
  const generated = await request('POST', '/api/plans/generate', { profileVersion: saved.version }, user);
  assert.equal(generated.status, 201);
  const plan = generated.data.plan;
  assert.equal(plan.status, 'example');
  assert.equal(plan.demo, true);
  assert.equal(plan.templateId, 'demo-catalog-v1');
  assert.equal(plan.templateVersion, 1);
  assert.equal(plan.profileVersion, saved.version);
  assert.equal(plan.version, 1);
  assert.deepEqual(plan.days, [1, 4, 7]);
  assert.deepEqual(plan.sessions.map(session => session.day), [1, 4, 7]);
  assert.deepEqual(plan.sessions.map(session => session.dayLabel), ['Lunes', 'Jueves', 'Domingo']);
  assert.ok(plan.exercises.length > 0);
  assert.equal('review' in plan, false);
  assert.equal('approvedBy' in plan, false);
  assert.equal(plan.isFromCurrentProfile, true);
  assert.equal((await request('GET', '/api/plans/me', undefined, user)).data.plan.id, plan.id);
  const state = (await request('GET', '/api/demo/state', undefined, user)).data;
  assert.equal(state.plan.id, plan.id);
  assert.equal('pendingStatus' in state, false);
});

test('Las rutas de borradores y revisión individual ya no existen', async t => {
  const { request, user } = await fixture(t);
  for (const [method, path] of [
    ['GET', '/api/drafts'], ['POST', '/api/drafts'], ['POST', '/api/drafts/antiguo/submit'],
    ['GET', '/api/reviews'], ['POST', '/api/reviews/antiguo'],
  ]) assert.equal((await request(method, path, method === 'POST' ? {} : undefined, user)).status, 404);
});

test('Exige versión positiva y perfil guardado antes de generar', async t => {
  const { request, user, repository } = await fixture(t);
  for (const body of [{}, { profileVersion: 0 }, { profileVersion: -1 }, { profileVersion: 1.5 }, { profileVersion: '1' }, { profileVersion: null }]) {
    const result = await request('POST', '/api/plans/generate', body, user);
    assert.equal(result.status, 400);
    assert.equal(result.data.error.code, 'INVALID_PROFILE_VERSION');
  }
  const missing = await request('POST', '/api/plans/generate', { profileVersion: 1 }, user);
  assert.equal(missing.status, 409);
  assert.equal(missing.data.error.code, 'PROFILE_REQUIRED');
  assert.equal(repository.snapshot().plan, null);
});

test('Dos clientes: bloquea versión obsoleta, conserva plan anterior y reutiliza la vigente', async t => {
  const { request, user, save, repository } = await fixture(t);
  const otherUser = (await request('POST', '/api/demo/login', { role: 'user' })).data.token;
  const first = await save();
  const firstPlan = (await request('POST', '/api/plans/generate', { profileVersion: first.version }, user)).data.plan;
  const changed = await save({ ...profile, objective: 'subir', durationMinutes: 60 }, otherUser);
  assert.equal(changed.version, 2);
  assert.equal((await request('GET', '/api/plans/me', undefined, user)).data.plan.isFromCurrentProfile, false);
  const stale = await request('POST', '/api/plans/generate', { profileVersion: first.version }, user);
  assert.equal(stale.status, 409);
  assert.equal(stale.data.error.code, 'STALE_PROFILE');
  assert.equal(repository.snapshot().plan.id, firstPlan.id);
  const current = await request('POST', '/api/plans/generate', { profileVersion: changed.version }, otherUser);
  assert.equal(current.status, 201);
  assert.notEqual(current.data.plan.id, firstPlan.id);
  assert.equal(current.data.plan.version, 2);
  const repeated = await request('POST', '/api/plans/generate', { profileVersion: changed.version }, user);
  assert.equal(repeated.status, 200);
  assert.equal(repeated.data.plan.id, current.data.plan.id);
  assert.equal(repeated.data.plan.version, 2);
});

test('Siete días rotan ejemplo específico, movilidad y actividad suave', async t => {
  const { request, user, save } = await fixture(t);
  const saved = await save({ ...profile, level: 'intermedio', equipment: 'con_equipo', days: [1, 2, 3, 4, 5, 6, 7] });
  const plan = (await request('POST', '/api/plans/generate', { profileVersion: saved.version }, user)).data.plan;
  assert.deepEqual(plan.sessions.map(session => session.routineId), ['circuito-con-equipo', 'movilidad-general', 'actividad-suave', 'circuito-con-equipo', 'movilidad-general', 'actividad-suave', 'circuito-con-equipo']);
  assert.ok(plan.sessions[0].exercises.some(exercise => exercise.name === 'Curl de bíceps con mancuernas'));
  assert.ok(plan.sessions[2].exercises.some(exercise => exercise.name === 'Caminata'));
});

test('Las 336 combinaciones válidas generan calendario respetando nivel, equipo, días y duración', async t => {
  const { request, user, save } = await fixture(t);
  const routines = (await request('GET', '/api/routines', undefined, user)).data.routines;
  const byId = new Map(routines.map(routine => [routine.id, routine]));
  let count = 0;
  for (const objective of ['bajar', 'mantener', 'subir']) {
    for (const level of ['principiante', 'intermedio']) {
      for (const equipment of ['sin_equipo', 'con_equipo']) {
        for (let numberOfDays = 1; numberOfDays <= 7; numberOfDays++) {
          for (const durationMinutes of [20, 30, 45, 60]) {
            const candidate = { ...profile, objective, level, equipment, days: Array.from({ length: numberOfDays }, (_, index) => index + 1), durationMinutes };
            const saved = await save(candidate);
            const generated = await request('POST', '/api/plans/generate', { profileVersion: saved.version }, user);
            assert.equal(generated.status, 201, JSON.stringify(candidate));
            const plan = generated.data.plan;
            assert.equal(plan.profileVersion, saved.version);
            assert.equal(plan.objective, objective);
            assert.equal(plan.level, level);
            assert.equal(plan.equipment, equipment);
            assert.equal(plan.durationMinutes, durationMinutes);
            assert.deepEqual(plan.days, candidate.days);
            assert.equal(plan.sessions.length, numberOfDays);
            assert.equal(plan.status, 'example');
            for (let index = 0; index < numberOfDays; index++) {
              const session = plan.sessions[index];
              assert.equal(session.day, candidate.days[index]);
              const routine = byId.get(session.routineId);
              assert.ok(routine.levels.includes(level));
              assert.ok(routine.equipmentOptions.includes(equipment));
              assert.deepEqual(session.exercises, routine.exercises);
            }
            const firstRoutine = byId.get(plan.sessions[0].routineId);
            assert.deepEqual(firstRoutine.levels, [level]);
            assert.deepEqual(firstRoutine.equipmentOptions, [equipment]);
            count++;
          }
        }
      }
    }
  }
  assert.equal(count, 336);
});

test('Persistencia schema2 conserva plan, y reiniciar app invalida sesiones demo', async t => {
  const file = temporaryState(t);
  const first = await fixture(t, new JsonRepository(file));
  const saved = await first.save();
  const plan = (await first.request('POST', '/api/plans/generate', { profileVersion: saved.version }, first.user)).data.plan;
  const second = await fixture(t, new JsonRepository(file));
  assert.equal((await second.request('GET', '/api/demo/state', undefined, first.user)).status, 401);
  const recovered = (await second.request('GET', '/api/demo/state', undefined, second.user)).data;
  assert.deepEqual(recovered.profile, saved);
  assert.equal(recovered.plan.id, plan.id);
  assert.deepEqual(recovered.plan.sessions, plan.sessions);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).schemaVersion, 2);
});

test('Migración schema1 conserva perfil y archiva borradores/revisiones/planes antiguos', async t => {
  const file = temporaryState(t);
  const oldProfile = { ...profile, id: 'demo-user', version: 4, demo: true, updatedAt: '2026-10-02T10:00:00.000Z' };
  const old = { schemaVersion: 1, profile: oldProfile, drafts: [{ id: 'old-draft', status: 'approved' }], reviews: [{ id: 'old-review', reviewedBy: 'Preparador demo' }], lastApprovedPlan: { id: 'old-plan', status: 'approved' } };
  writeFileSync(file, JSON.stringify(old), 'utf8');
  const repository = new JsonRepository(file);
  const migrated = repository.snapshot();
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.profile, oldProfile);
  assert.equal(migrated.plan, null);
  assert.deepEqual(migrated.legacy.drafts, old.drafts);
  assert.deepEqual(migrated.legacy.reviews, old.reviews);
  assert.deepEqual(migrated.legacy.lastApprovedPlan, old.lastApprovedPlan);
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).schemaVersion, 2);
  const { request, user } = await fixture(t, repository);
  const state = (await request('GET', '/api/demo/state', undefined, user)).data;
  assert.equal(state.plan, null);
  assert.equal('legacy' in state, false);
  const generated = await request('POST', '/api/plans/generate', { profileVersion: 4 }, user);
  assert.equal(generated.status, 201);
  assert.equal(generated.data.plan.status, 'example');
  assert.deepEqual(repository.snapshot().legacy.reviews, old.reviews);
});

test('CORS permite clientes HTTP locales y rechaza orígenes externos', async t => {
  const { request } = await fixture(t);
  const allowed = await request('OPTIONS', '/api/profiles/me', undefined, undefined, { Origin: 'http://localhost:54321' });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:54321');
  assert.equal((await request('GET', '/health', undefined, undefined, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await request('GET', '/health', undefined, undefined, { Origin: 'http://127.0.0.1.ejemplo.com' })).status, 403);
});
