// Genera los iconos transparentes (solo la N) y la og-image de NoutLife.
// Uso (desde apps/web): node scripts/brand-assets.mjs public  → luego borra public/_check.png
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const out = process.argv[2];
mkdirSync(join(out, 'icons'), { recursive: true });
mkdirSync(join(out, 'brand'), { recursive: true });

const PATHS = `<path fill="url(#c)" d="M474 198C581.2 230.2 670.1 305.6 669.0 500.0L669 760C669 776 666 783 662 785L500 600L474 489Z"/><path fill="url(#a)" d="M1 0C124.1 148.2 331.6 191.3 474.0 489.0L662 785C314.2 532.2 633.0 710.9 118.0 399.0C-22.3 290.2 2.6 200.5 0.0 150.0L0 4Z"/><path fill="url(#b)" d="M2 271C93.4 468.0 228.1 416.0 251.0 545.0L251 743C76.1 695.7 -13.2 587.2 0.0 380.0L0 275Z"/>`;
// light/dark = tokens.css (Aurora); mid = punto medio que se lee en pestañas claras y oscuras.
const V = {
  light: { a: ['#5fae97', '#2f7565', '#0a3a33', '#05302b'], b: ['#8ec7ad', '#2c7362'], c: ['#4f9c84', '#2a6f60', '#06302b'] },
  dark: { a: ['#a8d9c1', '#5aa58c', '#2a7262', '#1a5547'], b: ['#c4e6d4', '#5aa58c'], c: ['#86c5aa', '#4c957d', '#1a5547'] },
  mid: { a: ['#7cc4a8', '#3f8c77', '#1d5c4f', '#134a3f'], b: ['#a6d6bf', '#3f8c77'], c: ['#6ab39a', '#3a8270', '#134a3f'] },
};
const grads = (v, p = '') => `<linearGradient id="${p}a" gradientUnits="userSpaceOnUse" x1="60" y1="40" x2="650" y2="770"><stop offset="0" stop-color="${v.a[0]}"/><stop offset=".35" stop-color="${v.a[1]}"/><stop offset=".72" stop-color="${v.a[2]}"/><stop offset="1" stop-color="${v.a[3]}"/></linearGradient><linearGradient id="${p}b" gradientUnits="userSpaceOnUse" x1="30" y1="290" x2="250" y2="740"><stop offset="0" stop-color="${v.b[0]}"/><stop offset="1" stop-color="${v.b[1]}"/></linearGradient><linearGradient id="${p}c" gradientUnits="userSpaceOnUse" x1="520" y1="210" x2="669" y2="780"><stop offset="0" stop-color="${v.c[0]}"/><stop offset=".45" stop-color="${v.c[1]}"/><stop offset="1" stop-color="${v.c[2]}"/></linearGradient>`;
// La N mide 670×786: se centra en un cuadrado con `pad` de margen (fracción del lado).
const square = (pad) => { const s = 786 / (1 - 2 * pad); return `${-(s - 670) / 2} ${-(s - 786) / 2} ${s} ${s}`; };
const markSvg = (v, size, pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${square(pad)}"><defs>${grads(v)}</defs>${PATHS}</svg>`;

// icon.svg: favicon vectorial que cambia de tono con el tema del navegador.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${square(0.02)}" role="img" aria-label="NoutLife"><title>NoutLife</title><style>.d{display:none}@media (prefers-color-scheme:dark){.l{display:none}.d{display:inline}}</style><defs>${grads(V.light, 'l')}${grads(V.dark, 'd')}</defs><g class="l">${PATHS.replace(/url\(#/g, 'url(#l')}</g><g class="d">${PATHS.replace(/url\(#/g, 'url(#d')}</g></svg>\n`;
writeFileSync(join(out, 'icon.svg'), iconSvg);

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  if (file) writeFileSync(join(out, file), buf);
  return buf;
}

// PWA «any» y notificaciones: 8 % de aire.
for (const s of [72, 96, 128, 144, 152, 192, 384, 512]) await png(markSvg(V.mid, s, 0.08), s, `icons/icon-${s}.png`);
await png(markSvg(V.mid, 512, 0.08), 512, 'icon.png');
// Apple Touch Icon 180×180.
const apple = await png(markSvg(V.mid, 180, 0.1), 180, 'apple-touch-icon.png');
writeFileSync(join(out, 'brand/apple-touch-icon.png'), apple);
// Pestaña: casi sin margen para que la N se lea a 16 px.
const fav = {};
for (const s of [16, 32, 48]) fav[s] = await png(markSvg(V.mid, s, 0.02), s);
writeFileSync(join(out, 'brand/favicon-32.png'), fav[32]);
writeFileSync(join(out, 'brand/favicon-16.png'), fav[16]);

// favicon.ico con PNG embebidos (16, 32, 48).
const entries = [16, 32, 48].map((s) => ({ s, data: fav[s] }));
const header = Buffer.alloc(6 + 16 * entries.length);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
let offset = header.length;
entries.forEach(({ s, data }, i) => {
  const o = 6 + 16 * i;
  header.writeUInt8(s, o); header.writeUInt8(s, o + 1); header.writeUInt8(0, o + 2); header.writeUInt8(0, o + 3);
  header.writeUInt16LE(1, o + 4); header.writeUInt16LE(32, o + 6);
  header.writeUInt32LE(data.length, o + 8); header.writeUInt32LE(offset, o + 12);
  offset += data.length;
});
writeFileSync(join(out, 'favicon.ico'), Buffer.concat([header, ...entries.map((e) => e.data)]));

// og-image 1200×630: la N sin caja, wordmark y el nuevo eslogan.
const wordmark = readFileSync(fileURLToPath(new URL('../public/brand/noutlife-wordmark.svg', import.meta.url)), 'utf8')
  .replace(/#0e1d16/g, '#eef6f0').replace(/<title>.*?<\/title>/, '');
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{font-family:Montserrat,system-ui,sans-serif;color:#eef6f0;
    background:radial-gradient(900px 600px at 18% 30%,rgba(90,165,140,.22),transparent 60%),
      radial-gradient(700px 500px at 95% 110%,rgba(42,114,98,.18),transparent 60%),#070d0a;
    display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box}
  .mk svg{width:300px;height:300px;display:block;filter:drop-shadow(0 24px 48px rgba(0,0,0,.45))}
  .tx{display:flex;flex-direction:column;gap:30px}
  .wm svg{width:440px;height:auto;display:block}
  h1{margin:0;font-weight:500;font-size:44px;line-height:1.22;letter-spacing:-.01em;max-width:620px}
  p{margin:0;font-size:22px;font-weight:400;color:#8faea0;letter-spacing:.02em}
  .site{position:absolute;right:56px;bottom:40px;font-size:18px;color:#5f7f71;letter-spacing:.06em}
</style></head><body>
  <div class="mk">${markSvg(V.dark, 300, 0.02)}</div>
  <div class="tx">
    <div class="wm">${wordmark}</div>
    <h1>Tu rutina, tu mente y tus ideas en un solo lugar.</h1>
    <p>Hábitos, libreta, bienestar y metas en un espacio en calma.</p>
  </div>
  <div class="site">noutlife.site</div>
</body></html>`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
writeFileSync(join(out, 'og-image.png'), await page.screenshot({ clip: { x: 0, y: 0, width: 1200, height: 630 } }));

// Hoja de control: iconos sobre fondos claros y oscuros.
await page.setViewportSize({ width: 900, height: 300 });
const cell = (bg) => `<div style="background:${bg};padding:16px;display:flex;gap:16px;align-items:center">${[16, 32, 48].map((s) => `<img src="data:image/png;base64,${fav[s].toString('base64')}">`).join('')}<img width="96" src="data:image/png;base64,${readFileSync(join(out, 'icons/icon-192.png')).toString('base64')}"><img src="data:image/png;base64,${apple.toString('base64')}" width="90"></div>`;
await page.setContent(`<body style="margin:0;display:grid;grid-template-columns:1fr 1fr">${cell('#fff')}${cell('#35363a')}${cell('#dee1e6')}${cell('#000')}</body>`);
writeFileSync(join(out, '_check.png'), await page.screenshot());
await browser.close();
console.log('ok');
