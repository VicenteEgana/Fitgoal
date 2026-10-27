// Diagramas de arquitectura: contexto, componentes, topología de comunicaciones, infraestructura y arquitectura integrada.
import { Svg, THEME, textBlock, wrap } from '../kit/svg.mjs';
import { component, nodeBox, artifact } from '../kit/uml.mjs';

const dep = (s, pts, label, o = {}) => s.edge(pts, { color: THEME.sub, dash: '7 5', head: 'open', label, labelDy: -9, labelSize: 11.5, labelFill: THEME.sub, radius: 6, ...o });
const solid = (s, pts, label, o = {}) => s.edge(pts, { color: THEME.line, head: 'fill', label, labelSize: 11.5, labelFill: THEME.sub, radius: 6, ...o });

// ─────────────────────────────── Contexto del sistema ───────────────────────────────
export function context() {
  const w = 1380;
  const h = 780;
  const s = new Svg(w, h, { title: 'AR 0 Contexto del sistema', desc: 'FitGoal, sus usuarios y los sistemas externos con los que se relaciona' });
  s.text(30, 24, 'AR 0 · Diagrama de contexto del sistema', { size: 20, weight: 700, anchor: 'start' });
  s.text(30, 46, 'FitGoal con sus usuarios y los sistemas externos de los que depende (nivel 1 del modelo C4)', { size: 13, anchor: 'start', fill: THEME.sub });
  const person = (x, y, name, desc, color) => {
    s.rect(x, y, 250, 96, { r: 14, fill: color.fill, stroke: color.stroke, sw: 2 });
    s.add('nodes', textBlock(x + 125, y + 24, name, { size: 15, weight: 700, fill: color.ink }).svg);
    s.add('nodes', textBlock(x + 125, y + 62, desc, { size: 12, maxWidth: 220, fill: THEME.ink }).svg);
    return { cx: x + 125, cy: y + 48, x, y, w: 250, h: 96 };
  };
  const a1 = person(60, 90, 'Participante', 'Adulto que inicia un plan; consulta su plan y registra sesiones', THEME.blue);
  const a2 = person(340, 90, 'Preparador físico', 'Define plantillas y revisa las rutinas antes de publicarlas', THEME.green);
  const a3 = person(620, 90, 'Nutricionista', 'Aprueba alimentos, pautas de alimentación y reglas nutricionales', THEME.green);
  const a4 = person(900, 90, 'Administrador', 'Equipo fundador: cuentas, roles, solicitudes de datos y operación', THEME.violet);
  s.rect(330, 330, 720, 150, { r: 16, fill: THEME.amber.fill, stroke: THEME.amber.stroke, sw: 3 });
  s.add('nodes', textBlock(690, 372, 'Sistema FitGoal', { size: 22, weight: 700, fill: THEME.amber.ink }).svg);
  s.add('nodes', textBlock(690, 425, 'Aplicación móvil Flutter (Android) + API REST Node.js/Express + base de datos PostgreSQL. Recomienda rutinas aprobadas por el preparador físico, deja armar la propia y registra el seguimiento.', { size: 13, maxWidth: 640 }).svg);
  const ext = (x, y, name, desc) => {
    s.rect(x, y, 270, 100, { r: 10, fill: '#f1f4f7', stroke: THEME.gray.stroke, sw: 1.8, dash: '7 4' });
    s.add('nodes', textBlock(x + 135, y + 24, name, { size: 14, weight: 700 }).svg);
    s.add('nodes', textBlock(x + 135, y + 62, desc, { size: 12, maxWidth: 240, fill: THEME.sub }).svg);
    return { cx: x + 135, cy: y + 50, x, y, w: 270, h: 100 };
  };
  const e1 = ext(40, 600, 'Render', 'Aloja la API y la base de datos PostgreSQL gestionada del piloto');
  const e2 = ext(350, 600, 'Almacenamiento de respaldo', 'Destino externo y cifrado de las copias diarias');
  const e3 = ext(660, 600, 'GitHub', 'Repositorio, tablero de tareas e integración continua');
  const e4 = ext(970, 600, 'Google Play', 'Distribución de pruebas de la app (pruebas internas)');
  const e5 = ext(1100, 320, 'Sondeo externo', 'Consulta /health cada 5 minutos para medir la disponibilidad');
  solid(s, [[a1.cx, 186], [a1.cx, 260], [440, 260], [440, 330]], 'Registra perfil y sesiones; consulta su plan');
  solid(s, [[a2.cx, 186], [a2.cx, 330]], 'Revisa y aprueba rutinas', { labelDx: 70 });
  solid(s, [[a3.cx, 186], [a3.cx, 330]], 'Aprueba pautas', { labelDx: 60 });
  solid(s, [[a4.cx, 186], [a4.cx, 250], [940, 250], [940, 330]], 'Administra y opera');
  dep(s, [[400, 480], [400, 545], [e1.cx, 545], [e1.cx, 600]], 'Se despliega en', { labelSeg: 1, labelDy: -10 });
  dep(s, [[520, 480], [520, 575], [e2.cx, 575], [e2.cx, 600]], 'Respalda hacia', { labelSeg: 0, labelDx: 50, labelDy: 20 });
  dep(s, [[690, 480], [690, 560], [e3.cx, 560], [e3.cx, 600]], 'Código y CI/CD', { labelSeg: 0, labelDx: -52, labelDy: 40 });
  dep(s, [[900, 480], [900, 530], [e4.cx, 530], [e4.cx, 600]], 'Se distribuye por', { labelSeg: 1, labelDy: -10 });
  dep(s, [[1100, 396], [1050, 396]], 'GET /health', { labelDy: -12 });
  return { id: 'AR0', file: 'ar-0-contexto', title: 'AR 0 Contexto del sistema', svg: s.toString(), width: w, height: h };
}

