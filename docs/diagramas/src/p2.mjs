// P2 · Inicio de la rutina: recomendada o propia, sin revisión caso a caso (nivel 1 y subprocesos).
import { Bpmn } from '../kit/bpmn.mjs';

const colX = i => 140 + i * 158;

export function p2() {
  const d = new Bpmn({
    code: 'P2',
    title: 'Inicio de la rutina: recomendada o propia',
    subtitle: 'Trazabilidad: RF004, RF006, RF007 · OE-b · KPI K5, K6',
    width: 1400,
    lanes: [
      { name: 'Participante', h: 250 },
      { name: 'Sistema FitGoal (app + API)', h: 270 },
    ],
  });

  const s = d.start(0, colX(0), 'Elige una rutina o quiere armar la suya');
  const x1 = d.gateway(0, colX(1), 'xor', '¿Cómo quiere empezar?', { labelW: 92, labelDx: -46 });
  const tA = d.task(0, colX(2), 'Abrir el detalle de una rutina recomendada y elegir sus días', { dy: -62, w: 160, h: 74 });
  const tB = d.task(0, colX(2), 'Armar la rutina: nombre, días y ejercicios con sugerencias', { dy: 62, w: 160, h: 74 });
  const spA = d.sub(1, colX(3) + 60, 'SP2.1 Inicio de rutina recomendada', { dy: -56, w: 160, h: 76 });
  const spB = d.sub(1, colX(3) + 60, 'SP2.2 Armado de rutina propia', { dy: 56, w: 160, h: 76 });
  const mg = d.gateway(1, colX(4) + 50, 'xor');
  const pub = d.task(1, colX(5) + 50, 'Reemplazar la rutina vigente y programar las sesiones', { type: 'service', w: 160, h: 76 });
  const aud = d.task(1, colX(6) + 50, 'Registrar evento de uso y auditoría', { type: 'service' });
  const see = d.task(0, colX(6) + 50, 'Ver su rutina y sus sesiones en la agenda');
  const endOk = d.end(0, colX(7) + 50, 'Rutina vigente iniciada (continúa en P3)', { color: '#2f8a4f' });

  d.flow(s, 'r', x1, 'l');
  d.flow(x1, 't', tA, 'l', { label: 'Catálogo', labelDx: 28, labelDy: -2 });
  d.flow(x1, 'b', tB, 'l', { label: 'Propia', labelDx: 24, labelDy: 14 });
  d.flow(tA, 'r', spA, 'l', { mx: colX(2) + 116 });
  d.flow(tB, 'r', spB, 'l', { mx: colX(2) + 92 });
  d.flow(spA, 'r', mg, 't');
  d.flow(spB, 'r', mg, 'b');
  d.flow(mg, 'r', pub, 'l');
  d.flow(pub, 'r', aud, 'l');
  d.flow(aud, 't', see, 'b');
  d.flow(see, 'r', endOk, 'l');

  const y1 = d.lanes[1].y;
  d.note(colX(0) - 42, y1 + 70, 'No hay cola de revisión: la rutina empieza al instante porque todo su contenido (rutinas, ejercicios y reglas) lo aprobó antes el preparador físico en P5. Si ya tenía una rutina, la app pide confirmar el reemplazo. Si la solicitud no es válida, vuelve al participante con el mensaje del error (ver subprocesos).', { w: 380 });
  return { id: 'P2', file: 'bpmn-p2-inicio-de-rutina', title: 'P2 Inicio de la rutina', svg: d.toString(), width: d.width, height: d.height };
}

export function p2Sub() {
  const d = new Bpmn({
    code: 'P2',
    title: 'Subprocesos expandidos',
    subtitle: 'SP2.1 Inicio de rutina recomendada · SP2.2 Armado de rutina propia',
    width: 1500,
    sheet: true,
    lanes: [
      { name: 'SP2.1 Inicio de rutina recomendada', note: 'RF004, RF006 · K5', h: 230 },
      { name: 'SP2.2 Armado de rutina propia', note: 'RF004, RF006 · K5', h: 230 },
    ],
  });
  const x = i => 92 + i * 164;
  const W = 140;
  const main = -6;
  const branch = 66;
  const svc = { type: 'service', w: W, dy: main };

  // SP2.1
  const a0 = d.start(0, x(0), null, { dy: main });
  const a1 = d.task(0, x(1), 'Verificar consentimiento y que exista el perfil', svc);
  const a2 = d.gateway(0, x(2), 'xor', '¿Rutina aprobada y vigente?', { dy: main, labelW: 110 });
  const a2n = d.end(0, x(2), 'Rechazar con 409: elegir otra', { dy: branch, side: 'right', color: '#c58a12' });
  const a3 = d.task(0, x(3), 'Validar los días contra el mínimo y el máximo de la rutina', { ...svc, w: 150 });
  const a4 = d.gateway(0, x(4), 'xor', '¿Días válidos?', { dy: main });
  const a4n = d.end(0, x(4), 'Rechazar con 400', { dy: branch, side: 'right' });
  const a5 = d.task(0, x(5), 'Copiar los ejercicios de la plantilla a la rutina del participante', { ...svc, w: 156, h: 74 });
  const a6 = d.task(0, x(6), 'Guardar con la versión de la plantilla, de las reglas y del perfil', { ...svc, w: 156, h: 74 });
  const a7 = d.end(0, x(7), 'Rutina lista para programar', { dy: main, color: '#2f8a4f' });
  d.flow(a0, 'r', a1, 'l'); d.flow(a1, 'r', a2, 'l'); d.flow(a2, 'r', a3, 'l', { label: 'Sí' });
  d.flow(a2, 'b', a2n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(a3, 'r', a4, 'l'); d.flow(a4, 'r', a5, 'l', { label: 'Sí' });
  d.flow(a4, 'b', a4n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(a5, 'r', a6, 'l'); d.flow(a6, 'r', a7, 'l');

  // SP2.2
  const b0 = d.start(1, x(0), null, { dy: main });
  const b1 = d.task(1, x(1), 'Verificar consentimiento y perfil; validar nombre y semanas', { ...svc, w: 150 });
  const b2 = d.gateway(1, x(2), 'xor', '¿Una sesión por cada día elegido?', { dy: main, labelW: 120 });
  const b2n = d.end(1, x(2), 'Rechazar con 400', { dy: branch, side: 'right' });
  const b3 = d.gateway(1, x(3), 'xor', '¿Todos los ejercicios están aprobados?', { dy: main, labelW: 130 });
  const b3n = d.end(1, x(3), 'Rechazar: ejercicio no disponible', { dy: branch, side: 'right', color: '#c58a12' });
  const b4 = d.task(1, x(4), 'Validar series (1–6), repeticiones (1–50) o segundos (5–600)', { ...svc, w: 156, h: 74 });
  const b5 = d.gateway(1, x(5), 'xor', '¿Dentro de los límites?', { dy: main, labelW: 100 });
  const b5n = d.end(1, x(5), 'Rechazar con 400', { dy: branch, side: 'right' });
  const b6 = d.task(1, x(6), 'Completar con la indicación sugerida por el profesional', { ...svc, w: 150 });
  const b7 = d.task(1, x(7), 'Guardar la rutina propia con las reglas usadas', { ...svc, w: 150 });
  const b8 = d.end(1, x(8), 'Rutina lista para programar', { dy: main, color: '#2f8a4f' });
  d.flow(b0, 'r', b1, 'l'); d.flow(b1, 'r', b2, 'l'); d.flow(b2, 'r', b3, 'l', { label: 'Sí' });
  d.flow(b2, 'b', b2n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(b3, 'r', b4, 'l', { label: 'Sí' });
  d.flow(b3, 'b', b3n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(b4, 'r', b5, 'l'); d.flow(b5, 'r', b6, 'l', { label: 'Sí' });
  d.flow(b5, 'b', b5n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(b6, 'r', b7, 'l'); d.flow(b7, 'r', b8, 'l');
  return { id: 'P2b', file: 'bpmn-p2-subprocesos', title: 'P2 Subprocesos expandidos', svg: d.toString(), width: d.width, height: d.height };
}
