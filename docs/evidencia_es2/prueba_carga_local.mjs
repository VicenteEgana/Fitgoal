// Prueba de humo y de carga local de la API de FitGoal (evidencia de K6 para ES2).
// Uso, desde esta carpeta y con las dependencias de backend instaladas:
//   node prueba_carga_local.mjs [archivo-de-resultado.json]
// La base es PostgreSQL en memoria (PGlite) y la de humo es temporal: no toca datos del proyecto.
// Mide el flujo de K6: recomendar (GET /api/routines) e iniciar una rutina (POST /api/plans/start).
// El límite de solicitudes se relaja para medir. API, base y generador comparten el proceso,
// por lo que el resultado no representa al ambiente del piloto.
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import os from 'node:os';

const BACKEND = fileURLToPath(new URL('../../backend/', import.meta.url));
const { createContext, participantWithProfile, PROFILE } = await import(pathToFileURL(join(BACKEND, 'test', 'helpers.js')).href);

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};
const round = n => Math.round(n * 10) / 10;
const stats = values => ({ n: values.length, p50: round(percentile(values, 50)), p95: round(percentile(values, 95)), p99: round(percentile(values, 99)), max: round(Math.max(...values)) });

/** Arranca el servidor real con una base temporal y comprueba /health y una ruta protegida. */
async function smoke() {
  const dataDir = mkdtempSync(join(os.tmpdir(), 'fitgoal-humo-'));
  const started = performance.now();
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: BACKEND,
    env: { ...process.env, PORT: '3177', HOST: '127.0.0.1', FITGOAL_DATA_DIR: dataDir, NODE_ENV: 'development' },
    stdio: 'ignore',
  });
  const base = 'http://127.0.0.1:3177';
  let health = null;
  for (let i = 0; i < 600 && !health; i++) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) health = await response.json();
    } catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  const result = { arranqueMs: round(performance.now() - started), health: health ? { ok: health.ok, database: health.database } : null };
  if (health) {
    result.sinToken = (await fetch(`${base}/api/plans/me`)).status;
    const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'nadie@prueba.cl', password: 'clave-incorrecta-1234' }) });
    result.loginInvalido = login.status;
  }
  child.kill();
  await new Promise(resolve => setTimeout(resolve, 500));
  rmSync(dataDir, { recursive: true, force: true, maxRetries: 3 });
  return result;
}

async function scenario(baseUrl, people, clients, iterations) {
  const flow = [], recommend = [], start = [];
  let errors = 0;
  const began = performance.now();
  const worker = async person => {
    const headers = { Authorization: `Bearer ${person.accessToken}`, 'content-type': 'application/json' };
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const list = await fetch(`${baseUrl}/api/routines`, { headers });
      const body = await list.json();
      const t1 = performance.now();
      const routine = body.routines?.find(item => item.recommended);
      if (!list.ok || !routine) { errors++; continue; }
      const days = PROFILE.days.slice(0, routine.maxDays);
      const started = await fetch(`${baseUrl}/api/plans/start`, { method: 'POST', headers, body: JSON.stringify({ source: 'recomendada', templateId: routine.id, days }) });
      await started.text();
      const t2 = performance.now();
      if (started.status !== 201) { errors++; continue; }
      recommend.push(t1 - t0); start.push(t2 - t1); flow.push(t2 - t0);
    }
  };
  await Promise.all(people.slice(0, clients).map(worker));
  const seconds = (performance.now() - began) / 1000;
  return { clientes: clients, iteraciones: iterations, flujos: flow.length, errores: errors, segundos: round(seconds), flujosPorSegundo: round(flow.length / seconds), flujoMs: stats(flow), recomendarMs: stats(recommend), iniciarMs: stats(start) };
}

const out = {
  fecha: new Date().toISOString(),
  ambiente: { cpu: os.cpus()[0].model.trim(), nucleos: os.cpus().length, ramGB: round(os.totalmem() / 2 ** 30), so: `${os.type()} ${os.release()}`, node: process.version, base: 'PGlite en memoria, mismo proceso que la API y el generador de carga' },
};
out.humo = await smoke();
console.log('humo', out.humo);

const ctx = await createContext();
const server = await new Promise(resolve => { const s = ctx.app.listen(0, '127.0.0.1', () => resolve(s)); });
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const people = [];
for (let i = 0; i < 100; i++) people.push(await participantWithProfile(ctx));

await scenario(baseUrl, people, 2, 2); // calentamiento, fuera de la medición

out.escenarios = [];
for (const [clients, iterations] of [[10, 10], [25, 8], [50, 6], [100, 5]]) {
  const result = await scenario(baseUrl, people, clients, iterations);
  out.escenarios.push(result);
  console.log(JSON.stringify(result));
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
server.close();
await ctx.close();
process.exit(0);
