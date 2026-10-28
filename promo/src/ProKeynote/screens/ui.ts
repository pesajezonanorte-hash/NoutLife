// La app dentro del teléfono, medida como en un iPhone de 393 pt de ancho: 1 pt de la app
// son 1,43 px de la pantalla del vídeo (562 × 1190). Colores: los tokens de Aurora en
// modo oscuro (apps/web/src/styles/tokens.css, html.dark), los mismos de Video/theme.ts.
import { COLORS } from '../../Video/theme';
import { SCREEN } from '../../Video/layout';

export const SW = SCREEN.w;
export const SH = SCREEN.h;
/** px de pantalla por punto de la app. */
export const PT = SW / 393;
export const pt = (n: number) => n * PT;

/** Tokens de la app con sus nombres de tokens.css. */
export const APP = {
  background: COLORS.bg,
  surface: COLORS.surface,
  surfaceVariant: COLORS.surfaceVariant,
  border: COLORS.border,
  borderStrong: COLORS.borderStrong,
  onBackground: COLORS.text,
  onSurface: COLORS.textSoft,
  onSurfaceLight: COLORS.textMuted,
  primary: COLORS.jade,
  primaryText: COLORS.jade300,
  secondary: COLORS.gold,
  success: COLORS.success,
  warning: COLORS.warning,
  info: COLORS.info,
  infoText: '#9cc7e0',
  errorText: '#f2a39b',
  /** --lq-soft-alpha en oscuro. */
  soft: 0.16,
  /** --scrim en oscuro. */
  scrim: 'rgba(4, 12, 8, 0.62)',
} as const;

/** Escala tipográfica (tailwind.config.ts): tamaño y alto de línea en px de pantalla. */
export const TYPE = {
  displaySm: { size: pt(32), line: pt(40) },
  headingLg: { size: pt(24), line: pt(32) },
  headingSm: { size: pt(18), line: pt(26) },
  bodyLg: { size: pt(16), line: pt(24) },
  bodySm: { size: pt(14), line: pt(20) },
  labelLg: { size: pt(14), line: pt(20) },
  labelMd: { size: pt(12), line: pt(18) },
} as const;

/** Borde de 1 px CSS. */
export const HAIRLINE = PT;
/** Barra de estado de iOS, cabecera móvil (h-14) y barra inferior (56 + pt-1 + zona del indicador). */
export const STATUS_H = pt(54);
export const HEADER_H = pt(56);
export const TABBAR_H = pt(56 + 4 + 34);
