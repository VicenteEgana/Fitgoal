// P3 · Seguimiento de sesiones y progreso (nivel 1 y subprocesos).
import { Bpmn } from '../kit/bpmn.mjs';

const colX = i => 140 + i * 150;

export function p3() {
  const d = new Bpmn({
    code: 'P3',
    title: 'Seguimiento de sesiones y progreso',
    subtitle: 'Trazabilidad: RF002, RF007, RF008, RF009 · OE-d · KPI K2, K3, K4',
    width: 1440,
    lanes: [{ name: 'Participante', h: 175 }, { name: 'Sistema FitGoal (app + API)', h: 270 }],
  });
  const row1 = -78;
  const row2 = 72;
  const pm = -8;

  const s = d.start(0, colX(0), 'Tiene una rutina vigente (P2)', { dy: pm });
  const t1 = d.task(0, colX(1), 'Consultar su horario semanal: sesión del día o descanso', { dy: pm });
  const svcA = d.task(1, colX(1), 'Entregar la semana: sesiones aprobadas y días de descanso', { dy: row1, type: 'service' });
  const t2 = d.task(0, colX(2), 'Realizar la sesión (modo sesión con temporizador, o fuera de la app)', { dy: pm, h: 70 });
  const t3 = d.task(0, colX(3), 'Registrar la sesión realizada (y el peso, si está habilitado)', { dy: pm, w: 150, h: 70 });
  const sp1 = d.sub(1, colX(3), 'SP3.1 Registro de sesión y peso', { dy: row1, w: 150, h: 70 });
  const svcC = d.task(1, colX(4) + 30, 'Actualizar historial, adherencia y racha', { dy: row1, type: 'service' });
  const t4 = d.task(0, colX(6), 'Consultar progreso, racha y calendario', { dy: pm });
  const xor = d.gateway(0, colX(7), 'xor', '¿Cambia su disponibilidad u objetivo?', { dy: pm, labelW: 130 });
  const endNo = d.end(0, colX(8), 'El seguimiento continúa', { dy: pm });
  const endYes = d.end(1, colX(7), 'Va a P1: nuevas recomendaciones; su rutina vigente se mantiene', { dy: row1, side: 'right', color: '#2f6db5' });

  const ts = d.event(1, colX(1), 'timer', 'Cierre semanal (domingo 23:59)', { dy: row2 });
  const sp2 = d.sub(1, colX(3), 'SP3.2 Cierre semanal y adherencia', { dy: row2, w: 150, h: 70 });
  const svcR = d.task(1, colX(5), 'Crear recordatorio interno si el participante lo activó', { dy: row2, type: 'service', w: 150 });
  const endW = d.end(1, colX(7), 'Semana cerrada', { dy: row2 });

  d.flow(s, 'r', t1, 'l');
  d.flow(t1, 'b', svcA, 't');
  d.flow(svcA, 'r', t2, 'b');
  d.flow(t2, 'r', t3, 'l');
  d.flow(t3, 'b', sp1, 't');
  d.flow(sp1, 'r', svcC, 'l');
  d.flow(svcC, 'r', t4, 'b');
  d.flow(t4, 'r', xor, 'l');
  d.flow(xor, 'r', endNo, 'l', { label: 'No' });
  d.flow(xor, 'b', endYes, 't', { label: 'Sí', labelDx: 14, labelDy: 0 });
  d.flow(ts, 'r', sp2, 'l');
  d.flow(sp2, 'r', svcR, 'l');
  d.flow(svcR, 'r', endW, 'l');
  d.note(colX(4) + 60, d.lanes[1].y + 104, 'La sesión no registrada cuenta como no realizada en la adherencia (RF007, K3), aunque el comodín semanal proteja la racha. Los días de descanso suman a la racha.', { w: 470 });
  return { id: 'P3', file: 'bpmn-p3-seguimiento', title: 'P3 Seguimiento de sesiones y progreso', svg: d.toString(), width: d.width, height: d.height };
}

export function p3Sub() {
  const d = new Bpmn({
    code: 'P3',
    title: 'Subprocesos expandidos',
    subtitle: 'SP3.1 Registro de sesión y peso · SP3.2 Cierre semanal y adherencia',
    width: 1560,
    sheet: true,
    lanes: [
      { name: 'SP3.1 Registro de sesión y peso', note: 'RF007, RF009, RNF002 · K2, K3', h: 270 },
      { name: 'SP3.2 Cierre semanal y adherencia', note: 'RF007, RF008 · K3', h: 215 },
    ],
  });
  const x = i => 92 + i * 150;
  const W = 134;
  const svc = { type: 'service', w: W };

  // SP3.1
  const a0 = d.start(0, x(0), null, { dy: -10 });
  const a1 = d.task(0, x(1), 'Verificar que la sesión es de la rutina vigente del participante', { ...svc, dy: -10 });
  const a2 = d.gateway(0, x(2), 'xor', '¿Es suya y la fecha no es futura?', { dy: -10, labelW: 120 });
  const a2n = d.end(0, x(2), 'Rechazar con error 403 o 400', { dy: 72, side: 'right' });
  const a3 = d.task(0, x(3), 'Marcar la sesión como realizada con fecha y hora', { ...svc, dy: -10 });
  const a4 = d.gateway(0, x(4), 'xor', '¿Incluye el peso?', { dy: -10 });
  const a4n = d.end(0, x(4), 'Sin peso: continúa', { dy: 72, color: '#2f8a4f', side: 'right' });
  const a5 = d.gateway(0, x(5), 'xor', '¿Hay consentimiento y datos habilitados?', { dy: -10, labelW: 140 });
  const a5n = d.end(0, x(5), 'Rechazar solo el peso; la sesión sí queda guardada', { dy: 72, color: '#c58a12', side: 'right' });
  const a6 = d.task(0, x(6), 'Guardar el peso (valor positivo, uno por día)', { ...svc, dy: -10 });
  const a7 = d.task(0, x(7), 'Registrar el evento de uso seudonimizado', { ...svc, dy: -10 });
  const a8 = d.task(0, x(8), 'Recalcular la racha (descansos suman; comodín semanal)', { ...svc, dy: -10 });
  const a9 = d.end(0, x(8) + 120, 'Sesión registrada', { dy: -10, color: '#2f8a4f' });
  d.flow(a0, 'r', a1, 'l'); d.flow(a1, 'r', a2, 'l'); d.flow(a2, 'r', a3, 'l', { label: 'Sí' });
  d.flow(a2, 'b', a2n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(a3, 'r', a4, 'l');
  d.flow(a4, 'r', a5, 'l', { label: 'Sí' });
  d.flow(a4, 'b', a4n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(a5, 'r', a6, 'l', { label: 'Sí' });
  d.flow(a5, 'b', a5n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(a6, 'r', a7, 'l'); d.flow(a7, 'r', a8, 'l'); d.flow(a8, 'r', a9, 'l');

  // SP3.2
  const b0 = d.event(1, x(0), 'timer', null, { dy: -6 });
  const b1 = d.task(1, x(1), 'Contar las sesiones programadas de la semana', { ...svc, dy: -6 });
  const b2 = d.task(1, x(2), 'Contar las declaradas; las no registradas cuentan como no realizadas (también con comodín)', { ...svc, w: 150, h: 76, dy: -6 });
  const b3 = d.task(1, x(3) + 16, 'Calcular la adherencia acumulada con el denominador inicial', { ...svc, w: 150, dy: -6 });
  const b4 = d.task(1, x(4) + 46, 'Guardar el evento de uso seudonimizado', { ...svc, dy: -6 });
  const b5 = d.gateway(1, x(5) + 66, 'xor', '¿Hay sesiones pendientes y recordatorio activo?', { dy: -6, labelW: 150 });
  const b5n = d.end(1, x(5) + 66, 'Semana cerrada sin aviso', { dy: 62, color: '#2f8a4f', side: 'right' });
  const b6 = d.task(1, x(6) + 76, 'Crear aviso interno de recordatorio', { ...svc, dy: -6 });
  const b7 = d.end(1, x(7) + 76, 'Semana cerrada', { dy: -6, color: '#2f8a4f' });
  d.flow(b0, 'r', b1, 'l'); d.flow(b1, 'r', b2, 'l'); d.flow(b2, 'r', b3, 'l'); d.flow(b3, 'r', b4, 'l'); d.flow(b4, 'r', b5, 'l');
  d.flow(b5, 'r', b6, 'l', { label: 'Sí' });
  d.flow(b5, 'b', b5n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(b6, 'r', b7, 'l');
  return { id: 'P3b', file: 'bpmn-p3-subprocesos', title: 'P3 Subprocesos expandidos', svg: d.toString(), width: d.width, height: d.height };
}
