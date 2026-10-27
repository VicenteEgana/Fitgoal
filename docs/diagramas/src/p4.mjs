// P4 · Atención de derechos sobre datos personales (nivel 1 y subproceso).
import { Bpmn } from '../kit/bpmn.mjs';

const colX = i => 140 + i * 150;

export function p4() {
  const d = new Bpmn({
    code: 'P4',
    title: 'Atención de derechos sobre datos personales',
    subtitle: 'Trazabilidad: RF009, RF010, RNF002 · Ley 21.719 (art. 11) · KPI K5',
    width: 1440,
    lanes: [
      { name: 'Participante', h: 175 },
      { name: 'Sistema FitGoal (app + API)', h: 175 },
      { name: 'Responsable de operación', h: 300 },
    ],
  });
  const pm = -8;
  const sm = -4;
  const opA = -75;
  const opB = 88;

  const s = d.start(0, colX(0), 'Quiere ejercer un derecho sobre sus datos', { dy: pm });
  const t1 = d.task(0, colX(1), 'Elegir el tipo de derecho y enviar la solicitud', { dy: pm });
  const svc1 = d.task(1, colX(1), 'Registrar la solicitud, emitir el comprobante y calcular el plazo', { dy: sm, type: 'service', w: 150, h: 70 });
  const t2 = d.task(2, colX(2), 'Verificar identidad y alcance de la solicitud', { dy: opA, w: 160, h: 104 });
  const timer = d.boundary(t2, 'b', 'timer');
  const text = d.task(2, colX(2), 'Evaluar la prórroga única de hasta 30 días', { dy: opB, w: 136 });
  const endExt = d.end(2, colX(1), 'Prórroga registrada', { dy: opB, color: '#c58a12' });
  const g = d.gateway(2, colX(3), 'xor', '¿Procede la solicitud?', { dy: opA });
  const trej = d.task(2, colX(3), 'Responder con el fundamento del rechazo', { dy: opB });
  const sp = d.sub(2, colX(4), 'SP4.1 Ejecución según el tipo de derecho', { dy: opA, w: 160, h: 84 });
  const svc2 = d.task(1, colX(5), 'Registrar la resolución, auditar y avisar al titular', { dy: sm, type: 'service', w: 150, h: 70 });
  const t3 = d.task(0, colX(6), 'Recibir la respuesta y el comprobante', { dy: pm });
  const e = d.end(0, colX(7), 'Solicitud cerrada', { dy: pm, color: '#2f8a4f' });

  d.flow(s, 'r', t1, 'l');
  d.flow(t1, 'b', svc1, 't');
  d.flow(svc1, 'r', t2, 't');
  d.flow(t2, 'r', g, 'l');
  d.flow(timer, 'b', text, 't', { dash: true, label: 'Quedan 5 días del plazo', labelDx: 10, labelDy: 0, labelAnchor: 'start', labelMaxWidth: 80 });
  d.flow(text, 'l', endExt, 'r');
  d.flow(g, 'r', sp, 'l', { label: 'Sí' });
  d.flow(g, 'b', trej, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(sp, 'r', svc2, 'b', { offB: -30 });
  d.flow(trej, 'r', svc2, 'b', { offB: 30 });
  d.flow(svc2, 'r', t3, 'b');
  d.flow(t3, 'r', e, 'l');

  d.note(colX(2) - 40, d.lanes[0].y + 40, 'Plazos propuestos según el art. 11 de la Ley 21.719: respuesta en 30 días corridos con una única prórroga de hasta 30; bloqueo temporal fundado: respuesta en 2 días hábiles. La reforma rige desde el 1 de diciembre de 2026.', { w: 640 });
  return { id: 'P4', file: 'bpmn-p4-derechos-de-datos', title: 'P4 Atención de derechos sobre datos personales', svg: d.toString(), width: d.width, height: d.height };
}

export function p4Sub() {
  const d = new Bpmn({
    code: 'P4',
    title: 'Subproceso expandido',
    subtitle: 'SP4.1 Ejecución según el tipo de derecho (RF009)',
    width: 1400,
    sheet: true,
    lanes: [{ name: 'SP4.1 Ejecución según el tipo de derecho', note: 'RF009 · Ley 21.719', h: 520 }],
  });
  const ys = [-190, -114, -38, 38, 114, 190];
  const rows = [
    ['Acceso', 'Generar la copia de los datos del titular y entregarla por la app'],
    ['Rectificación', 'Corregir el dato con una nueva versión del perfil, conservando la anterior'],
    ['Oposición', 'Dejar de tratar para la finalidad indicada y registrar la revocación del consentimiento'],
    ['Bloqueo temporal', 'Suspender el tratamiento afectado (estado «bloqueado») dentro de 2 días hábiles'],
    ['Exportación', 'Generar un archivo portable en JSON con los datos del titular, entregado por canal cifrado'],
    ['Eliminación', 'Eliminar o anonimizar los datos y registrar la solicitud para reaplicarla tras restaurar copias'],
  ];
  const start = d.start(0, 80, null);
  const g1 = d.gateway(0, 170, 'xor', '¿Qué derecho se solicita?', { labelW: 120 });
  const g2 = d.gateway(0, 1010, 'xor');
  const done = d.task(0, 1150, 'Registrar la resolución y la auditoría', { type: 'service', w: 130 });
  const end = d.end(0, 1300, 'Resuelta', { color: '#2f8a4f' });
  d.flow(start, 'r', g1, 'l');
  rows.forEach(([label, text], i) => {
    const t = d.task(0, 590, text, { dy: ys[i], type: 'service', w: 380, h: 56 });
    d.flow(g1, 'r', t, 'l', { label, mx: 250, labelSeg: 2, labelT: 0.5, labelDy: -10 });
    d.flow(t, 'r', g2, 'l', { mx: 930 });
  });
  d.flow(g2, 'r', done, 'l');
  d.flow(done, 'r', end, 'l');
  return { id: 'P4b', file: 'bpmn-p4-subproceso', title: 'P4 Subproceso expandido', svg: d.toString(), width: d.width, height: d.height };
}
