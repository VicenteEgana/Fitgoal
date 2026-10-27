import supertest from 'supertest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDatabase, migrate } from '../src/db.js';
import { hashPassword } from '../src/lib/security.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemo } from '../src/seed/demo.js';

export const PASSWORD = 'Clave-de-prueba-2026';
export const POLICY = 'politica-datos-2026-10-v1';
export const PROFILE = { age: 30, objective: 'bajar', level: 'principiante', days: [1, 3, 5], durationMinutes: 30, equipment: 'sin_equipo' };
const RELAXED = { perMinute: 1_000_000, authFailures: 1000, authWindowMinutes: 15 };

/**
 * Crea una API aislada con PostgreSQL en memoria y un reloj controlable (lunes 2 de noviembre de 2026, 12:00 en Chile).
 * Los límites de solicitudes vienen relajados; las pruebas de límites crean su propio contexto con `limits`.
 */
export async function createContext({ seed = true, config: overrides = {}, limits = RELAXED, start = '2026-11-02T15:00:00Z' } = {}) {
  const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'j'.repeat(40), PSEUDONYM_SECRET: 'p'.repeat(40) }, { allowFictitiousRegistration: true, rateLimit: limits, ...overrides });
  const db = await createDatabase({ memory: true });
  await migrate(db);
  if (seed) await seedDemo(db, config);
  const clock = { current: new Date(start) };
  const app = createApp({ db, config, now: () => new Date(clock.current), webBuild: null });
  const http = supertest(app);
  const ctx = { db, config, app, http, clock, counter: 0 };

  ctx.tick = ms => { clock.current = new Date(clock.current.getTime() + ms); };
  ctx.advanceDays = days => ctx.tick(days * 24 * 60 * 60 * 1000);
  ctx.email = prefix => `${prefix}${++ctx.counter}@prueba.cl`;
  ctx.as = token => ({
    get: url => http.get(url).set('Authorization', `Bearer ${token}`),
    post: url => http.post(url).set('Authorization', `Bearer ${token}`),
    put: url => http.put(url).set('Authorization', `Bearer ${token}`),
    patch: url => http.patch(url).set('Authorization', `Bearer ${token}`),
    delete: url => http.delete(url).set('Authorization', `Bearer ${token}`),
  });
  ctx.login = async (email, password = DEMO_PASSWORD) => {
    const response = await http.post('/api/auth/login').send({ email, password });
    if (response.status !== 200) throw new Error(`login falló (${response.status}): ${JSON.stringify(response.body)}`);
    return response.body;
  };
  ctx.demo = async role => ctx.as((await ctx.login(DEMO_ACCOUNTS[role].email)).accessToken);
  ctx.demoId = async role => (await db.query('SELECT id FROM users WHERE email = $1', [DEMO_ACCOUNTS[role].email])).rows[0].id;
  ctx.register = async (extra = {}) => {
    const email = extra.email ?? ctx.email('participante');
    const response = await http.post('/api/auth/register').send({
      email, password: PASSWORD, policyVersion: POLICY, fictitious: true,
      consents: { registro_cuenta: true, perfil_entrenamiento: true, datos_corporales: true, seguimiento_progreso: true, recordatorios: true }, ...extra,
    });
    if (response.status !== 201) throw new Error(`registro falló (${response.status}): ${JSON.stringify(response.body)}`);
    return { ...response.body, email, api: ctx.as(response.body.accessToken) };
  };
  /** Renueva el acceso de un participante tras avanzar el reloj (el JWT dura 15 minutos). */
  ctx.reauth = async person => {
    person.api = ctx.as((await ctx.login(person.email, PASSWORD)).accessToken);
    return person;
  };
  ctx.createStaff = async (role, prefix = role) => {
    const email = ctx.email(prefix);
    const inserted = await db.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', [email, await hashPassword(PASSWORD), role]);
    const session = await ctx.login(email, PASSWORD);
    return { id: inserted.rows[0].id, email, session, api: ctx.as(session.accessToken) };
  };
  ctx.close = () => db.close();
  return ctx;
}

/** Rutina recomendada del catálogo de demostración para una combinación de perfil. */
export async function recommendedFor(person) {
  const response = await person.api.get('/api/routines');
  if (response.status !== 200) throw new Error(`rutinas falló: ${JSON.stringify(response.body)}`);
  return response.body.routines.filter(routine => routine.recommended);
}

/** Participante con perfil completo, listo para iniciar una rutina. */
export async function participantWithProfile(ctx, { profile = PROFILE, extra = {} } = {}) {
  const participant = await ctx.register(extra);
  const saved = await participant.api.put('/api/profiles/me').send(profile);
  if (saved.status !== 200) throw new Error(`perfil falló: ${JSON.stringify(saved.body)}`);
  return participant;
}

/** Participante que ya inició la primera rutina recomendada, en los días de su perfil. */
export async function participantWithPlan(ctx, { profile = PROFILE, extra = {} } = {}) {
  const participant = await participantWithProfile(ctx, { profile, extra });
  const [routine] = await recommendedFor(participant);
  const started = await participant.api.post('/api/plans/start').send({ source: 'recomendada', templateId: routine.id, days: profile.days.slice(0, routine.maxDays) });
  if (started.status !== 201) throw new Error(`inicio falló: ${JSON.stringify(started.body)}`);
  return { participant, plan: started.body.plan, routine };
}
