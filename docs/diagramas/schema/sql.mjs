// Genera el DDL de PostgreSQL a partir de schema.mjs.
import { TABLES, FUNCTIONS, TRIGGERS } from './schema.mjs';

const lit = v => (typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);

export function tableDdl(t) {
  const lines = [];
  const constraints = [];
  for (const col of t.columns) {
    let line = `  ${col.name} ${col.type}`;
    if (col.identity) line += ' GENERATED ALWAYS AS IDENTITY';
    if (col.nn) line += ' NOT NULL';
    if (col.def !== undefined) line += ` DEFAULT ${col.def}`;
    lines.push(line);
  }
  const pk = t.columns.filter(col => col.pk).map(col => col.name);
  if (pk.length) constraints.push(`  CONSTRAINT ${t.name}_pkey PRIMARY KEY (${pk.join(', ')})`);
  for (const col of t.columns) {
    if (col.uq) constraints.push(`  CONSTRAINT ${t.name}_${col.name}_key UNIQUE (${col.name})`);
  }
  for (const u of t.unique ?? []) constraints.push(`  CONSTRAINT ${u.name} UNIQUE (${u.cols.join(', ')})`);
  for (const col of t.columns) {
    if (col.values) constraints.push(`  CONSTRAINT ${t.name}_${col.name}_check CHECK (${col.name} IN (${col.values.map(lit).join(', ')}))`);
    if (col.check) constraints.push(`  CONSTRAINT ${t.name}_${col.name}_range CHECK (${col.check})`);
  }
  for (const chk of t.checks ?? []) constraints.push(`  CONSTRAINT ${t.name}_${chk.name} CHECK (${chk.sql})`);
  for (const col of t.columns) {
    if (col.fk) constraints.push(`  CONSTRAINT ${t.name}_${col.name}_fkey FOREIGN KEY (${col.name}) REFERENCES ${col.fk.t} (${col.fk.c})${col.fk.onDelete ? ` ON DELETE ${col.fk.onDelete}` : ''}`);
  }
  for (const fk of t.fks ?? []) constraints.push(`  CONSTRAINT ${t.name}_${fk.cols.join('_')}_fkey FOREIGN KEY (${fk.cols.join(', ')}) REFERENCES ${fk.ref} (${fk.refCols.join(', ')})`);
  const body = [...lines, ...constraints].join(',\n');
  const comments = [`COMMENT ON TABLE ${t.name} IS ${lit(t.desc)};`];
  for (const col of t.columns) comments.push(`COMMENT ON COLUMN ${t.name}.${col.name} IS ${lit(col.desc)};`);
  const indexes = (t.indexes ?? []).map(ix => `${ix.sql};`);
  return `CREATE TABLE ${t.name} (\n${body}\n);\n${indexes.join('\n')}${indexes.length ? '\n' : ''}${comments.join('\n')}\n`;
}

export function fullMigration() {
  const out = [];
  out.push(`-- FitGoal · modelo de datos del MVP (PostgreSQL 18).
-- GENERADO desde docs/diagramas/schema/schema.mjs. No editar a mano: modifica el esquema y vuelve a generar.
-- Es la misma fuente que produce los diagramas ER y el diccionario de datos del informe.
BEGIN;
`);
  for (const fn of FUNCTIONS) out.push(`-- ${fn.desc}\n${fn.sql}\n`);
  for (const t of TABLES) out.push(`-- ${t.name}: ${t.desc}\n${tableDdl(t)}`);
  for (const tr of TRIGGERS) out.push(`-- ${tr.desc}\n${tr.sql}\n`);
  out.push('COMMIT;\n');
  return out.join('\n');
}
