// AR 1 · Diagrama de componentes lógicos y físicos de FitGoal.
import { Svg, THEME, textBlock } from '../kit/svg.mjs';
import { component, nodeBox } from '../kit/uml.mjs';

const dep = (s, pts, label, o = {}) => s.edge(pts, { color: THEME.sub, dash: '7 5', head: 'open', label, labelDy: -9, labelSize: 11.5, labelFill: THEME.sub, radius: 6, ...o });
const solid = (s, pts, label, o = {}) => s.edge(pts, { color: THEME.line, head: 'fill', label, labelSize: 11.5, labelFill: THEME.sub, radius: 6, ...o });

export function components() {
  const w = 1680;
  const h = 1070;
  const s = new Svg(w, h, { title: 'AR 1 Diagrama de componentes', desc: 'Componentes lógicos y físicos de FitGoal y sus dependencias' });
  s.text(30, 24, 'AR 1 · Diagrama de componentes', { size: 20, weight: 700, anchor: 'start' });
  s.text(30, 46, 'Componentes lógicos (app y módulos del backend) y físicos (dispositivo, servicios gestionados) con sus relaciones de dependencia · las flechas punteadas indican «usa»', { size: 13, anchor: 'start', fill: THEME.sub });

  // Dispositivo y app
  nodeBox(s, 30, 90, 320, 640, 'Smartphone Android 10 o superior', { stereotype: 'device', color: THEME.gray });
  s.add('bg', textBlock(46, 196, 'App FitGoal (Flutter, Dart)', { size: 13.5, weight: 700, anchor: 'start', fill: THEME.blue.ink }).svg);
  const appBoxes = [
    ['Presentación por rol', 'Pantallas de participante, profesional y administrador'],
    ['Estado y navegación', 'Estado de la sesión, formularios y validaciones'],
    ['Cliente de la API', 'HTTP/JSON, JWT, tiempos de espera y reintentos'],
    ['Almacén seguro de tokens', 'Keystore de Android; nunca datos de salud'],
    ['Consulta de avisos', 'Actualiza plan y avisos al abrir o refrescar'],
  ];
  const app = appBoxes.map(([t, d], i) => component(s, 48, 214 + i * 98, 284, 88, t, { lines: [d], color: THEME.blue, size: 13, sub: 11.5 }));
  const google = component(s, 30, 790, 320, 92, 'Google Play (pruebas internas)', { stereotype: 'external system', lines: ['Distribución de la app a los dispositivos del piloto'], color: THEME.gray, dash: '6 4', size: 13 });

  // Entorno de ejecución de la API
  const ex = { x: 450, y: 90, w: 960, h: 720 };
  s.rect(ex.x, ex.y, ex.w, ex.h, { r: 14, fill: '#fbfcfe', stroke: THEME.blue.stroke, sw: 2.2, layer: 'bg' });
  s.add('bg', textBlock(ex.x + 16, ex.y + 18, '«execution environment»  Render Web Service · Node.js 24 LTS · 0,5 CPU / 512 MB', { size: 13.5, weight: 700, anchor: 'start', fill: THEME.blue.ink }).svg);
  s.add('bg', textBlock(ex.x + 16, ex.y + 40, 'API REST FitGoal (Express 5), monolito modular', { size: 12.5, anchor: 'start', fill: THEME.sub }).svg);
  component(s, 470, 150, 920, 82, 'Plataforma transversal', { lines: ['Validación de entradas · autenticación y autorización por rol y por relación con el recurso · límite de solicitudes · cabeceras y CORS · registros sin datos sensibles · /health'], color: THEME.violet, size: 13, sub: 11.5 });
  s.rect(462, 250, 936, 408, { r: 10, fill: '#fff', stroke: THEME.faint, sw: 1.5, dash: '6 4', layer: 'bg' });
  s.add('bg', textBlock(478, 266, 'Módulos de negocio', { size: 12.5, weight: 700, anchor: 'start', fill: THEME.sub }).svg);
  const col = i => 478 + i * 228;
  const row = j => 286 + j * 132;
  const mod = (c, r, title, lines, color, span = 1) => component(s, col(c), row(r), 208 + (span - 1) * 228, 94, title, { lines, color, size: 13, sub: 11 });
  const m = {
    identidad: mod(0, 0, 'Identidad', ['Registro, Argon2id, JWT y refresh rotativo, roles'], THEME.blue),
    perfil: mod(1, 0, 'Perfil y consentimiento', ['Perfil versionado y consentimientos con política'], THEME.blue),
    catalogo: mod(2, 0, 'Catálogo', ['Ejercicios, rutinas, alimentos, pautas y reglas aprobados'], THEME.green),
    calculo: mod(3, 0, 'Cálculo energético', ['Mifflin-St Jeor × actividad ± objetivo, con consentimiento'], THEME.green),
    derechos: mod(0, 1, 'Derechos de datos', ['Solicitudes, plazos y comprobantes'], THEME.blue),
    recomendacion: mod(1, 1, 'Recomendación', ['Rutinas recomendadas, biblioteca y sugerencias'], THEME.amber),
    rutinas: mod(2, 1, 'Rutinas del participante', ['Iniciar recomendada o propia, rutina vigente e historial'], THEME.amber),
    alimentacion: mod(3, 1, 'Alimentación', ['Pautas de 7 días con gramos ajustados a las calorías'], THEME.amber),
    auditoria: mod(0, 2, 'Auditoría', ['Bitácora de solo anexado; la usan Identidad, Perfil, Catálogo, Rutinas, Progreso y Derechos'], THEME.violet, 2),
    progreso: mod(2, 2, 'Progreso', ['Horario semanal, sesiones, peso, adherencia y racha'], THEME.amber),
    notif: mod(3, 2, 'Notificaciones', ['Avisos internos sin datos sensibles'], THEME.violet),
  };
  component(s, 470, 676, 920, 84, 'Acceso a datos', { lines: ['Repositorios con SQL parametrizado, transacciones, pool de conexiones acotado y migraciones versionadas'], color: THEME.gray, size: 13, sub: 11.5 });
  const pg = component(s, 650, 870, 480, 120, 'PostgreSQL 18 (Render, gestionado)', { stereotype: 'database', lines: ['20 tablas en 4 módulos, con claves foráneas, restricciones y disparadores · 0,1 CPU · 256 MB · 1 GB de almacenamiento'], color: THEME.teal, size: 14, sub: 12 });
  const backup = component(s, 1180, 870, 230, 120, 'Job de respaldo', { stereotype: 'cron job', lines: ['pg_dump diario, cifrado AES-256'], color: THEME.gray, size: 13.5 });
  const store = component(s, 1450, 870, 200, 120, 'Almacenamiento externo', { stereotype: 'external system', lines: ['Compatible con S3, cifrado en reposo'], color: THEME.gray, size: 13, dash: '6 4' });
  const probe = component(s, 1450, 130, 200, 100, 'Sondeo externo', { stereotype: 'external system', lines: ['GET /health cada 5 min'], color: THEME.gray, size: 13.5, dash: '6 4' });
  const ci = component(s, 1450, 290, 200, 130, 'GitHub y Actions', { stereotype: 'external system', lines: ['Repositorio, tablero y CI: análisis y pruebas por cada cambio'], color: THEME.gray, size: 13.5, dash: '6 4' });

  // App → plataforma (etiqueta girada sobre el tramo vertical)
  solid(s, [[332, app[2].cy], [400, app[2].cy], [400, 191], [470, 191]], null);
  s.add('top', `<g transform="translate(388,${(app[2].cy + 191) / 2}) rotate(-90)">${textBlock(0, 0, 'HTTPS · TLS 1.2+ · JSON · JWT', { size: 11.5, fill: THEME.sub, halo: true }).svg}</g>`);
  dep(s, [[google.cx, 790], [google.cx, 730]], 'Instala', { labelDx: 30, labelDy: 0 });

  // Dependencias entre módulos
  const g = (r, d) => row(r) + d;
  dep(s, [[m.derechos.cx, row(1)], [m.derechos.cx, g(0, 94)]], null);
  dep(s, [[m.derechos.cx + 70, row(1)], [m.derechos.cx + 70, 394], [m.perfil.cx - 60, 394], [m.perfil.cx - 60, g(0, 94)]], null);
  dep(s, [[m.derechos.cx, row(2)], [m.derechos.cx, g(1, 94)]], 'registra', { labelDx: 30, labelDy: 0 });
  dep(s, [[m.recomendacion.cx, row(1)], [m.recomendacion.cx, g(0, 94)]], null);
  dep(s, [[m.recomendacion.cx + 50, row(1)], [m.recomendacion.cx + 50, 400], [m.catalogo.cx - 40, 400], [m.catalogo.cx - 40, g(0, 94)]], null);
  dep(s, [[m.rutinas.cx + 20, row(1)], [m.rutinas.cx + 20, g(0, 94)]], 'copia', { labelDx: 30, labelDy: 0 });
  dep(s, [[m.rutinas.x, m.rutinas.cy], [m.recomendacion.x + m.recomendacion.w, m.recomendacion.cy]], 'reglas', { labelDy: -10 });
  dep(s, [[m.progreso.cx, row(2)], [m.progreso.cx, g(1, 94)]], 'rutina vigente', { labelDx: 44, labelDy: 0 });
  dep(s, [[m.alimentacion.cx, row(1)], [m.alimentacion.cx, g(0, 94)]], 'calorías', { labelDx: 34, labelDy: 0 });
  dep(s, [[930, 658], [930, 676]], null);

  solid(s, [[pg.cx, 760], [pg.cx, 870]], null);
  s.text(pg.cx + 12, 835, 'SQL parametrizado · TLS · puerto 5432', { size: 11.5, fill: THEME.sub, anchor: 'start' });
  dep(s, [[pg.x + pg.w, pg.cy], [backup.x, backup.cy]], 'pg_dump', { labelDy: -10 });
  solid(s, [[backup.x + backup.w, backup.cy], [store.x, store.cy]], 'HTTPS', { labelDy: -10 });
  dep(s, [[probe.x, probe.cy], [ex.x + ex.w, probe.cy]], 'HTTPS', { labelDy: -10 });
  dep(s, [[ci.x, ci.cy], [ex.x + ex.w, ci.cy]], 'deploy', { labelDy: -10 });

  s.text(30, 930, 'Componentes lógicos: app Flutter y módulos del backend. Componentes físicos: dispositivo Android; entorno de ejecución y base de datos gestionados en Render; job de respaldo y almacenamiento externo.', { size: 12.5, fill: THEME.sub, anchor: 'start', maxWidth: 560, valign: 'top' });
  return { id: 'AR1', file: 'ar-1-componentes', title: 'AR 1 Diagrama de componentes', svg: s.toString(), width: w, height: h };
}
