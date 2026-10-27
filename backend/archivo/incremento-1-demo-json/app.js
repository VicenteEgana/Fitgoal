import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MemoryRepository } from './repository.js';
import { getRoutines, buildSessions } from './routines.js';

const OBJECTIVES = ['bajar', 'mantener', 'subir'];
const LEVELS = ['principiante', 'intermedio'];
const EQUIPMENT = ['sin_equipo', 'con_equipo'];
const DURATIONS = [20, 30, 45, 60];
const FIELDS = ['name', 'age', 'objective', 'level', 'days', 'durationMinutes', 'equipment'];
const OBJECTIVE_LABELS = { bajar: 'Bajar de peso', mantener: 'Mantener peso', subir: 'Subir de peso' };

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new ApiError(status, code, message); };
function validateProfile(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INVALID_PROFILE', 'Envía un perfil ficticio válido.');
  if (Object.keys(body).some(key => !FIELDS.includes(key))) fail(400, 'UNKNOWN_FIELD', 'El perfil demo solo admite nombre ficticio, edad, objetivo, nivel, días, duración y equipo.');
  if (typeof body.name !== 'string' || body.name.trim().length < 1 || body.name.trim().length > 60) fail(400, 'INVALID_NAME', 'El nombre ficticio debe tener entre 1 y 60 caracteres.');
  if (!Number.isInteger(body.age) || body.age < 18 || body.age > 120) fail(400, 'INVALID_AGE', 'La edad ficticia debe ser un entero entre 18 y 120.');
  if (!OBJECTIVES.includes(body.objective)) fail(400, 'INVALID_OBJECTIVE', 'Objetivo permitido: bajar, mantener o subir.');
  if (!LEVELS.includes(body.level)) fail(400, 'INVALID_LEVEL', 'Nivel permitido: principiante o intermedio.');
  if (!EQUIPMENT.includes(body.equipment)) fail(400, 'INVALID_EQUIPMENT', 'Equipo permitido: sin_equipo o con_equipo.');
  if (!DURATIONS.includes(body.durationMinutes)) fail(400, 'INVALID_DURATION', 'Duración permitida: 20, 30, 45 o 60 minutos.');
  if (!Array.isArray(body.days) || body.days.length < 1 || body.days.length > 7 || body.days.some(day => !Number.isInteger(day) || day < 1 || day > 7) || new Set(body.days).size !== body.days.length) fail(400, 'INVALID_DAYS', 'Selecciona días únicos entre 1 (lunes) y 7 (domingo).');
  return { name: body.name.trim(), age: body.age, objective: body.objective, level: body.level, days: [...body.days].sort((a, b) => a - b), durationMinutes: body.durationMinutes, equipment: body.equipment };
}
function visiblePlan(state) {
  return state.plan ? { ...state.plan, isFromCurrentProfile: state.plan.profileVersion === state.profile?.version } : null;
}
function localOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

export function createApp({ repository = new MemoryRepository(), now = () => new Date().toISOString(), publicDirectory = fileURLToPath(new URL('../public/', import.meta.url)) } = {}) {
  const app = express();
  const sessions = new Map();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const origin = req.headers.origin;
    if (origin) {
      const allowed = process.env.CORS_ORIGIN ? origin === process.env.CORS_ORIGIN : localOrigin(origin);
      if (!allowed) return res.status(403).json({ demo: true, error: { code: 'ORIGIN_NOT_ALLOWED', message: 'La demo solo admite aplicaciones locales.' } });
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '8kb' }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const health = (_req, res) => res.json({ ok: true, demo: true, storage: 'local-demo', message: 'FitGoal: catálogo de ejemplos y datos ficticios, sin autenticación de producción.' });
  app.get('/health', health);
  app.get('/api/health', health);
  app.post('/api/demo/login', (req, res) => {
    if (req.body?.role !== 'user') fail(400, 'INVALID_ROLE', 'La demo solo admite el rol user.');
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, { role: 'user', actorId: 'demo-user', expires: Date.now() + 8 * 60 * 60 * 1000 });
    res.json({ token, role: 'user', demo: true, expiresInSeconds: 28800, warning: 'Acceso de demostración con ejemplos generales; no usar datos personales reales.' });
  });
  app.use('/api', (req, _res, next) => {
    const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]+)$/)?.[1];
    const session = sessions.get(token);
    if (!session || session.expires <= Date.now() || session.role !== 'user') {
      if (token) sessions.delete(token);
      fail(401, 'UNAUTHORIZED', 'Inicia una sesión de demostración.');
    }
    req.actor = session;
    next();
  });
  app.get('/api/demo/state', (_req, res) => {
    const state = repository.snapshot();
    res.json({ demo: true, profile: state.profile, plan: visiblePlan(state) });
  });
  app.get('/api/profiles/me', (_req, res) => res.json({ demo: true, profile: repository.snapshot().profile }));
  app.put('/api/profiles/me', (req, res) => {
    const values = validateProfile(req.body);
    const profile = repository.transact(state => {
      state.profile = { id: req.actor.actorId, ...values, version: (state.profile?.version ?? 0) + 1, updatedAt: now(), demo: true };
      return state.profile;
    });
    res.json({ demo: true, profile });
  });
  app.get('/api/routines', (_req, res) => res.json({ demo: true, routines: getRoutines() }));
  app.post('/api/plans/generate', (req, res) => {
    const expectedProfileVersion = req.body?.profileVersion;
    if (!Number.isInteger(expectedProfileVersion) || expectedProfileVersion <= 0) fail(400, 'INVALID_PROFILE_VERSION', 'La versión esperada del perfil debe ser un entero positivo.');
    const result = repository.transact(state => {
      const profile = state.profile;
      if (!profile) fail(409, 'PROFILE_REQUIRED', 'Guarda primero el perfil ficticio.');
      if (expectedProfileVersion !== profile.version) fail(409, 'STALE_PROFILE', 'El perfil guardado cambió en otra sesión. Actualiza el perfil antes de generar el plan.');
      if (state.plan?.profileVersion === profile.version) return { reused: true, plan: visiblePlan(state) };
      const calendar = buildSessions(profile);
      const exercises = [...new Map(calendar.flatMap(session => session.exercises).map(exercise => [exercise.name, exercise])).values()];
      state.plan = { id: randomUUID(), version: (state.plan?.version ?? 0) + 1, profileVersion: profile.version, status: 'example', demo: true, title: `${OBJECTIVE_LABELS[profile.objective]} · plan de ejemplo`, templateId: 'demo-catalog-v1', templateVersion: 1, objective: profile.objective, level: profile.level, equipment: profile.equipment, days: [...profile.days], durationMinutes: profile.durationMinutes, exercises, sessions: calendar, createdAt: now() };
      return { reused: false, plan: visiblePlan(state) };
    });
    res.status(result.reused ? 200 : 201).json({ demo: true, plan: result.plan });
  });
  app.get('/api/plans/me', (_req, res) => res.json({ demo: true, plan: visiblePlan(repository.snapshot()) }));
  app.use('/api', (_req, res) => res.status(404).json({ demo: true, error: { code: 'NOT_FOUND', message: 'Recurso API inexistente.' } }));
  app.use('/app', express.static(fileURLToPath(new URL('../../mobile/build/web/', import.meta.url))));
  app.use(express.static(publicDirectory));
  app.use((error, _req, res, _next) => {
    const status = error.status ?? 500;
    const code = error.code ?? (error.type === 'entity.parse.failed' ? 'INVALID_JSON' : 'INTERNAL_ERROR');
    res.status(status).json({ demo: true, error: { code, message: status >= 500 ? 'No se pudo completar la operación local.' : error.message } });
  });
  return app;
}
