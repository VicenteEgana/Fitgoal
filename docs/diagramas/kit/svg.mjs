// Primitivas SVG compartidas por todos los diagramas (sin dependencias externas).
export const THEME = {
  font: "'Segoe UI', Arial, Helvetica, sans-serif",
  ink: '#1b2733',
  sub: '#4a5b6c',
  line: '#52616f',
  faint: '#d5dde5',
  bg: '#ffffff',
  // familias de color: relleno suave + borde
  blue: { fill: '#e6effa', stroke: '#2f6db5', ink: '#173f6e' },
  green: { fill: '#e5f4ea', stroke: '#2f8a4f', ink: '#1a5530' },
  amber: { fill: '#fdf1d8', stroke: '#c58a12', ink: '#6b4a05' },
  rose: { fill: '#fbe6e8', stroke: '#c0394b', ink: '#7a1e2c' },
  violet: { fill: '#efe8f8', stroke: '#7a4cb8', ink: '#47267a' },
  teal: { fill: '#e0f4f3', stroke: '#1f8a87', ink: '#0f5654' },
  gray: { fill: '#f1f4f7', stroke: '#7b8794', ink: '#3b4856' },
  white: { fill: '#ffffff', stroke: '#52616f', ink: '#1b2733' },
};

export const esc = value => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const CHAR_W = 0.53; // ancho medio de carácter / tamaño de fuente (Segoe UI / Arial)
const BOLD_W = 0.57;
export const textWidth = (text, size, weight = 400) => String(text).length * size * (weight >= 600 ? BOLD_W : CHAR_W);

export function wrap(text, maxWidth, size, weight = 400) {
  const perChar = size * (weight >= 600 ? BOLD_W : CHAR_W);
  const maxChars = Math.max(4, Math.floor(maxWidth / perChar));
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      if (!current) current = word;
      else if ((current + ' ' + word).length <= maxChars) current += ' ' + word;
      else { lines.push(current); current = word; }
    }
    lines.push(current);
  }
  return lines;
}

/** Texto multilínea. valign: middle (y es el centro del bloque) | top | bottom. */
export function textBlock(x, y, text, { size = 14, weight = 400, anchor = 'middle', fill = THEME.ink, lh = 1.22, maxWidth, italic = false, valign = 'middle', halo = false, family } = {}) {
  const lines = maxWidth ? wrap(text, maxWidth, size, weight) : String(text).split('\n');
  const step = size * lh;
  const total = step * lines.length;
  let first = y;
  if (valign === 'middle') first = y - total / 2 + step / 2;
  else if (valign === 'top') first = y + step / 2;
  else first = y - total + step / 2;
  const style = halo ? ` style="paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round"` : '';
  const spans = lines.map((line, index) => `<text x="${x}" y="${(first + index * step).toFixed(1)}" text-anchor="${anchor}" dominant-baseline="central" font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''}${family ? ` font-family="${family}"` : ''} fill="${fill}"${style}>${esc(line)}</text>`);
  return { svg: spans.join(''), lines, height: total };
}

function roundedPath(points, radius = 7) {
  if (points.length < 3) return `M${points.map(point => point.join(',')).join(' L')}`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const sx = cx - ((cx - px) / inLen) * r;
    const sy = cy - ((cy - py) / inLen) * r;
    const ex = cx + ((nx - cx) / outLen) * r;
    const ey = cy + ((ny - cy) / outLen) * r;
    d += ` L${sx.toFixed(1)},${sy.toFixed(1)} Q${cx},${cy} ${ex.toFixed(1)},${ey.toFixed(1)}`;
  }
  const last = points.at(-1);
  return d + ` L${last[0]},${last[1]}`;
}

export class Svg {
  constructor(width, height, { title = '', desc = '' } = {}) {
    this.width = width;
    this.height = height;
    this.title = title;
    this.desc = desc;
    this.layers = { bg: [], edges: [], nodes: [], top: [] };
    this.markers = new Map();
  }

  add(layer, markup) { this.layers[layer].push(markup); return this; }

  marker(kind, color) {
    const id = `m-${kind}-${color.replace('#', '')}`;
    if (!this.markers.has(id)) {
      let shape;
      if (kind === 'fill') shape = `<marker id="${id}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M1,1.5 L11,6 L1,10.5 Z" fill="${color}" stroke="${color}" stroke-linejoin="round"/></marker>`;
      else if (kind === 'open') shape = `<marker id="${id}" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M1.5,1.5 L10.5,6 L1.5,10.5" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></marker>`;
      else if (kind === 'hollow') shape = `<marker id="${id}" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto"><path d="M1.5,1.5 L12.5,7 L1.5,12.5 Z" fill="#fff" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/></marker>`;
      else if (kind === 'circle') shape = `<marker id="${id}" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><circle cx="6" cy="6" r="4" fill="#fff" stroke="${color}" stroke-width="1.5"/></marker>`;
      else if (kind === 'diamond') shape = `<marker id="${id}" viewBox="0 0 16 12" refX="1" refY="6" markerWidth="16" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M1,6 L8,1.5 L15,6 L8,10.5 Z" fill="${color}" stroke="${color}" stroke-linejoin="round"/></marker>`;
      this.markers.set(id, shape);
    }
    return id;
  }

  /** Conector ortogonal. kind: seq | msg | dash | assoc | dep | plain */
  edge(points, { color = THEME.line, width = 1.6, head = 'fill', tail = 'none', dash = false, label, labelSeg = 0, labelT = 0.5, labelDx = 0, labelDy = -10, labelSize = 12.5, labelFill, radius = 7, labelAnchor = 'middle', labelMaxWidth } = {}) {
    const attrs = [`fill="none"`, `stroke="${color}"`, `stroke-width="${width}"`, 'stroke-linejoin="round"'];
    if (dash) attrs.push(`stroke-dasharray="${dash === true ? '7 5' : dash}"`);
    if (head !== 'none') attrs.push(`marker-end="url(#${this.marker(head, color)})"`);
    if (tail !== 'none') attrs.push(`marker-start="url(#${this.marker(tail, color)})"`);
    this.add('edges', `<path d="${roundedPath(points, radius)}" ${attrs.join(' ')}/>`);
    if (label) {
      const [a, b] = [points[labelSeg], points[labelSeg + 1]];
      const lx = a[0] + (b[0] - a[0]) * labelT + labelDx;
      const ly = a[1] + (b[1] - a[1]) * labelT + labelDy;
      this.add('top', textBlock(lx, ly, label, { size: labelSize, fill: labelFill ?? color, halo: true, anchor: labelAnchor, maxWidth: labelMaxWidth }).svg);
    }
    return this;
  }

  rect(x, y, w, h, { r = 8, fill = '#fff', stroke = THEME.line, sw = 1.6, dash, layer = 'nodes', opacity } = {}) {
    this.add(layer, `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}${opacity ? ` fill-opacity="${opacity}"` : ''}/>`);
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }

  ellipse(cx, cy, rx, ry, { fill = '#fff', stroke = THEME.line, sw = 1.6, layer = 'nodes', dash } = {}) {
    this.add(layer, `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  }

  line(x1, y1, x2, y2, { stroke = THEME.line, sw = 1.5, dash, layer = 'edges' } = {}) {
    this.add(layer, `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  }

  path(d, { fill = 'none', stroke = THEME.line, sw = 1.5, layer = 'nodes', dash } = {}) {
    this.add(layer, `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  }

  text(x, y, text, opts = {}) {
    const block = textBlock(x, y, text, opts);
    this.add(opts.layer ?? 'top', block.svg);
    return block;
  }

  toString() {
    const defs = this.markers.size ? `<defs>${[...this.markers.values()].join('')}</defs>` : '';
    const title = this.title ? `<title>${esc(this.title)}</title>` : '';
    const desc = this.desc ? `<desc>${esc(this.desc)}</desc>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}" font-family="${THEME.font}" role="img">${title}${desc}${defs}<rect width="${this.width}" height="${this.height}" fill="${THEME.bg}"/>${this.layers.bg.join('')}${this.layers.edges.join('')}${this.layers.nodes.join('')}${this.layers.top.join('')}</svg>`;
  }
}

/** Punto de anclaje en un lado de un rectángulo {cx,cy,w,h}. side: l r t b; off desplaza a lo largo del lado. */
export function port(shape, side, off = 0) {
  const { cx, cy, w, h } = shape;
  if (side === 'r') return [cx + w / 2, cy + off];
  if (side === 'l') return [cx - w / 2, cy + off];
  if (side === 't') return [cx + off, cy - h / 2];
  return [cx + off, cy + h / 2];
}

/** Ruta ortogonal entre dos puntos; da = lado de salida, db = lado de entrada. */
export function route(a, da, b, db, { mx, my, via } = {}) {
  if (via) return [a, ...via, b];
  const [ax, ay] = a;
  const [bx, by] = b;
  const key = da + db;
  if (key === 'rl') return Math.abs(ay - by) < 1 ? [a, b] : [a, [mx ?? (ax + bx) / 2, ay], [mx ?? (ax + bx) / 2, by], b];
  if (key === 'bt' || key === 'tb') return Math.abs(ax - bx) < 1 ? [a, b] : [a, [ax, my ?? (ay + by) / 2], [bx, my ?? (ay + by) / 2], b];
  if (key === 'rt' || key === 'rb') return [a, [bx, ay], b];
  if (key === 'bl' || key === 'tl') return [a, [ax, by], b];
  if (key === 'br' || key === 'tr') return [a, [ax, by], b];
  if (key === 'lr') return Math.abs(ay - by) < 1 ? [a, b] : [a, [mx ?? (ax + bx) / 2, ay], [mx ?? (ax + bx) / 2, by], b];
  if (key === 'rr') { const x = mx ?? Math.max(ax, bx) + 24; return [a, [x, ay], [x, by], b]; }
  if (key === 'll') { const x = mx ?? Math.min(ax, bx) - 24; return [a, [x, ay], [x, by], b]; }
  if (key === 'tt') { const y = my ?? Math.min(ay, by) - 24; return [a, [ax, y], [bx, y], b]; }
  if (key === 'bb') { const y = my ?? Math.max(ay, by) + 24; return [a, [ax, y], [bx, y], b]; }
  return [a, b];
}
