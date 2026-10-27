// P5 · Gobierno del catálogo: el profesional aprueba una vez lo que reciben todas las personas (nivel 1 y subprocesos).
import { Bpmn } from '../kit/bpmn.mjs';

const colX = i => 140 + i * 158;

export function p5() {
  const d = new Bpmn({
    code: 'P5',
    title: 'Gobierno del catálogo: aprobación profesional',
    subtitle: 'Trazabilidad: RF004, RF005, RF006, RF010 · OE-b, OE-c · KPI K5',
    width: 1400,
    lanes: [
      { name: 'Profesional (preparador físico; nutricionista en su ámbito)', h: 270 },
      { name: 'Sistema FitGoal (app + API)', h: 250 },
      { name: 'Participante', h: 150 },
    ],
  });
  const up = -62;
  const down = 70;

  const s = d.start(0, colX(0), 'Necesita contenido nuevo: ejercicio, rutina o reglas', { dy: up });
  const t1 = d.task(0, colX(1), 'Redactar el contenido en borrador', { dy: up });
  const svc1 = d.task(1, colX(1), 'Guardar el borrador con autor y versión', { type: 'service', dy: -30 });
  const t2 = d.task(0, colX(2), 'Revisar técnica, progresión, restricciones y coherencia', { dy: up, w: 170, h: 90 });
  const g1 = d.gateway(0, colX(3), 'xor', '¿Cumple los criterios?', { dy: up });
  const tfix = d.task(0, colX(3), 'Dejarlo en borrador y ajustarlo', { dy: down });
  const tap = d.task(0, colX(4), 'Aprobar el contenido', { dy: up });
  const sp1 = d.sub(1, colX(5), 'SP5.1 Publicación de contenido aprobado', { dy: -30, w: 170, h: 80 });
  const msg = d.event(2, colX(5), 'message', 'Catálogo actualizado');
  const tuse = d.task(2, colX(6), 'Ver y usar solo lo aprobado: rutinas, ejercicios y recomendaciones');
  const endOk = d.end(2, colX(7), 'Contenido vigente para todas las personas', { color: '#2f8a4f' });

  const r0 = d.start(0, colX(6), 'Decide retirar contenido', { dy: 40 });
  const sp2 = d.sub(1, colX(6), 'SP5.2 Retiro de contenido', { dy: 70, w: 150, h: 70 });
  const endRet = d.end(1, colX(7), 'Contenido retirado', { dy: 70, color: '#c58a12' });

  d.flow(s, 'r', t1, 'l');
  d.flow(t1, 'b', svc1, 't');
  d.flow(svc1, 'r', t2, 'b', { offB: -30 });
  d.flow(t2, 'r', g1, 'l');
  d.flow(g1, 'r', tap, 'l', { label: 'Sí' });
  d.flow(g1, 'b', tfix, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(tfix, 'l', t1, 'b', { offB: 40, dash: true });
  d.flow(tap, 'b', sp1, 't');
  d.flow(sp1, 'b', msg, 't');
  d.flow(msg, 'r', tuse, 'l');
  d.flow(tuse, 'r', endOk, 'l');
  d.flow(r0, 'r', sp2, 't');
  d.flow(sp2, 'r', endRet, 'l');

  const y2 = d.lanes[2].y;
  d.note(colX(0) - 40, y2 + 24, 'La competencia la exige la base de datos: el preparador aprueba ejercicios, rutinas y reglas de entrenamiento; la nutricionista, alimentos, pautas de alimentación y reglas de nutrición (RF006). Nadie aprueba contenido ajeno a su ámbito.', { w: 560 });
  return { id: 'P5', file: 'bpmn-p5-catalogo-profesional', title: 'P5 Gobierno del catálogo', svg: d.toString(), width: d.width, height: d.height };
}

export function p5Sub() {
  const d = new Bpmn({
    code: 'P5',
    title: 'Subprocesos expandidos',
    subtitle: 'SP5.1 Publicación de contenido aprobado · SP5.2 Retiro de contenido',
    width: 1500,
    sheet: true,
    lanes: [
      { name: 'SP5.1 Publicación de contenido aprobado', note: 'RF004, RF006, RF010 · K5', h: 250 },
      { name: 'SP5.2 Retiro de contenido', note: 'RF006, RF010', h: 230 },
    ],
  });
  const x = i => 92 + i * 164;
  const W = 140;
  const main = -6;
  const branch = 66;
  const svc = { type: 'service', w: W, dy: main };

  // SP5.1
  const a0 = d.start(0, x(0), null, { dy: main });
  const a1 = d.task(0, x(1), 'Verificar el rol competente del aprobador', svc);
  const a2 = d.gateway(0, x(2), 'xor', '¿Está en borrador?', { dy: main, labelW: 90 });
  const a2n = d.end(0, x(2), 'Rechazar con 409', { dy: branch, side: 'right' });
  const a3 = d.gateway(0, x(3), 'xor', '¿Sus dependencias están aprobadas?', { dy: main, labelW: 130 });
  const a3n = d.end(0, x(3), 'Pedir aprobar antes ejercicios o rutinas (409)', { dy: branch, side: 'right', color: '#c58a12' });
  const a4 = d.task(0, x(4), 'Transacción: retirar la versión anterior y aprobar la nueva', { ...svc, w: 156, h: 74 });
  const a5 = d.task(0, x(5), 'Registrar aprobador, rol y fecha de aprobación', { ...svc, w: 150 });
  const a6 = d.task(0, x(6), 'Registrar auditoría: autor, fecha y versión', { ...svc, w: 150 });
  const a7 = d.end(0, x(7), 'Contenido aprobado y vigente', { dy: main, color: '#2f8a4f' });
  d.flow(a0, 'r', a1, 'l'); d.flow(a1, 'r', a2, 'l'); d.flow(a2, 'r', a3, 'l', { label: 'Sí' });
  d.flow(a2, 'b', a2n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(a3, 'r', a4, 'l', { label: 'Sí' });
  d.flow(a3, 'b', a3n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(a4, 'r', a5, 'l'); d.flow(a5, 'r', a6, 'l'); d.flow(a6, 'r', a7, 'l');

  // SP5.2
  const b0 = d.start(1, x(0), null, { dy: main });
  const b1 = d.task(1, x(1), 'Verificar que el contenido está aprobado', svc);
  const b2 = d.gateway(1, x(2), 'xor', '¿Es un ejercicio usado por una rutina aprobada?', { dy: main, labelW: 150 });
  const b2n = d.end(1, x(2), 'Rechazar: retirar antes esas rutinas (409)', { dy: branch, side: 'right', color: '#c58a12' });
  const b3 = d.task(1, x(3), 'Marcar como retirado: solo deja de ofrecerse', { ...svc, w: 150 });
  const b4 = d.task(1, x(4), 'Conservar sin cambios las rutinas ya iniciadas', { ...svc, w: 150 });
  const b5 = d.task(1, x(5), 'Registrar auditoría', svc);
  const b6 = d.end(1, x(6), 'Contenido retirado', { dy: main, color: '#c0394b' });
  d.flow(b0, 'r', b1, 'l'); d.flow(b1, 'r', b2, 'l');
  d.flow(b2, 'r', b3, 'l', { label: 'No' });
  d.flow(b2, 'b', b2n, 't', { label: 'Sí', labelDx: 14, labelDy: 0 });
  d.flow(b3, 'r', b4, 'l'); d.flow(b4, 'r', b5, 'l'); d.flow(b5, 'r', b6, 'l');
  return { id: 'P5b', file: 'bpmn-p5-subprocesos', title: 'P5 Subprocesos expandidos', svg: d.toString(), width: d.width, height: d.height };
}
