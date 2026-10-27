// Diagramas entidad-relación (notación pata de gallo) generados desde schema/schema.mjs.
import { Svg, THEME, textBlock, textWidth } from '../kit/svg.mjs';
import { TABLES, MODULES, byName } from '../schema/schema.mjs';

const W = 300;
const HEAD = 34;
const ROW = 19.5;
const moduleColor = id => THEME[MODULES.find(m => m.id === id).color];

/** Relaciones derivadas de las claves foráneas del esquema (se omiten las autorreferencias). */
export function relations() {
  const list = [];
  for (const t of TABLES) {
    for (const col of t.columns) {
      if (!col.fk || col.fk.t === t.name) continue;
      list.push({ child: t.name, cols: [col.name], parent: col.fk.t, parentCols: [col.fk.c], optional: !col.nn, unique: Boolean(col.uq) || (col.pk && t.columns.filter(x => x.pk).length === 1) });
    }
    for (const fk of t.fks ?? []) {
      const optional = fk.cols.some(name => !t.columns.find(col => col.name === name).nn);
      const first = t.columns.find(col => col.name === fk.cols[0]);
      list.push({ child: t.name, cols: fk.cols, parent: fk.ref, parentCols: fk.refCols, optional, unique: Boolean(first.uq) });
    }
  }
  return list;
}

class Entity {
  constructor(svg, name, x, y, { stub = false, rows } = {}) {
    this.svg = svg;
    this.t = byName[name];
    this.x = x;
    this.y = y;
    this.stub = stub;
    this.cols = stub ? this.t.columns.filter(col => rows.includes(col.name)) : this.t.columns;
    this.w = W;
    this.h = HEAD + this.cols.length * ROW + 10;
    this.draw();
  }

  rowY(colName) {
    const index = this.cols.findIndex(col => col.name === colName);
    return this.y + HEAD + (index < 0 ? 0 : index) * ROW + ROW / 2 + 3;
  }

  draw() {
    const s = this.svg;
    const color = moduleColor(this.t.module);
    s.rect(this.x, this.y, this.w, this.h, { r: 8, fill: '#fff', stroke: color.stroke, sw: this.stub ? 1.4 : 2, dash: this.stub ? '6 4' : undefined });
    s.add('nodes', `<path d="M${this.x},${this.y + HEAD} V${this.y + 8} Q${this.x},${this.y} ${this.x + 8},${this.y} H${this.x + this.w - 8} Q${this.x + this.w},${this.y} ${this.x + this.w},${this.y + 8} V${this.y + HEAD} Z" fill="${this.stub ? color.fill : color.stroke}"/>`);
    s.add('nodes', textBlock(this.x + 12, this.y + HEAD / 2, this.t.name, { size: 15, weight: 700, anchor: 'start', fill: this.stub ? color.ink : '#fff' }).svg);
    s.add('nodes', textBlock(this.x + this.w - 12, this.y + HEAD / 2, this.stub ? 'ver otra vista' : this.t.es, { size: 11.5, anchor: 'end', fill: this.stub ? THEME.sub : '#fff', italic: true }).svg);
    this.cols.forEach((col, i) => {
      const cy = this.y + HEAD + i * ROW + ROW / 2 + 3;
      if (i % 2 === 1) s.add('nodes', `<rect x="${this.x + 1}" y="${cy - ROW / 2}" width="${this.w - 2}" height="${ROW}" fill="#f6f8fa"/>`);
      const isFk = Boolean(col.fk) || (this.t.fks ?? []).some(fk => fk.cols.includes(col.name));
      const tags = [col.pk ? 'PK' : null, isFk ? 'FK' : null, col.uq && !col.pk ? 'UQ' : null].filter(Boolean);
      s.add('nodes', textBlock(this.x + 8, cy, tags.join(' '), { size: 10, weight: 700, anchor: 'start', fill: col.pk ? '#b3261e' : isFk ? '#2f6db5' : '#2f8a4f' }).svg);
      s.add('nodes', textBlock(this.x + 44, cy, col.name, { size: 12.5, anchor: 'start', weight: col.pk ? 700 : 400 }).svg);
      s.add('nodes', textBlock(this.x + this.w - 8, cy, col.type + (col.nn ? '' : '?'), { size: 11.5, anchor: 'end', fill: THEME.sub }).svg);
    });
  }

  side(side, colName) {
    if (side === 'l') return [this.x, this.rowY(colName)];
    if (side === 'r') return [this.x + this.w, this.rowY(colName)];
    if (side === 't') return [this.x + this.w / 2, this.y];
    return [this.x + this.w / 2, this.y + this.h];
  }
}

function endMark(svg, [x, y], dir, kind, color) {
  const u = { r: [1, 0], l: [-1, 0], t: [0, -1], b: [0, 1] }[dir];
  const n = [-u[1], u[0]];
  const P = (a, b) => [(x + u[0] * a + n[0] * b).toFixed(1), (y + u[1] * a + n[1] * b).toFixed(1)];
  const seg = (a1, b1, a2, b2) => { const [x1, y1] = P(a1, b1); const [x2, y2] = P(a2, b2); svg.add('top', `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.6"/>`); };
  const circle = a => { const [cx, cy] = P(a, 0); svg.add('top', `<circle cx="${cx}" cy="${cy}" r="4.2" fill="#fff" stroke="${color}" stroke-width="1.5"/>`); };
  if (kind === 'many') { seg(14, 0, 0, -7); seg(14, 0, 0, 0); seg(14, 0, 0, 7); circle(20); }
  else if (kind === 'one') { seg(9, -6.5, 9, 6.5); seg(14, -6.5, 14, 6.5); }
  else if (kind === 'zeroOne') { seg(9, -6.5, 9, 6.5); circle(16); }
}

function connect(svg, ents, rel, route = {}, spread = 0) {
  const child = ents[rel.child];
  const parent = ents[route.parentKey ?? rel.parent];
  const childCol = rel.cols[0];
  const parentCol = rel.parentCols[0];
  let sideC = route.sideC;
  let sideP = route.sideP;
  if (!sideC) {
    if (child.x + child.w + 40 <= parent.x) { sideC = 'r'; sideP = 'l'; }
    else if (parent.x + parent.w + 40 <= child.x) { sideC = 'l'; sideP = 'r'; }
    else if (child.y > parent.y) { sideC = 't'; sideP = 'b'; }
    else { sideC = 'b'; sideP = 't'; }
  }
  const a = child.side(sideC, childCol);
  const b = parent.side(sideP, parentCol);
  if (sideP === 'l' || sideP === 'r') b[1] += spread; else b[0] += spread;
  let pts;
  if (route.via) pts = [a, ...route.via, b];
  else if ((sideC === 'r' && sideP === 'l') || (sideC === 'l' && sideP === 'r')) {
    const mx = route.mx ?? (a[0] + b[0]) / 2;
    pts = Math.abs(a[1] - b[1]) < 1 ? [a, b] : [a, [mx, a[1]], [mx, b[1]], b];
  } else {
    const ox = route.ox ?? 0;
    const my = route.my ?? (a[1] + b[1]) / 2;
    pts = Math.abs(a[0] + ox - b[0]) < 1 ? [[a[0] + ox, a[1]], [b[0], b[1]]] : [[a[0] + ox, a[1]], [a[0] + ox, my], [b[0], my], b];
  }
  const color = route.color ?? THEME.line;
  svg.edge(pts, { color, head: 'none', width: 1.5, radius: 6 });
  endMark(svg, pts[0], sideC, rel.unique ? 'zeroOne' : 'many', color);
  endMark(svg, pts.at(-1), sideP, rel.optional ? 'zeroOne' : 'one', color);
  if (route.label) {
    const [lx, ly] = pts[0];
    const dx = sideC === 'r' ? 30 : sideC === 'l' ? -30 : 8;
    const dy = sideC === 't' ? -26 : sideC === 'b' ? 26 : -9;
    svg.add('top', textBlock(lx + dx + (route.labelDx ?? 0), ly + dy + (route.labelDy ?? 0), route.label, { size: 11, fill: THEME.sub, italic: true, halo: true, anchor: sideC === 'l' ? 'end' : sideC === 'r' ? 'start' : 'middle' }).svg);
  }
}

function legend(svg, y, x0 = 30) {
  let x = x0;
  const item = (text, advance, draw) => { draw?.(x); svg.add('top', textBlock(x + (draw ? 34 : 0), y, text, { size: 11.5, anchor: 'start', fill: THEME.sub }).svg); x += advance; };
  item('PK clave primaria', 130);
  item('FK clave foránea', 128);
  item('UQ valor único', 112);
  item('? admite nulo', 108);
  item('exactamente uno', 150, cx => endMark(svg, [cx + 4, y], 'r', 'one', THEME.line));
  item('cero o uno', 120, cx => endMark(svg, [cx + 4, y], 'r', 'zeroOne', THEME.line));
  item('cero o muchos', 130, cx => endMark(svg, [cx + 4, y], 'r', 'many', THEME.line));
}

function view({ code, title, subtitle, width, height, place, routes = {}, stubs = {}, notes = [] }) {
  const svg = new Svg(width, height, { title: `${code} ${title}`, desc: subtitle });
  svg.text(30, 24, `${code} · ${title}`, { size: 20, weight: 700, anchor: 'start' });
  svg.text(30, 46, subtitle, { size: 13, anchor: 'start', fill: THEME.sub });
  const ents = {};
  for (const [key, [x, y]] of Object.entries(place)) {
    const stub = stubs[key];
    const name = stub ? (stub.table ?? key) : key;
    ents[key] = new Entity(svg, name, x, y, stub ? { stub: true, rows: stub.rows } : {});
  }
  const arrivals = new Map();
  const planned = [];
  for (const rel of relations()) {
    const childKey = Object.keys(ents).find(k => (stubs[k]?.table ?? k) === rel.child && !stubs[k]);
    if (!childKey) continue;
    const parentCandidates = Object.keys(ents).filter(k => (stubs[k]?.table ?? k) === rel.parent);
    if (!parentCandidates.length) continue;
    const key = `${rel.child}.${rel.cols[0]}>${rel.parent}`;
    const route = routes[key] ?? {};
    if (route.skip) continue;
    const parentKey = route.parentKey ?? parentCandidates[0];
    const slot = `${parentKey}.${rel.parentCols[0]}.${route.sideP ?? 'auto'}`;
    const list = arrivals.get(slot) ?? [];
    list.push(planned.length);
    arrivals.set(slot, list);
    planned.push({ rel, route: { ...route, parentKey }, slot });
  }
  for (const item of planned) {
    const list = arrivals.get(item.slot);
    const spread = (list.indexOf(planned.indexOf(item)) - (list.length - 1) / 2) * 6.5;
    connect(svg, ents, item.rel, item.route, spread);
  }
  for (const n of notes) {
    const lines = textBlock(n.x, n.y, n.text, { size: 12, anchor: 'start', maxWidth: n.w ?? 280, fill: THEME.sub, valign: 'top', lh: 1.25 });
    svg.add('top', lines.svg);
  }
  legend(svg, height - 20);
  return svg;
}

const stubRows = (...rows) => ({ rows });

export function erViews() {
  const out = [];

  // 1 · Identidad, consentimiento y derechos
  out.push({
    id: 'ER1', file: 'er-1-identidad', title: 'ER 1 Identidad, consentimiento y derechos',
    ...(() => {
      const svg = view({
        code: 'ER 1', title: 'Identidad, consentimiento y derechos',
        subtitle: 'Cuentas con rol, sesiones renovables, consentimientos con versión de política y solicitudes de derechos · RF009, RF010, RNF002',
        width: 1180, height: 700,
        place: { auth_sessions: [30, 80], consents: [30, 340], users: [440, 80], data_requests: [850, 80] },
        routes: {
          'data_requests.resolved_by>users': { label: 'resolved_by', mx: 810 },
          'data_requests.user_id>users': { label: 'user_id', mx: 790 },
        },
        notes: [{ x: 30, y: 600, w: 380, text: 'auth_sessions.replaced_by apunta a la sesión que la reemplazó al rotar el refresh token (autorreferencia, no dibujada).' }, { x: 440, y: 420, w: 360, text: 'users.id y users.role forman una clave única que permite a otras tablas verificar el rol real con una clave foránea compuesta.' }],
      });
      return { svg: svg.toString(), width: svg.width, height: svg.height };
    })(),
  });

  // 2 · Catálogo profesional y reglas
  out.push({
    id: 'ER2', file: 'er-2-catalogo', title: 'ER 2 Catálogo profesional y reglas',
    ...(() => {
      const svg = view({
        code: 'ER 2', title: 'Catálogo profesional y reglas',
        subtitle: 'Ejercicios, rutinas prearmadas (con su división de la semana) y reglas de recomendación aprobadas por el preparador físico · RF004, RF006',
        width: 1110, height: 1130,
        place: { exercises: [30, 80], template_exercises: [405, 80], routine_templates: [780, 80], rule_versions: [30, 700], users: [405, 700] },
        stubs: { users: stubRows('id', 'role') },
        routes: {
          'exercises.created_by>users': { label: 'created_by', mx: 375 },
          'exercises.approved_by>users': { label: 'approved_by', mx: 360 },
          'rule_versions.author_id>users': { label: 'author_id', mx: 375 },
          'rule_versions.approved_by>users': { label: 'approved_by', mx: 360 },
          'routine_templates.author_id>users': { label: 'author_id', mx: 745 },
          'routine_templates.approved_by>users': { label: 'approved_by', mx: 730 },
        },
        notes: [
          { x: 405, y: 480, w: 330, text: 'Los ejercicios, las rutinas y las reglas solo pasan a «approved» con el rol competente: lo exige una clave foránea compuesta (approved_by, approved_by_role) hacia users(id, role). Las personas solo ven lo aprobado.' },
          { x: 780, y: 760, w: 300, text: 'Cada rutina tiene su división (full body, upper/lower o push/pull/legs) y el nombre de cada sesión en session_labels; un disparador exige que cada ejercicio vaya en una sesión con nombre.' },
        ],
      });
      return { svg: svg.toString(), width: svg.width, height: svg.height };
    })(),
  });

  // 2b · Catálogo nutricional
  out.push({
    id: 'ER2b', file: 'er-2b-alimentacion', title: 'ER 2b Catálogo nutricional',
    ...(() => {
      const svg = view({
        code: 'ER 2b', title: 'Catálogo nutricional',
        subtitle: 'Alimentos por 100 g y pautas de 7 días aprobados por la nutricionista; la API ajusta los gramos a las calorías de cada persona, que puede cambiar un alimento que no tiene · RF003, RF005, RF006',
        width: 1200, height: 900,
        place: { foods: [30, 80], meal_plan_items: [430, 80], meal_plan_templates: [830, 80], meal_plan_swaps: [430, 300], users: [830, 560] },
        stubs: { users: stubRows('id', 'role') },
        routes: {
          'foods.author_id>users': { label: 'author_id', sideC: 'b', sideP: 'b', ox: -45, my: 690 },
          'foods.approved_by>users': { label: 'approved_by', sideC: 'b', sideP: 'b', ox: 45, my: 705 },
          'meal_plan_items.food_id>foods': { mx: 395 },
          'meal_plan_templates.author_id>users': { label: 'author_id', sideC: 'b', sideP: 't', ox: -40 },
          'meal_plan_templates.approved_by>users': { label: 'approved_by', sideC: 'b', sideP: 't', ox: 40 },
          'meal_plan_swaps.user_id>users': { label: 'user_id', mx: 780 },
          'meal_plan_swaps.food_id>foods': { mx: 365 },
          'meal_plan_swaps.template_id>meal_plan_items': { sideC: 't', sideP: 'b' },
        },
        notes: [
          { x: 30, y: 735, w: 360, text: 'Las verduras no se escalan: quedan fijas como base libre. El resto de los gramos se ajusta a las calorías del objetivo con las reglas nutricionales aprobadas (rule_versions, ámbito «nutricion»).' },
          { x: 430, y: 500, w: 320, text: 'meal_plan_swaps: la persona cambia un alimento que no tiene por otro aprobado del mismo grupo que la misma pauta incluye (lo exige un disparador). No guarda gramos: la API calcula los que aportan la misma energía.' },
          { x: 830, y: 735, w: 340, text: 'Un disparador impide aprobar una pauta con alimentos sin aprobar, cambiar los gramos de una pauta que ya no es borrador y borrar una pauta aprobada.' },
        ],
      });
      return { svg: svg.toString(), width: svg.width, height: svg.height };
    })(),
  });

  // 3 · Perfil y rutinas del participante
  out.push({
    id: 'ER3', file: 'er-3-planes', title: 'ER 3 Perfil y rutinas del participante',
    ...(() => {
      const svg = view({
        code: 'ER 3', title: 'Perfil y rutinas del participante',
        subtitle: 'Perfil versionado → rutina que la persona inicia (recomendada o propia) → ejercicios y sesiones · RF002, RF004, RF005',
        width: 1520, height: 900,
        place: { profile_versions: [30, 80], users_a: [30, 600], routine_templates: [450, 70], user_plans: [450, 260], rule_versions: [450, 640], user_plan_exercises: [870, 260], exercises: [870, 70] },
        stubs: { users_a: { table: 'users', rows: ['id', 'role'] }, routine_templates: { rows: ['id'] }, rule_versions: { rows: ['id'] }, exercises: { rows: ['id'] } },
        routes: {
          'profile_versions.user_id>users': { parentKey: 'users_a', label: 'user_id' },
          'user_plans.user_id>users': { parentKey: 'users_a', label: 'user_id', mx: 400 },
          'user_plans.profile_version_id>profile_versions': { mx: 390 },
          'user_plans.template_id>routine_templates': { sideC: 't', sideP: 'b', label: 'template_id' },
          'user_plans.rule_version_id>rule_versions': { sideC: 'b', sideP: 't', label: 'rule_version_id' },
          'user_plan_exercises.plan_id>user_plans': { mx: 810 },
          'user_plan_exercises.exercise_id>exercises': { sideC: 't', sideP: 'b', label: 'exercise_id' },
        },
        notes: [
          { x: 30, y: 780, w: 380, text: 'Reglas que aplica la base de datos: solo se inicia una plantilla o se usa un ejercicio aprobados; el perfil de la rutina pertenece al mismo participante; una rutina iniciada no se modifica (solo pasa a «reemplazada»); un solo plan vigente por participante.' },
          { x: 870, y: 560, w: 330, text: 'Una rutina recomendada es una copia de la plantilla aprobada: guarda su versión y la de las reglas usadas. Una rutina propia reúne ejercicios aprobados elegidos por la persona.' },
        ],
      });
      return { svg: svg.toString(), width: svg.width, height: svg.height };
    })(),
  });

  // 4 · Seguimiento, avisos y trazabilidad
  out.push({
    id: 'ER4', file: 'er-4-seguimiento', title: 'ER 4 Seguimiento, avisos y trazabilidad',
    ...(() => {
      const svg = view({
        code: 'ER 4', title: 'Seguimiento, avisos y trazabilidad',
        subtitle: 'Sesiones y adherencia, peso con consentimiento, avisos internos, auditoría de solo anexado y eventos seudonimizados · RF007, RF008, RF010 · K2, K3',
        width: 1180, height: 860,
        place: { weight_records: [30, 80], notifications: [30, 280], audit_log: [30, 510], users: [440, 80], user_plans: [850, 80], training_sessions: [850, 270], usage_events: [850, 560] },
        stubs: { users: stubRows('id'), user_plans: stubRows('id', 'user_id') },
        routes: {
          'weight_records.user_id>users': { mx: 390 },
          'notifications.user_id>users': { mx: 400 },
          'audit_log.actor_id>users': { mx: 410, label: 'actor_id' },
        },
        notes: [
          { x: 440, y: 300, w: 360, text: 'training_sessions guarda la agenda de la rutina vigente. Una sesión sin completed_at cuenta como no realizada en la adherencia (K3). Si la persona la mueve a otro día, rescheduled_from guarda la fecha original. La clave compuesta (plan_id, user_id) asegura que la rutina es del mismo participante.' },
          { x: 440, y: 520, w: 360, text: 'audit_log es de solo anexado: la base rechaza UPDATE y DELETE. usage_events no tiene clave foránea hacia users: usa un seudónimo (HMAC-SHA256) y el vínculo con la cuenta queda separado.' },
        ],
      });
      return { svg: svg.toString(), width: svg.width, height: svg.height };
    })(),
  });

  return out;
}

/** Vista general: solo nombres de tablas por módulo y las relaciones principales del flujo. */
export function erOverview() {
  const width = 1500;
  const height = 800;
  const svg = new Svg(width, height, { title: 'ER 0 Vista general del modelo de datos', desc: '20 tablas en 4 módulos' });
  svg.text(30, 24, 'ER 0 · Vista general del modelo de datos', { size: 20, weight: 700, anchor: 'start' });
  svg.text(30, 46, '20 tablas en 4 módulos. Las flechas muestran el flujo: catálogo aprobado → rutina del participante → sesiones; las claves hacia users se resumen en la nota lateral.', { size: 13, anchor: 'start', fill: THEME.sub });
  const chip = (name, x, y, w = 214) => {
    const t = byName[name];
    const color = moduleColor(t.module);
    svg.rect(x, y, w, 46, { r: 9, fill: '#fff', stroke: color.stroke, sw: 2 });
    svg.add('nodes', textBlock(x + 12, y + 15, name, { size: 14, weight: 700, anchor: 'start', fill: color.ink }).svg);
    svg.add('nodes', textBlock(x + 12, y + 33, `${t.es} · ${t.columns.length} col.`, { size: 11.5, anchor: 'start', fill: THEME.sub }).svg);
    return { x, y, w, h: 46, cx: x + w / 2, cy: y + 23 };
  };
  const group = (id, x, y, w, h) => {
    const m = MODULES.find(item => item.id === id);
    const color = THEME[m.color];
    svg.rect(x, y, w, h, { r: 14, fill: color.fill, stroke: color.stroke, sw: 1.6, layer: 'bg', opacity: 0.55 });
    svg.add('bg', textBlock(x + 16, y + 20, m.name, { size: 14.5, weight: 700, anchor: 'start', fill: color.ink }).svg);
  };
  // módulos
  group('identidad', 30, 80, 270, 440);
  group('planes', 340, 80, 540, 440);
  group('catalogo', 920, 80, 550, 440);
  group('seguimiento', 340, 560, 1130, 200);
  const e = {};
  e.users = chip('users', 56, 120, 218);
  e.auth_sessions = chip('auth_sessions', 56, 200, 218);
  e.consents = chip('consents', 56, 280, 218);
  e.data_requests = chip('data_requests', 56, 360, 218);
  e.profile_versions = chip('profile_versions', 366, 130, 214);
  e.user_plans = chip('user_plans', 366, 290, 214);
  e.user_plan_exercises = chip('user_plan_exercises', 640, 290, 214);
  e.routine_templates = chip('routine_templates', 640, 130, 214);
  e.rule_versions = chip('rule_versions', 640, 410, 214);
  e.meal_plan_swaps = chip('meal_plan_swaps', 366, 410, 230);
  e.exercises = chip('exercises', 946, 130, 214);
  e.template_exercises = chip('template_exercises', 946, 230, 214);
  e.foods = chip('foods', 946, 330, 214);
  e.meal_plan_templates = chip('meal_plan_templates', 1206, 130, 240);
  e.meal_plan_items = chip('meal_plan_items', 1206, 230, 240);
  e.training_sessions = chip('training_sessions', 366, 620, 214);
  e.weight_records = chip('weight_records', 640, 620, 214);
  e.notifications = chip('notifications', 914, 620, 214);
  e.audit_log = chip('audit_log', 1188, 620, 214);
  e.usage_events = chip('usage_events', 1188, 680, 214);
  // flujo principal
  svg.edge([[e.profile_versions.cx, e.profile_versions.y + 46], [e.user_plans.cx, e.user_plans.y]], { color: THEME.line, head: 'fill' });
  svg.edge([[e.routine_templates.x, e.routine_templates.cy], [610, e.routine_templates.cy], [610, e.user_plans.y - 12], [e.user_plans.cx + 60, e.user_plans.y - 12], [e.user_plans.cx + 60, e.user_plans.y]], { color: THEME.line, head: 'fill' });
  svg.edge([[e.user_plans.x + e.user_plans.w, e.user_plans.cy], [e.user_plan_exercises.x, e.user_plan_exercises.cy]], { color: THEME.line, head: 'fill' });
  svg.edge([[e.rule_versions.x, e.rule_versions.cy], [610, e.rule_versions.cy], [610, e.user_plans.y + 76], [e.user_plans.cx + 60, e.user_plans.y + 76], [e.user_plans.cx + 60, e.user_plans.y + 46]], { color: THEME.line, head: 'fill' });
  svg.edge([[e.template_exercises.x, e.template_exercises.cy], [900, e.template_exercises.cy], [900, e.routine_templates.cy], [e.routine_templates.x + e.routine_templates.w, e.routine_templates.cy]], { color: THEME.line, head: 'fill' });
  svg.edge([[e.exercises.cx, e.exercises.y + 46], [e.template_exercises.cx, e.template_exercises.y]], { color: THEME.line, head: 'fill' });
  svg.edge([[e.foods.x + e.foods.w, e.foods.cy], [1183, e.foods.cy], [1183, e.meal_plan_items.cy], [e.meal_plan_items.x, e.meal_plan_items.cy]], { color: THEME.line, head: 'fill' });
  svg.edge([[e.meal_plan_items.cx, e.meal_plan_items.y], [e.meal_plan_templates.cx, e.meal_plan_templates.y + 46]], { color: THEME.line, head: 'fill' });
  svg.edge([[e.user_plans.x, e.user_plans.cy], [352, e.user_plans.cy], [352, 540], [e.training_sessions.cx, 540], [e.training_sessions.cx, e.training_sessions.y]], { color: THEME.line, head: 'fill' });
  svg.edge([[e.meal_plan_items.cx, e.meal_plan_items.y + 46], [e.meal_plan_items.cx, 505], [e.meal_plan_swaps.cx, 505], [e.meal_plan_swaps.cx, e.meal_plan_swaps.y + 46]], { color: THEME.line, head: 'fill' });
  // hacia users
  svg.edge([[274, e.users.cy], [340, e.users.cy]], { color: THEME.sub, head: 'fill', dash: '6 5' });
  svg.text(30, 640, 'Casi todas las tablas referencian a users (línea punteada): titular de los datos, autor o aprobador. No se dibujan una a una para no saturar la vista; el detalle está en las vistas ER 1 a ER 4.', { size: 12, fill: THEME.sub, anchor: 'start', maxWidth: 280, valign: 'top' });
  svg.text(946, 440, 'Claves foráneas compuestas: la base de datos verifica el rol del aprobador y que el perfil y las sesiones pertenezcan al mismo participante de la rutina.', { size: 12, fill: THEME.sub, anchor: 'start', maxWidth: 440, valign: 'top' });
  svg.text(366, 780, 'usage_events no referencia a users: se vincula por seudónimo (HMAC) para mantener separada la identidad.', { size: 12, fill: THEME.sub, anchor: 'start' });
  return { id: 'ER0', file: 'er-0-general', title: 'ER 0 Vista general del modelo de datos', svg: svg.toString(), width, height };
}
