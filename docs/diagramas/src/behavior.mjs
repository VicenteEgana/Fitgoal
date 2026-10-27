// Diagramas de comportamiento: estados del contenido del catálogo y de la rutina (ST 1) y secuencia del flujo crítico (SQ 1).
import { Svg, THEME, textBlock } from '../kit/svg.mjs';

export function states() {
  const w = 1460;
  const h = 700;
  const s = new Svg(w, h, { title: 'ST 1 Estados del catálogo y de la rutina', desc: 'Máquinas de estados del contenido del catálogo y de la rutina del participante' });
  s.text(30, 24, 'ST 1 · Diagrama de estados del contenido del catálogo y de la rutina del participante', { size: 20, weight: 700, anchor: 'start' });
  s.text(30, 46, 'Estados permitidos por status en exercises, routine_templates y rule_versions, y en user_plans · RF006 · las restricciones y disparadores de la base de datos impiden las transiciones no permitidas', { size: 13, anchor: 'start', fill: THEME.sub });

  const state = (cx, cy, name, desc, color, wd = 230, ht = 80) => {
    s.rect(cx - wd / 2, cy - ht / 2, wd, ht, { r: 22, fill: color.fill, stroke: color.stroke, sw: 2.2 });
    s.add('nodes', textBlock(cx, cy - 13, name, { size: 15, weight: 700, fill: color.ink, family: "'Cascadia Mono', Consolas, monospace" }).svg);
    s.add('nodes', textBlock(cx, cy + 14, desc, { size: 11.5, maxWidth: wd - 24, fill: THEME.sub }).svg);
    return { cx, cy, w: wd, h: ht };
  };
  const final = (cx, cy) => { s.ellipse(cx, cy, 15, 15, { fill: '#fff', stroke: THEME.ink, sw: 2 }); s.ellipse(cx, cy, 8, 8, { fill: THEME.ink, stroke: THEME.ink }); };
  const t = (pts, label, o = {}) => s.edge(pts, { color: THEME.line, head: 'fill', width: 1.8, label, labelSize: 11.8, labelFill: THEME.ink, radius: 10, labelMaxWidth: o.maxWidth ?? 170, ...o });

  // Contenido del catálogo
  s.rect(60, 80, 1340, 270, { r: 14, fill: '#fcfdfe', stroke: THEME.faint, sw: 1.6, layer: 'bg' });
  s.add('bg', textBlock(78, 100, 'Contenido del catálogo: ejercicios, rutinas y reglas (status)', { size: 14.5, weight: 700, anchor: 'start' }).svg);
  s.ellipse(120, 215, 13, 13, { fill: THEME.ink, stroke: THEME.ink });
  state(380, 215, 'draft', 'El profesional lo redacta; nadie más lo ve', THEME.amber);
  state(780, 215, 'approved', 'Vigente: lo ven y lo usan todas las personas', THEME.green);
  state(1180, 215, 'retired', 'Deja de ofrecerse; lo ya iniciado se conserva', THEME.gray);
  final(1360, 215);
  t([[133, 215], [265, 215]], 'Se crea con autor y versión', { labelDy: -18, maxWidth: 110 });
  t([[495, 200], [665, 200]], 'Aprueba el profesional competente', { labelDy: -30, maxWidth: 140 });
  t([[665, 232], [495, 232]], 'Si no cumple, se ajusta y sigue en draft', { labelDy: 20, maxWidth: 150, dash: '6 4' });
  t([[895, 200], [1065, 200]], 'Se retira, o se aprueba una versión nueva', { labelDy: -30, maxWidth: 150 });
  t([[1295, 215], [1345, 215]], null);
  s.text(730, 300, 'Una versión aprobada no se edita ni se borra: los ejercicios de una rutina aprobada quedan congelados y los cambios se publican como una versión nueva.', { size: 12, fill: THEME.sub, maxWidth: 960 });

  // Rutina del participante
  s.rect(60, 390, 1340, 260, { r: 14, fill: '#fcfdfe', stroke: THEME.faint, sw: 1.6, layer: 'bg' });
  s.add('bg', textBlock(78, 410, 'Rutina del participante (user_plans.status)', { size: 14.5, weight: 700, anchor: 'start' }).svg);
  s.ellipse(120, 515, 11, 11, { fill: THEME.ink, stroke: THEME.ink });
  state(420, 515, 'vigente', 'La rutina que la persona sigue hoy; solo una', THEME.green, 250);
  state(900, 515, 'reemplazado', 'Se conserva en el historial; no se modifica', THEME.gray, 260);
  final(1250, 515);
  t([[131, 515], [295, 515]], 'La persona inicia una rutina (inmediato)', { labelDy: -22, maxWidth: 140 });
  t([[545, 515], [770, 515]], 'Inicia otra rutina (recomendada o propia)', { labelDy: -22, maxWidth: 190 });
  t([[1030, 515], [1235, 515]], 'Historial', { labelDy: -14, maxWidth: 80 });
  s.text(730, 600, 'Solo la rutina vigente programa sesiones. Al reemplazarla se quitan las sesiones futuras sin hacer y se conserva lo ya registrado.', { size: 12, fill: THEME.sub, maxWidth: 960 });
  return { id: 'ST1', file: 'st-1-estados', title: 'ST 1 Estados del catálogo y de la rutina', svg: s.toString(), width: w, height: h };
}

export function sequence() {
  const w = 1560;
  const names = [
    ['Participante', 'persona'],
    ['Preparador físico', 'persona'],
    ['App FitGoal', 'Flutter'],
    ['API REST', 'Plataforma'],
    ['Módulos', 'Catálogo, recomendación y rutinas'],
    ['PostgreSQL', 'base de datos'],
  ];
  const xs = names.map((_, i) => 130 + i * 260);
  const y0 = 150;
  const step = 44;
  const messages = [
    { phase: '0 · Aprobación previa del catálogo (una sola vez, por el preparador)' },
    [1, 2, 'Abre el catálogo y revisa una rutina'],
    [2, 3, 'GET /catalog/templates/{id}'],
    [3, 5, 'SELECT rutina, sesiones y estado de sus ejercicios', 'short'],
    [1, 2, 'Decide aprobarla (sus ejercicios ya están aprobados)'],
    [2, 3, 'POST /catalog/templates/{id}/approve'],
    [3, 4, 'aprobarRutina(id, preparador)'],
    [4, 5, 'Transacción: retira la versión anterior; UPDATE aprobada con aprobador y fecha; INSERT audit_log'],
    [3, 2, '200 { rutina aprobada y vigente }', 'return'],
    { phase: '1 · Perfil y recomendación' },
    [0, 2, 'Completa el perfil: objetivo, nivel, días y equipo'],
    [2, 3, 'PUT /profiles/me con JWT'],
    [3, 3, 'Valida JWT, sesión activa, versión y límite de solicitudes; valida la entrada', 'self'],
    [3, 5, 'INSERT profile_versions (versión N)'],
    [0, 2, 'Abre «Rutinas»'],
    [2, 3, 'GET /routines'],
    [3, 4, 'recomendar(perfil vigente)'],
    [4, 5, 'Lee las reglas aprobadas y las rutinas aprobadas del catálogo'],
    [3, 2, '200 { rutinas con motivos; las recomendadas primero }', 'return'],
    { phase: '2 · Inicio de la rutina (sin cola de revisión)' },
    [0, 2, 'Elige una rutina y sus días y pulsa «Empezar»'],
    [2, 3, 'POST /plans/start { source: "recomendada", templateId, days }'],
    [3, 4, 'iniciarRutina(perfil, rutina, días)'],
    [4, 5, 'Transacción: reemplaza la vigente; INSERT user_plans, user_plan_exercises, training_sessions, usage_events y audit_log'],
    [3, 2, '201 { rutina iniciada, sesiones programadas }', 'return'],
    { phase: '3 · Consulta de la rutina vigente' },
    [0, 2, 'Abre o actualiza la app'],
    [2, 3, 'GET /plans/me y GET /notifications/me'],
    [3, 5, 'SELECT rutina vigente, sus ejercicios y los avisos del usuario', 'short'],
    [3, 2, '200 { rutina vigente con sus ejercicios }', 'return'],
  ];
  const rows = messages.length;
  const h = y0 + rows * step + 30;
  const s = new Svg(w, h, { title: 'SQ 1 Secuencia del flujo crítico', desc: 'Aprobación del catálogo, recomendación e inicio de la rutina' });
  s.text(30, 24, 'SQ 1 · Diagrama de secuencia: aprobación del catálogo, recomendación e inicio de la rutina', { size: 20, weight: 700, anchor: 'start' });
  s.text(30, 46, 'Flujo crítico de FitGoal · RF001 a RF008, RF010 · cada tramo cruza HTTPS con JWT y se registra en la auditoría', { size: 13, anchor: 'start', fill: THEME.sub });

  names.forEach(([n, sub], i) => {
    s.rect(xs[i] - 100, 70, 200, 54, { r: 8, fill: i < 2 ? THEME.blue.fill : i === 5 ? THEME.teal.fill : THEME.amber.fill, stroke: i < 2 ? THEME.blue.stroke : i === 5 ? THEME.teal.stroke : THEME.amber.stroke, sw: 1.8 });
    s.add('nodes', textBlock(xs[i], 90, n, { size: 14, weight: 700 }).svg);
    s.add('nodes', textBlock(xs[i], 109, sub, { size: 11.5, fill: THEME.sub }).svg);
    s.line(xs[i], 124, xs[i], h - 40, { stroke: '#a9b4bf', sw: 1.4, dash: '6 5', layer: 'bg' });
  });
  let y = y0;
  let n = 0;
  for (const item of messages) {
    if (!Array.isArray(item)) {
      s.rect(20, y - 22, w - 40, 30, { r: 6, fill: '#eef2f6', stroke: THEME.faint, sw: 1.2, layer: 'bg' });
      s.add('bg', textBlock(34, y - 7, item.phase, { size: 13.5, weight: 700, anchor: 'start', fill: THEME.ink }).svg);
      y += step - 8;
      continue;
    }
    const [from, to, text, kind] = item;
    n += 1;
    const x1 = xs[from];
    const x2 = xs[to];
    y += 2;
    s.rect(x2 - 5, y - 11, 10, 22, { r: 1, fill: '#fff', stroke: THEME.line, sw: 1.2, layer: 'bg' });
    if (kind === 'self') {
      s.edge([[x1 + 5, y - 8], [x1 + 60, y - 8], [x1 + 60, y + 8], [x1 + 5, y + 8]], { color: THEME.line, head: 'fill', width: 1.6, radius: 4 });
      s.add('top', textBlock(x1 + 70, y, `${n}. ${text}`, { size: 12, anchor: 'start', maxWidth: 560, fill: THEME.ink }).svg);
    } else {
      const dir = x2 > x1 ? 1 : -1;
      const ret = kind === 'return';
      s.edge([[x1 + dir * 5, y], [x2 - dir * 5, y]], { color: ret ? THEME.sub : THEME.line, dash: ret, head: ret ? 'open' : 'fill', width: 1.7, radius: 0 });
      const lx = (x1 + x2) / 2;
      const width = Math.abs(x2 - x1) - 24;
      const block = textBlock(lx, y - 9, `${n}. ${text}`, { size: 12, maxWidth: width, fill: THEME.ink, valign: 'bottom', halo: true });
      s.add('top', block.svg);
    }
    y += step - 2;
  }
  return { id: 'SQ1', file: 'sq-1-secuencia', title: 'SQ 1 Secuencia del flujo crítico', svg: s.toString(), width: w, height: h };
}
