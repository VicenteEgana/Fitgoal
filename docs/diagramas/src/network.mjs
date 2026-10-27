// AR 2 · Topología de comunicaciones  ·  AR 3 · Diagrama de infraestructura.
import { Svg, THEME, textBlock } from '../kit/svg.mjs';
import { nodeBox, artifact } from '../kit/uml.mjs';
import { drawTable, tableHeight } from '../kit/table.mjs';

const badge = (s, x, y, n) => {
  s.add('top', `<circle cx="${x}" cy="${y}" r="13" fill="${THEME.amber.stroke}" stroke="#fff" stroke-width="2"/>`);
  s.add('top', textBlock(x, y + 0.5, String(n), { size: 13, weight: 700, fill: '#fff' }).svg);
};
const link = (s, pts, n, at, o = {}) => {
  s.edge(pts, { color: THEME.line, width: 2, head: o.head ?? 'fill', tail: o.tail ?? 'none', radius: 8, dash: o.dash });
  badge(s, at[0], at[1], n);
};

export const PROTOCOLS = [
  ['1', 'App Android → Internet → borde de Render', 'HTTPS (HTTP/1.1 o HTTP/2), puerto 443', 'TLS 1.2 o superior con certificado gestionado; JWT de acceso de 15 minutos', 'JSON UTF-8; carga menor a 100 KB; 120 solicitudes por minuto por usuario e IP; tiempo de espera del cliente de 10 s, con un reintento en consultas'],
  ['2', 'Borde de Render → servicio de la API', 'HTTP dentro de la red del proveedor, puerto PORT', 'El TLS termina en el borde gestionado; se solicitará al proveedor evidencia del tramo interno', 'Mismo formato y carga; el servicio solo se publica a través del borde'],
  ['3', 'API → PostgreSQL', 'Protocolo de PostgreSQL, puerto 5432', 'TLS obligatorio; usuario con privilegios mínimos; sin acceso público', 'Red privada de Render; pool de hasta 10 conexiones; consultas parametrizadas; tiempo máximo de consulta de 5 s'],
  ['4', 'Job de respaldo → PostgreSQL', 'Protocolo de PostgreSQL, puerto 5432', 'TLS obligatorio; usuario de solo lectura', 'Exportación diaria con pg_dump fuera del horario de uso; RPO de 24 h'],
  ['5', 'Job de respaldo → almacenamiento externo', 'HTTPS, puerto 443 (API compatible con S3)', 'Archivo cifrado con AES-256 antes de subir; claves separadas de los datos', '7 copias diarias y 4 semanales; restauración ensayada antes del piloto; RTO de 4 h'],
  ['6', 'Sondeo externo → borde de Render', 'HTTPS, puerto 443, GET /health', 'TLS 1.2 o superior; la ruta no expone datos personales', 'Cada 5 minutos; comprueba API y base de datos (SELECT 1); meta de disponibilidad ≥ 95% en 28 días'],
  ['7', 'Desarrollo → GitHub → Render', 'HTTPS 443 o SSH 22; deploy hook por HTTPS', 'Autenticación individual; secretos fuera del repositorio', 'Análisis y pruebas en cada cambio; despliegue solo si pasan; revisión del responsable de operación'],
  ['8', 'Google Play → smartphone', 'HTTPS, puerto 443', 'Firma de la aplicación y canal de Play', 'Distribución por prueba interna; la producción pública se difiere'],
];

export function topology() {
  const w = 1620;
  const widths = [40, 230, 240, 360, 690];
  const headers = ['N.º', 'Enlace', 'Protocolo y puerto', 'Seguridad', 'Características de transmisión'];
  const th = tableHeight(widths, headers, PROTOCOLS);
  const tableY = 800;
  const h = Math.ceil(tableY + th + 30);
  const s = new Svg(w, h, { title: 'AR 2 Topología de comunicaciones', desc: 'Enlaces, protocolos y puertos entre la app, Render y los servicios externos' });
  s.text(30, 24, 'AR 2 · Topología de comunicaciones', { size: 20, weight: 700, anchor: 'start' });
  s.text(30, 46, 'Enlaces de red, protocolos y características de transmisión que dan soporte al sistema · los números remiten a la tabla inferior', { size: 13, anchor: 'start', fill: THEME.sub });

  // Zona de usuarios
  s.rect(20, 90, 270, 560, { r: 14, fill: '#f8fafc', stroke: THEME.faint, sw: 1.6, layer: 'bg', dash: '6 4' });
  s.add('bg', textBlock(36, 110, 'Usuarios (Wi-Fi, 4G o 5G)', { size: 13.5, weight: 700, anchor: 'start', fill: THEME.sub }).svg);
  nodeBox(s, 36, 130, 220, 110, 'Smartphone del participante', { stereotype: 'device', lines: ['App FitGoal · Android 10+'] });
  nodeBox(s, 36, 270, 220, 110, 'Smartphone del profesional o administrador', { stereotype: 'device', lines: ['App FitGoal · Android 10+'] });
  // Internet
  s.rect(330, 215, 190, 120, { r: 60, fill: THEME.blue.fill, stroke: THEME.blue.stroke, sw: 2, dash: '8 5' });
  s.add('nodes', textBlock(425, 262, 'Internet público', { size: 15, weight: 700, fill: THEME.blue.ink }).svg);
  s.add('nodes', textBlock(425, 295, 'DNS · IPv4/IPv6 · enrutamiento del operador', { size: 11.5, maxWidth: 150, fill: THEME.sub }).svg);
  // Render
  s.rect(560, 90, 700, 600, { r: 16, fill: '#fbfcfe', stroke: THEME.blue.stroke, sw: 2.2, layer: 'bg' });
  s.add('bg', textBlock(578, 112, '«cloud»  Render · región por confirmar (candidata: US East)', { size: 14, weight: 700, anchor: 'start', fill: THEME.blue.ink }).svg);
  s.add('bg', textBlock(578, 134, 'La API y la base de datos se comunican por la red privada del proveedor', { size: 12, anchor: 'start', fill: THEME.sub }).svg);
  const edge = artifact(s, 600, 170, 330, 104, 'Borde de Render (balanceador gestionado)', ['Termina TLS 1.2 o 1.3', 'Certificado gestionado', 'Redirige HTTP a HTTPS · puerto 443'], { color: THEME.blue });
  const api = artifact(s, 600, 350, 330, 128, 'Servicio web de la API', ['Node.js 24 LTS · Express 5', 'Escucha en PORT (red privada)', 'Límite: 120 solicitudes/min y 10 intentos fallidos de autenticación en 15 min (429)'], { color: THEME.amber });
  const db = artifact(s, 600, 540, 330, 118, 'PostgreSQL 18 gestionado', ['Puerto 5432 · TLS obligatorio', 'Pool de hasta 10 conexiones', 'Sin acceso público'], { color: THEME.teal });
  const cron = artifact(s, 960, 540, 270, 118, 'Job de respaldo diario', ['pg_dump de solo lectura', 'Cifra con AES-256 y sube la copia'], { color: THEME.gray });
  // Servicios externos
  s.rect(1300, 90, 300, 600, { r: 14, fill: '#f8fafc', stroke: THEME.faint, sw: 1.6, layer: 'bg', dash: '6 4' });
  s.add('bg', textBlock(1316, 110, 'Servicios externos', { size: 13.5, weight: 700, anchor: 'start', fill: THEME.sub }).svg);
  const gh = artifact(s, 1316, 140, 268, 100, 'GitHub y Actions', ['Repositorio, tablero y CI', 'Los desarrolladores envían cambios por HTTPS o SSH'], { color: THEME.gray });
  const probe = artifact(s, 1316, 300, 268, 90, 'Sondeo externo', ['GET /health cada 5 minutos'], { color: THEME.gray });
  const store = artifact(s, 1316, 540, 268, 118, 'Almacenamiento externo', ['Compatible con S3', 'Cifrado en reposo y claves separadas'], { color: THEME.gray });
  const play = nodeBox(s, 36, 470, 220, 110, 'Google Play', { stereotype: 'cloud', lines: ['Pruebas internas'] });

  link(s, [[262, 175], [330, 250]], 1, [296, 212], { head: 'none' });
  link(s, [[262, 315], [330, 300]], 1, [296, 307], { head: 'none' });
  link(s, [[520, 275], [560, 275], [560, 222], [600, 222]], 1, [545, 249]);
  link(s, [[edge.cx, 274], [api.cx, 350]], 2, [edge.cx, 312]);
  link(s, [[api.cx, 478], [db.cx, 540]], 3, [db.cx, 509]);
  link(s, [[cron.x, cron.cy], [db.x + db.w, db.cy]], 4, [945, db.cy]);
  link(s, [[cron.x + cron.w, cron.cy], [store.x, store.cy]], 5, [1280, cron.cy]);
  link(s, [[probe.x, probe.cy], [1280, probe.cy], [1280, 222], [edge.x + edge.w, 222]], 6, [1280, 270], { dash: '7 5' });
  link(s, [[gh.x, gh.cy], [1260, gh.cy]], 7, [1280, gh.cy], { dash: '7 5' });
  link(s, [[146, 470], [146, 395]], 8, [146, 432], { dash: '7 5' });
  s.text(580, 678, 'Todo el tráfico del usuario entra por HTTPS en el puerto 443; ningún otro puerto se publica en Internet.', { size: 12, anchor: 'start', fill: THEME.sub });

  s.text(30, tableY - 24, 'Protocolos y características de transmisión', { size: 15, weight: 700, anchor: 'start' });
  drawTable(s, 30, tableY, widths, headers, PROTOCOLS, { size: 12, badgeCol: 0 });
  return { id: 'AR2', file: 'ar-2-topologia', title: 'AR 2 Topología de comunicaciones', svg: s.toString(), width: w, height: h };
}

export const ENVIRONMENTS = [
  ['Desarrollo local', 'Estación de cada integrante: API y PostgreSQL 18 en Docker Compose; la app en emulador o teléfono', 'Ficticios; sin datos personales ni de salud', 'Credenciales propias de desarrollo; archivo .env fuera del repositorio', 'Construir y probar cada cambio; pruebas automáticas con PostgreSQL en proceso (PGlite)'],
  ['Staging local', 'Misma configuración, con migraciones y datos de prueba idénticos a los del piloto', 'Ficticios', 'Servicios y credenciales separados de los de desarrollo', 'Aceptación de cada hito y ensayo de revisión y restauración'],
  ['Piloto en Render', 'Servicio web de la API y PostgreSQL 18 gestionados, con respaldo cifrado externo', 'Reales solo si se resuelve la habilitación de datos; de lo contrario, ficticios', 'Base de datos y secretos independientes; acceso individual del equipo', 'Se habilita tras aceptar pruebas, restauración, política de datos y financiamiento'],
];

export function infrastructure() {
  const w = 1700;
  const widths = [190, 360, 300, 340, 440];
  const headers = ['Ambiente', 'Dónde corre', 'Datos', 'Secretos y accesos', 'Uso y condición'];
  const th = tableHeight(widths, headers, ENVIRONMENTS);
  const tableY = 870;
  const h = Math.ceil(tableY + th + 30);
  const s = new Svg(w, h, { title: 'AR 3 Diagrama de infraestructura', desc: 'Nodos físicos y en la nube que soportan la solución, con sus especificaciones' });
  s.text(30, 24, 'AR 3 · Diagrama de infraestructura', { size: 20, weight: 700, anchor: 'start' });
  s.text(30, 46, 'Hardware y servicios en la nube que soportan la solución, con sus especificaciones mínimas y los tres ambientes de trabajo', { size: 13, anchor: 'start', fill: THEME.sub });

  const phones = nodeBox(s, 30, 100, 360, 170, 'Smartphones Android ×2 (más un emulador)', { stereotype: 'device', lines: ['Android 10 o superior · 2 GB de RAM · ancho mínimo 360 dp · 200 MB libres para instalación y caché'] });
  artifact(s, 50, 215, 320, 44, 'Artefacto: aplicación FitGoal (Flutter)', [], { color: THEME.blue });
  const dev = nodeBox(s, 30, 340, 430, 440, 'Estaciones de desarrollo ×3 (equipos propios)', { stereotype: 'device', lines: ['Mínimo 8 GB de RAM y 20 GB libres; 16 GB recomendados para el emulador'] });
  artifact(s, 50, 470, 390, 52, 'Flutter, Dart y emulador Android', ['VS Code o Android Studio'], { color: THEME.blue });
  artifact(s, 50, 534, 390, 52, 'Node.js 24 LTS y Express 5', ['Pruebas de la API con Node y Supertest'], { color: THEME.amber });
  artifact(s, 50, 598, 390, 66, 'Docker Compose', ['API y PostgreSQL 18 locales: desarrollo y staging ficticio'], { color: THEME.teal });
  artifact(s, 50, 676, 390, 66, 'Pruebas automáticas y de carga', ['PostgreSQL en proceso (PGlite) y k6 con 10 clientes virtuales'], { color: THEME.gray });

  const gh = nodeBox(s, 560, 100, 400, 170, 'GitHub', { stereotype: 'cloud', lines: ['Repositorio del código y tablero de tareas (GitHub Projects)', 'GitHub Actions: análisis y pruebas en cada cambio'] });
  s.rect(600, 330, 740, 520, { r: 16, fill: '#fbfcfe', stroke: THEME.blue.stroke, sw: 2.2, layer: 'bg' });
  s.add('bg', textBlock(618, 352, '«cloud»  Render · región por confirmar (candidata: US East) · red privada', { size: 14, weight: 700, anchor: 'start', fill: THEME.blue.ink }).svg);
  const api = nodeBox(s, 625, 380, 330, 200, 'Servicio web de la API', { stereotype: 'execution environment', lines: ['0,5 CPU · 512 MB de RAM', 'Node.js 24 LTS · Express 5', 'Despliegue automático tras aprobar la integración continua'], color: THEME.amber });
  const db = nodeBox(s, 985, 380, 330, 200, 'PostgreSQL 18 gestionado', { stereotype: 'database', lines: ['0,1 CPU · 256 MB de RAM', '1 GB de almacenamiento', 'Conexión con TLS y respaldo propio del proveedor'], color: THEME.teal });
  const cron = nodeBox(s, 985, 640, 330, 170, 'Job de respaldo diario', { stereotype: 'cron job', lines: ['pg_dump de solo lectura y cifrado AES-256', 'Siete copias diarias y cuatro semanales'], color: THEME.gray });
  artifact(s, 625, 640, 330, 170, 'Secretos y variables por ambiente', ['JWT, HMAC de seudónimos y cadena de conexión', 'Nunca en el repositorio', 'Rotación al cambiar de responsable de operación'], { color: THEME.violet });

  const play = nodeBox(s, 1440, 100, 230, 170, 'Google Play Console', { stereotype: 'cloud', lines: ['Prueba interna del piloto; la producción pública se difiere'] });
  const probe = nodeBox(s, 1440, 340, 230, 150, 'Sondeo externo', { stereotype: 'cloud', lines: ['GET /health cada 5 minutos'] });
  const store = nodeBox(s, 1440, 640, 230, 170, 'Almacenamiento externo', { stereotype: 'cloud', lines: ['Compatible con S3', 'Cifrado en reposo; claves separadas'] });

  const link2 = (pts, label, o = {}) => s.edge(pts, { color: THEME.line, width: 2, head: o.head ?? 'fill', dash: o.dash, label, labelSize: 11.5, labelFill: THEME.sub, radius: 8, labelDy: o.labelDy ?? -10, labelDx: o.labelDx ?? 0, labelSeg: o.labelSeg ?? 0, labelAnchor: o.anchor });
  link2([[phones.x + phones.w + 12, 190], [480, 190], [480, 480], [625, 480]], 'HTTPS (443)', { labelSeg: 1, labelDy: -20, labelDx: -8, anchor: 'end' });
  link2([[dev.x + dev.w + 12, 400], [535, 400], [535, 215], [560, 215]], 'git push', { labelSeg: 1, labelDy: 20, labelDx: 8, anchor: 'start' });
  link2([[760, 270], [760, 330]], 'deploy hook', { labelDx: 50, labelDy: 0 });
  link2([[api.x + api.w, 480], [db.x, 480]], 'TLS · 5432', { labelDy: -10 });
  link2([[db.cx, 580], [db.cx, 640]], 'pg_dump', { labelDx: 36, labelDy: 0 });
  link2([[cron.x + cron.w, cron.cy], [store.x, cron.cy]], 'HTTPS', { labelDy: -10 });
  link2([[probe.x, probe.cy], [1340, probe.cy]], 'GET /health (HTTPS)', { dash: '7 5', labelDy: -10 });
  link2([[play.cx, 100], [play.cx, 64], [210, 64], [210, 100]], 'instalación de pruebas', { dash: '7 5', labelSeg: 1, labelDy: -10 });

  s.text(30, tableY - 24, 'Ambientes de trabajo', { size: 15, weight: 700, anchor: 'start' });
  drawTable(s, 30, tableY, widths, headers, ENVIRONMENTS, { size: 12, badgeCol: 0 });
  return { id: 'AR3', file: 'ar-3-infraestructura', title: 'AR 3 Diagrama de infraestructura', svg: s.toString(), width: w, height: h };
}
