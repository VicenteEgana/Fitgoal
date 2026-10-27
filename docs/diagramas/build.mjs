// Genera todos los diagramas (SVG + PNG). Uso: node build.mjs [filtro]
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderAll } from './kit/render.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const modules = [
  ['./src/er.mjs', ['erOverview', 'erViews']],
  ['./src/usecases.mjs', ['useCasesParticipant', 'useCasesStaff']],
  ['./src/arch.mjs', ['context']],
  ['./src/components.mjs', ['components']],
  ['./src/network.mjs', ['topology', 'infrastructure']],
  ['./src/integrated.mjs', ['integrated']],
  ['./src/behavior.mjs', ['states', 'sequence']],
  ['./src/p1.mjs', ['p1', 'p1Sub']],
  ['./src/p2.mjs', ['p2', 'p2Sub']],
  ['./src/p3.mjs', ['p3', 'p3Sub']],
  ['./src/p4.mjs', ['p4', 'p4Sub']],
  ['./src/p5.mjs', ['p5', 'p5Sub']],
];

const filter = process.argv[2];
const items = [];
for (const [path, names] of modules) {
  const mod = await import(path);
  for (const name of names) {
    const produced = mod[name]();
    for (const diagram of Array.isArray(produced) ? produced : [produced]) {
      if (filter && !diagram.file.includes(filter) && !diagram.id.toLowerCase().includes(filter.toLowerCase())) continue;
      items.push(diagram);
    }
  }
}
mkdirSync(`${here}out/svg`, { recursive: true });
mkdirSync(`${here}out/png`, { recursive: true });
for (const item of items) {
  item.svgPath = `${here}out/svg/${item.file}.svg`;
  item.pngPath = `${here}out/png/${item.file}.png`;
  writeFileSync(item.svgPath, item.svg, 'utf8');
}
await renderAll(items);
for (const item of items) console.log(`${item.id.padEnd(5)} ${item.width}x${item.height}  ${item.pngPath.replace(here, '')}`);
