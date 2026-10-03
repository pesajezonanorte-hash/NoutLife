// Tonos semánticos compartidos por Badge, IconChip, ProgressBar, charts…
// Solo clases de token (README regla 1). El tinte suave usa --lq-soft-alpha
// (.10 en claro, .16 en oscuro) igual que *-soft en lq.css.
export type Tone = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'muted';

/** Fondo suave + texto AA (chips, badges). */
export const softTone: Record<Tone, string> = {
  primary: 'bg-primary/[var(--lq-soft-alpha)] text-primary-text',
  secondary: 'bg-secondary/[var(--lq-soft-alpha)] text-secondary-text',
  success: 'bg-success/[var(--lq-soft-alpha)] text-success-text',
  warning: 'bg-warning/[var(--lq-soft-alpha)] text-warning-text',
  error: 'bg-error/[var(--lq-soft-alpha)] text-error-text',
  info: 'bg-info/[var(--lq-soft-alpha)] text-info-text',
  muted: 'bg-surface-variant text-on-surface-light',
};

/** Relleno sólido (barras, puntos, segmentos de chart). */
export const solidBg: Record<Tone, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
  muted: 'bg-on-surface-light',
};

/** Trazo SVG (anillos, líneas). */
export const strokeTone: Record<Tone, string> = {
  primary: 'stroke-primary',
  secondary: 'stroke-secondary',
  success: 'stroke-success',
  warning: 'stroke-warning',
  error: 'stroke-error',
  info: 'stroke-info',
  muted: 'stroke-on-surface-light',
};

/** Texto de estado (AA sobre background/surface). */
export const textTone: Record<Tone, string> = {
  primary: 'text-primary-text',
  secondary: 'text-secondary-text',
  success: 'text-success-text',
  warning: 'text-warning-text',
  error: 'text-error-text',
  info: 'text-info-text',
  muted: 'text-on-surface-light',
};
