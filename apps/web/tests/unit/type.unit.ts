// Nout Sans: la fuente que se publica es la que genera scripts/font/nout_sans.py y toda la app la usa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url));

test('fuente: WOFF2 ligero para la web y variable con su eje de peso', () => {
  const web = read('../../src/assets/fonts/nout-sans.woff2');
  assert.equal(web.subarray(0, 4).toString('latin1'), 'wOF2');
  assert.ok(web.length / 1024 < 40, `${(web.length / 1024).toFixed(1)} KB`);
  const ttf = read('../../design/type/NoutSans[wght].ttf');
  const tables = Array.from({ length: ttf.readUInt16BE(4) }, (_, i) => ttf.subarray(12 + i * 16, 16 + i * 16).toString('latin1'));
  for (const tag of ['fvar', 'gvar', 'HVAR', 'GPOS', 'GSUB', 'STAT']) assert.ok(tables.includes(tag), tag);
});

test('fuente: se precarga y ya no se pide Montserrat ni JetBrains Mono', () => {
  const html = read('../../index.html').toString();
  assert.ok(html.includes('href="/src/assets/fonts/nout-sans.woff2" as="font"'), 'precarga');
  const css = read('../../src/styles/globals.css').toString();
  assert.ok(css.includes("font-family: 'Nout Sans';") && css.includes('font-weight: 300 700;'), '@font-face variable');
  for (const source of [html, css, read('../../tailwind.config.ts').toString(), read('../../src/styles/skins.css').toString()]) {
    assert.ok(!source.includes('Montserrat') && !source.includes('JetBrains'), 'sin las fuentes de antes');
  }
});
