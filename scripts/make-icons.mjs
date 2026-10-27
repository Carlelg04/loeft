// Laver app-ikonerne i public/ ud fra én SVG. Kør: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BG = '#121418';
const FG = '#5ad48a';

function glyph(scale = 1) {
  const t = (256 * (1 - scale)).toFixed(1);
  return `<g transform="translate(${t} ${t}) scale(${scale})" fill="${FG}">
    <rect x="72" y="244" width="368" height="24" rx="12"/>
    <rect x="150" y="156" width="44" height="200" rx="14"/>
    <rect x="318" y="156" width="44" height="200" rx="14"/>
    <rect x="114" y="190" width="30" height="132" rx="11"/>
    <rect x="368" y="190" width="30" height="132" rx="11"/>
  </g>`;
}

const svg = (radius, scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${radius}" fill="${BG}"/>${glyph(scale)}</svg>`;

const files = [
  { name: 'icon-192.png', size: 192, svg: svg(112, 1) },
  { name: 'icon-512.png', size: 512, svg: svg(112, 1) },
  { name: 'icon-maskable-512.png', size: 512, svg: svg(0, 0.72) },
  { name: 'apple-touch-icon.png', size: 180, svg: svg(0, 0.86) },
];

writeFileSync('public/favicon.svg', svg(112, 1));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const f of files) {
  await page.setViewportSize({ width: f.size, height: f.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${f.svg.replace('<svg ', `<svg width="${f.size}" height="${f.size}" `)}</body></html>`);
  await page.locator('svg').screenshot({ path: `public/${f.name}`, omitBackground: true });
}
await browser.close();
console.log('ikoner lavet');
