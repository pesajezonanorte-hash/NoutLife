// Alfabeto de la marca: las minúsculas del wordmark «noutlife» extendidas a todo
// el abecedario (monolínea de 15 u, remates redondos, cuencos de r 24,5, n de
// pierna inclinada, t con barra a la derecha, e de barra diagonal). Unidades del
// wordmark: altura x de 36 a 100 (línea base), ascendentes desde 0, descendentes
// hasta 134. Cada trazo es un subtrazo único, en el orden en que se dibuja.

export interface Glyph {
  /** Ancho del eje de los trazos (de x = 0 al trazo más a la derecha). */
  w: number;
  /** Trazos, en orden de escritura. */
  d: readonly string[];
  /** Puntos rellenos [cx, cy, r] (i, j, signos). */
  dots?: readonly (readonly [number, number, number])[];
  /** Ajuste del espacio tras el glifo (u). */
  rb?: number;
  /** Ajuste del espacio antes del glifo (u). */
  lb?: number;
  /** Transformación SVG del glifo (¿ y ¡ son ? y ! girados). */
  t?: string;
}

/** Espacio entre los ejes de dos glifos vecinos (u), medido en el wordmark. */
export const GAP = 27;
/** Grosor del trazo (u) y medio trazo para los márgenes. */
export const STROKE = 15;

const bowlCcw = (cx: number) => `M${cx + 24.5} 68a24.5 24.5 0 1 0-49 0a24.5 24.5 0 1 0 49 0`;
const bowlCw = (cx: number) => `M${cx - 24.5} 68a24.5 24.5 0 1 1 49 0a24.5 24.5 0 1 1-49 0`;
const N = 'M0 100L12 52A22.5 22.5 0 0 1 55 58.5V100';
const acute = (x: number, y = 22) => `M${x - 6} ${y}L${x + 6} ${y - 16}`;

const base: Record<string, Glyph> = {
  a: { w: 49, d: [bowlCcw(24.5), 'M49 36V100'] },
  b: { w: 49, d: ['M0 0V100', bowlCw(24.5)] },
  c: { w: 44, d: ['M43.3 52.3A24.5 24.5 0 1 0 43.3 83.7'] },
  d: { w: 49, d: [bowlCcw(24.5), 'M49 0V100'] },
  e: { w: 46, d: ['M1.7 76L44.7 54A24.5 24.5 0 1 0 44 82.7'] },
  f: { w: 40, d: ['M14 100V30a22 22 0 0 1 22-22h4', 'M0 46h34'], rb: -3 },
  g: { w: 49, d: [bowlCcw(24.5), 'M49 36V110a24 24 0 0 1-24 24h-9'] },
  h: { w: 45, d: ['M0 0V100', 'M0 58.5a22.5 22.5 0 0 1 45 0V100'] },
  i: { w: 0, d: ['M0 52V100'], dots: [[0, 22, 9]] },
  j: { w: 22, d: ['M22 52V110a22 22 0 0 1-22 22'], dots: [[22, 22, 9]], lb: -6 },
  k: { w: 42, d: ['M0 0V100', 'M40 36L2 72', 'M18 57L42 100'] },
  l: { w: 0, d: ['M0 0V100'] },
  m: { w: 80, d: ['M0 100L11 50A18 18 0 0 1 45 56V100', 'M45 56A17.5 17.5 0 0 1 80 56V100'] },
  n: { w: 55, d: [N] },
  o: { w: 49, d: ['M24.5 43.5a24.5 24.5 0 1 1 0 49a24.5 24.5 0 1 1 0-49'] },
  p: { w: 49, d: ['M0 36V134', bowlCw(24.5)] },
  q: { w: 49, d: [bowlCcw(24.5), 'M49 36V134'] },
  r: { w: 46, d: ['M0 100L12 52A22.5 22.5 0 0 1 47.1 43.7'], rb: -4 },
  s: { w: 33, d: ['M28.8 48.4A15 11.5 0 1 0 16.5 66.5A16.5 13 0 1 1 3 87'] },
  t: { w: 26, d: ['M0 12V80a20 20 0 0 0 20 20', 'M0 40h26'], rb: -3 },
  u: { w: 45, d: ['M0 36V77.5a22.5 22.5 0 0 0 45 0V36', 'M45 36V100'] },
  v: { w: 46, d: ['M0 36L23 100L46 36'] },
  w: { w: 74, d: ['M0 36L18 100L37 42L56 100L74 36'] },
  x: { w: 44, d: ['M0 36L44 100', 'M44 36L0 100'] },
  y: { w: 45, d: ['M0 36V77.5a22.5 22.5 0 0 0 45 0', 'M45 36V110a24 24 0 0 1-24 24h-9'] },
  z: { w: 42, d: ['M0 36H42L0 100H42'] },

  0: { w: 48, d: ['M24 16a24 24 0 0 1 24 24v36a24 24 0 0 1-48 0V40a24 24 0 0 1 24-24'] },
  1: { w: 20, d: ['M2 32L20 16V100'] },
  2: { w: 46, d: ['M2 40a22 22 0 0 1 44 0c0 13-9 21-19 31L2 100h44'] },
  3: { w: 46, d: ['M4 16h40L22 48a26 26 0 1 1-20 44'] },
  4: { w: 50, d: ['M36 100V16L0 72h50'] },
  5: { w: 46, d: ['M42 16H9L5 51c5-4 11-6 18-6a26 26 0 1 1-21 42'] },
  6: { w: 48, d: ['M36 16L11 56', 'M24 52a24 24 0 1 1 0 48a24 24 0 1 1 0-48'] },
  7: { w: 46, d: ['M2 16H46L16 100'] },
  8: { w: 50, d: ['M25 16a17 17 0 1 1 0 34a17 17 0 1 1 0-34', 'M25 50a25 25 0 1 1 0 50a25 25 0 1 1 0-50'] },
  9: { w: 48, d: ['M24 16a24 24 0 1 1 0 48a24 24 0 1 1 0-48', 'M37 60L12 100'] },

  '.': { w: 0, d: [], dots: [[0, 91, 9]], lb: -6 },
  ',': { w: 0, d: ['M2 90L-5 112'], lb: -6 },
  ':': { w: 0, d: [], dots: [[0, 52, 9], [0, 91, 9]], lb: -4 },
  ';': { w: 0, d: ['M2 90L-5 112'], dots: [[0, 52, 9]], lb: -4 },
  '!': { w: 0, d: ['M0 16V66'], dots: [[0, 91, 9]] },
  '¡': { w: 0, d: ['M0 16V66'], dots: [[0, 91, 9]], t: 'rotate(180 0 68)' },
  '?': { w: 42, d: ['M2 38a20 20 0 1 1 30 17c-8 5-12 9-12 16'], dots: [[20, 91, 9]] },
  '¿': { w: 42, d: ['M2 38a20 20 0 1 1 30 17c-8 5-12 9-12 16'], dots: [[20, 91, 9]], t: 'rotate(180 21 68)' },
  '-': { w: 24, d: ['M0 68H24'] },
  '’': { w: 0, d: ['M2 4L-2 24'], lb: -6 },
  "'": { w: 0, d: ['M2 4L-2 24'], lb: -6 },
  '·': { w: 0, d: [], dots: [[0, 68, 8]] },
  '…': { w: 52, d: [], dots: [[0, 91, 9], [26, 91, 9], [52, 91, 9]], lb: -6 },
  '/': { w: 32, d: ['M32 4L0 124'] },
  '+': { w: 44, d: ['M0 68H44', 'M22 46V90'] },
  '%': { w: 48, d: ['M44 18L4 98'], dots: [[6, 26, 9], [42, 90, 9]] },
};

/** Centro del signo diacrítico sobre cada vocal (u). */
const MID: Record<string, number> = { a: 26, e: 26, o: 26, u: 23, i: 1 };
const grave = (x: number, y = 22) => `M${x + 6} ${y}L${x - 6} ${y - 16}`;
const circumflex = (x: number, y = 22) => `M${x - 13} ${y}L${x} ${y - 14}L${x + 13} ${y}`;
const tilde = (x: number) => `M${x - 19} 16c6-8 13-9 19.5-3s13.5 5 19.5-3`;
const dieresis = (x: number, y: number, dx: number, r: number): readonly (readonly [number, number, number])[] => [[x - dx, y, r], [x + dx, y, r]];

function mark(ch: 'a' | 'e' | 'i' | 'o' | 'u', kind: 'acute' | 'grave' | 'circumflex' | 'tilde' | 'dieresis'): Glyph {
  const g = base[ch];
  const x = MID[ch];
  // Sobre la i el signo sustituye al punto y baja un poco: su asta empieza más abajo.
  const onI = ch === 'i';
  if (kind === 'dieresis') return { ...g, dots: onI ? dieresis(x, 30, 9, 7) : dieresis(x, 20, 11.5, 8) };
  const y = onI ? 36 : 22;
  const sign = kind === 'acute' ? acute(x, y) : kind === 'grave' ? grave(x, y) : kind === 'circumflex' ? circumflex(x, y) : tilde(x);
  return { ...g, dots: onI ? undefined : g.dots, d: [...g.d, sign] };
}

/** Vocales con tilde, ñ, ü, ç y las tildes de nombres en otras lenguas. */
const marked: Record<string, Glyph> = {
  ...Object.fromEntries((['a', 'e', 'i', 'o', 'u'] as const).flatMap((v) => [
    [{ a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }[v]!, mark(v, 'acute')],
    [{ a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' }[v]!, mark(v, 'grave')],
    [{ a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' }[v]!, mark(v, 'circumflex')],
    [{ a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü' }[v]!, mark(v, 'dieresis')],
  ])),
  ã: mark('a', 'tilde'),
  õ: mark('o', 'tilde'),
  ñ: { ...base.n, d: [N, tilde(27.5)] },
  ç: { ...base.c, d: [...base.c.d, 'M24 100v14a8 8 0 0 1-8 8'] },
};

export const GLYPHS: Readonly<Record<string, Glyph>> = { ...base, ...marked };
