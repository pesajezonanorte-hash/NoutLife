// Motor del personaje pixel art (estilo chibi: cabeza grande, contorno oscuro y
// sombreado por bloques). Compone capas sobre una rejilla de 32×36 celdas y
// devuelve tiras de color para pintarlas en SVG. Los colores son DATOS del
// avatar (los elige el usuario), no tokens de interfaz.

export const W = 32;
export const H = 36;

export type Body = 'male' | 'female';
export type HairId =
  | 'calvo' | 'rapado' | 'corto' | 'puntas' | 'despeinado' | 'copete' | 'raya' | 'mohicano' | 'afro' | 'mono_alto'
  | 'media' | 'bob' | 'flequillo' | 'pixie' | 'largo' | 'ondulado' | 'coleta' | 'dos_coletas' | 'mono' | 'trenzas';
export type EyesId = 'normal' | 'grandes' | 'felices' | 'entrecerrados' | 'guino';
export type BrowsId = 'normales' | 'gruesas' | 'enfadadas' | 'preocupadas' | 'ninguna';
export type MouthId = 'sonrisa' | 'neutral' | 'abierta' | 'sonrisota' | 'seria' | 'lengua';
export type FacialId = 'ninguno' | 'bigote' | 'perilla' | 'barba_corta' | 'barba';
export type TopId = 'camiseta' | 'manga_larga' | 'tirantes' | 'camisa' | 'uniforme' | 'sudadera' | 'chaqueta' | 'sueter' | 'vestido' | 'sin_camiseta';
export type BottomId = 'pantalon' | 'shorts' | 'falda' | 'rotos';
export type ShoesId = 'zapatillas' | 'botas' | 'sandalias' | 'descalzo';
export type ExtraId =
  | 'gafas' | 'gafas_sol' | 'cinta' | 'gorra' | 'gorro' | 'corona' | 'auriculares' | 'pendientes' | 'bufanda' | 'collar' | 'flor' | 'parche';

export interface PixelLook {
  body: Body;
  skin: string;
  hair: HairId;
  hairColor: string;
  eyes: EyesId;
  eyeColor: string;
  brows: BrowsId;
  mouth: MouthId;
  facial: FacialId;
  blush: boolean;
  top: TopId;
  topColor: string;
  bottom: BottomId;
  bottomColor: string;
  shoes: ShoesId;
  shoesColor: string;
  extras: ExtraId[];
  extraColor: string;
}

// ── Color ───────────────────────────────────────────────────────────────────
function rgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? [128, 128, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex([r, g, b]: number[]) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}
export function mix(a: string, b: string, t: number) {
  const x = rgb(a); const y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}
export const darken = (c: string, f: number) => hex(rgb(c).map((v) => v * f));
export const lighten = (c: string, t: number) => mix(c, '#ffffff', t);

const INK = '#1d1424';      // ojos y líneas
const WHITE = '#fbf8f2';
const MOUTH = '#b8323f';
const GOLD = '#f2c14e';

// ── Lienzo ──────────────────────────────────────────────────────────────────
/** Grupo de sombreado: celdas del mismo grupo no se sombrean entre sí. */
type Group = 'skin' | 'hair' | 'hairB' | 'top' | 'bottom' | 'shoes' | 'acc' | 'flat';
interface Cell { c: string; g: Group }
type Grid = (Cell | null)[][];

class Canvas {
  g: Grid = Array.from({ length: H }, () => Array<Cell | null>(W).fill(null));
  set(x: number, y: number, c: string, g: Group) {
    if (x >= 0 && x < W && y >= 0 && y < H) this.g[y][x] = { c, g };
  }
  clear(x: number, y: number) { if (x >= 0 && x < W && y >= 0 && y < H) this.g[y][x] = null; }
  get(x: number, y: number) { return x >= 0 && x < W && y >= 0 && y < H ? this.g[y][x] : null; }
  /** Filas: { y: [[x0, x1], …] } (inclusivas). */
  spans(rows: Record<number, [number, number][]>, c: string, g: Group) {
    for (const [y, list] of Object.entries(rows)) for (const [a, b] of list) for (let x = a; x <= b; x++) this.set(x, +y, c, g);
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: string, g: Group) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c, g);
  }
  /** Pinta una celda y su simétrica respecto al eje central (x ↔ 31 − x). */
  sym(x: number, y: number, c: string, g: Group) { this.set(x, y, c, g); this.set(W - 1 - x, y, c, g); }
  symRect(x0: number, y0: number, x1: number, y1: number, c: string, g: Group) {
    this.rect(x0, y0, x1, y1, c, g); this.rect(W - 1 - x1, y0, W - 1 - x0, y1, c, g);
  }
  each(fn: (x: number, y: number, cell: Cell) => void) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = this.g[y][x]; if (c) fn(x, y, c); }
  }
}

/** Filas simétricas a partir de rangos del lado izquierdo [x0, x1]. */
function symRows(rows: Record<number, [number, number][]>) {
  const out: Record<number, [number, number][]> = {};
  for (const [y, list] of Object.entries(rows)) out[+y] = list.flatMap(([a, b]) => [[a, b], [W - 1 - b, W - 1 - a]] as [number, number][]);
  return out;
}

// ── Cuerpo ──────────────────────────────────────────────────────────────────
const HEAD: Record<number, [number, number][]> = {
  6: [[12, 19]], 7: [[10, 21]], 8: [[9, 22]], 9: [[9, 22]], 10: [[9, 22]], 11: [[9, 22]], 12: [[9, 22]], 13: [[9, 22]],
  14: [[9, 22]], 15: [[9, 22]], 16: [[9, 22]], 17: [[9, 22]], 18: [[10, 21]], 19: [[12, 19]],
};
function torso(body: Body): Record<number, [number, number][]> {
  return body === 'male'
    ? { 21: [[11, 20]], 22: [[10, 21]], 23: [[10, 21]], 24: [[10, 21]], 25: [[10, 21]], 26: [[10, 21]], 27: [[10, 21]] }
    : { 21: [[12, 19]], 22: [[11, 20]], 23: [[11, 20]], 24: [[11, 20]], 25: [[12, 19]], 26: [[11, 20]], 27: [[11, 20]] };
}
/** Columnas del brazo izquierdo (el derecho es simétrico). */
const ARM: Record<Body, [number, number]> = { male: [8, 9], female: [9, 10] };

function paintBody(cv: Canvas, look: PixelLook) {
  const s = look.skin;
  const [a0, a1] = ARM[look.body];
  cv.spans(torso(look.body), s, 'skin');
  cv.symRect(a0, 22, a1, 27, s, 'skin');
  cv.sym(a1, 21, s, 'skin');
  cv.symRect(12, 28, 14, 32, s, 'skin');
  cv.symRect(11, 33, 14, 34, s, 'skin');
  cv.rect(14, 20, 17, 20, darken(s, 0.8), 'flat'); // cuello en sombra
}

function paintHead(cv: Canvas, look: PixelLook) {
  cv.spans(HEAD, look.skin, 'skin');
  cv.symRect(8, 12, 8, 14, look.skin, 'skin');
  cv.sym(8, 13, darken(look.skin, 0.85), 'skin');
}

// ── Ropa ────────────────────────────────────────────────────────────────────
function paintBottom(cv: Canvas, look: PixelLook) {
  const c = look.bottomColor;
  const legs = (y0: number, y1: number) => cv.symRect(12, y0, 14, y1, c, 'bottom');
  switch (look.bottom) {
    case 'pantalon':
      cv.rect(12, 28, 19, 28, c, 'bottom'); legs(29, 32); break;
    case 'rotos':
      cv.rect(12, 28, 19, 28, c, 'bottom'); legs(29, 32);
      cv.set(13, 30, look.skin, 'skin'); cv.set(18, 31, look.skin, 'skin'); break;
    case 'shorts':
      cv.rect(12, 28, 19, 28, c, 'bottom'); legs(29, 30); break;
    case 'falda':
      cv.spans({ 28: [[11, 20]], 29: [[10, 21]], 30: [[10, 21]] }, c, 'bottom');
      cv.rect(10, 30, 21, 30, darken(c, 0.85), 'bottom'); break;
  }
}

function paintShoes(cv: Canvas, look: PixelLook) {
  const c = look.shoesColor;
  switch (look.shoes) {
    case 'zapatillas':
      cv.symRect(11, 33, 14, 33, c, 'shoes'); cv.symRect(11, 34, 14, 34, WHITE, 'flat'); break;
    case 'botas':
      cv.symRect(12, 30, 14, 32, c, 'shoes'); cv.symRect(11, 33, 14, 34, c, 'shoes');
      cv.symRect(12, 30, 14, 30, lighten(c, 0.2), 'flat'); break;
    case 'sandalias':
      cv.symRect(11, 33, 14, 33, c, 'flat'); cv.symRect(11, 34, 14, 34, darken(c, 0.7), 'flat'); break;
    case 'descalzo': break;
  }
}

function paintTop(cv: Canvas, look: PixelLook) {
  const c = look.topColor;
  const [a0, a1] = ARM[look.body];
  const body = () => cv.spans(torso(look.body), c, 'top');
  const sleeves = (y1: number) => { cv.symRect(a0, 22, a1, y1, c, 'top'); cv.sym(a1, 21, c, 'top'); };
  let top = look.top;
  if (top === 'sin_camiseta' && look.body === 'female') top = 'tirantes';
  switch (top) {
    case 'sin_camiseta':
      cv.sym(13, 24, darken(look.skin, 0.88), 'flat'); cv.sym(14, 24, darken(look.skin, 0.88), 'flat'); break;
    case 'camiseta': body(); sleeves(23); break;
    case 'manga_larga': body(); sleeves(26); break;
    case 'tirantes':
      body(); cv.rect(13, 21, 18, 21, look.skin, 'skin'); cv.rect(14, 22, 17, 22, look.skin, 'skin');
      if (look.body === 'female') { cv.set(12, 21, look.skin, 'skin'); cv.set(19, 21, look.skin, 'skin'); }
      break;
    case 'camisa':
      body(); sleeves(23);
      cv.sym(13, 21, WHITE, 'flat'); cv.sym(14, 21, WHITE, 'flat'); cv.sym(14, 22, WHITE, 'flat');
      for (let y = 23; y <= 27; y += 2) cv.set(15, y, darken(c, 0.7), 'flat');
      break;
    case 'uniforme':
      body(); sleeves(26);
      cv.rect(14, 21, 17, 21, WHITE, 'flat');
      for (const y of [23, 25]) { cv.set(15, y, GOLD, 'flat'); cv.set(16, y, GOLD, 'flat'); }
      cv.symRect(a0, 26, a1, 26, lighten(c, 0.25), 'flat');
      break;
    case 'sudadera':
      body(); sleeves(26);
      cv.symRect(11, 20, 13, 20, darken(c, 0.8), 'top');
      cv.rect(13, 25, 18, 26, darken(c, 0.82), 'flat');
      cv.sym(14, 22, WHITE, 'flat'); cv.sym(14, 23, WHITE, 'flat');
      break;
    case 'chaqueta':
      body(); sleeves(26);
      cv.rect(14, 21, 17, 27, WHITE, 'flat');
      cv.sym(13, 22, darken(c, 0.75), 'flat'); cv.sym(13, 23, darken(c, 0.75), 'flat');
      break;
    case 'sueter':
      body(); sleeves(26);
      for (const y of [23, 25]) {
        for (const [x0, x1] of torso(look.body)[y]) cv.rect(x0, y, x1, y, lighten(c, 0.3), 'flat');
        cv.symRect(a0, y, a1, y, lighten(c, 0.3), 'flat');
      }
      break;
    case 'vestido':
      body(); sleeves(22);
      cv.spans({ 27: [[11, 20]], 28: [[10, 21]], 29: [[10, 21]], 30: [[9, 22]] }, c, 'top');
      cv.rect(9, 30, 22, 30, darken(c, 0.82), 'top');
      cv.rect(12, 25, 19, 25, lighten(c, 0.3), 'flat');
      break;
  }
}

// ── Cara ────────────────────────────────────────────────────────────────────
function eye(cv: Canvas, look: PixelLook, side: 'L' | 'R', kind: EyesId) {
  const m = (x: number) => (side === 'L' ? x : W - 1 - x);
  // Columnas del ojo izquierdo: 12–13 (el derecho, 18–19). El brillo siempre arriba a la izquierda.
  const lx = side === 'L' ? 12 : 18;
  const iris = look.eyeColor;
  const lash = look.body === 'female';
  switch (kind) {
    case 'normal':
      cv.rect(lx, 12, lx + 1, 14, INK, 'flat');
      cv.set(lx + 1, 13, iris, 'flat'); cv.set(lx + 1, 14, iris, 'flat');
      cv.set(lx, 12, WHITE, 'flat');
      if (lash) cv.set(m(11), 11, INK, 'flat');
      break;
    case 'grandes':
      cv.rect(lx - (side === 'L' ? 1 : 0), 11, lx + (side === 'L' ? 1 : 2), 14, INK, 'flat');
      cv.rect(lx, 12, lx + 1, 14, iris, 'flat');
      cv.set(lx, 12, WHITE, 'flat'); cv.set(lx + 1, 14, lighten(iris, 0.35), 'flat');
      if (lash) { cv.set(m(10), 11, INK, 'flat'); }
      break;
    case 'felices':
      cv.set(m(12), 12, INK, 'flat'); cv.set(m(13), 12, INK, 'flat');
      cv.set(m(11), 13, INK, 'flat'); cv.set(m(14), 13, INK, 'flat');
      break;
    case 'entrecerrados':
      cv.set(m(11), 13, INK, 'flat'); cv.set(m(12), 13, INK, 'flat'); cv.set(m(13), 13, INK, 'flat');
      cv.set(lx, 14, iris, 'flat'); cv.set(lx + 1, 14, iris, 'flat');
      break;
    case 'guino':
      eye(cv, look, side, side === 'L' ? 'normal' : 'felices');
      break;
  }
}

function paintFace(cv: Canvas, look: PixelLook, blink: boolean) {
  const ink = INK;
  const browC = darken(look.hairColor, 0.75);
  const eyes: EyesId = blink && look.eyes !== 'felices' ? 'entrecerrados' : look.eyes;
  if (blink && look.eyes !== 'felices') {
    for (const s of ['L', 'R'] as const) { const m = (x: number) => (s === 'L' ? x : W - 1 - x); cv.set(m(12), 13, ink, 'flat'); cv.set(m(13), 13, ink, 'flat'); cv.set(m(11), 13, ink, 'flat'); }
  } else {
    eye(cv, look, 'L', eyes);
    eye(cv, look, 'R', eyes);
  }

  switch (look.brows) {
    case 'normales': cv.sym(12, 10, browC, 'flat'); cv.sym(13, 10, browC, 'flat'); break;
    case 'gruesas': cv.symRect(11, 10, 13, 10, browC, 'flat'); cv.sym(12, 9, browC, 'flat'); cv.sym(13, 9, browC, 'flat'); break;
    case 'enfadadas': cv.sym(11, 9, browC, 'flat'); cv.sym(12, 10, browC, 'flat'); cv.sym(13, 11, browC, 'flat'); break;
    case 'preocupadas': cv.sym(11, 11, browC, 'flat'); cv.sym(12, 10, browC, 'flat'); cv.sym(13, 9, browC, 'flat'); break;
    case 'ninguna': break;
  }

  if (look.blush) { const b = mix(look.skin, '#ff5c7a', 0.45); cv.sym(10, 15, b, 'flat'); cv.sym(11, 15, b, 'flat'); }
  cv.set(16, 15, darken(look.skin, 0.85), 'flat'); // nariz

  switch (look.mouth) {
    case 'sonrisa': cv.set(14, 16, ink, 'flat'); cv.set(17, 16, ink, 'flat'); cv.rect(15, 17, 16, 17, ink, 'flat'); break;
    case 'neutral': cv.rect(15, 17, 16, 17, ink, 'flat'); break;
    case 'abierta': cv.rect(15, 16, 16, 16, ink, 'flat'); cv.rect(15, 17, 16, 17, MOUTH, 'flat'); break;
    case 'sonrisota': cv.rect(14, 16, 17, 16, ink, 'flat'); cv.rect(15, 17, 16, 17, MOUTH, 'flat'); cv.set(14, 17, ink, 'flat'); cv.set(17, 17, ink, 'flat'); break;
    case 'seria': cv.rect(15, 16, 16, 16, ink, 'flat'); cv.set(14, 17, ink, 'flat'); cv.set(17, 17, ink, 'flat'); break;
    case 'lengua': cv.rect(14, 16, 17, 16, ink, 'flat'); cv.set(16, 17, '#f08aa0', 'flat'); break;
  }
}

function paintFacial(cv: Canvas, look: PixelLook) {
  const c = darken(look.hairColor, 0.9);
  const mustache = () => cv.rect(14, 15, 17, 15, c, 'flat');
  switch (look.facial) {
    case 'ninguno': break;
    case 'bigote': mustache(); cv.sym(13, 16, c, 'flat'); break;
    case 'perilla': cv.rect(15, 18, 16, 19, c, 'flat'); break;
    case 'barba_corta':
      cv.symRect(9, 15, 10, 17, c, 'flat'); cv.rect(10, 18, 21, 18, c, 'flat'); cv.rect(12, 19, 19, 19, c, 'flat');
      break;
    case 'barba':
      mustache();
      cv.symRect(9, 14, 10, 17, c, 'flat'); cv.symRect(11, 16, 13, 17, c, 'flat');
      cv.rect(10, 18, 21, 18, c, 'flat'); cv.rect(11, 19, 20, 19, c, 'flat'); cv.rect(13, 20, 18, 21, c, 'flat');
      break;
  }
}

// ── Pelo ────────────────────────────────────────────────────────────────────
const CAP: Record<number, [number, number][]> = {
  3: [[12, 19]], 4: [[10, 21]], 5: [[9, 22]], 6: [[8, 23]], 7: [[8, 23]], 8: [[8, 23]],
};
const sides = (y0: number, y1: number, x0 = 8, x1 = 9) => {
  const out: Record<number, [number, number][]> = {};
  for (let y = y0; y <= y1; y++) out[y] = [[x0, x1], [W - 1 - x1, W - 1 - x0]];
  return out;
};

function paintHairBack(cv: Canvas, look: PixelLook) {
  const c = darken(look.hairColor, 0.85);
  const g: Group = 'hairB';
  switch (look.hair) {
    case 'afro':
      cv.spans(symRows({ 1: [[11, 15]], 2: [[9, 15]], 3: [[7, 15]], 4: [[6, 15]], 5: [[5, 15]], 6: [[5, 15]], 7: [[5, 15]], 8: [[5, 15]], 9: [[5, 15]], 10: [[5, 15]], 11: [[5, 15]], 12: [[5, 15]], 13: [[6, 15]], 14: [[7, 15]], 15: [[9, 15]] }), look.hairColor, g);
      break;
    case 'bob':
      cv.rect(7, 7, 24, 19, c, g); break;
    case 'flequillo':
      cv.rect(7, 7, 24, 24, c, g); break;
    case 'largo':
      cv.rect(6, 7, 25, 28, c, g); cv.spans(symRows({ 29: [[7, 9]] }), c, g); break;
    case 'ondulado':
      cv.rect(6, 7, 25, 28, c, g);
      for (let y = 10; y <= 27; y++) if (Math.floor(y / 3) % 2) { cv.set(5, y, c, g); cv.set(26, y, c, g); }
      cv.spans(symRows({ 29: [[6, 8]] }), c, g);
      break;
    case 'coleta':
      cv.rect(23, 7, 25, 9, c, g); cv.rect(24, 10, 26, 20, c, g); cv.rect(25, 21, 25, 22, c, g); break;
    case 'dos_coletas':
      cv.symRect(4, 8, 7, 16, c, g); cv.symRect(5, 17, 6, 18, c, g); break;
    case 'mono':
      cv.spans({ 0: [[13, 18]], 1: [[12, 19]], 2: [[12, 19]], 3: [[13, 18]] }, look.hairColor, 'hair'); break;
    case 'mono_alto':
      cv.spans({ 0: [[14, 17]], 1: [[13, 18]], 2: [[13, 18]] }, look.hairColor, 'hair'); break;
    default: break;
  }
}

function paintHairFront(cv: Canvas, look: PixelLook) {
  const c = look.hairColor;
  const g: Group = 'hair';
  const cap = () => cv.spans(CAP, c, g);
  switch (look.hair) {
    case 'calvo': break;
    case 'rapado':
      cv.spans({ 5: [[10, 21]], 6: [[9, 22]], 7: [[9, 22]], 8: [[9, 22]] }, mix(c, look.skin, 0.45), 'flat');
      break;
    case 'corto':
      cap(); cv.spans({ 9: [[8, 23]], 10: [[8, 10], [13, 14], [21, 23]] }, c, g); cv.spans(sides(11, 11), c, g);
      break;
    case 'puntas':
      cap();
      cv.spans({ 0: [[14, 14]], 1: [[13, 15], [18, 18]], 2: [[10, 10], [13, 15], [17, 19]], 3: [[9, 11], [21, 22]], 4: [[21, 23]] }, c, g);
      cv.spans({ 6: [[6, 7], [24, 25]], 7: [[7, 7], [24, 24]] }, c, g);
      cv.spans({ 9: [[8, 23]], 10: [[9, 10], [13, 14], [17, 18], [21, 22]], 11: [[9, 9], [14, 14], [22, 22]] }, c, g);
      cv.spans(sides(9, 13), c, g);
      break;
    case 'despeinado':
      cap();
      cv.spans({ 2: [[11, 12], [17, 18]], 3: [[10, 14], [16, 20]], 8: [[7, 7], [24, 24]], 9: [[7, 23]], 10: [[9, 11], [15, 16], [20, 22]] }, c, g);
      cv.spans(sides(10, 12), c, g);
      break;
    case 'copete':
      cap();
      cv.spans({ 1: [[13, 20]], 2: [[11, 21]], 3: [[10, 22]] }, c, g);
      cv.spans(sides(9, 11), c, g);
      break;
    case 'raya':
      cap(); cv.spans({ 9: [[8, 19]], 10: [[8, 15]], 11: [[8, 11]] }, c, g); cv.spans({ 9: [[22, 23]], 10: [[22, 23]], 11: [[22, 23]] }, c, g);
      for (let y = 4; y <= 8; y++) cv.set(19, y, darken(c, 0.7), 'flat');
      break;
    case 'mohicano':
      cv.spans({ 5: [[9, 13], [18, 22]], 6: [[8, 13], [18, 23]], 7: [[8, 13], [18, 23]], 8: [[8, 13], [18, 23]] }, mix(c, look.skin, 0.5), 'flat');
      cv.spans({ 0: [[15, 16]], 1: [[14, 17]], 2: [[14, 17]], 3: [[14, 17]], 4: [[14, 17]], 5: [[14, 17]], 6: [[14, 17]], 7: [[14, 17]], 8: [[14, 17]], 9: [[14, 16]] }, c, g);
      break;
    case 'afro':
      cap(); cv.spans({ 9: [[8, 23]] }, c, g); cv.spans(sides(10, 12), c, g);
      break;
    case 'mono_alto':
      cap(); cv.spans({ 9: [[8, 23]], 10: [[8, 9], [22, 23]] }, c, g); cv.rect(14, 3, 17, 3, darken(c, 0.6), 'flat');
      break;
    case 'media':
      cap(); cv.spans({ 9: [[8, 23]], 10: [[8, 12], [19, 23]] }, c, g); cv.spans(sides(9, 15, 7, 9), c, g);
      break;
    case 'bob':
      cap(); cv.spans({ 9: [[8, 23]], 10: [[8, 11], [15, 18], [21, 23]] }, c, g);
      cv.spans(sides(9, 18, 7, 9), c, g); cv.spans(sides(19, 19, 8, 9), c, g);
      break;
    case 'flequillo':
      cap(); cv.spans({ 9: [[8, 23]], 10: [[8, 23]] }, c, g); cv.spans(sides(11, 22, 7, 9), c, g);
      break;
    case 'pixie':
      cap(); cv.spans({ 9: [[8, 17]], 10: [[8, 14]], 11: [[8, 11]] }, c, g); cv.spans(sides(9, 12), c, g);
      break;
    case 'largo':
      cap(); cv.spans({ 9: [[8, 14], [17, 23]], 10: [[8, 12], [19, 23]] }, c, g); cv.spans(sides(11, 25, 7, 9), c, g);
      break;
    case 'ondulado':
      cap(); cv.spans({ 9: [[8, 14], [17, 23]], 10: [[8, 11], [20, 23]] }, c, g);
      for (let y = 11; y <= 26; y++) { const o = Math.floor(y / 3) % 2; cv.spans(sides(y, y, 7 - o, 9 - o), c, g); }
      break;
    case 'coleta':
      cap(); cv.spans({ 9: [[8, 23]], 10: [[8, 10], [14, 15], [21, 23]] }, c, g); cv.spans(sides(11, 12), c, g);
      cv.rect(23, 8, 24, 9, look.extraColor, 'flat');
      break;
    case 'dos_coletas':
      cap(); cv.spans({ 9: [[8, 23]], 10: [[8, 23]] }, c, g); cv.spans(sides(11, 13), c, g);
      cv.symRect(7, 9, 8, 10, look.extraColor, 'flat');
      break;
    case 'mono':
      cap(); cv.spans({ 9: [[8, 16]], 10: [[8, 12]] }, c, g); cv.spans(sides(9, 12), c, g);
      cv.rect(13, 4, 18, 4, lighten(c, 0.55), 'flat');
      break;
    case 'trenzas':
      cap(); cv.spans({ 9: [[8, 14], [17, 23]], 10: [[8, 11], [20, 23]] }, c, g);
      for (let y = 11; y <= 26; y++) cv.spans(sides(y, y, 7, 8), y % 2 ? c : darken(c, 0.78), y % 2 ? g : 'flat');
      cv.symRect(7, 26, 8, 26, look.extraColor, 'flat'); cv.symRect(7, 27, 8, 28, c, g);
      break;
  }
}

// ── Accesorios ──────────────────────────────────────────────────────────────
const HATS: ExtraId[] = ['gorra', 'gorro', 'corona'];

function paintExtras(cv: Canvas, look: PixelLook) {
  const e = new Set(look.extras);
  const c = look.extraColor;
  const frame = '#2a2633';
  if (e.has('bufanda')) {
    cv.rect(11, 20, 20, 21, c, 'acc'); cv.rect(12, 22, 19, 22, darken(c, 0.85), 'acc');
    cv.rect(17, 23, 18, 26, c, 'acc'); cv.rect(17, 25, 18, 25, lighten(c, 0.3), 'flat');
  }
  if (e.has('collar')) { cv.rect(13, 21, 18, 21, GOLD, 'flat'); cv.rect(15, 22, 16, 22, '#e2574c', 'flat'); }
  if (e.has('pendientes')) cv.symRect(8, 15, 8, 15, GOLD, 'flat');
  if (e.has('gafas')) {
    for (const s of [0, 1]) {
      const m = (x: number) => (s ? W - 1 - x : x);
      cv.set(m(12), 11, frame, 'flat'); cv.set(m(13), 11, frame, 'flat');
      cv.set(m(11), 12, frame, 'flat'); cv.set(m(11), 13, frame, 'flat'); cv.set(m(11), 14, frame, 'flat');
      cv.set(m(14), 12, frame, 'flat'); cv.set(m(14), 13, frame, 'flat'); cv.set(m(14), 14, frame, 'flat');
      cv.set(m(12), 15, frame, 'flat'); cv.set(m(13), 15, frame, 'flat');
    }
    cv.rect(15, 12, 16, 12, frame, 'flat');
  }
  if (e.has('gafas_sol')) {
    cv.symRect(11, 12, 14, 14, '#15131c', 'flat'); cv.rect(15, 12, 16, 12, '#15131c', 'flat');
    cv.sym(12, 12, '#6b6f86', 'flat');
  }
  if (e.has('parche')) {
    cv.rect(17, 11, 20, 14, '#15131c', 'flat');
    for (let i = 0; i < 4; i++) { cv.set(16 - 2 * i, 10 - i, '#15131c', 'flat'); cv.set(15 - 2 * i, 10 - i, '#15131c', 'flat'); }
    cv.set(21, 11, '#15131c', 'flat'); cv.set(22, 10, '#15131c', 'flat');
  }
  if (e.has('cinta')) {
    cv.rect(8, 6, 23, 7, c, 'acc'); cv.rect(24, 7, 25, 8, c, 'acc'); cv.set(25, 9, c, 'acc');
  }
  if (e.has('flor')) {
    cv.set(21, 4, c, 'acc'); cv.set(20, 5, c, 'acc'); cv.set(22, 5, c, 'acc'); cv.set(21, 6, c, 'acc'); cv.set(21, 5, GOLD, 'flat');
  }
  if (e.has('auriculares')) {
    cv.spans({ 2: [[12, 19]], 3: [[10, 11], [20, 21]], 4: [[9, 9], [22, 22]] }, '#2a2633', 'acc');
    cv.rect(8, 5, 8, 10, '#2a2633', 'acc'); cv.rect(23, 5, 23, 10, '#2a2633', 'acc');
    cv.symRect(6, 11, 8, 15, c, 'acc');
  }
  // Sombreros: lo que sobresale del pelo por encima se recorta.
  const hat = HATS.find((h) => e.has(h));
  if (hat) {
    const clearTop = hat === 'gorra' ? 3 : 2;
    for (let y = 0; y < clearTop; y++) for (let x = 0; x < W; x++) { const k = cv.get(x, y); if (k && (k.g === 'hair' || k.g === 'hairB')) cv.clear(x, y); }
  }
  if (hat === 'gorra') {
    cv.spans({ 3: [[12, 19]], 4: [[10, 21]], 5: [[9, 22]], 6: [[8, 23]], 7: [[8, 23]] }, c, 'acc');
    cv.rect(5, 8, 20, 8, darken(c, 0.78), 'acc');
    cv.rect(15, 4, 16, 5, WHITE, 'flat');
  }
  if (hat === 'gorro') {
    cv.spans({ 1: [[13, 18]], 2: [[11, 20]], 3: [[10, 21]], 4: [[9, 22]], 5: [[9, 22]], 6: [[8, 23]] }, c, 'acc');
    cv.rect(8, 7, 23, 8, lighten(c, 0.3), 'flat');
    cv.rect(15, 0, 16, 0, WHITE, 'flat');
    for (let x = 9; x <= 22; x += 2) cv.set(x, 8, c, 'flat');
  }
  if (hat === 'corona') {
    cv.spans({ 2: [[10, 10], [15, 16], [21, 21]], 3: [[10, 11], [14, 17], [20, 21]], 4: [[10, 21]], 5: [[10, 21]] }, GOLD, 'acc');
    cv.rect(15, 4, 16, 4, '#e2574c', 'flat'); cv.set(12, 5, '#4fa3e0', 'flat'); cv.set(19, 5, '#4fa3e0', 'flat');
  }
}

// ── Composición ─────────────────────────────────────────────────────────────
export interface Run { x: number; y: number; w: number; c: string }
export type PixelGrid = (string | null)[][];

/** Rejilla final (con sombreado y contorno): un color por celda o null. */
export function renderGrid(look: PixelLook, opts: { blink?: boolean } = {}): PixelGrid {
  const cv = new Canvas();
  paintHairBack(cv, look);
  paintBody(cv, look);
  paintBottom(cv, look);
  paintShoes(cv, look);
  paintTop(cv, look);
  paintHead(cv, look);
  paintFace(cv, look, Boolean(opts.blink));
  paintFacial(cv, look);
  paintHairFront(cv, look);
  paintExtras(cv, look);

  // Sombreado por bloques: luz desde arriba a la izquierda.
  const same = (a: Cell | null, g: Group) => !!a && (a.g === g || (g === 'skin' && a.g === 'flat'));
  const out: (string | null)[][] = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  cv.each((x, y, cell) => {
    let col = cell.c;
    if (cell.g !== 'flat') {
      const right = !same(cv.get(x + 1, y), cell.g);
      const below = cv.get(x, y + 1);
      const bottom = !same(below, cell.g);
      const top = !same(cv.get(x, y - 1), cell.g);
      if ((cell.g === 'hair') && below && (below.g === 'skin' || below.g === 'flat')) col = darken(col, 0.62);
      else if (right || bottom) col = darken(col, cell.g === 'skin' ? 0.86 : 0.78);
      else if (top && (cell.g === 'hair' || cell.g === 'hairB' || cell.g === 'acc')) col = lighten(col, 0.22);
    }
    out[y][x] = col;
  });

  // Contorno: celda vacía junto a una llena (4 vecinos) → tono oscuro del vecino.
  const outline: (string | null)[][] = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (out[y][x]) continue;
    const n = [out[y - 1]?.[x], out[y + 1]?.[x], out[y]?.[x - 1], out[y]?.[x + 1]].find(Boolean);
    if (n) outline[y][x] = mix(darken(n, 0.38), INK, 0.45);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (outline[y][x]) out[y][x] = outline[y][x];
  return out;
}

/** Tiras horizontales del mismo color (menos nodos SVG para miniaturas). */
export function render(look: PixelLook, opts: { blink?: boolean } = {}): Run[] {
  const out = renderGrid(look, opts);
  const runs: Run[] = [];
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const c = out[y][x];
      if (!c) { x++; continue; }
      let w = 1;
      while (x + w < W && out[y][x + w] === c) w++;
      runs.push({ x, y, w, c });
      x += w;
    }
  }
  return runs;
}
