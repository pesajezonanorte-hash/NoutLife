// Contornos vectoriales de los textos del anuncio «Modo Pro» (src/ProKeynote).
//
// Chrome redondea la línea base del texto HTML al píxel entero (un desplazamiento de
// 0,1–0,4 px se dibuja igual que 0 y 0,6 px salta un píxel entero), así que un texto
// que sube despacio o crece con la cámara avanza a saltos y parece temblar. Dibujado
// como trazados SVG se mueve en fracciones de píxel y conserva la misma nitidez en
// cualquier escala.
//
// Este script compone cada texto de src/ProKeynote/copy.json con fontkit (los mismos
// pares de kerning y anchos que Chrome: la diferencia medida es < 0,01 %) a partir de
// Montserrat Light y Bold (scripts/fonts, las instancias estáticas que sirve Google
// Fonts, OFL) y escribe los glifos en src/ProKeynote/type/outlines.ts.
//
// Uso: node scripts/build-keynote-type.mjs   (después de cambiar cualquier texto de copy.json)
// Otro anuncio con el mismo sistema pasa su carpeta: node scripts/build-keynote-type.mjs src/ProStudio
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = process.argv[2] ?? join('src', 'ProKeynote');
const COPY = join(ROOT, TARGET, 'copy.json');
const OUT = join(ROOT, TARGET, 'type', 'outlines.ts');
const RERUN = process.argv[2] ? `node scripts/build-keynote-type.mjs ${process.argv[2]}` : 'npm run type:pro-keynote';
const FONTS = {
  300: join(ROOT, 'scripts', 'fonts', 'Montserrat-Light.ttf'),
  400: join(ROOT, 'scripts', 'fonts', 'Montserrat-Regular.ttf'),
  500: join(ROOT, 'scripts', 'fonts', 'Montserrat-Medium.ttf'),
  600: join(ROOT, 'scripts', 'fonts', 'Montserrat-SemiBold.ttf'),
  700: join(ROOT, 'scripts', 'fonts', 'Montserrat-Bold.ttf'),
};
const NAMES = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };

const fonts = Object.fromEntries(Object.entries(FONTS).map(([w, file]) => [w, fontkit.openSync(file)]));
const em = fonts[300].unitsPerEm;

/** Todos los tramos { t, w } de copy.json, en cualquier nivel. */
function collectRuns(node, out = new Map()) {
  if (Array.isArray(node)) node.forEach((n) => collectRuns(n, out));
  else if (node && typeof node === 'object') {
    if (typeof node.t === 'string' && typeof node.w === 'number') {
      if (!fonts[node.w]) throw new Error(`Peso ${node.w} sin fuente («${node.t}»): usa ${Object.keys(FONTS).join(', ')}.`);
      out.set(`${node.w}|${node.t}`, node);
    } else Object.values(node).forEach((n) => collectRuns(n, out));
  }
  return out;
}

const round = (n) => Math.round(n * 10) / 10;
const ALL_RUNS = collectRuns(JSON.parse(readFileSync(COPY, 'utf8')));
/** Solo los pesos que usa este copy.json (el de ProKeynote: 300 y 700). */
const WEIGHTS = [...new Set([...ALL_RUNS.values()].map((r) => r.w))].sort((a, b) => a - b);
const glyphs = Object.fromEntries(WEIGHTS.map((w) => [w, new Map()]));
const runs = {};
const report = [];

for (const [key, { t, w }] of ALL_RUNS) {
  const font = fonts[w];
  const layout = font.layout(t);
  let pen = 0;
  const placed = [];
  layout.glyphs.forEach((glyph, i) => {
    const pos = layout.positions[i];
    // Los espacios no tienen contorno: solo avanzan la pluma. `i` es el puesto del glifo
    // en el tramo (con los espacios), para repartir el interletrado.
    if (glyph.path.commands.length > 0) {
      if (!glyphs[w].has(glyph.id)) glyphs[w].set(glyph.id, glyph.path.scale(1, -1).toSVG());
      const x = round(pen + pos.xOffset);
      const y = -pos.yOffset;
      placed.push(y ? [glyph.id, x, i, round(y)] : [glyph.id, x, i]);
    }
    pen += pos.xAdvance;
  });
  runs[key] = { adv: round(pen), n: layout.glyphs.length, g: placed };
  report.push([t, w, ((pen / em) * 100).toFixed(1)]);
}

const glyphTable = (w) =>
  [...glyphs[w].entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, d]) => `    ${id}: '${d}',`)
    .join('\n');

const runTable = Object.entries(runs)
  .map(([key, run]) => `  ${JSON.stringify(key)}: { adv: ${run.adv}, n: ${run.n}, g: ${JSON.stringify(run.g)} },`)
  .join('\n');

const m = fonts[300];
const names = WEIGHTS.map((w) => `${NAMES[w]} (${w})`);
const weightList = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0];
writeFileSync(
  OUT,
  `// Generado por scripts/build-keynote-type.mjs a partir de copy.json. No se edita a mano:
// cambia el texto en copy.json y vuelve a ejecutar \`${RERUN}\`.
// Unidades de la fuente (${em} por em), y hacia abajo. Montserrat ${weightList}, OFL.

export const EM = ${em};
/** Métricas compartidas por ${WEIGHTS.length === 2 ? 'los dos pesos' : 'todos los pesos'} (unidades de la fuente). */
export const METRICS = { ascent: ${m.ascent}, descent: ${m.descent}, capHeight: ${m.capHeight}, xHeight: ${m.xHeight} } as const;

export type Weight = ${WEIGHTS.join(' | ')};

/** Contorno de cada glifo, por peso e identificador. */
export const GLYPHS: Record<Weight, Record<number, string>> = {
${WEIGHTS.map((w) => `  ${w}: {\n${glyphTable(w)}\n  },`).join('\n')}
};

/**
 * Cada tramo de texto compuesto: avance total, número de glifos (con los espacios) y
 * [glifo, x, puesto, y?] de cada letra con contorno.
 */
export const RUNS: Record<string, { adv: number; n: number; g: ReadonlyArray<readonly [number, number, number, number?]> }> = {
${runTable}
};
`,
);

console.log(`${Object.keys(runs).length} tramos, ${WEIGHTS.reduce((n, w) => n + glyphs[w].size, 0)} glifos → ${OUT}`);
console.table(report.map(([t, w, width]) => ({ texto: t, peso: w, 'ancho a 100 px': width })));
