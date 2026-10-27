// P1 · Registro del participante, perfil y recomendación de rutinas aprobadas (nivel 1 y subprocesos).
import { Bpmn } from '../kit/bpmn.mjs';

const colX = i => 150 + i * 152;

export function p1() {
  const d = new Bpmn({
    code: 'P1',
    title: 'Registro, perfil y recomendación de rutinas aprobadas',
    subtitle: 'Trazabilidad: RF001, RF002, RF004, RF009 · OE-a, OE-b · KPI K1, K6',
    width: 1360,
    lanes: [{ name: 'Participante', h: 170 }, { name: 'Sistema FitGoal (app + API)', h: 262 }],
  });
  const main = -28;
  const alt = 68;

  const start = d.start(0, colX(0), 'Quiere un plan de entrenamiento');
  const t1 = d.task(0, colX(1), 'Registrarse con correo y contraseña');
  const sp1 = d.sub(1, colX(1), 'SP1.1 Registro y consentimiento', { dy: main });
  const t3 = d.task(0, colX(2), 'Completar su perfil (estatura y peso opcionales)');
  const sp2 = d.sub(1, colX(2), 'SP1.2 Validación del perfil', { dy: main });
  const x1 = d.gateway(1, colX(3), 'xor', '¿Perfil válido?', { dy: main, labelDx: 38, labelW: 90 });
  const corr = d.task(0, colX(3), 'Corregir los datos indicados');
  const sp3 = d.sub(1, colX(4), 'SP1.3 Recomendación de rutinas aprobadas', { dy: main, w: 162, h: 84 });
  const x2 = d.gateway(1, colX(5), 'xor', '¿Hay rutinas recomendadas?', { dy: main, labelDx: 84, labelW: 96 });
  const see = d.task(0, colX(5), 'Ver las rutinas recomendadas, sus motivos y avisos de ajuste');
  const all = d.task(1, colX(5), 'Ofrecer todo el catálogo aprobado y la opción de armar la propia', { dy: alt, type: 'service', w: 150, h: 70 });
  const endPart = d.end(0, colX(6), 'Elige una rutina (P2)', { color: '#2f6db5' });
  const endAll = d.end(1, colX(6), 'Explora o arma la suya (P2)', { dy: alt, color: '#2f6db5' });

  d.flow(start, 'r', t1, 'l');
  d.flow(t1, 'b', sp1, 't');
  d.flow(sp1, 'r', t3, 'b', { offB: -28 });
  d.flow(t3, 'b', sp2, 't', { offA: 28, offB: 28 });
  d.flow(sp2, 'r', x1, 'l');
  d.flow(x1, 't', corr, 'b', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(corr, 'l', t3, 'r');
  d.flow(x1, 'r', sp3, 'l', { label: 'Sí' });
  d.flow(sp3, 'r', x2, 'l');
  d.flow(x2, 't', see, 'b', { label: 'Sí', labelDx: 14, labelDy: 0 });
  d.flow(x2, 'b', all, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(see, 'r', endPart, 'l');
  d.flow(all, 'r', endAll, 'l');

  const y1 = d.lanes[1].y;
  d.note(colX(0) - 42, y1 + 168, 'Sin cola de espera: las recomendaciones salen del catálogo que el preparador ya aprobó (P5). La estatura y el peso son datos de salud: son opcionales y solo se usan con consentimiento específico.', { w: 560 });
  return { id: 'P1', file: 'bpmn-p1-registro-y-recomendacion', title: 'P1 Registro, perfil y recomendación de rutinas', svg: d.toString(), width: d.width, height: d.height };
}

export function p1Sub() {
  const d = new Bpmn({
    code: 'P1',
    title: 'Subprocesos expandidos',
    subtitle: 'SP1.1 Registro y consentimiento · SP1.2 Validación del perfil · SP1.3 Recomendación de rutinas aprobadas',
    width: 1500,
    sheet: true,
    lanes: [
      { name: 'SP1.1 Registro y consentimiento', note: 'RF001, RF009, RNF002', h: 222 },
      { name: 'SP1.2 Validación del perfil', note: 'RF001, RF002, RF009, RNF002', h: 222 },
      { name: 'SP1.3 Recomendación de rutinas aprobadas', note: 'RF004 · K6 (p95 < 5 s)', h: 222 },
    ],
  });
  const x = i => 92 + i * 164;
  const main = -6;
  const branch = 64;
  const W = 140;
  const svc = { type: 'service', w: W, dy: main };

  // SP1.1 ---------------------------------------------------------------
  const a0 = d.start(0, x(0), null, { dy: main });
  const a1 = d.task(0, x(1), 'Mostrar finalidad y política; el participante acepta', { type: 'user', w: W, dy: main });
  const a2 = d.gateway(0, x(2), 'xor', '¿Acepta?', { dy: main });
  const a2n = d.end(0, x(2), 'Sin cuenta: no se tratan datos', { dy: branch, side: 'right' });
  const a3 = d.task(0, x(3), 'Validar correo y política de contraseña', svc);
  const a4 = d.gateway(0, x(4), 'xor', '¿Datos válidos?', { dy: main });
  const a4n = d.end(0, x(4), 'Rechazar con mensaje genérico', { dy: branch, side: 'right' });
  const a5 = d.task(0, x(5), 'Crear cuenta con hash Argon2id y registrar consentimientos', svc);
  const a6 = d.task(0, x(6), 'Emitir JWT de 15 min y refresh token rotativo', svc);
  const a7 = d.end(0, x(7), 'Cuenta creada con sesión iniciada', { dy: main, color: '#2f8a4f' });
  d.flow(a0, 'r', a1, 'l'); d.flow(a1, 'r', a2, 'l'); d.flow(a2, 'r', a3, 'l', { label: 'Sí' });
  d.flow(a2, 'b', a2n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(a3, 'r', a4, 'l'); d.flow(a4, 'r', a5, 'l', { label: 'Sí' });
  d.flow(a4, 'b', a4n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(a5, 'r', a6, 'l'); d.flow(a6, 'r', a7, 'l');

  // SP1.2 ---------------------------------------------------------------
  const b0 = d.start(1, x(0), null, { dy: main });
  const b1 = d.task(1, x(1), 'Validar tipos y rangos: edad ≥ 18, 1–7 días únicos, duración, equipo', { ...svc, w: 148 });
  const b2 = d.gateway(1, x(2), 'xor', '¿Válido y permitido?', { dy: main, labelW: 100 });
  const b2n = d.end(1, x(2), 'Error 400 con mensaje', { dy: branch, side: 'right' });
  const b3 = d.task(1, x(3), 'Sexo y actividad (calorías): exigen estatura, peso y «datos_nutricionales»', { ...svc, w: 148 });
  const b4 = d.gateway(1, x(4), 'xor', '¿Indicó estatura y peso sin consentimiento «datos_corporales»?', { dy: main, labelW: 160 });
  const b4n = d.end(1, x(4), 'Rechazar con 403: no se guarda nada', { dy: branch, side: 'right', color: '#c58a12' });
  const b5 = d.task(1, x(5), 'Guardar nueva versión del perfil y auditar', svc);
  const b6 = d.end(1, x(6), 'Perfil validado: versión N', { dy: main, color: '#2f8a4f', side: 'right' });
  d.flow(b0, 'r', b1, 'l'); d.flow(b1, 'r', b2, 'l'); d.flow(b2, 'r', b3, 'l', { label: 'Sí' });
  d.flow(b2, 'b', b2n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(b3, 'r', b4, 'l');
  d.flow(b4, 'r', b5, 'l', { label: 'No' });
  d.flow(b4, 'b', b4n, 't', { label: 'Sí', labelDx: 14, labelDy: 0 });
  d.flow(b5, 'r', b6, 'l');

  // SP1.3 ---------------------------------------------------------------
  const y = i => 80 + i * 142;
  const w3 = 128;
  const sv = { type: 'service', w: w3, dy: main };
  const c0 = d.start(2, y(0), null, { dy: main });
  const c1 = d.task(2, y(1), 'Calcular el IMC y su categoría (sin datos: «general»)', sv);
  const c2 = d.task(2, y(2), 'Leer las reglas de recomendación aprobadas', sv);
  const c3 = d.gateway(2, y(3), 'xor', '¿Hay reglas aprobadas?', { dy: main, labelW: 100 });
  const c3n = d.end(2, y(3), 'Sin recomendaciones: se ofrece el catálogo', { dy: branch, side: 'right', color: '#c58a12' });
  const c4 = d.task(2, y(4), 'Aplicar ajustes de seguridad (bajo peso no baja de peso)', sv);
  const c5 = d.task(2, y(5), 'Elegir la división según nivel y días (full body, upper/lower, PPL)', sv);
  const c6 = d.task(2, y(6), 'Buscar la rutina aprobada: objetivo × nivel × equipo × IMC × división', sv);
  const c7 = d.task(2, y(7), 'Avisar si pide más o menos días, o más minutos, que su perfil', sv);
  const c8 = d.task(2, y(8), 'Ordenar: recomendada, otras divisiones; motivos y avisos', sv);
  const c9 = d.end(2, y(9), 'Lista de rutinas para elegir', { dy: main, color: '#2f8a4f' });
  d.flow(c0, 'r', c1, 'l'); d.flow(c1, 'r', c2, 'l'); d.flow(c2, 'r', c3, 'l'); d.flow(c3, 'r', c4, 'l', { label: 'Sí' });
  d.flow(c3, 'b', c3n, 't', { label: 'No', labelDx: 14, labelDy: 0 });
  d.flow(c4, 'r', c5, 'l'); d.flow(c5, 'r', c6, 'l'); d.flow(c6, 'r', c7, 'l'); d.flow(c7, 'r', c8, 'l'); d.flow(c8, 'r', c9, 'l');
  return { id: 'P1b', file: 'bpmn-p1-subprocesos', title: 'P1 Subprocesos expandidos', svg: d.toString(), width: d.width, height: d.height };
}
