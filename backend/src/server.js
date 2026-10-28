import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase, migrate, missingSchema } from './db.js';
import { runMaintenance } from './modules/admin.js';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, seedDemo, seedDemoHistory } from './seed/demo.js';

const config = loadConfig();
const db = await createDatabase({ databaseUrl: config.databaseUrl, dataDir: config.dataDir });
const applied = await migrate(db);
if (applied.length) console.log(`Migraciones aplicadas: ${applied.join(', ')}`);
const missing = await missingSchema(db);
if (missing.length) {
  console.warn(`La base de datos es de una versión anterior del modelo: faltan ${missing.join(', ')}. ${config.databaseUrl ? 'Aplica la migración actualizada.' : 'Ejecuta «npm run reset-demo» dentro de backend para recrear la base local de demostración.'}`);
}

const demo = process.env.FITGOAL_SEED_DEMO === '1' || (!config.production && process.env.FITGOAL_SEED_DEMO !== '0' && !config.databaseUrl);
if (demo) {
  if ((await seedDemo(db, config)).seeded) {
    await seedDemoHistory(db, config);
    console.log('Datos de demostración creados (cuentas ficticias; la cuenta participante trae un historial de dos semanas).');
  }
  console.log(`Cuentas de demostración: ${Object.values(DEMO_ACCOUNTS).map(account => account.email).join(', ')} · contraseña común en src/seed/demo.js (${DEMO_PASSWORD.length} caracteres)`);
}

const app = createApp({ db, config, logger: line => console.log(line) });
const server = app.listen(config.port, config.host, () => {
  console.log(`FitGoal API en http://${config.host}:${config.port} · base de datos: ${db.kind === 'pg' ? 'PostgreSQL (DATABASE_URL)' : 'PostgreSQL en proceso (PGlite)'}`);
});

const scheduler = setInterval(() => runMaintenance(app.context).then(result => {
  if (result.sessionReminders) console.log(`Mantenimiento: ${JSON.stringify(result)}`);
}).catch(error => console.error('Mantenimiento falló:', error.message)), 60 * 60 * 1000);
scheduler.unref();

const shutdown = async () => {
  clearInterval(scheduler);
  server.close();
  await db.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
