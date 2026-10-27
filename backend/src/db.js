import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/**
 * Base de datos PostgreSQL con una interfaz única para dos motores:
 *  - DATABASE_URL definida → PostgreSQL gestionado (piloto en Render) mediante `pg`.
 *  - Sin DATABASE_URL → PGlite, el motor de PostgreSQL en proceso, para desarrollo local y pruebas.
 * Ambos ejecutan el mismo SQL y las mismas migraciones.
 */
export async function createDatabase({ databaseUrl = null, dataDir = null, memory = false } = {}) {
  if (databaseUrl) return createPgDatabase(databaseUrl);
  return createPgliteDatabase({ dataDir, memory });
}

async function createPgliteDatabase({ dataDir, memory }) {
  const { PGlite } = await import('@electric-sql/pglite');
  if (!memory && dataDir) mkdirSync(dataDir, { recursive: true });
  const engine = new PGlite(memory ? undefined : dataDir);
  await engine.waitReady;
  const wrap = target => ({
    async query(text, params = []) {
      const result = await target.query(text, params);
      // PGlite informa affectedRows = 0 en las consultas SELECT: con filas devueltas, el conteo es el de filas.
      return { rows: result.rows, rowCount: result.rows.length > 0 ? result.rows.length : (result.affectedRows ?? 0) };
    },
  });
  return {
    kind: 'pglite',
    ...wrap(engine),
    exec: sql => engine.exec(sql),
    transaction: fn => engine.transaction(tx => fn(wrap(tx))),
    close: () => engine.close(),
  };
}

async function createPgDatabase(connectionString) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
  const wrap = client => ({
    async query(text, params = []) {
      const result = await client.query(text, params);
      return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
    },
  });
  return {
    kind: 'pg',
    ...wrap(pool),
    async exec(sql) {
      const client = await pool.connect();
      try { await client.query(sql); } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** Aplica en orden las migraciones SQL pendientes y las registra en schema_migrations. */
export async function migrate(db, dir = MIGRATIONS_DIR) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied = new Set((await db.query('SELECT name FROM schema_migrations')).rows.map(row => row.name));
  const files = readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.sql')).map(entry => entry.name).sort();
  const run = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    await db.exec(readFileSync(join(dir, file), 'utf8'));
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    run.push(file);
  }
  return run;
}

/** Tablas que crean las migraciones y que faltan en la base: pasa con una base local creada por una versión anterior del modelo. */
export async function missingTables(db, dir = MIGRATIONS_DIR) {
  const expected = readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .flatMap(entry => [...readFileSync(join(dir, entry.name), 'utf8').matchAll(/^CREATE TABLE (\w+)/gm)].map(match => match[1]));
  const present = new Set((await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).rows.map(row => row.table_name));
  return expected.filter(name => !present.has(name));
}
