// La pantalla del teléfono en cada fotograma del anuncio. No se ve en el anuncio tal
// cual: se renderiza a escala 3 como secuencia de imágenes (npm run studio:screen) y
// Blender la pone en la pantalla del teléfono, con sus reflejos y su desenfoque.
//
// Es el menú de NoutLife Lite abierto: las zonas Pro llevan el candado champán (NavLock).
// Cuando Coliseo y Recreación salen como tarjetas de cristal, su baldosa destella; luego
// cada candado se abre (el arco sube y gira), la baldosa se ilumina en jade con una onda,
// y el resto de zonas Pro se abren en cadena desde las dos primeras.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { X } from 'lucide-react';
import '../../Video/fonts';
import { FONT, rgba } from '../../Video/theme';
import { StatusBar } from '../../Video/screens/kit';
import { flash, lerp, ramp } from '../../Video/lib/anim';
import { AD } from '../palette';
import { EASE } from '../motion';
import { DEVICE } from '../timeline';
import {
  APP,
  CHIP,
  CONTENT_TOP,
  HAIRLINE,
  HANDLE,
  LAYOUT,
  LOCK,
  PAD,
  PROFILE_H,
  SHEET_TOP,
  SH,
  SW,
  TITLE_TOP,
  TYPE,
  ZONES,
  chipRect,
  lockCenter,
  pt,
  type MenuZone,
} from './app';

const HERO = DEVICE.unlock as Record<string, number>;
const LIFT = DEVICE.cards as Record<string, number>;

/**
 * Fotograma en que se abre cada zona Pro: Coliseo y Recreación en su momento; las demás
 * en cadena durante `ripple`, primero las más cercanas a esas dos.
 */
const UNLOCK_AT: Record<string, number> = (() => {
  const heroes = Object.keys(HERO).map(lockCenter);
  const others = ZONES.filter((z) => z.pro && !(z.id in HERO)).map((z) => {
    const c = lockCenter(z.id);
    return { id: z.id, d: Math.min(...heroes.map((h) => Math.hypot(c.x - h.x, c.y - h.y))) };
  });
  const far = Math.max(...others.map((o) => o.d));
  const [a, b] = DEVICE.ripple;
  return {
    ...HERO,
    ...Object.fromEntries(others.map((o) => [o.id, Math.round(lerp(a, b, o.d / far))])),
  };
})();

const text = (t: { size: number; line: number }, weight: number, color: string, extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: FONT.sans,
  fontSize: t.size,
  lineHeight: `${t.line}px`,
  fontWeight: weight,
  color,
  whiteSpace: 'nowrap',
  ...extra,
});

/** Estado de una zona Pro en el fotograma: candado, luz jade y onda. */
function zoneState(id: string, frame: number) {
  const at = UNLOCK_AT[id];
  const hero = id in HERO;
  const shackle = ramp(frame, at, at + 7, EASE.text);
  // El candado se vuelve jade al abrirse y luego se va (en la app, Pro no lleva candado)
  const tint = ramp(frame, at + 2, at + 9, EASE.inOut);
  const gone = ramp(frame, at + 9, at + 20, EASE.inOut);
  // La luz sube con el candado (8 fotogramas, sin golpe: en el primer plano la baldosa es
  // grande y un arranque brusco salta muchos niveles de luma de un fotograma a otro) y se
  // posa en un brillo tranquilo que queda
  const peak = ramp(frame, at + 1, at + 9, EASE.inOut) * Math.exp(-Math.max(0, frame - (at + 9)) / 16);
  const lit = Math.max(peak, ramp(frame, at + 2, at + 14, EASE.inOut) * (hero ? 0.42 : 0.2)) * (hero ? 1 : 0.7);
  const ring = ramp(frame, at + 3, at + (hero ? 30 : 22), EASE.text);
  const ringIn = ramp(frame, at + 3, at + 8, EASE.inOut);
  const lift = id in LIFT ? flash(frame, LIFT[id], 4, 14) : 0;
  return { shackle, tint, gone, lit, ring, ringIn, lift, hero };
}

/** Candado NavLock: círculo del fondo con anillo champán; el arco se abre y el candado se va. */
const LockBadge: React.FC<{ shackle: number; tint: number; gone: number }> = ({ shackle, tint, gone }) => {
  if (gone >= 1) return null;
  const color = tint > 0 ? mixHex(APP.secondary, AD.jadeBright, tint) : APP.secondary;
  return (
    <div
      style={{
        position: 'absolute',
        right: -pt(6),
        top: -pt(4),
        width: LOCK,
        height: LOCK,
        borderRadius: '50%',
        background: APP.background,
        boxShadow: `inset 0 0 0 ${HAIRLINE}px ${rgba(color, 0.6)}`,
        opacity: 1 - gone,
        transform: `scale(${1 - 0.5 * gone})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={pt(10)} height={pt(10)} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
        <rect x={4.5} y={11} width={15} height={10.5} rx={2.2} />
        {/* El arco sube y gira sobre su pata derecha: la izquierda sale del cuerpo */}
        <path d="M8 11V7a4 4 0 0 1 8 0v4" transform={`translate(0 ${-3 * shackle}) rotate(${-24 * shackle} 16 11)`} />
      </svg>
    </div>
  );
};

const Tile: React.FC<{ zone: MenuZone; frame: number }> = ({ zone, frame }) => {
  const r = LAYOUT.tiles[zone.id];
  const chip = chipRect(zone.id);
  const Icon = zone.icon;
  const s = zone.pro ? zoneState(zone.id, frame) : null;
  const lit = s?.lit ?? 0;
  const lift = s?.lift ?? 0;
  const cx = chip.x + chip.w / 2 - r.x;
  const cy = chip.y + chip.h / 2 - r.y;
  const ringR = s ? lerp(CHIP * 0.5, r.w * (s.hero ? 0.95 : 0.7), s.ring) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: pt(16),
        overflow: 'hidden',
        background: lit > 0.001 ? `radial-gradient(${r.w * 0.9}px ${r.h * 0.95}px at ${cx}px ${cy}px, ${rgba(AD.jade, 0.42 * lit)} 0%, ${rgba(AD.jade, 0.1 * lit)} 55%, transparent 100%), ${APP.surface}` : APP.surface,
        boxShadow: `inset 0 0 0 ${HAIRLINE}px ${
          lit > 0.001 ? rgba(AD.jadeBright, 0.18 + 0.62 * lit) : lift > 0.001 ? rgba('#ffffff', 0.08 + 0.3 * lift) : APP.border
        }`,
      }}
    >
      {/* Brillo de cristal al salir la tarjeta: una franja que cruza la baldosa */}
      {lift > 0.001 && (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(115deg, transparent 20%, ${rgba('#ffffff', 0.16 * lift)} 48%, transparent 76%)` }} />
      )}
      {s && s.ring > 0 && s.ring < 1 && (
        <div
          style={{
            position: 'absolute',
            left: cx - ringR,
            top: cy - ringR,
            width: ringR * 2,
            height: ringR * 2,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 ${pt(1.5)}px ${rgba(AD.jadeBright, 0.85 * (1 - s.ring) * s.ringIn)}`,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: chip.x - r.x,
          top: chip.y - r.y,
          width: CHIP,
          height: CHIP,
          borderRadius: pt(12),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: lit > 0.001 ? rgba(AD.jade, 0.2 + 0.4 * lit) : rgba(APP.primary, APP.soft),
        }}
      >
        <Icon size={pt(20)} color={lit > 0.001 ? mixHex(APP.primaryText, '#f0fdf8', Math.min(1, lit * 1.4)) : APP.primaryText} strokeWidth={1.75} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: chip.y - r.y + CHIP + pt(8), textAlign: 'center', ...text(TYPE.labelMd, 600, lit > 0.001 ? mixHex(APP.onSurface, '#ffffff', lit) : APP.onSurface, { letterSpacing: '0.01em' }) }}>
        {zone.label}
      </div>
      {s && (
        <div style={{ position: 'absolute', left: chip.x - r.x, top: chip.y - r.y, width: CHIP, height: CHIP }}>
          <LockBadge shackle={s.shackle} tint={s.tint} gone={s.gone} />
        </div>
      )}
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
        <div style={text(TYPE.headingSm, 600, APP.onBackground, { letterSpacing: '-0.01em' })}>Ana Restrepo</div>
        <div style={text(TYPE.bodySm, 400, APP.onSurfaceLight)}>Nivel 2 · Explorador</div>
      </div>
      <div
        style={{
          padding: `${pt(4)}px ${pt(12)}px`,
          borderRadius: 999,
          background: rgba(APP.warning, APP.soft),
          ...text(TYPE.labelLg, 600, APP.warning, { fontFamily: FONT.mono }),
        }}
      >
        1.240
      </div>
    </div>
    <div style={{ marginTop: pt(12), height: pt(8), borderRadius: 999, background: APP.surfaceVariant, overflow: 'hidden' }}>
      <div style={{ width: '72%', height: '100%', borderRadius: 999, background: APP.primary }} />
    </div>
  </div>
);

/** La isla dinámica (Video/layout ISLAND: 176 × 52 px a 20 px del borde). */
const Island: React.FC = () => <div style={{ position: 'absolute', left: (SW - 176) / 2, top: 20, width: 176, height: 52, borderRadius: 26, background: '#000' }} />;

export const StudioScreen: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ width: SW, height: SH, background: '#040907', overflow: 'hidden', fontFamily: FONT.sans }}>
      {/* Inicio queda detrás del velo: solo asoma la franja de arriba */}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${APP.background} 0%, #050b08 100%)` }} />
      <div style={{ position: 'absolute', inset: 0, background: APP.scrim }} />
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
      <div style={{ position: 'absolute', left: PAD, top: TITLE_TOP, ...text(TYPE.headingLg, 700, APP.onBackground, { letterSpacing: '-0.01em' }) }}>Menú</div>
      <div style={{ position: 'absolute', right: PAD - pt(8), top: TITLE_TOP + (TYPE.headingLg.line - pt(44)) / 2, width: pt(44), height: pt(44), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={pt(24)} color={APP.onSurface} strokeWidth={1.75} />
      </div>
      <Profile />
      {LAYOUT.labels.map((l) => (
        <div key={l.label} style={{ position: 'absolute', left: PAD, top: l.y, ...text(TYPE.labelMd, 600, APP.onSurfaceLight, { letterSpacing: '0.01em', textTransform: 'uppercase' }) }}>
          {l.label}
        </div>
      ))}
      {ZONES.map((zone) => (
        <Tile key={zone.id} zone={zone} frame={frame} />
      ))}
      <StatusBar />
      <Island />
      <div style={{ position: 'absolute', left: (SW - pt(134)) / 2, bottom: pt(8), width: pt(134), height: pt(5), borderRadius: 999, background: rgba(APP.onBackground, 0.9) }} />
    </AbsoluteFill>
  );
};

/** Mezcla dos `#rrggbb` (t = 0 → a, 1 → b). */
function mixHex(a: string, b: string, t: number) {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
