// Convierte SVG a PNG con el Chrome instalado (playwright-core, sin descargar navegadores).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);

export async function renderAll(items, { scale = 2 } = {}) {
  const executablePath = CHROME_CANDIDATES.find(path => existsSync(path));
  if (!executablePath) throw new Error('No se encontró Chrome/Edge; define CHROME_PATH.');
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ deviceScaleFactor: scale });
    const page = await context.newPage();
    for (const { svg, width, height, pngPath } of items) {
      await page.setViewportSize({ width: Math.ceil(width), height: Math.ceil(height) });
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}svg{display:block}</style>${svg}`);
      await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width, height } });
    }
  } finally {
    await browser.close();
  }
}
