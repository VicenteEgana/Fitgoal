// Elementos BPMN 2.0 sobre el kit SVG: pool con carriles, tareas, subprocesos, eventos, compuertas y flujos.
import { Svg, THEME, port, route, textBlock, wrap } from './svg.mjs';

const gearPath = (cx, cy, outer = 7.2, inner = 5.2, teeth = 8) => {
  const pts = [];
  for (let i = 0; i < teeth * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const a0 = (Math.PI * 2 * i) / (teeth * 2) - Math.PI / (teeth * 4);
    const a1 = (Math.PI * 2 * (i + 1)) / (teeth * 2) - Math.PI / (teeth * 4);
    pts.push([cx + radius * Math.cos(a0), cy + radius * Math.sin(a0)], [cx + radius * Math.cos(a1), cy + radius * Math.sin(a1)]);
  }
  return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} Z`;
};

export class Bpmn {
  /**
   * @param {object} o
   * @param {string} o.code       código del proceso (P1, P2...)
   * @param {string} o.title      título del diagrama
   * @param {number} o.width
   * @param {{name:string,h:number}[]} o.lanes
   * @param {string} o.pool       nombre del pool
   */
  constructor({ code, title, width, lanes, pool = 'FitGoal', subtitle = '', sheet = false }) {
    this.sheet = sheet; // true: cada banda es un subproceso expandido (sin pool ni carriles)
    this.pad = 14;
    this.header = 54;
    this.labelW = sheet ? 0 : 34;
    this.poolW = sheet ? 0 : 30;
    this.lanes = lanes.map(lane => ({ ...lane }));
    let y = this.header + this.pad;
    this.x0 = this.pad;
    this.x1 = width - this.pad;
    this.contentX = this.x0 + this.poolW + this.labelW;
    for (const lane of this.lanes) { lane.y = y; lane.cy = y + lane.h / 2; y += lane.h; }
    this.bottom = y;
    this.legendH = 52;
    this.height = y + this.pad + this.legendH;
    this.svg = new Svg(width, this.height, { title: `${code} ${title}`, desc: subtitle });
    this.width = width;
    this.drawFrame({ code, title, pool, subtitle });
  }

  drawFrame({ code, title, pool, subtitle }) {
    const s = this.svg;
    s.text(this.pad + 2, 22, `${code} · ${title}`, { size: 20, weight: 700, anchor: 'start', fill: THEME.ink });
    if (subtitle) s.text(this.pad + 2, 44, subtitle, { size: 13, anchor: 'start', fill: THEME.sub });
    if (this.sheet) {
      for (const lane of this.lanes) {
        s.rect(this.x0, lane.y + 4, this.x1 - this.x0, lane.h - 8, { r: 14, fill: '#fffdf6', stroke: '#b58a1c', sw: 2.4, layer: 'bg' });
        s.add('bg', textBlock(this.x0 + 14, lane.y + 24, lane.name, { size: 15, weight: 700, anchor: 'start', fill: '#6b4a05' }).svg);
        if (lane.note) s.add('bg', textBlock(this.x1 - 14, lane.y + 24, lane.note, { size: 12.5, anchor: 'end', fill: THEME.sub, italic: true }).svg);
      }
      return;
    }
    const top = this.lanes[0].y;
    s.rect(this.x0, top, this.x1 - this.x0, this.bottom - top, { r: 4, fill: '#fff', stroke: THEME.line, sw: 1.8, layer: 'bg' });
    s.rect(this.x0, top, this.poolW, this.bottom - top, { r: 0, fill: '#e8edf2', stroke: THEME.line, sw: 1.8, layer: 'bg' });
    const mid = (top + this.bottom) / 2;
    s.add('bg', `<g transform="translate(${this.x0 + this.poolW / 2},${mid}) rotate(-90)">${textBlock(0, 0, pool, { size: 14, weight: 700 }).svg}</g>`);
    this.lanes.forEach((lane, i) => {
      s.rect(this.x0 + this.poolW, lane.y, this.x1 - this.x0 - this.poolW, lane.h, { r: 0, fill: i % 2 ? '#fbfcfd' : '#ffffff', stroke: THEME.line, sw: 1.2, layer: 'bg' });
      s.rect(this.x0 + this.poolW, lane.y, this.labelW, lane.h, { r: 0, fill: '#f1f4f7', stroke: THEME.line, sw: 1.2, layer: 'bg' });
      const lines = wrap(lane.name, lane.h - 14, 13, 700);
      s.add('bg', `<g transform="translate(${this.x0 + this.poolW + this.labelW / 2},${lane.cy}) rotate(-90)">${textBlock(0, 0, lines.join('\n'), { size: 13, weight: 700, lh: 1.1 }).svg}</g>`);
    });
  }

  laneY(index, dy = 0) { return this.lanes[index].cy + dy + (this.sheet ? 14 : 0); }

  /** Evento límite (temporizador) adherido al borde inferior o superior de una tarea. */
  boundary(task, side = 'b', type = 'timer', { off = 0, label, labelDx = 0 } = {}) {
    const s = this.svg;
    const [x, y] = port(task, side, off);
    s.ellipse(x, y, 14, 14, { fill: '#fff', stroke: THEME.line, sw: 1.5, dash: '4 3' });
    s.ellipse(x, y, 11, 11, { fill: 'none', stroke: THEME.line, sw: 1.1, dash: '4 3' });
    if (type === 'timer') s.add('nodes', `<circle cx="${x}" cy="${y}" r="6.5" fill="none" stroke="${THEME.line}" stroke-width="1.2"/><path d="M${x},${y - 4.5} V${y} L${x + 3},${y + 2.2}" fill="none" stroke="${THEME.line}" stroke-width="1.2"/>`);
    if (label) s.add('nodes', textBlock(x + labelDx, y + (side === 'b' ? 28 : -28), label, { size: 12, maxWidth: 120, fill: THEME.sub }).svg);
    return { cx: x, cy: y, w: 28, h: 28, kind: 'event' };
  }

  task(lane, cx, label, { dy = 0, w = 138, h = 62, type = 'user', fill, stroke, size = 13.5 } = {}) {
    const s = this.svg;
    const iconPad = type === 'none' ? 0 : 14;
    const lines = wrap(label, w - 18 - iconPad, size);
    const need = lines.length * size * 1.2 + 16;
    const height = Math.max(h, need);
    const cy = this.laneY(lane, dy);
    const auto = type === 'service';
    s.rect(cx - w / 2, cy - height / 2, w, height, { r: 10, fill: fill ?? (auto ? '#e6effa' : '#ffffff'), stroke: stroke ?? (auto ? '#2f6db5' : THEME.line), sw: 1.8 });
    s.add('nodes', textBlock(cx + iconPad / 2, cy + 2, lines.join('\n'), { size, lh: 1.2 }).svg);
    const ix = cx - w / 2 + 9;
    const iy = cy - height / 2 + 9;
    if (type === 'user') s.add('nodes', `<g fill="none" stroke="${THEME.sub}" stroke-width="1.2"><circle cx="${ix + 5}" cy="${iy + 3}" r="2.8"/><path d="M${ix - 0.5},${iy + 12} Q${ix - 0.5},${iy + 6.5} ${ix + 5},${iy + 6.5} Q${ix + 10.5},${iy + 6.5} ${ix + 10.5},${iy + 12} Z"/></g>`);
    if (type === 'service') s.add('nodes', `<path d="${gearPath(ix + 5, iy + 6, 6.2, 4.4)}" fill="#fff" stroke="#2f6db5" stroke-width="1.1"/><circle cx="${ix + 5}" cy="${iy + 6}" r="1.8" fill="none" stroke="#2f6db5" stroke-width="1.1"/>`);
    return { cx, cy, w, h: height, kind: 'task' };
  }

  sub(lane, cx, label, { dy = 0, w = 150, h = 72, size = 13.5, fill = '#fffbe9', stroke = '#b58a1c' } = {}) {
    const s = this.svg;
    const lines = wrap(label, w - 16, size);
    const height = Math.max(h, lines.length * size * 1.2 + 34);
    const cy = this.laneY(lane, dy);
    s.rect(cx - w / 2, cy - height / 2, w, height, { r: 10, fill, stroke, sw: 2.4 });
    s.add('nodes', textBlock(cx, cy - 6, lines.join('\n'), { size, lh: 1.2, weight: 600 }).svg);
    s.add('nodes', `<rect x="${cx - 8}" y="${cy + height / 2 - 20}" width="16" height="16" fill="#fff" stroke="${stroke}" stroke-width="1.5"/><path d="M${cx - 4},${cy + height / 2 - 12} h8 M${cx},${cy + height / 2 - 16} v8" stroke="${stroke}" stroke-width="1.6"/>`);
    return { cx, cy, w, h: height, kind: 'sub' };
  }

  /** Subproceso expandido: contenedor dentro de un carril; devuelve el rectángulo. */
  container(x, y, w, h, label, { stroke = '#b58a1c', fill = '#fffdf5' } = {}) {
    const s = this.svg;
    s.rect(x, y, w, h, { r: 12, fill, stroke, sw: 2.2, layer: 'bg' });
    s.add('bg', textBlock(x + 12, y + 14, label, { size: 13.5, weight: 700, anchor: 'start', fill: '#6b4a05' }).svg);
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }

  eventLabel(cx, cy, label, side, maxWidth = 120) {
    if (!label) return;
    if (side === 'right') this.svg.add('nodes', textBlock(cx + 24, cy, label, { size: 12.5, maxWidth: 150, fill: THEME.sub, anchor: 'start' }).svg);
    else this.svg.add('nodes', textBlock(cx, cy + 22, label, { size: 12.5, maxWidth, fill: THEME.sub, valign: 'top' }).svg);
  }

  start(lane, cx, label, { dy = 0, side, type } = {}) {
    const cy = this.laneY(lane, dy);
    this.svg.ellipse(cx, cy, 16, 16, { fill: '#e5f4ea', stroke: '#2f8a4f', sw: 2 });
    if (type === 'message') this.svg.add('nodes', `<rect x="${cx - 7}" y="${cy - 5}" width="14" height="10" fill="none" stroke="#2f8a4f" stroke-width="1.3"/><path d="M${cx - 7},${cy - 5} L${cx},${cy + 1} L${cx + 7},${cy - 5}" fill="none" stroke="#2f8a4f" stroke-width="1.3"/>`);
    this.eventLabel(cx, cy, label, side, 110);
    return { cx, cy, w: 32, h: 32, kind: 'event' };
  }

  end(lane, cx, label, { dy = 0, color = '#c0394b', side } = {}) {
    const cy = this.laneY(lane, dy);
    this.svg.ellipse(cx, cy, 16, 16, { fill: '#fbe6e8', stroke: color, sw: 4 });
    this.eventLabel(cx, cy, label, side, 130);
    return { cx, cy, w: 32, h: 32, kind: 'event' };
  }

  event(lane, cx, type, label, { dy = 0, side } = {}) {
    const s = this.svg;
    const cy = this.laneY(lane, dy);
    s.ellipse(cx, cy, 16, 16, { fill: '#fff', stroke: THEME.line, sw: 1.6 });
    s.ellipse(cx, cy, 12.5, 12.5, { fill: 'none', stroke: THEME.line, sw: 1.2 });
    if (type === 'message') s.add('nodes', `<rect x="${cx - 7}" y="${cy - 5}" width="14" height="10" fill="none" stroke="${THEME.line}" stroke-width="1.3"/><path d="M${cx - 7},${cy - 5} L${cx},${cy + 1} L${cx + 7},${cy - 5}" fill="none" stroke="${THEME.line}" stroke-width="1.3"/>`);
    if (type === 'timer') s.add('nodes', `<circle cx="${cx}" cy="${cy}" r="7.5" fill="none" stroke="${THEME.line}" stroke-width="1.3"/><path d="M${cx},${cy - 5} V${cy} L${cx + 3.5},${cy + 2.5}" fill="none" stroke="${THEME.line}" stroke-width="1.3"/>`);
    this.eventLabel(cx, cy, label, side, 130);
    return { cx, cy, w: 32, h: 32, kind: 'event' };
  }

  gateway(lane, cx, type = 'xor', label, { dy = 0, labelDx = 0, labelDy = -27, labelAnchor = 'middle', labelW = 120 } = {}) {
    const s = this.svg;
    const cy = this.laneY(lane, dy);
    const r = 23;
    s.add('nodes', `<path d="M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} Z" fill="#fff8e1" stroke="#b58a1c" stroke-width="2"/>`);
    if (type === 'xor') s.add('nodes', `<path d="M${cx - 8},${cy - 8} L${cx + 8},${cy + 8} M${cx + 8},${cy - 8} L${cx - 8},${cy + 8}" stroke="#b58a1c" stroke-width="3" stroke-linecap="round"/>`);
    else if (type === 'and') s.add('nodes', `<path d="M${cx - 10},${cy} H${cx + 10} M${cx},${cy - 10} V${cy + 10}" stroke="#b58a1c" stroke-width="3" stroke-linecap="round"/>`);
    if (label) s.add('nodes', textBlock(cx + labelDx, cy + labelDy, label, { size: 12.5, maxWidth: labelW, weight: 600, anchor: labelAnchor, fill: '#6b4a05', valign: 'bottom' }).svg);
    return { cx, cy, w: r * 2, h: r * 2, kind: 'gateway' };
  }

  dataStore(lane, cx, label, { dy = 0, w = 70, h = 52 } = {}) {
    const s = this.svg;
    const cy = this.laneY(lane, dy);
    const x = cx - w / 2;
    const y = cy - h / 2;
    s.add('nodes', `<path d="M${x},${y + 8} Q${cx},${y - 4} ${x + w},${y + 8} V${y + h - 8} Q${cx},${y + h + 4} ${x},${y + h - 8} Z" fill="#eef2f6" stroke="${THEME.line}" stroke-width="1.6"/><path d="M${x},${y + 8} Q${cx},${y + 20} ${x + w},${y + 8}" fill="none" stroke="${THEME.line}" stroke-width="1.4"/>`);
    s.add('nodes', textBlock(cx, cy + 9, label, { size: 11.5, lh: 1.1, maxWidth: w - 6 }).svg);
    return { cx, cy, w, h, kind: 'data' };
  }

  note(x, y, text, { w = 170, size = 12 } = {}) {
    const lines = wrap(text, w - 14, size);
    const h = lines.length * size * 1.2 + 12;
    this.svg.add('nodes', `<path d="M${x + 12},${y} H${x} V${y + h} H${x + 12}" fill="none" stroke="${THEME.sub}" stroke-width="1.3"/>`);
    this.svg.add('nodes', textBlock(x + 18, y + h / 2, lines.join('\n'), { size, anchor: 'start', fill: THEME.sub, lh: 1.2 }).svg);
    return { x, y, w, h };
  }

  /** Flujo de secuencia. da/db: lados de salida y entrada (r l t b). */
  flow(a, da, b, db, { label, dash = false, msg = false, ...rest } = {}) {
    const pa = port(a, da, rest.offA ?? 0);
    const pb = port(b, db, rest.offB ?? 0);
    const pts = route(pa, da, pb, db, rest);
    this.svg.edge(pts, { color: msg ? THEME.sub : THEME.line, dash: dash || msg, head: msg ? 'open' : 'fill', tail: msg ? 'circle' : 'none', label, labelSeg: rest.labelSeg ?? 0, labelT: rest.labelT ?? 0.5, labelDx: rest.labelDx ?? 0, labelDy: rest.labelDy ?? -11, labelMaxWidth: rest.labelMaxWidth, labelAnchor: rest.labelAnchor });
    return this;
  }

  legend() {
    const s = this.svg;
    const y = this.bottom + this.pad + 16;
    let x = this.contentX;
    const item = (draw, text, advance) => { draw(x); s.add('nodes', textBlock(x + 24, y, text, { size: 12, anchor: 'start', fill: THEME.sub }).svg); x += advance; };
    item(cx => s.ellipse(cx + 8, y, 8, 8, { fill: '#e5f4ea', stroke: '#2f8a4f', sw: 2 }), 'Inicio', 80);
    item(cx => s.ellipse(cx + 8, y, 8, 8, { fill: '#fbe6e8', stroke: '#c0394b', sw: 3.5 }), 'Fin', 66);
    item(cx => s.rect(cx - 2, y - 9, 22, 18, { r: 5, fill: '#fff', stroke: THEME.line, sw: 1.5 }), 'Tarea manual / de usuario', 190);
    item(cx => s.rect(cx - 2, y - 9, 22, 18, { r: 5, fill: '#e6effa', stroke: '#2f6db5', sw: 1.5 }), 'Tarea automática (servicio)', 200);
    item(cx => s.rect(cx - 2, y - 9, 22, 18, { r: 5, fill: '#fffbe9', stroke: '#b58a1c', sw: 2.2 }), 'Subproceso', 118);
    item(cx => s.add('nodes', `<path d="M${cx + 8},${y - 10} L${cx + 18},${y} L${cx + 8},${y + 10} L${cx - 2},${y} Z" fill="#fff8e1" stroke="#b58a1c" stroke-width="1.6"/>`), 'Compuerta exclusiva (XOR)', 190);
    item(cx => s.add('nodes', `<path d="M${cx + 8},${y - 10} L${cx + 18},${y} L${cx + 8},${y + 10} L${cx - 2},${y} Z" fill="#fff8e1" stroke="#b58a1c" stroke-width="1.6"/><path d="M${cx + 3},${y} h10 M${cx + 8},${y - 5} v10" stroke="#b58a1c" stroke-width="1.8"/>`), 'Compuerta paralela (AND)', 180);
    return this;
  }

  toString() { this.legend(); return this.svg.toString(); }
}
