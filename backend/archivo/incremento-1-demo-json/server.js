import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { JsonRepository } from './repository.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';
const statePath = process.env.FITGOAL_STATE_PATH ?? fileURLToPath(new URL('../data/state.json', import.meta.url));
const app = createApp({ repository: new JsonRepository(statePath) });
const server = app.listen(port, host, () => {
  console.log(`FitGoal demo local: http://${host}:${port}`);
  console.log('Rutinas de ejemplo para demostración. La sesión local no es autenticación de producción.');
});
server.on('error', error => {
  console.error(`No se pudo iniciar FitGoal: ${error.code ?? error.message}`);
  process.exitCode = 1;
});

