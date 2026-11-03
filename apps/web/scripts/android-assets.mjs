// Genera los iconos de la app de Android desde public/brand/noutlife-app-icon.svg. El fondo del icono
// adaptativo es vectorial (res/drawable/ic_launcher_background.xml), con el mismo degradado del SVG.
// Uso (desde apps/web): node scripts/android-assets.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const res = (file) => fileURLToPath(new URL(`../android/app/src/main/res/${file}`, import.meta.url));
const icon = readFileSync(new URL('../public/brand/noutlife-app-icon.svg', import.meta.url), 'utf8');
const defs = icon.match(/<defs>.*<\/defs>/)[0];
const leaves = icon.match(/scale\(0\.73\)">(.*?)<\/g>/)[0].replace(/^scale\(0\.73\)">|<\/g>$/g, '');

// La N mide 670×786. Android recorta el icono en un círculo de 66 dp sobre un lienzo de 108 dp: al 46 % de
// alto, las esquinas de la N quedan dentro con cualquier máscara del fabricante.
const k = (0.46 * 1024) / 786;
const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs}<g transform="translate(${(1024 - 670 * k) / 2} ${(1024 - 786 * k) / 2}) scale(${k})">${leaves}</g></svg>`;
const round = icon.replace('rx="229"', 'rx="512"');

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  writeFileSync(res(file), await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}

for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  mkdirSync(res(`mipmap-${density}`), { recursive: true });
  await png(foreground, 108 * scale, `mipmap-${density}/ic_launcher_foreground.png`);
  // Android 7: sin iconos adaptativos.
  await png(icon, 48 * scale, `mipmap-${density}/ic_launcher.png`);
  await png(round, 48 * scale, `mipmap-${density}/ic_launcher_round.png`);
}
await browser.close();
