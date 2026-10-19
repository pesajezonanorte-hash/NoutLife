// Paleta del deck: base slate profunda con acentos índigo y violeta. Dentro del
// teléfono, NoutLife conserva sus colores reales (jade y champán, como en
// apps/web/src/styles/tokens.css): lo que creaste tiene su propia luz.

export const COLORS = {
  ink: '#0F172A', // slate-900: fondo
  inkDeep: '#020617', // slate-950: viñeta
  text: '#F1F5F9', // slate-100
  soft: '#CBD5E1', // slate-300
  muted: '#94A3B8', // slate-400
  faint: '#64748B', // slate-500
  indigo: '#818CF8',
  indigoDeep: '#6366F1',
  violet: '#A78BFA',
  violetDeep: '#8B5CF6',
  /** Consumir: el lado pasivo. */
  rose: '#FB7185',
  /** Post-its y la actividad del aula. */
  amber: '#FBBF24',
  postit: '#FDE68A',
  /** NoutLife (marca). */
  jade: '#85C7A1',
  ivory: '#F9F7F3',
} as const;

/** NoutLife en modo oscuro (px de la pantalla del teléfono). */
export const APP = {
  bg: '#070d0a',
  surface: '#0f1813',
  surface2: '#15221b',
  border: '#1e2e25',
  text: '#e6f2e8',
  muted: '#8fae9c',
  jade: '#85c7a1',
  gold: '#d4b483',
  goldLight: '#ecd7ad',
  coliseo: '#ff6247',
  habitos: '#46dc9a',
  sabio: '#8a7bff',
  libreta: '#d4b483',
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
