// Genera le icone PNG dall'SVG usando Chromium (Playwright). Uso: node scripts/make-icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [size, file, bg] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png', '#13233D']]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${bg ?? 'transparent'}">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/${file}`, omitBackground: !bg });
}
await browser.close();
console.log('icone generate');
