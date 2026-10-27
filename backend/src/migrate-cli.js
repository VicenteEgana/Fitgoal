// Aplica las migraciones pendientes. Usa DATABASE_URL (PostgreSQL) o la base local en proceso.
import { loadConfig } from './config.js';
import { createDatabase, migrate } from './db.js';

const config = loadConfig();
const db = await createDatabase({ databaseUrl: config.databaseUrl, dataDir: config.dataDir });
const applied = await migrate(db);
console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'No hay migraciones pendientes.');
await db.close();
