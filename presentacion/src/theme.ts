// Identidad de NoutLife en modo oscuro: los mismos valores que
// apps/web/src/styles/tokens.css (html.dark). Jade es el color de la marca y de
// crear; el gris verdoso apagado es el de consumir. Champán solo para logros.
// Si la app cambia de paleta, se cambia aquí.

export const COLORS = {
  bg: '#070d0a', // --lq-background
  bgDeep: '#030605',
  surface: '#0d1611', // --lq-surface
  surfaceVariant: '#15221b', // --lq-surface-variant
  border: '#1e2e25', // --lq-border
  borderStrong: '#5f9a7a', // --lq-border-strong
  text: '#e6f2e8', // --lq-on-background (jade-50)
  onSurface: '#c4e2ca', // --lq-on-surface (jade-200)
  muted: '#8fae9c', // --lq-on-surface-light
  /** Texto apagado: lo pasivo, lo que se consume. */
  faint: '#56715f',
  jade: '#85c7a1', // --lq-primary (jade-400)
  jade300: '#a5d2b5',
  jade700: '#3d6950',
  gold: '#d4b483', // --lq-secondary: XP, oro, recompensas
  success: '#7fd3a0',
  warning: '#e0a84a',
  info: '#7fb6d6',
  ivory: '#f9f7f3',
} as const;

/** Degradados del isotipo en oscuro (--lq-brand-*). */
export const LOGO_GRADIENTS = {
  a: [['0', '#a8d9c1'], ['.35', '#5aa58c'], ['.72', '#2a7262'], ['1', '#1a5547']],
  b: [['0', '#c4e6d4'], ['1', '#5aa58c']],
  c: [['0', '#86c5aa'], ['.45', '#4c957d'], ['1', '#1a5547']],
} as const;

export const FONT = {
  sans: '"Montserrat", system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
} as const;

/** `#rrggbb` → `rgba(r, g, b, a)`. */
export function rgba(color: string, alpha: number): string {
  const n = Number.parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
