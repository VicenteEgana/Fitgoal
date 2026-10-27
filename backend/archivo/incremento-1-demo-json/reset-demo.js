import { fileURLToPath } from 'node:url';
import { JsonRepository, initialState } from './repository.js';
const path = process.env.FITGOAL_STATE_PATH ?? fileURLToPath(new URL('../data/state.json', import.meta.url));
new JsonRepository(path, { reset: true }).commit(initialState());
console.log('Demo reiniciada. Reinicia también el servidor para invalidar las sesiones de demostración.');

