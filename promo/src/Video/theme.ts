// Marca NoutLife en modo oscuro: los mismos valores que apps/web/src/styles/tokens.css
// (html.dark), los degradados del isotipo (public/brand) y los colores de fase del
// Ciclo (styles/ambience.css). Si la app cambia de paleta, se cambia aquí.
import type { SpringConfig } from 'remotion';

export const COLORS = {
  bg: '#070d0a',
  bgDeep: '#030605',
  surface: '#0d1611',
  surfaceVariant: '#15221b',
  border: '#1e2e25',
  borderStrong: '#5f9a7a',
  text: '#e6f2e8', // jade-50
  textSoft: '#c4e2ca', // jade-200
  textMuted: '#8fae9c',
  ivory: '#f9f7f3', // letras del logotipo
  jade: '#85c7a1', // jade-400, primario en oscuro
  jade300: '#a5d2b5',
  jade500: '#70b48d',
  jade600: '#548f6f',
  jade700: '#3d6950',
  jade800: '#234433',
  jade900: '#0e1d16',
  gold: '#d4b483', // champán: XP, oro, Pro
  goldLight: '#ecd7ad',
  goldDeep: '#b08d57',
  success: '#7fd3a0',
  warning: '#e0a84a',
  error: '#e57369',
  info: '#7fb6d6',
} as const;

/** Fases del Ciclo Menstrual (modo oscuro). */
export const CYCLE = {
  menstrual: '#ec8fae',
  follicular: '#a8d46c',
  ovulation: '#f2c45a',
  luteal: '#f0a070',
} as const;

/** Degradados del isotipo (noutlife-mark-on-dark.svg). */
export const LOGO_GRADIENTS = {
  a: [['0', '#a8d9c1'], ['.35', '#5aa58c'], ['.72', '#2a7262'], ['1', '#1a5547']],
  b: [['0', '#c4e6d4'], ['1', '#5aa58c']],
  c: [['0', '#86c5aa'], ['.45', '#4c957d'], ['1', '#1a5547']],
} as const;

export const FONT = {
  sans: '"Montserrat", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  serif: '"EB Garamond", Georgia, serif',
} as const;

/** `#rrggbb` → `rgba(r, g, b, a)`. */
export function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Muelles calibrados. `smooth` no rebota (textos, cámara); `card` rebota una vez,
 * poco (tarjetas); `snappy` es corto y firme (chips, checks, botón).
 */
export const SPRING: Record<'smooth' | 'card' | 'snappy' | 'soft', Partial<SpringConfig>> = {
  smooth: { damping: 200 },
  card: { damping: 15, stiffness: 120, mass: 0.9 },
  snappy: { damping: 14, stiffness: 240, mass: 0.55 },
  soft: { damping: 24, stiffness: 80, mass: 1.1 },
};
