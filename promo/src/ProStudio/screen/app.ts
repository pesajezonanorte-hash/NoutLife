// La app dentro del teléfono 3D: el lienzo de su pantalla (562 × 1190 px, un iPhone de
// 393 pt de ancho, 1 pt = 1,43 px), los tokens de Aurora en modo oscuro
// (apps/web/src/styles/tokens.css, html.dark, los mismos de Video/theme.ts) y el menú de
// NoutLife Lite (apps/web/src/components/layout/MenuSheet.tsx) con sus zonas. Blender
// usa esta pantalla como textura, así que la posición de Coliseo y Recreación también
// está en timeline.json: al cargar se comprueba que las dos coinciden.
import {
  BarChart3,
  BookOpen,
  Clapperboard,
  Flag,
  Heart,
  ListChecks,
  MapPin,
  Moon,
  NotebookPen,
  Scroll,
  ShoppingBag,
  Sparkles,
  Swords,
  Trophy,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { COLORS } from '../../Video/theme';
import { SCREEN as PLAN } from '../timeline';

export const SW = PLAN.w;
export const SH = PLAN.h;
/** px de pantalla por punto de la app. */
export const PT = SW / 393;
export const pt = (n: number) => n * PT;
/** Borde de 1 px CSS. */
export const HAIRLINE = PT;

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
  warning: COLORS.warning,
  /** --lq-soft-alpha en oscuro. */
  soft: 0.16,
  /** --scrim en oscuro. */
  scrim: 'rgba(4, 12, 8, 0.62)',
} as const;

/** Escala tipográfica (tailwind.config.ts): tamaño y alto de línea en px de pantalla. */
export const TYPE = {
  headingLg: { size: pt(24), line: pt(32) },
  headingSm: { size: pt(18), line: pt(26) },
  bodySm: { size: pt(14), line: pt(20) },
  labelLg: { size: pt(14), line: pt(20) },
  labelMd: { size: pt(12), line: pt(18) },
} as const;

export interface MenuZone {
  id: string;
  label: string;
  icon: LucideIcon;
  pro?: boolean;
}

/**
 * Secciones del menú con el orden de Lite: primero lo que se usa y después las zonas Pro
 * con candado. Las tres fijadas en la barra (Hábitos, Agenda y Libreta) no se repiten y
 * Comunidad queda debajo, fuera de la pantalla.
 */
export const SECTIONS: Array<{ label: string; items: MenuZone[] }> = [
  {
    label: 'Bienestar',
    items: [
      { id: 'achievements', label: 'Logros', icon: Trophy },
      { id: 'finances', label: 'Finanzas', icon: Wallet, pro: true },
      { id: 'food', label: 'Comida', icon: UtensilsCrossed, pro: true },
      { id: 'sleep', label: 'Sueño', icon: Moon, pro: true },
      { id: 'recreacion', label: 'Recreación', icon: Clapperboard, pro: true },
    ],
  },
  {
    label: 'Más zonas',
    items: [
      { id: 'checklists', label: 'Checklists', icon: ListChecks },
      { id: 'quests', label: 'Misiones', icon: Flag },
      { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
      { id: 'shop', label: 'Tienda', icon: ShoppingBag },
      { id: 'coliseo', label: 'Coliseo', icon: Swords, pro: true },
      { id: 'mirror', label: 'Espejo', icon: Sparkles, pro: true },
      { id: 'learning', label: 'Aprendizaje', icon: BookOpen, pro: true },
      { id: 'love', label: 'Relaciones', icon: Heart, pro: true },
      { id: 'journal', label: 'Diario', icon: NotebookPen, pro: true },
      { id: 'wisdom', label: 'Sabiduría', icon: Scroll, pro: true },
      { id: 'custom-zones', label: 'Mis zonas', icon: MapPin, pro: true },
    ],
  },
];
export const ZONES = SECTIONS.flatMap((s) => s.items);

// ─── Geometría de la hoja abierta (px de pantalla) ──────────────────────────
export const PAD = pt(16);
/** max-h 92dvh: la hoja empieza en el 8 % de arriba. */
export const SHEET_TOP = SH * 0.08;
export const HANDLE = { top: pt(12), w: pt(44), h: pt(6) };
export const TITLE_TOP = SHEET_TOP + HANDLE.top + HANDLE.h + pt(12);
export const CONTENT_TOP = TITLE_TOP + TYPE.headingLg.line + pt(8) + pt(8);
export const PROFILE_H = pt(16) * 2 + TYPE.headingSm.line + TYPE.bodySm.line + pt(12) + pt(8) + 2 * HAIRLINE;
const COLS = 3;
const GAP = pt(8);
const TILE_W = (SW - 2 * PAD - (COLS - 1) * GAP) / COLS;
const TILE_H = pt(88);
/** Ícono de cada zona (bg-primary/soft, rounded-xl) y su candado NavLock (16 pt, arriba a la derecha). */
export const CHIP = pt(40);
export const LOCK = pt(16);

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectángulo de cada zona y altura de cada rótulo de sección. */
export const LAYOUT = (() => {
  const tiles: Record<string, Rect> = {};
  const labels: Array<{ label: string; y: number }> = [];
  let y = CONTENT_TOP + PROFILE_H + pt(16);
  for (const section of SECTIONS) {
    labels.push({ label: section.label, y });
    y += TYPE.labelMd.line + pt(12);
    section.items.forEach((zone, i) => {
      const row = Math.floor(i / COLS);
      tiles[zone.id] = { x: PAD + (i % COLS) * (TILE_W + GAP), y: y + row * (TILE_H + GAP), w: TILE_W, h: TILE_H };
    });
    const rows = Math.ceil(section.items.length / COLS);
    y += rows * TILE_H + (rows - 1) * GAP + pt(24);
  }
  return { tiles, labels };
})();

/** Ícono de la zona: centrado en la baldosa, encima del rótulo. */
export function chipRect(id: string): Rect {
  const r = LAYOUT.tiles[id];
  const top = r.y + (r.h - (CHIP + pt(8) + TYPE.labelMd.line)) / 2;
  return { x: r.x + (r.w - CHIP) / 2, y: top, w: CHIP, h: CHIP };
}

/** Centro del candado de una zona (px de pantalla). */
export function lockCenter(id: string) {
  const c = chipRect(id);
  return { x: c.x + c.w + pt(6) - LOCK / 2, y: c.y - pt(4) + LOCK / 2 };
}

// Blender coloca las tarjetas de cristal sobre estas dos baldosas: si el menú cambia,
// hay que copiar los números nuevos a timeline.json (y volver a renderizar el teléfono).
for (const [id, planned] of Object.entries(PLAN.tiles)) {
  const r = LAYOUT.tiles[id];
  const off = Math.max(Math.abs(r.x - planned.x), Math.abs(r.y - planned.y), Math.abs(r.w - planned.w), Math.abs(r.h - planned.h));
  if (off > 0.05) {
    throw new Error(`La baldosa «${id}» está en ${JSON.stringify(r)} y timeline.json dice ${JSON.stringify(planned)}: actualiza screen.tiles.`);
  }
}
