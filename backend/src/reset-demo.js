// Borra la base local de desarrollo (PGlite). No toca PostgreSQL gestionado.
import { rmSync } from 'node:fs';
import { loadConfig } from './config.js';

const config = loadConfig();
if (config.databaseUrl) {
  console.error('DATABASE_URL está definida: este comando solo borra la base local de desarrollo.');
  process.exit(1);
}
rmSync(config.dataDir, { recursive: true, force: true });
console.log(`Base local eliminada: ${config.dataDir}. Se recreará, con los datos de demostración, al iniciar la API.`);
