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

/**
 * Acento de cada zona en el vídeo: los tonos de la app (error/advertencia del mapa de
 * fatiga, rosa de la menstruación, verde de éxito, azul de info), más saturados para
 * que brillen como neón sobre el negro. `from → to` es el degradado de los títulos,
 * `glow` el halo y `deep` el fondo que se tiñe.
 */
export const ZONE = {
  coliseo: { from: '#ffb070', to: '#ff4f4f', glow: '#ff6247', deep: '#3a0d06' },
  ciclo: { from: '#ffc4d6', to: '#ff7d98', glow: '#ff8aa8', deep: '#3d0f1f' },
  habitos: { from: '#c9f8de', to: '#3ad98f', glow: '#46dc9a', deep: '#06301f' },
  sabio: { from: '#9fc6ff', to: '#8a68ff', glow: '#7a66ff', deep: '#170f45' },
} as const;
export type ZoneId = keyof typeof ZONE;

/** Las tres palabras del gancho y su color: la rutina (hábitos), el cuerpo (Coliseo), la mente (El Sabio). */
export const HOOK_TINT = {
  rutina: ZONE.habitos,
  cuerpo: ZONE.coliseo,
  mente: ZONE.sabio,
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

/** `#rrggbb` (o un `rgb()`/`rgba()` de interpolateColors) → `rgba(r, g, b, a)`. */
export function rgba(color: string, alpha: number): string {
  if (color.startsWith('rgb')) {
    const [r, g, b, a = '1'] = color.slice(color.indexOf('(') + 1, -1).split(',');
    return `rgba(${r.trim()}, ${g.trim()}, ${b.trim()}, ${Number(a) * alpha})`;
  }
  const n = Number.parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Texto relleno con un degradado (los titulares de cada zona, «Pro.»). */
export const gradientText = (from: string, to: string, angle = 100): Record<string, string> => ({
  backgroundImage: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

/**
 * Muelles calibrados (Remotion `spring`):
 * - `smooth` no rebota (textos, fundidos de interfaz).
 * - `slam` es muy rígido y apenas rebota: las palabras del gancho caen como un golpe.
 * - `pop` rebota una vez, visible (chips, checks, botones).
 * - `card` rebota poco (tarjetas que se levantan de la pantalla).
 * - `phone` casi no rebota y es lento: el teléfono es un objeto pesado.
 * - `swing` es el giro del teléfono entre zonas, con un rebote corto.
 * - `glide` es críticamente amortiguado: llega sin rebote (las palabras del gancho entran).
 */
export const SPRING: Record<'smooth' | 'slam' | 'pop' | 'card' | 'phone' | 'swing' | 'glide', Partial<SpringConfig>> = {
  smooth: { damping: 200 },
  slam: { stiffness: 420, damping: 26, mass: 0.6 },
  pop: { stiffness: 260, damping: 15, mass: 0.6 },
  card: { stiffness: 150, damping: 16, mass: 0.9 },
  phone: { stiffness: 70, damping: 17, mass: 1.2 },
  swing: { stiffness: 120, damping: 15, mass: 1 },
  // ζ ≈ 1: sin rebote. ω = √stiffness rad/s: ~0,6 s hasta casi quieta
  glide: { stiffness: 140, damping: 24, mass: 1 },
};
