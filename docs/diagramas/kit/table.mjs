// Tabla simple dibujada en SVG (celdas con texto ajustado) para usar dentro de los diagramas.
import { THEME, textBlock, wrap } from './svg.mjs';

/**
 * @param {import('./svg.mjs').Svg} svg
 * @param {number} x
 * @param {number} y
 * @param {number[]} widths  ancho de cada columna
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {number} alto total dibujado
 */
export function drawTable(svg, x, y, widths, headers, rows, { size = 12, headSize = 12.5, pad = 8, headFill = '#2f3e4e', zebra = '#f6f8fa', badgeCol } = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const lh = size * 1.25;
  const headH = headSize * 1.25 + pad * 2;
  svg.add('nodes', `<path d="M${x},${y + headH} V${y + 6} Q${x},${y} ${x + 6},${y} H${x + total - 6} Q${x + total},${y} ${x + total},${y + 6} V${y + headH} Z" fill="${headFill}"/>`);
  let cx = x;
  headers.forEach((head, i) => {
    svg.add('nodes', textBlock(cx + pad, y + headH / 2, head, { size: headSize, weight: 700, anchor: 'start', fill: '#fff' }).svg);
    cx += widths[i];
  });
  let cy = y + headH;
  rows.forEach((row, r) => {
    const cells = row.map((cell, i) => wrap(cell, widths[i] - pad * 2, size, badgeCol === i ? 700 : 400));
    const height = Math.max(...cells.map(lines => lines.length)) * lh + pad * 2;
    svg.add('nodes', `<rect x="${x}" y="${cy}" width="${total}" height="${height}" fill="${r % 2 ? zebra : '#fff'}" stroke="${THEME.faint}" stroke-width="1"/>`);
    let px = x;
    cells.forEach((lines, i) => {
      const bold = badgeCol === i;
      svg.add('nodes', textBlock(px + pad, cy + height / 2, lines.join('\n'), { size, anchor: 'start', weight: bold ? 700 : 400, lh: 1.25 }).svg);
      px += widths[i];
    });
    cy += height;
  });
  svg.add('nodes', `<rect x="${x}" y="${y}" width="${total}" height="${cy - y}" fill="none" stroke="${THEME.line}" stroke-width="1.4" rx="6"/>`);
  return cy - y;
}

/** Medición previa para reservar alto sin dibujar. */
export function tableHeight(widths, headers, rows, { size = 12, headSize = 12.5, pad = 8 } = {}) {
  const lh = size * 1.25;
  let total = headSize * 1.25 + pad * 2;
  for (const row of rows) total += Math.max(...row.map((cell, i) => wrap(cell, widths[i] - pad * 2, size).length)) * lh + pad * 2;
  return total;
}
