// Motor del personaje pixel art (estilo chibi: cabeza grande, contorno oscuro y
// sombreado por bloques). Compone capas sobre una rejilla de 32×36 celdas y
// devuelve tiras de color para pintarlas en SVG. Los colores son DATOS del
// avatar (los elige el usuario), no tokens de interfaz.

export const W = 32;
export const H = 36;

export type Body = 'male' | 'female';
export type HairId =
  | 'calvo' | 'rapado' | 'corto' | 'puntas' | 'despeinado' | 'copete' | 'raya' | 'mohicano' | 'afro' | 'mono_alto'
  | 'media' | 'bob' | 'flequillo' | 'pixie' | 'largo' | 'ondulado' | 'coleta' | 'dos_coletas' | 'mono' | 'trenzas'
  // De la Tienda
  | 'samurai' | 'rizos';
export type EyesId = 'normal' | 'grandes' | 'felices' | 'entrecerrados' | 'guino';
export type BrowsId = 'normales' | 'gruesas' | 'enfadadas' | 'preocupadas' | 'ninguna';
export type MouthId = 'sonrisa' | 'neutral' | 'abierta' | 'sonrisota' | 'seria' | 'lengua';
export type FacialId = 'ninguno' | 'bigote' | 'perilla' | 'barba_corta' | 'barba';
export type TopId =
  | 'camiseta' | 'manga_larga' | 'tirantes' | 'camisa' | 'uniforme' | 'sudadera' | 'chaqueta' | 'sueter' | 'vestido' | 'sin_camiseta'
  // De la Tienda
  | 'armadura' | 'kimono' | 'traje';
export type BottomId = 'pantalon' | 'shorts' | 'falda' | 'rotos';
export type ShoesId = 'zapatillas' | 'botas' | 'sandalias' | 'descalzo';
export type ExtraId =
  | 'gafas' | 'gafas_sol' | 'cinta' | 'gorra' | 'gorro' | 'corona' | 'auriculares' | 'pendientes' | 'bufanda' | 'collar' | 'flor' | 'parche'
  // De la Tienda: sombreros, cara, espalda y al costado
  | 'sombrero_aventurero' | 'sombrero_mago' | 'birrete' | 'casco_vikingo' | 'bandana_ninja' | 'corona_campeon' | 'corona_cristal'
  | 'antifaz' | 'monoculo' | 'capa' | 'alas' | 'escudo' | 'dragoncito';

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
    case 'armadura': {
      // Placas de acero, cota de malla en los brazos, hombreras y cinturón dorado.
      const steel = '#a9b2bd';
      const mail = '#7f8894';
      cv.spans(torso(look.body), steel, 'top');
      cv.symRect(a0, 22, a1, 26, mail, 'top'); cv.sym(a1, 21, steel, 'top');
      for (let y = 23; y <= 25; y += 2) cv.symRect(a0, y, a1, y, darken(mail, 0.82), 'flat');
      cv.symRect(a0 - 1, 21, a1, 22, lighten(steel, 0.18), 'acc');
      cv.rect(15, 22, 16, 25, lighten(steel, 0.32), 'flat');
      for (const [x0, x1] of torso(look.body)[24]) cv.rect(x0, 24, x1, 24, darken(steel, 0.78), 'flat');
      cv.rect(15, 24, 16, 24, lighten(steel, 0.2), 'flat');
      for (const [x0, x1] of torso(look.body)[27]) cv.rect(x0, 27, x1, 27, '#5a3a22', 'flat');
      cv.rect(15, 27, 16, 27, GOLD, 'flat');
      cv.symRect(a0, 26, a1, 26, darken(steel, 0.85), 'top');
      break;
    }
    case 'kimono': {
      // Mangas amplias, cuello cruzado blanco y obi del color de los accesorios.
      body();
      cv.symRect(a0 - 1, 22, a1, 26, c, 'top'); cv.sym(a1, 21, c, 'top');
      cv.symRect(a0 - 1, 26, a1, 26, darken(c, 0.8), 'flat');
      cv.spans({ 28: [[11, 20]], 29: [[11, 20]], 30: [[10, 21]] }, c, 'top');
      for (let y = 27; y <= 30; y++) cv.set(16, y, darken(c, 0.72), 'flat');
      // Cuello en V: dos bandas blancas que se cruzan hasta el obi.
      for (const [x, y] of [[13, 21], [14, 22], [15, 23], [18, 21], [17, 22], [16, 23]] as const) cv.set(x, y, WHITE, 'flat');
      cv.rect(14, 21, 17, 21, darken(c, 0.7), 'flat');
      const obi = look.extraColor;
      for (const y of [25, 26]) for (const [x0, x1] of torso(look.body)[y]) cv.rect(x0, y, x1, y, obi, 'acc');
      cv.rect(15, 25, 16, 26, darken(obi, 0.75), 'flat');
      break;
    }
    case 'traje': {
      // Chaqueta del color elegido, camisa blanca, solapas y corbata roja.
      body(); sleeves(26);
      cv.symRect(a0, 26, a1, 26, WHITE, 'flat');
      cv.rect(14, 21, 17, 21, WHITE, 'flat'); cv.rect(15, 22, 16, 24, WHITE, 'flat');
      cv.rect(15, 22, 16, 22, '#c0392b', 'flat'); cv.rect(15, 23, 16, 25, '#a8302a', 'flat'); cv.set(15, 26, '#a8302a', 'flat');
      for (const [x, y] of [[13, 21], [14, 22], [14, 23], [18, 21], [17, 22], [17, 23]] as const) cv.set(x, y, darken(c, 0.72), 'flat');
      cv.set(14, 26, darken(c, 0.6), 'flat'); cv.set(17, 26, darken(c, 0.6), 'flat');
      break;
    }
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
    case 'rizos': {
      // Volumen de rizos alrededor de la cabeza, con textura de bucles.
      const rows = symRows({ 3: [[10, 15]], 4: [[7, 15]], 5: [[6, 15]], 6: [[5, 15]], 7: [[5, 15]], 8: [[5, 15]], 9: [[5, 15]], 10: [[5, 15]], 11: [[5, 15]], 12: [[5, 15]], 13: [[5, 15]], 14: [[5, 15]], 15: [[5, 15]], 16: [[5, 15]], 17: [[6, 15]], 18: [[6, 9]], 19: [[7, 8]] });
      cv.spans(rows, c, g);
      for (const [y, list] of Object.entries(rows)) for (const [a, b] of list) for (let x = a; x <= b; x++) if ((x + 2 * +y) % 4 === 0) cv.set(x, +y, darken(c, 0.82), 'flat');
      for (const x of [5, 26]) cv.clear(x, 6);
      break;
    }
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
    case 'samurai':
      // Laterales rapados, el pelo peinado hacia atrás y el moño en lo alto.
      cv.spans({ 5: [[9, 10], [21, 22]], 6: [[8, 10], [21, 23]], 7: [[8, 10], [21, 23]], 8: [[8, 10], [21, 23]], 9: [[8, 9], [22, 23]] }, mix(c, look.skin, 0.5), 'flat');
      cv.spans({ 3: [[12, 19]], 4: [[11, 20]], 5: [[11, 20]], 6: [[11, 20]], 7: [[11, 20]], 8: [[11, 20]] }, c, g);
      for (let y = 4; y <= 8; y++) cv.set(y % 2 ? 14 : 17, y, darken(c, 0.75), 'flat');
      cv.spans({ 0: [[14, 17]], 1: [[13, 18]] }, c, g);
      cv.rect(14, 2, 17, 2, look.extraColor, 'flat');
      break;
    case 'rizos':
      cap();
      cv.spans({ 9: [[7, 24]], 10: [[7, 10], [12, 13], [15, 16], [18, 19], [21, 24]], 11: [[7, 9], [22, 24]] }, c, g);
      cv.spans(sides(12, 16, 6, 8), c, g);
      for (let y = 3; y <= 16; y++) for (let x = 6; x <= 25; x++) {
        const k = cv.get(x, y);
        if (k?.g === g && (x + 2 * y) % 4 === 1) cv.set(x, y, lighten(c, 0.16), 'flat');
      }
      break;
  }
}

// ── Accesorios ──────────────────────────────────────────────────────────────
/** Sombreros y desde qué fila hacia arriba recortan el pelo que sobresale. */
const HAT_CLIP: Partial<Record<ExtraId, number>> = {
  gorra: 3, gorro: 2, corona: 2,
  sombrero_aventurero: 6, sombrero_mago: 7, birrete: 5, casco_vikingo: 9, corona_campeon: 3, corona_cristal: 3,
};

/** Lo que va a la espalda (detrás del pelo largo y del cuerpo): capa y alas. */
function paintBack(cv: Canvas, look: PixelLook) {
  const e = new Set(look.extras);
  if (e.has('capa')) {
    const red = '#b02e45';
    cv.rect(10, 20, 21, 20, red, 'acc');
    for (let y = 21; y <= 33; y++) { const k = Math.floor((y - 21) / 4); cv.rect(8 - k, y, 23 + k, y, red, 'acc'); }
    for (let y = 26; y <= 33; y++) for (const x of [7, 10, 21, 24]) if (cv.get(x, y)) cv.set(x, y, darken(red, 0.78), 'flat');
  }
  if (e.has('alas')) {
    // Alas de hada: la de arriba más grande, la de abajo más corta; nervios claros.
    const up: Record<number, [number, number][]> = { 15: [[2, 4]], 16: [[1, 6]], 17: [[1, 7]], 18: [[1, 7]], 19: [[2, 8]], 20: [[3, 9]], 21: [[4, 9]], 22: [[6, 9]] };
    const low: Record<number, [number, number][]> = { 23: [[5, 9]], 24: [[3, 9]], 25: [[2, 8]], 26: [[2, 7]], 27: [[3, 6]], 28: [[4, 5]] };
    cv.spans(symRows(up), '#cdeeff', 'flat');
    cv.spans(symRows(low), '#e6dbff', 'flat');
    for (const [x, y] of [[3, 17], [4, 18], [5, 19], [6, 20], [7, 21], [4, 26], [5, 25], [6, 25], [7, 24]] as const) cv.sym(x, y, '#8fc6ee', 'flat');
    for (const [x, y] of [[2, 16], [2, 17], [3, 26]] as const) cv.sym(x, y, WHITE, 'flat');
  }
}

/** Dragón pequeño que vuela a tu lado, junto al hombro, mirando hacia fuera. */
function paintDragon(cv: Canvas) {
  const g = '#4caf6a'; const d = '#2f8a55'; const wing = '#8fdcaa'; const belly = '#e3efb0'; const horn = '#f2e3b0';
  // Dibujado en su propia rejilla (x 25–31) y bajado a la altura de la cara.
  const px = (cells: [number, number][], c: string, grp: Group = 'flat') => { for (const [x, y] of cells) cv.set(x, y + 11, c, grp); };
  // Ala abierta sobre el lomo: borde oscuro y membrana clara.
  px([[25, 0], [25, 1], [26, 1], [25, 2], [27, 2], [26, 3]], d);
  px([[26, 2]], wing);
  px([[29, 1]], horn);
  // Cabeza con el ojo y la nariz hacia fuera.
  px([[28, 2], [29, 2], [30, 2], [27, 3], [28, 3], [29, 3], [31, 3], [27, 4], [28, 4], [29, 4], [30, 4]], g, 'acc');
  px([[30, 3]], INK); px([[31, 4]], darken(g, 0.72)); px([[28, 2]], lighten(g, 0.3));
  // Cuello, cuerpo con la panza clara y patas.
  px([[27, 5], [28, 5], [26, 6], [27, 6], [28, 6], [29, 6], [26, 7], [27, 7], [28, 7], [29, 7], [30, 7], [27, 8], [28, 8], [29, 8], [30, 8]], g, 'acc');
  px([[28, 5], [28, 6], [29, 7], [28, 7], [29, 8]], belly);
  px([[27, 9], [30, 9]], d);
  // Cola enroscada hacia atrás con la punta en flecha.
  px([[25, 7], [25, 8], [26, 9]], g, 'acc'); px([[25, 6]], d);
}

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
  if (e.has('antifaz')) {
    // Antifaz: banda oscura sobre los ojos, con dos aberturas y el nudo a un lado.
    const m = '#1f1b29';
    for (let y = 11; y <= 14; y++) for (let x = 9; x <= 22; x++) {
      const hole = y >= 12 && (x === 12 || x === 13 || x === 18 || x === 19);
      if (!hole) cv.set(x, y, y === 11 ? '#3b3550' : m, 'flat');
    }
    cv.set(23, 11, m, 'flat'); cv.set(24, 12, m, 'flat'); cv.set(24, 11, m, 'flat'); cv.set(25, 13, m, 'flat');
  }
  if (e.has('monoculo')) {
    for (const [x, y] of [[18, 11], [19, 11], [17, 12], [17, 13], [17, 14], [20, 12], [20, 13], [20, 14], [18, 15], [19, 15]] as const) cv.set(x, y, GOLD, 'flat');
    cv.set(19, 12, '#dff4ff', 'flat');
    for (const [x, y] of [[21, 15], [21, 16], [21, 17], [22, 18], [22, 19]] as const) cv.set(x, y, '#c8902a', 'flat');
  }
  if (e.has('escudo')) {
    // Escudo con borde dorado y cruz, sujeto a la altura de la mano.
    const rim = '#e3b341'; const field = '#2f5fb3';
    cv.rect(3, 21, 8, 21, rim, 'acc');
    cv.rect(2, 22, 8, 26, rim, 'acc'); cv.rect(3, 22, 7, 26, field, 'acc');
    cv.rect(3, 27, 7, 27, rim, 'acc'); cv.rect(4, 27, 6, 27, field, 'acc');
    cv.rect(4, 28, 6, 28, rim, 'acc'); cv.set(5, 28, field, 'acc'); cv.set(5, 29, rim, 'acc');
    cv.rect(5, 22, 5, 27, GOLD, 'flat'); cv.rect(3, 24, 7, 24, GOLD, 'flat');
    cv.set(3, 22, lighten(field, 0.35), 'flat');
  }
  if (e.has('dragoncito')) paintDragon(cv);
  if (e.has('capa')) { cv.set(12, 21, GOLD, 'flat'); cv.set(19, 21, GOLD, 'flat'); }

  // Sombreros: lo que sobresale del pelo por encima se recorta.
  const hat = (Object.keys(HAT_CLIP) as ExtraId[]).find((h) => e.has(h));
  if (hat) {
    const clearTop = HAT_CLIP[hat] ?? 2;
    for (let y = 0; y < clearTop; y++) for (let x = 0; x < W; x++) { const k = cv.get(x, y); if (k && (k.g === 'hair' || k.g === 'hairB')) cv.clear(x, y); }
  }
  if (e.has('bandana_ninja')) {
    const b = '#1f1d26';
    cv.rect(8, 7, 23, 8, b, 'acc');
    cv.rect(13, 7, 18, 8, '#b8c0cc', 'flat'); cv.rect(15, 7, 16, 8, '#6b7280', 'flat');
    for (const [x, y] of [[24, 8], [25, 8], [25, 9], [26, 10], [24, 9], [24, 10], [25, 11]] as const) cv.set(x, y, b, 'acc');
  }
  if (hat === 'sombrero_aventurero') {
    const felt = '#8a5a33';
    cv.spans({ 1: [[12, 19]], 2: [[11, 20]], 3: [[11, 20]], 4: [[11, 20]], 5: [[11, 20]], 6: [[11, 20]] }, felt, 'acc');
    cv.rect(11, 5, 20, 5, '#3b2a22', 'flat');
    cv.rect(15, 1, 16, 1, darken(felt, 0.75), 'flat');
    cv.spans({ 7: [[5, 26]], 8: [[7, 24]] }, darken(felt, 0.9), 'acc');
  }
  if (hat === 'sombrero_mago') {
    const p = '#4b3a9c';
    cv.spans({ 0: [[22, 23]], 1: [[20, 22]], 2: [[18, 21]], 3: [[16, 20]], 4: [[15, 20]], 5: [[13, 20]], 6: [[11, 21]] }, p, 'acc');
    cv.spans({ 7: [[6, 25]], 8: [[8, 23]] }, darken(p, 0.85), 'acc');
    cv.rect(11, 6, 21, 6, GOLD, 'flat');
    cv.set(17, 4, GOLD, 'flat'); cv.set(19, 2, '#fff1b8', 'flat'); cv.set(14, 5, '#fff1b8', 'flat');
  }
  if (hat === 'birrete') {
    const k = '#25222b';
    cv.spans({ 2: [[11, 20]], 3: [[8, 23]] }, '#3a3644', 'acc');
    cv.rect(6, 4, 25, 4, k, 'acc');
    cv.rect(9, 5, 22, 7, k, 'acc');
    cv.set(16, 2, GOLD, 'flat');
    for (const [x, y] of [[17, 3], [19, 3], [21, 3], [23, 3], [24, 4], [24, 5], [24, 6], [24, 7]] as const) cv.set(x, y, GOLD, 'flat');
    cv.rect(23, 8, 25, 9, GOLD, 'flat');
  }
  if (hat === 'casco_vikingo') {
    const steel = '#9aa3ae'; const horn = '#efe6d0';
    cv.spans({ 2: [[12, 19]], 3: [[10, 21]], 4: [[9, 22]], 5: [[8, 23]], 6: [[8, 23]], 7: [[8, 23]] }, steel, 'acc');
    cv.rect(15, 2, 16, 7, lighten(steel, 0.25), 'flat');
    cv.rect(8, 8, 23, 8, '#6c7480', 'acc');
    for (const x of [10, 13, 18, 21]) cv.set(x, 8, lighten(steel, 0.35), 'flat');
    cv.rect(15, 9, 16, 11, steel, 'acc');
    for (const [x, y] of [[7, 6], [7, 5], [6, 5], [6, 4], [5, 4], [5, 3], [4, 3], [4, 2]] as const) cv.sym(x, y, horn, 'acc');
    cv.sym(4, 1, darken(horn, 0.7), 'flat');
  }
  if (hat === 'corona_campeon') {
    cv.spans({ 0: [[10, 10], [15, 16], [21, 21]], 1: [[10, 11], [15, 16], [20, 21]], 2: [[10, 11], [14, 17], [20, 21]], 3: [[10, 21]], 4: [[9, 22]], 5: [[9, 22]] }, GOLD, 'acc');
    cv.set(10, 0, '#fff1b8', 'flat'); cv.set(21, 0, '#fff1b8', 'flat'); cv.rect(15, 0, 16, 0, '#fff1b8', 'flat');
    cv.rect(15, 4, 16, 5, '#d62b45', 'flat'); cv.rect(11, 5, 12, 5, '#2fae6a', 'flat'); cv.rect(19, 5, 20, 5, '#2fae6a', 'flat');
    cv.rect(9, 6, 22, 6, '#c8902a', 'acc');
  }
  if (hat === 'corona_cristal') {
    const ice = '#bfeaff'; const deep = '#7fc8ee';
    cv.spans({ 0: [[11, 11], [15, 16], [20, 20]], 1: [[11, 11], [14, 17], [20, 20]], 2: [[10, 12], [14, 17], [19, 21]], 3: [[10, 21]] }, ice, 'flat');
    cv.spans({ 1: [[17, 17]], 2: [[12, 12], [17, 17], [21, 21]], 3: [[13, 13], [18, 18], [21, 21]] }, deep, 'flat');
    cv.rect(9, 4, 22, 5, '#e6f6ff', 'acc');
    cv.rect(15, 4, 16, 5, '#b79cff', 'flat'); cv.set(11, 4, '#ffffff', 'flat'); cv.set(20, 5, deep, 'flat');
    cv.set(15, 0, '#ffffff', 'flat'); cv.set(11, 0, '#ffffff', 'flat');
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
  paintBack(cv, look);
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
