// El menú de la app (apps/web/src/components/layout/MenuSheet.tsx) en NoutLife Lite: la
// hoja que sube desde abajo con el asa, «Menú», la tarjeta del perfil y las zonas por
// secciones. Como en la app, en Lite las zonas Pro llevan el candado champán (NavLock) y
// van después de las que sí se usan; las tres fijadas en la barra (Hábitos, Agenda y
// Libreta) no se repiten. `unlock(id)` (0–1) quita el candado de cada zona.
import type React from 'react';
import {
  BarChart3,
  BookOpen,
  Clapperboard,
  Coins,
  Flag,
  Heart,
  ListChecks,
  Lock,
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
  X,
  type LucideIcon,
} from 'lucide-react';
import { FONT, rgba } from '../../Video/theme';
import { flash } from '../../Video/lib/anim';
import { APP, HAIRLINE, SH, SW, TYPE, pt } from './ui';

export interface MenuZone {
  id: string;
  label: string;
  icon: LucideIcon;
  pro?: boolean;
}

/** Secciones del menú con el orden de Lite (usable primero). Comunidad queda debajo, fuera de la pantalla. */
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

// ─── Geometría (px de pantalla) ─────────────────────────────────────────────
const PAD = pt(16);
/** max-h 92dvh: la hoja empieza en el 8 % de arriba. */
export const SHEET_TOP = SH * 0.08;
const HANDLE = { top: pt(12), w: pt(44), h: pt(6) };
const TITLE_TOP = SHEET_TOP + HANDLE.top + HANDLE.h + pt(12);
const CONTENT_TOP = TITLE_TOP + TYPE.headingLg.line + pt(8) + pt(8);
const PROFILE_H = pt(16) * 2 + TYPE.headingSm.line + TYPE.bodySm.line + pt(12) + pt(8) + 2 * HAIRLINE;
const COLS = 3;
const GAP = pt(8);
const TILE_W = (SW - 2 * PAD - (COLS - 1) * GAP) / COLS;
const TILE_H = pt(88);

/** Rectángulo de cada zona y de cada rótulo de sección. */
export const LAYOUT = (() => {
  const tiles: Record<string, { x: number; y: number; w: number; h: number }> = {};
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

/** Centro de una zona en la hoja abierta (px de pantalla). */
export const tileCenter = (id: string) => {
  const r = LAYOUT.tiles[id];
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
};

const CHIP = pt(40);
/** Centro del candado de una zona (px de pantalla), para saber cuándo lo cruza el haz. */
export const lockCenter = (id: string) => {
  const r = LAYOUT.tiles[id];
  const chipTop = r.y + (r.h - (CHIP + pt(8) + TYPE.labelMd.line)) / 2;
  return { x: r.x + r.w / 2 + CHIP / 2 + pt(6) - pt(8), y: chipTop - pt(4) + pt(8) };
};

const label = (t: { size: number; line: number }, weight: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: FONT.sans,
  fontSize: t.size,
  lineHeight: `${t.line}px`,
  fontWeight: weight,
  color,
  whiteSpace: 'nowrap',
  ...extra,
});

/** NavLock: círculo del fondo con anillo champán y el candado. */
const NavLock: React.FC<{ open: number }> = ({ open }) => {
  if (open >= 1) return null;
  const size = pt(16);
  return (
    <div
      style={{
        position: 'absolute',
        right: -pt(6),
        top: -pt(4),
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: APP.background,
        boxShadow: `inset 0 0 0 ${HAIRLINE}px ${rgba(APP.secondary, 0.6)}`,
        opacity: 1 - open,
        transform: `scale(${1 - 0.45 * open})`,
      }}
    >
      <Lock size={pt(10)} color={APP.secondary} strokeWidth={2.5} />
    </div>
  );
};

const Tile: React.FC<{ zone: MenuZone; open: number; glow: number }> = ({ zone, open, glow }) => {
  const r = LAYOUT.tiles[zone.id];
  const Icon = zone.icon;
  return (
    <div
      style={{
        position: 'absolute',
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: pt(16),
        background: APP.surface,
        boxShadow: `inset 0 0 0 ${HAIRLINE}px ${glow > 0.01 ? rgba(APP.primary, 0.2 + 0.5 * glow) : APP.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: pt(8),
      }}
    >
      <div
        style={{
          position: 'relative',
          width: CHIP,
          height: CHIP,
          borderRadius: pt(12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: rgba(APP.primary, APP.soft + 0.14 * glow),
        }}
      >
        <Icon size={pt(20)} color={APP.primaryText} strokeWidth={1.75} />
        {zone.pro && <NavLock open={open} />}
      </div>
      <span style={label(TYPE.labelMd, 600, APP.onSurface, { letterSpacing: '0.01em' })}>{zone.label}</span>
    </div>
  );
};

const Profile: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      left: PAD,
      right: PAD,
      top: CONTENT_TOP,
      height: PROFILE_H,
      borderRadius: pt(16),
      background: APP.surface,
      boxShadow: `inset 0 0 0 ${HAIRLINE}px ${APP.border}`,
      padding: pt(16),
      boxSizing: 'border-box',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={label(TYPE.headingSm, 600, APP.onBackground, { letterSpacing: '-0.01em' })}>Ana Restrepo</div>
        <div style={label(TYPE.bodySm, 400, APP.onSurfaceLight)}>Nivel 2 · Explorador</div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: pt(6),
          padding: `${pt(4)}px ${pt(12)}px`,
          borderRadius: 999,
          background: rgba(APP.warning, APP.soft),
          ...label(TYPE.labelLg, 600, APP.warning, { fontFamily: FONT.mono }),
        }}
      >
        <Coins size={pt(16)} color={APP.warning} strokeWidth={1.75} />
        1.240
      </div>
    </div>
    <div style={{ marginTop: pt(12), height: pt(8), borderRadius: 999, background: APP.surfaceVariant, overflow: 'hidden' }}>
      <div style={{ width: '72%', height: '100%', borderRadius: 999, background: APP.primary }} />
    </div>
  </div>
);

/**
 * `open` 0–1: la hoja sube (y el velo oscurece Inicio). `unlock(id)` y `glow(id)`: el
 * candado de cada zona (0 cerrado, 1 abierto) y la luz del haz sobre ella.
 */
export const MenuSheet: React.FC<{ open: number; unlock: (id: string) => number; glow: (id: string) => number }> = ({ open, unlock, glow }) => {
  if (open <= 0.001) return null;
  const travel = SH - SHEET_TOP + pt(24);
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: APP.scrim, opacity: Math.min(1, open) }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: SW,
          height: SH,
          transform: `translateY(${(1 - open) * travel}px)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: SHEET_TOP,
            bottom: -pt(40),
            borderRadius: `${pt(24)}px ${pt(24)}px 0 0`,
            background: APP.background,
            boxShadow: `inset 0 ${HAIRLINE}px 0 ${rgba('#ffffff', 0.05)}`,
          }}
        />
        <div style={{ position: 'absolute', left: (SW - HANDLE.w) / 2, top: SHEET_TOP + HANDLE.top, width: HANDLE.w, height: HANDLE.h, borderRadius: 999, background: rgba(APP.borderStrong, 0.6) }} />
        <div style={{ position: 'absolute', left: PAD, top: TITLE_TOP, ...label(TYPE.headingLg, 700, APP.onBackground, { letterSpacing: '-0.01em' }) }}>Menú</div>
        <div style={{ position: 'absolute', right: PAD - pt(8), top: TITLE_TOP + (TYPE.headingLg.line - pt(44)) / 2, width: pt(44), height: pt(44), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={pt(24)} color={APP.onSurface} strokeWidth={1.75} />
        </div>
        <Profile />
        {LAYOUT.labels.map((l) => (
          <div key={l.label} style={{ position: 'absolute', left: PAD, top: l.y, ...label(TYPE.labelMd, 600, APP.onSurfaceLight, { letterSpacing: '0.01em', textTransform: 'uppercase' }) }}>
            {l.label}
          </div>
        ))}
        {SECTIONS.flatMap((s) => s.items).map((zone) => (
          <Tile key={zone.id} zone={zone} open={zone.pro ? unlock(zone.id) : 0} glow={zone.pro ? glow(zone.id) : 0} />
        ))}
      </div>
    </>
  );
};

/** Destello corto del borde de una zona al abrirse. */
export const tileFlash = (frame: number, at: number) => flash(frame, at, 3, 10);
