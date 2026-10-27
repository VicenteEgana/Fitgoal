// Primitivas UML: actores, casos de uso, componentes, nodos de despliegue, estados y secuencia.
import { THEME, textBlock, wrap } from './svg.mjs';

export function actor(svg, x, y, label, { color = THEME.ink, sub } = {}) {
  svg.add('nodes', `<g stroke="${color}" stroke-width="2" fill="none"><circle cx="${x}" cy="${y - 28}" r="11" fill="#fff"/><path d="M${x},${y - 17} V${y + 14} M${x - 20},${y - 6} H${x + 20} M${x},${y + 14} L${x - 15},${y + 40} M${x},${y + 14} L${x + 15},${y + 40}"/></g>`);
  svg.add('nodes', textBlock(x, y + 62, label, { size: 13.5, weight: 700, maxWidth: 120, valign: 'top' }).svg);
  if (sub) svg.add('nodes', textBlock(x, y + 98, sub, { size: 11.5, fill: THEME.sub, maxWidth: 120, valign: 'top' }).svg);
  return { cx: x, cy: y, w: 40, h: 80, x: x - 20, y: y - 40 };
}

/** Punto de la elipse en dirección a (tx, ty). */
export function ellipseEdge(e, tx, ty) {
  const dx = tx - e.cx;
  const dy = ty - e.cy;
  const k = 1 / Math.sqrt((dx / e.rx) ** 2 + (dy / e.ry) ** 2);
  return [e.cx + dx * k, e.cy + dy * k];
}

export function usecase(svg, cx, cy, id, text, { rx = 150, ry = 31, fill = '#fff', stroke = THEME.line, size = 13 } = {}) {
  svg.ellipse(cx, cy, rx, ry, { fill, stroke, sw: 1.7 });
  const lines = wrap(text, rx * 1.55, size);
  const block = textBlock(cx, cy + 6, lines.join('\n'), { size, lh: 1.15 });
  svg.add('nodes', block.svg);
  svg.add('nodes', textBlock(cx, cy - ry + 12, id, { size: 10.5, weight: 700, fill: THEME.sub }).svg);
  return { cx, cy, rx, ry, w: rx * 2, h: ry * 2 };
}

export function boundary(svg, x, y, w, h, title) {
  svg.rect(x, y, w, h, { r: 10, fill: '#fcfdfe', stroke: THEME.line, sw: 1.8, layer: 'bg' });
  svg.add('bg', textBlock(x + 16, y + 20, title, { size: 15, weight: 700, anchor: 'start' }).svg);
}

export function assoc(svg, a, e, { color = THEME.line } = {}) {
  const [ex, ey] = ellipseEdge(e, a.cx, a.cy);
  const ax = a.cx + (ex > a.cx ? 20 : -20);
  svg.edge([[ax, a.cy], [ex, ey]], { color, head: 'none', width: 1.5, radius: 0 });
}

/** include / extend entre elipses (flecha punteada con etiqueta). */
export function relate(svg, from, to, kind) {
  const [x1, y1] = ellipseEdge(from, to.cx, to.cy);
  const [x2, y2] = ellipseEdge(to, from.cx, from.cy);
  const label = kind === 'include' ? '«include»' : '«extend»';
  svg.edge([[x1, y1], [x2, y2]], { color: THEME.sub, dash: '7 5', head: 'open', label, labelDy: -9, labelSize: 11.5, radius: 0, labelFill: THEME.sub });
}

/** Componente UML con icono y lista de responsabilidades. */
export function component(svg, x, y, w, h, title, { stereotype = 'component', lines = [], color = THEME.blue, size = 13.5, sub = 12, dash } = {}) {
  svg.rect(x, y, w, h, { r: 8, fill: color.fill, stroke: color.stroke, sw: 1.9, dash });
  svg.add('nodes', `<g fill="#fff" stroke="${color.stroke}" stroke-width="1.4"><rect x="${x + w - 30}" y="${y + 8}" width="20" height="14"/><rect x="${x + w - 34}" y="${y + 11}" width="8" height="3.6"/><rect x="${x + w - 34}" y="${y + 16.5}" width="8" height="3.6"/></g>`);
  svg.add('nodes', textBlock(x + 12, y + 14, `«${stereotype}»`, { size: 10.5, anchor: 'start', fill: color.ink, italic: true }).svg);
  svg.add('nodes', textBlock(x + 12, y + 33, title, { size, weight: 700, anchor: 'start', fill: color.ink, maxWidth: w - 24 }).svg);
  if (lines.length) {
    const startY = y + 52 + (wrap(title, w - 24, size, 700).length - 1) * size * 1.2;
    svg.add('nodes', textBlock(x + 12, startY, lines.join('\n'), { size: sub, anchor: 'start', fill: THEME.ink, lh: 1.28, valign: 'top', maxWidth: w - 24 }).svg);
  }
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/** Nodo de despliegue UML (caja 3D). */
export function nodeBox(svg, x, y, w, h, title, { stereotype = 'device', color = THEME.gray, lines = [], depth = 12 } = {}) {
  const d = depth;
  svg.add('bg', `<path d="M${x},${y + d} L${x + d},${y} H${x + w + d} L${x + w},${y + d} Z" fill="${color.stroke}" fill-opacity="0.35" stroke="${color.stroke}" stroke-width="1.6" stroke-linejoin="round"/>`);
  svg.add('bg', `<path d="M${x + w},${y + d} L${x + w + d},${y} V${y + h - d} L${x + w},${y + h} Z" fill="${color.stroke}" fill-opacity="0.5" stroke="${color.stroke}" stroke-width="1.6" stroke-linejoin="round"/>`);
  svg.rect(x, y + d, w, h - d, { r: 0, fill: color.fill, stroke: color.stroke, sw: 1.8, layer: 'bg' });
  svg.add('bg', textBlock(x + 12, y + d + 13, `«${stereotype}»`, { size: 10.5, anchor: 'start', fill: color.ink, italic: true }).svg);
  const titleLines = wrap(title, w - 24, 14.5, 700).length;
  svg.add('bg', textBlock(x + 12, y + d + 32, title, { size: 14.5, weight: 700, anchor: 'start', fill: color.ink, maxWidth: w - 24 }).svg);
  if (lines.length) svg.add('bg', textBlock(x + 12, y + d + 48 + (titleLines - 1) * 17.7, lines.join('\n'), { size: 12, anchor: 'start', fill: THEME.ink, lh: 1.28, valign: 'top', maxWidth: w - 24 }).svg);
  return { x, y: y + d, w, h: h - d, cx: x + w / 2, cy: y + d + (h - d) / 2 };
}

/** Artefacto o caja simple con título y líneas (para el interior de nodos). */
export function artifact(svg, x, y, w, h, title, lines = [], { color = THEME.white, size = 12.5, fill } = {}) {
  svg.rect(x, y, w, h, { r: 6, fill: fill ?? color.fill, stroke: color.stroke, sw: 1.5 });
  svg.add('nodes', textBlock(x + 10, y + 14, title, { size, weight: 700, anchor: 'start', fill: color.ink, maxWidth: w - 20 }).svg);
  if (lines.length) svg.add('nodes', textBlock(x + 10, y + 28, lines.join('\n'), { size: 11.5, anchor: 'start', fill: THEME.ink, lh: 1.25, valign: 'top', maxWidth: w - 20 }).svg);
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/** Asociaciones actor–casos de uso en estilo «bus»: una troncal vertical con ramales cortos a cada elipse. */
export function bus(svg, a, trunkX, targets, side = 'left') {
  const ys = targets.map(t => t.cy);
  const top = Math.min(a.cy, ...ys);
  const bottom = Math.max(a.cy, ...ys);
  const ax = side === 'left' ? a.cx + 20 : a.cx - 20;
  svg.edge([[ax, a.cy], [trunkX, a.cy]], { color: THEME.line, head: 'none', width: 1.5, radius: 0 });
  svg.edge([[trunkX, top], [trunkX, bottom]], { color: THEME.line, head: 'none', width: 1.5, radius: 0 });
  for (const t of targets) {
    const ex = side === 'left' ? t.cx - t.rx : t.cx + t.rx;
    svg.edge([[trunkX, t.cy], [ex, t.cy]], { color: THEME.line, head: 'none', width: 1.5, radius: 0 });
  }
}
