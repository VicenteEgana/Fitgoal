import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function initialState() {
  return { schemaVersion: 2, profile: null, plan: null, legacy: null };
}
function migrate(state) {
  if (state.schemaVersion === 2 && Object.hasOwn(state, 'profile') && Object.hasOwn(state, 'plan')) return { state, migrated: false };
  if (state.schemaVersion === 1 && Array.isArray(state.drafts) && Array.isArray(state.reviews)) {
    return {
      migrated: true,
      state: {
        schemaVersion: 2,
        profile: structuredClone(state.profile),
        plan: null,
        legacy: { schemaVersion: 1, archivedAt: new Date().toISOString(), drafts: structuredClone(state.drafts), reviews: structuredClone(state.reviews), lastApprovedPlan: structuredClone(state.lastApprovedPlan ?? null) },
      },
    };
  }
  throw new Error('Archivo de demo incompatible. Respaldar y ejecutar npm run reset-demo.');
}

export class MemoryRepository {
  constructor(state = initialState()) { this.state = structuredClone(state); }
  snapshot() { return structuredClone(this.state); }
  commit(state) { this.state = structuredClone(state); }
  transact(change) {
    const next = this.snapshot();
    const result = change(next);
    this.commit(next);
    return result;
  }
}

export class JsonRepository extends MemoryRepository {
  constructor(path, { reset = false } = {}) {
    let state = initialState();
    let migrated = false;
    if (!reset && existsSync(path)) {
      const parsed = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
      ({ state, migrated } = migrate(parsed));
    }
    super(state);
    this.path = path;
    if (migrated) this.commit(state);
  }
  commit(state) {
    mkdirSync(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(state, null, 2), 'utf8');
    renameSync(temporaryPath, this.path);
    super.commit(state);
  }
}
