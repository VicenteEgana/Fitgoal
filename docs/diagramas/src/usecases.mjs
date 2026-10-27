// Diagramas UML de casos de uso (2 vistas) y su catálogo, usado también para la tabla de especificación.
import { Svg, THEME } from '../kit/svg.mjs';
import { actor, usecase, boundary, bus, relate } from '../kit/uml.mjs';

export const USE_CASES = [
  // Participante
  { id: 'CU-01', name: 'Registrarse y aceptar consentimientos', actor: 'Participante', rf: ['RF001', 'RF009'] },
  { id: 'CU-02', name: 'Iniciar y cerrar sesión', actor: 'Todos los roles', rf: ['RNF002'] },
  { id: 'CU-03', name: 'Completar y actualizar perfil y objetivo', actor: 'Participante', rf: ['RF001', 'RF002'] },
  { id: 'CU-04', name: 'Ver las rutinas recomendadas para mi perfil', actor: 'Participante', rf: ['RF004'] },
  { id: 'CU-05', name: 'Explorar todas las rutinas aprobadas', actor: 'Participante', rf: ['RF004'] },
  { id: 'CU-06', name: 'Empezar una rutina recomendada', actor: 'Participante', rf: ['RF004'] },
  { id: 'CU-07', name: 'Consultar mi horario semanal y la sesión del día', actor: 'Participante', rf: ['RF004'] },
  { id: 'CU-08', name: 'Explorar la biblioteca de ejercicios', actor: 'Participante', rf: ['RF004'] },
  { id: 'CU-09', name: 'Armar y empezar una rutina propia', actor: 'Participante', rf: ['RF004'] },
  { id: 'CU-10', name: 'Registrar sesión realizada', actor: 'Participante', rf: ['RF007'] },
  { id: 'CU-11', name: 'Consultar progreso, racha y calendario', actor: 'Participante', rf: ['RF007'] },
  { id: 'CU-12', name: 'Registrar peso', actor: 'Participante', rf: ['RF007'] },
  { id: 'CU-13', name: 'Consultar avisos internos', actor: 'Participante', rf: ['RF008'] },
  { id: 'CU-14', name: 'Solicitar el ejercicio de derechos sobre mis datos', actor: 'Participante', rf: ['RF009'] },
  { id: 'CU-15', name: 'Consultar mis calorías estimadas', actor: 'Participante', rf: ['RF003'] },
  { id: 'CU-16', name: 'Consultar la pauta de 7 días y cambiar alimentos', actor: 'Participante', rf: ['RF005'] },
  // Funciones del sistema
  { id: 'CU-17', name: 'Validar perfil', actor: 'Sistema', rf: ['RF001', 'RF002'] },
  { id: 'CU-18', name: 'Recomendar rutinas aprobadas', actor: 'Sistema', rf: ['RF004'] },
  { id: 'CU-19', name: 'Sugerir ejercicios según el objetivo', actor: 'Sistema', rf: ['RF004'] },
  { id: 'CU-20', name: 'Verificar consentimiento y habilitación de datos', actor: 'Sistema', rf: ['RF009', 'RNF002'] },
  // Profesionales
  { id: 'CU-21', name: 'Gestionar los ejercicios del catálogo', actor: 'Preparador físico', rf: ['RF004', 'RF006'] },
  { id: 'CU-22', name: 'Gestionar las rutinas del catálogo', actor: 'Preparador físico', rf: ['RF004', 'RF006'] },
  { id: 'CU-23', name: 'Aprobar ejercicios y rutinas', actor: 'Preparador físico', rf: ['RF006'] },
  { id: 'CU-24', name: 'Definir y aprobar las reglas de recomendación', actor: 'Preparador físico', rf: ['RF006'] },
  { id: 'CU-25', name: 'Gestionar y aprobar alimentos, pautas y reglas nutricionales', actor: 'Nutricionista', rf: ['RF003', 'RF005'] },
  // Administración
  { id: 'CU-26', name: 'Gestionar cuentas y roles', actor: 'Administrador', rf: ['RF010'] },
  { id: 'CU-27', name: 'Resolver solicitudes de derechos sobre datos', actor: 'Administrador', rf: ['RF009'] },
  { id: 'CU-28', name: 'Consultar la auditoría', actor: 'Administrador', rf: ['RF010'] },
  { id: 'CU-29', name: 'Consultar los indicadores del piloto', actor: 'Administrador', rf: ['RF007'] },
  { id: 'CU-30', name: 'Operar respaldo y restauración', actor: 'Administrador', rf: ['RNF003'] },
  { id: 'CU-31', name: 'Monitorear disponibilidad y atender incidentes', actor: 'Administrador', rf: ['RNF003'] },
];
const uc = id => USE_CASES.find(item => item.id === id);

export function useCasesParticipant() {
  const width = 1240;
  const height = 1300;
  const s = new Svg(width, height, { title: 'CU 1 Casos de uso del participante', desc: 'Casos de uso del participante y funciones del sistema incluidas' });
  s.text(30, 24, 'CU 1 · Casos de uso del participante', { size: 20, weight: 700, anchor: 'start' });
  s.text(30, 46, 'Diagrama UML de casos de uso · RF001 a RF009 · CU-02 (autenticación) es previo a todos los casos protegidos y se omite de las asociaciones', { size: 13, anchor: 'start', fill: THEME.sub });
  boundary(s, 250, 70, 960, 1210, 'Sistema FitGoal (app móvil + API)');
  const person = actor(s, 90, 650, 'Participante', { sub: 'Adulto que entrena' });
  const left = ['CU-01', 'CU-02', 'CU-03', 'CU-04', 'CU-05', 'CU-06', 'CU-07', 'CU-08', 'CU-09', 'CU-10', 'CU-11', 'CU-13', 'CU-14', 'CU-15', 'CU-16'];
  const lx = 470;
  const step = 76;
  const top = 150;
  const cases = {};
  left.forEach((id, i) => { cases[id] = usecase(s, lx, top + i * step, id, uc(id).name, { rx: 170, ry: 32, fill: id === 'CU-02' ? '#f1f4f7' : '#fff' }); });
  const rx = 1020;
  const yOf = id => top + left.indexOf(id) * step;
  const blue = { fill: THEME.blue.fill, stroke: THEME.blue.stroke };
  cases['CU-17'] = usecase(s, rx, yOf('CU-03'), 'CU-17', uc('CU-17').name, { rx: 130, ry: 30, ...blue });
  cases['CU-18'] = usecase(s, rx, yOf('CU-04') + 30, 'CU-18', uc('CU-18').name, { rx: 135, ry: 32, ...blue });
  cases['CU-19'] = usecase(s, rx, yOf('CU-09'), 'CU-19', uc('CU-19').name, { rx: 135, ry: 32, ...blue });
  cases['CU-12'] = usecase(s, rx, yOf('CU-10') + 6, 'CU-12', uc('CU-12').name, { rx: 130, ry: 30, fill: '#fff' });
  cases['CU-20'] = usecase(s, rx, 1010, 'CU-20', uc('CU-20').name, { rx: 140, ry: 34, ...blue });
  bus(s, person, 282, left.map(id => cases[id]));
  relate(s, cases['CU-03'], cases['CU-17'], 'include');
  relate(s, cases['CU-04'], cases['CU-18'], 'include');
  relate(s, cases['CU-09'], cases['CU-19'], 'include');
  relate(s, cases['CU-12'], cases['CU-10'], 'extend');
  relate(s, cases['CU-12'], cases['CU-20'], 'include');
  relate(s, cases['CU-15'], cases['CU-20'], 'include');
  relate(s, cases['CU-16'], cases['CU-20'], 'include');
  s.text(1020, 1080, 'Funciones del sistema (incluidas) en azul. CU-12 extiende a CU-10 solo si hay consentimiento de seguimiento y datos habilitados; CU-15 y CU-16 ajustan las calorías solo con los consentimientos de datos corporales y nutricionales; sin ellos se muestran porciones de referencia. Todo lo que ve la persona proviene del catálogo aprobado por el preparador o la nutricionista (P5).', { size: 12, anchor: 'middle', fill: THEME.sub, maxWidth: 330, valign: 'top' });
  return { id: 'CU1', file: 'cu-1-participante', title: 'CU 1 Casos de uso del participante', svg: s.toString(), width, height };
}

export function useCasesStaff() {
  const width = 1620;
  const height = 900;
  const s = new Svg(width, height, { title: 'CU 2 Casos de uso de profesionales y administración', desc: 'Casos de uso del preparador físico, la nutricionista y el administrador' });
  s.text(30, 24, 'CU 2 · Casos de uso de profesionales y administración', { size: 20, weight: 700, anchor: 'start' });
  s.text(30, 46, 'Diagrama UML de casos de uso · RF004 a RF010, RNF003 · el preparador define y aprueba una sola vez lo que reciben todas las personas; CU-23 extiende a CU-21 y CU-22', { size: 13, anchor: 'start', fill: THEME.sub });
  boundary(s, 220, 70, 1190, 800, 'Sistema FitGoal (app móvil + API)');
  const trainer = actor(s, 80, 270, 'Preparador físico', { sub: 'Nicolás Villacura' });
  const nutri = actor(s, 80, 640, 'Nutricionista');
  const admin = actor(s, 1520, 440, 'Administrador', { sub: 'Operación del servicio' });
  const c = {};
  const col1 = 440;
  c['CU-21'] = usecase(s, col1, 160, 'CU-21', uc('CU-21').name, { rx: 165, ry: 33 });
  c['CU-22'] = usecase(s, col1, 270, 'CU-22', uc('CU-22').name, { rx: 165, ry: 33 });
  c['CU-24'] = usecase(s, col1, 420, 'CU-24', uc('CU-24').name, { rx: 165, ry: 36 });
  c['CU-25'] = usecase(s, col1, 640, 'CU-25', uc('CU-25').name, { rx: 165, ry: 36 });
  const col2 = 850;
  c['CU-23'] = usecase(s, col2, 215, 'CU-23', uc('CU-23').name, { rx: 140, ry: 32, fill: THEME.amber.fill, stroke: THEME.amber.stroke });
  const col3 = 1180;
  const adminIds = ['CU-26', 'CU-27', 'CU-28', 'CU-29', 'CU-30', 'CU-31'];
  adminIds.forEach((id, i) => { c[id] = usecase(s, col3, 170 + i * 120, id, uc(id).name, { rx: 160, ry: 34 }); });
  bus(s, trainer, 240, ['CU-21', 'CU-22', 'CU-24'].map(id => c[id]));
  bus(s, nutri, 258, ['CU-25'].map(id => c[id]));
  bus(s, admin, 1380, adminIds.map(id => c[id]), 'right');
  relate(s, c['CU-23'], c['CU-21'], 'extend');
  relate(s, c['CU-23'], c['CU-22'], 'extend');
  s.text(col2 - 20, 560, 'Competencia: la base de datos solo admite que el preparador apruebe ejercicios, rutinas y reglas de entrenamiento, y que la nutricionista apruebe alimentos, pautas y reglas de nutrición. No existe revisión caso a caso: la persona recibe al instante lo que ya está aprobado. CU-25 queda bloqueado para contenido personal mientras no exista nutricionista.', { size: 12, anchor: 'middle', fill: THEME.sub, maxWidth: 380, valign: 'top' });
  return { id: 'CU2', file: 'cu-2-profesionales-y-administracion', title: 'CU 2 Casos de uso de profesionales y administración', svg: s.toString(), width, height };
}
