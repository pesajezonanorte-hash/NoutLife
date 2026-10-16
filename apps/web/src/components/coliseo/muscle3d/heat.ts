// Colores del mapa muscular en 3D. Salen de los tokens del tema (--lq-success,
// --lq-warning, --lq-error, --lq-info…), así cada skin pinta el cuerpo con sus
// propios verdes, ámbares y rojos y la leyenda de la tarjeta sigue valiendo.
export type RGB = [number, number, number]; // sRGB 0–255

export interface HeatTokens { success: RGB; warning: RGB; error: RGB; info: RGB }

export interface ScenePalette extends HeatTokens {
  /** Maniquí, músculos sin trabajo esta semana, contorno de la selección, sombra y anillo del suelo. */
  body: RGB;
  idle: RGB;
  outline: RGB;
  shadow: RGB;
  ring: RGB;
  dark: boolean;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const mix = (a: RGB, b: RGB, t: number): RGB => {
  const k = clamp(t, 0, 1);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

function toHsl([r, g, b]: RGB): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** Gira el tono `dh` grados y suma `dl` a la luminosidad (0–1). */
const shift = (c: RGB, dh: number, dl: number): RGB => {
  const [h, s, l] = toHsl(c);
  return fromHsl((h + dh + 360) % 360, s, clamp(l + dl, 0, 1));
};

/**
 * Color de un músculo según su % de fatiga (0–100), dentro de su banda:
 * 0–30 de azul claro a verde, 31–70 de amarillo a naranja, 71–100 de rojo a carmesí.
 */
export function heatColor(pct: number, t: HeatTokens): RGB {
  if (pct <= 30) return mix(mix(t.info, t.success, 0.45), t.success, pct / 30);
  if (pct <= 70) return mix(shift(t.warning, 10, 0.06), shift(t.warning, -9, -0.03), (pct - 31) / 39);
  return mix(t.error, shift(t.error, -7, -0.12), (pct - 71) / 29);
}

const luminance = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Lee los tokens --lq-* (canales «R G B») del documento. */
export function readPalette(root: HTMLElement = document.documentElement): ScenePalette {
  const css = getComputedStyle(root);
  const token = (name: string, fallback: RGB): RGB => {
    const parts = css.getPropertyValue(`--lq-${name}`).trim().split(/[\s,/]+/).map(Number);
    return parts.length >= 3 && parts.slice(0, 3).every(Number.isFinite) ? [parts[0], parts[1], parts[2]] : fallback;
  };
  const surface = token('surface', [255, 255, 255]);
  const ink = token('on-surface-light', [79, 107, 92]);
  const dark = luminance(surface) < 0.4;
  return {
    success: token('success', [58, 155, 103]),
    warning: token('warning', [212, 149, 42]),
    error: token('error', [200, 70, 63]),
    info: token('info', [59, 126, 166]),
    body: mix(surface, ink, dark ? 0.34 : 0.3),
    idle: mix(surface, ink, dark ? 0.52 : 0.46),
    outline: token('on-background', dark ? [230, 240, 232] : [14, 29, 22]),
    shadow: dark ? [0, 0, 0] : mix(surface, ink, 0.85),
    ring: token('border-strong', dark ? [48, 70, 58] : [190, 210, 196]),
    dark,
  };
}
