// Inicio de la app en NoutLife Lite, y cómo se abre al pasar a Pro (escena 2): la
// ventana del cielo, tres zonas Pro con su candado de oro (Coliseo, Recreación y las
// analíticas, que en Lite solo ven 5 días), los hábitos de hoy con el límite de Lite
// y la racha. Un haz de luz jade cruza cada zona, el candado se abre y la zona sale
// del teléfono; luego los hábitos pasan a «Ilimitados» y la racha se enciende.
// Datos de ejemplo («Hola, Ana»).
import type React from 'react';
import { BarChart3, Bell, Check, Clapperboard, Flame, Gem, Infinity as InfinityIcon, Search, Swords, type LucideIcon } from 'lucide-react';
import { COLORS, FONT, rgba } from '../../Video/theme';
import { EASE, clamp, flash, lerp, ramp, rng, springAt } from '../../Video/lib/anim';
import { IconChip } from '../../Video/components/ui';
import { NoutLifeMark, Wordmark } from '../../Video/components/Brand';
import { HEADER_LOGO } from '../../Video/screens/HomeScreen';
import { CardSlots, Kicker, ScreenBg, StatusBar, TabBar, fadeUp, liftCurve, type PopCard } from '../../Video/screens/kit';
import { AD, AD_SPRING } from '../brand';
import { UNLOCK, type UnlockZone } from '../timeline';
import { SkyWindow } from './SkyWindow';

/** Geometría de la pantalla (px de pantalla, 562 × 1190). */
const WINDOW = { x: 20, y: 266, w: 522, h: 214 };
const ZONES_TOP = 504;
const TILE = { y: 548, w: 166, h: 196, gap: 12 };
const HABITS = { x: 20, y: 762, w: 522, h: 118 };
const STREAK = { x: 20, y: 894, w: 522, h: 148 };

interface ZoneInfo {
  label: string;
  icon: LucideIcon;
  /** Lo que se ve en Lite (difuminado) y al abrirse. */
  lite: string;
  pro: string;
}
const ZONES: Record<UnlockZone, ZoneInfo> = {
  coliseo: { label: 'Coliseo', icon: Swords, lite: 'Zona Pro', pro: '1RM 102,5 kg' },
  recreacion: { label: 'Recreación', icon: Clapperboard, lite: 'Zona Pro', pro: '3 pelis · 1 serie' },
  analiticas: { label: 'Analíticas', icon: BarChart3, lite: 'Últimos 5 días', pro: 'Historial completo' },
};
const ZONE_ORDER: UnlockZone[] = ['coliseo', 'recreacion', 'analiticas'];

/** Candado dibujado a mano para poder abrir el arco: `open` 0 → 1. */
const Padlock: React.FC<{ size: number; open: number; color: string }> = ({ size, open, color }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
    <rect x="5" y="11" width="14" height="10" rx="2.4" fill={rgba(color, 0.14)} />
    <path d="M8 11V7.5a4 4 0 0 1 8 0V11" transform={`translate(0 ${-3.2 * open}) rotate(${26 * open} 16 11)`} />
  </svg>
);

/** Chispas jade que salen del candado al abrirse. */
const Sparks: React.FC<{ frame: number; at: number; seed: number }> = ({ frame, at, seed }) => {
  const p = ramp(frame, at, at + 16, EASE.out);
  if (p <= 0 || p >= 1) return null;
  const r = rng(seed);
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => {
        const angle = (i / 7) * Math.PI * 2 + r() * 0.6;
        const dist = (34 + r() * 30) * p;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: Math.cos(angle) * dist - 3,
              top: Math.sin(angle) * dist - 3,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: AD.jadeLight,
              boxShadow: `0 0 8px ${AD.jade}`,
              opacity: 1 - p,
            }}
          />
        );
      })}
    </>
  );
};

const ZoneTile: React.FC<{ frame: number; id: UnlockZone }> = ({ frame, id }) => {
  const at = UNLOCK.zones[id];
  const z = ZONES[id];
  const beam = ramp(frame, at - 9, at + 3, EASE.inOut);
  const open = ramp(frame, at - 1, at + 9, EASE.out);
  const shackle = springAt(frame, at - 2, AD_SPRING.pop);
  const gone = springAt(frame, at + 5, AD_SPRING.settle);
  const glow = flash(frame, at, 3, 12);
  const accent = COLORS.jade;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 28,
        overflow: 'hidden',
        background: `radial-gradient(90% 70% at 50% 34%, ${rgba(AD.jade, 0.45 * glow)} 0%, transparent 70%), linear-gradient(160deg, ${rgba(accent, 0.08 + 0.16 * open)} 0%, ${rgba('#0f1813', 0.96)} 72%)`,
        boxShadow: `inset 0 0 0 ${1.5 + 1.5 * glow}px ${rgba(open > 0.5 ? AD.jade : COLORS.gold, 0.22 + 0.25 * open + 0.5 * glow)}`,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: lerp(0.4, 1, open), filter: open < 0.98 ? `blur(${lerp(2.6, 0, open)}px)` : undefined }}>
        <div style={{ position: 'absolute', left: 16, top: 16 }}>
          <IconChip icon={z.icon} color={accent} size={52} />
        </div>
        <div style={{ position: 'absolute', left: 18, right: 12, bottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{z.label}</div>
          <div style={{ position: 'relative', marginTop: 5, height: 22, fontFamily: FONT.mono, fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>
            <span style={{ position: 'absolute', left: 0, color: COLORS.textMuted, opacity: 1 - open }}>{z.lite}</span>
            <span style={{ position: 'absolute', left: 0, color: COLORS.jade300, opacity: open }}>{z.pro}</span>
          </div>
        </div>
      </div>
      {/* El candado: se abre el arco y se va */}
      {gone < 0.99 && (
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: 18,
            width: 50,
            height: 50,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: rgba(COLORS.bg, 0.9),
            boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.gold, 0.6)}, 0 0 ${18 * glow}px ${rgba(AD.jade, 0.8 * glow)}`,
            transform: `scale(${(1 - gone) * (1 + 0.12 * glow)})`,
            opacity: clamp(1.4 - 1.4 * gone),
          }}
        >
          <Padlock size={26} open={clamp(shackle)} color={open > 0.4 ? AD.jadeLight : COLORS.gold} />
        </div>
      )}
      <div style={{ position: 'absolute', right: 39, top: 43 }}>
        <Sparks frame={frame} at={at} seed={at} />
      </div>
      {/* El haz de luz jade que cruza la zona */}
      {beam > 0 && beam < 1 && (
        <div
          style={{
            position: 'absolute',
            top: -30,
            bottom: -30,
            left: `${lerp(-75, 125, beam)}%`,
            width: '58%',
            transform: 'skewX(-18deg)',
            background: `linear-gradient(100deg, transparent 0%, ${rgba(AD.jade, 0.25)} 30%, ${rgba(AD.jadeLight, 0.75)} 48%, rgba(255, 255, 255, 0.7) 52%, ${rgba(AD.jadeLight, 0.6)} 58%, transparent 100%)`,
            opacity: Math.sin(Math.PI * beam),
          }}
        />
      )}
    </div>
  );
};

const HabitsCard: React.FC<{ frame: number }> = ({ frame }) => {
  const up = ramp(frame, UNLOCK.habits, UNLOCK.habits + 10, EASE.out);
  const fill = lerp(2 / 3, 1, ramp(frame, UNLOCK.habits + 3, UNLOCK.habits + 18, EASE.inOut));
  const done = frame >= UNLOCK.habits + 12;
  const glow = flash(frame, UNLOCK.habits, 3, 12);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 28,
        padding: '20px 22px',
        background: 'linear-gradient(165deg, #131f19, #0c1511)',
        boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.jade, 0.16 + 0.4 * glow)}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Kicker>HÁBITOS DE HOY</Kicker>
        <div style={{ position: 'relative', marginLeft: 'auto', height: 32, width: 170 }}>
          {/* Lite: límite de 3 activos · Pro: ilimitados */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 12px',
              borderRadius: 999,
              background: rgba(COLORS.gold, 0.1),
              boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.gold, 0.4)}`,
              fontFamily: FONT.mono,
              fontWeight: 700,
              fontSize: 15,
              color: COLORS.gold,
              whiteSpace: 'nowrap',
              opacity: 1 - up,
              transform: `translateY(${-8 * up}px)`,
            }}
          >
            <Padlock size={15} open={0} color={COLORS.gold} />3 de 3 · Lite
          </div>
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 14px',
              borderRadius: 999,
              background: rgba(COLORS.jade, 0.16),
              boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.jade, 0.5)}`,
              fontFamily: FONT.mono,
              fontWeight: 700,
              fontSize: 15,
              color: COLORS.jade300,
              whiteSpace: 'nowrap',
              opacity: up,
              transform: `translateY(${8 * (1 - up)}px) scale(${0.9 + 0.1 * springAt(frame, UNLOCK.habits, AD_SPRING.pop)})`,
            }}
          >
            <InfinityIcon size={18} strokeWidth={2.4} />
            Ilimitados
          </div>
        </div>
      </div>
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1, height: 16, borderRadius: 8, background: rgba(COLORS.text, 0.08), overflow: 'hidden' }}>
          <div
            style={{
              width: `${fill * 100}%`,
              height: '100%',
              borderRadius: 8,
              background: `linear-gradient(90deg, ${COLORS.jade600}, ${COLORS.jade} 70%, ${COLORS.jade300})`,
              boxShadow: `0 0 ${10 + 14 * glow}px ${rgba(COLORS.jade, 0.6)}`,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FONT.mono, fontWeight: 700, fontSize: 22, color: done ? COLORS.jade300 : COLORS.text }}>
          {done && <Check size={20} strokeWidth={3} />}
          {done ? '3/3' : '2/3'}
        </div>
      </div>
    </div>
  );
};

const StreakCard: React.FC<{ frame: number }> = ({ frame }) => {
  const at = UNLOCK.streak;
  const ignite = flash(frame, at, 4, 20);
  const lit = ramp(frame, at - 2, at + 8, EASE.out);
  // El número sube de 12 a 13: el viejo sale por arriba y el nuevo entra desde abajo
  const flip = springAt(frame, at + 2, AD_SPRING.pop);
  const warm = COLORS.warning;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 30,
        padding: '22px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        background: `radial-gradient(70% 90% at 14% 50%, ${rgba(warm, 0.08 + 0.22 * lit + 0.25 * ignite)} 0%, transparent 70%), linear-gradient(165deg, #151b14, #0c1511)`,
        boxShadow: `inset 0 0 0 1.5px ${rgba(warm, 0.18 + 0.3 * lit + 0.4 * ignite)}`,
      }}
    >
      <div style={{ position: 'relative', transform: `scale(${1 + 0.18 * ignite})` }}>
        <div
          style={{
            position: 'absolute',
            inset: -26,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${rgba(warm, 0.5 * lit + 0.4 * ignite)} 0%, transparent 65%)`,
          }}
        />
        <IconChip icon={Flame} color={lit > 0.5 ? warm : COLORS.textMuted} size={92} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ position: 'relative', height: 60, width: 74, overflow: 'hidden' }}>
            {[12, 13].map((n, i) => (
              <div
                key={n}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  fontWeight: 800,
                  fontSize: 58,
                  lineHeight: 1.05,
                  letterSpacing: '-0.03em',
                  color: i === 1 ? COLORS.goldLight : COLORS.text,
                  transform: `translateY(${(i - flip) * 62}px)`,
                }}
              >
                {n}
              </div>
            ))}
          </div>
          <div style={{ fontWeight: 700, fontSize: 25, color: COLORS.textSoft }}>días de racha</div>
        </div>
        <div style={{ marginTop: 6, fontFamily: FONT.mono, fontWeight: 600, fontSize: 17, color: lit > 0.5 ? warm : COLORS.textMuted }}>
          {lit > 0.5 ? '¡Racha activa! Sigue así' : 'Completa hoy para sumar'}
        </div>
      </div>
    </div>
  );
};

/** Las zonas y la racha como tarjetas que pueden salir del teléfono (PopCard del kit). */
export function liteHomeCards(frame: number): PopCard[] {
  const zoneCards: PopCard[] = ZONE_ORDER.map((id, i) => {
    const at = UNLOCK.zones[id];
    return {
      key: id,
      rect: { x: 20 + i * (TILE.w + TILE.gap), y: TILE.y, w: TILE.w, h: TILE.h },
      lift: liftCurve(frame, at, at + 22),
      z: 120,
      shift: { x: (i - 1) * 16, y: -18 },
      grow: 0.14,
      node: <ZoneTile frame={frame} id={id} />,
    };
  });
  return [
    ...zoneCards,
    {
      key: 'streak',
      rect: STREAK,
      lift: liftCurve(frame, UNLOCK.streak + 1, UNLOCK.turn + 6),
      z: 230,
      shift: { x: 0, y: -46 },
      grow: 0.2,
      node: <StreakCard frame={frame} />,
    },
  ];
}

export const LiteHome: React.FC<{ frame: number; at: number; cards: PopCard[] }> = ({ frame, at, cards }) => {
  const pro = ramp(frame, UNLOCK.zones.analiticas + 4, UNLOCK.zones.analiticas + 14, EASE.out);
  const proPop = springAt(frame, UNLOCK.zones.analiticas + 4, AD_SPRING.pop);
  return (
    <ScreenBg>
      <StatusBar />
      <div style={{ ...fadeUp(frame, at, 10), position: 'absolute', inset: 0 }}>
        <div style={{ position: 'absolute', left: HEADER_LOGO.markLeft, top: HEADER_LOGO.markTop }}>
          <NoutLifeMark height={HEADER_LOGO.markHeight} />
        </div>
        <div style={{ position: 'absolute', left: HEADER_LOGO.wordmarkLeft, top: HEADER_LOGO.wordmarkTop }}>
          <Wordmark width={HEADER_LOGO.wordmarkWidth} />
        </div>
        <div style={{ position: 'absolute', right: 26, top: 110, display: 'flex', gap: 22 }}>
          <Search size={32} color={COLORS.textSoft} strokeWidth={1.9} />
          <Bell size={32} color={COLORS.textSoft} strokeWidth={1.9} />
        </div>
      </div>
      <div style={{ ...fadeUp(frame, at + 2), position: 'absolute', left: 26, top: 170 }}>
        <Kicker>BUENOS DÍAS</Kicker>
        <div style={{ marginTop: 2, fontWeight: 800, fontSize: 50, letterSpacing: '-0.025em' }}>Hola, Ana</div>
      </div>
      <div style={{ ...fadeUp(frame, at + 4), position: 'absolute', left: WINDOW.x, top: WINDOW.y }}>
        <SkyWindow frame={frame} width={WINDOW.w} height={WINDOW.h} />
      </div>
      <div style={{ ...fadeUp(frame, at + 6), position: 'absolute', left: 26, right: 26, top: ZONES_TOP, display: 'flex', alignItems: 'center' }}>
        <Kicker>TUS ZONAS</Kicker>
        <div style={{ position: 'relative', marginLeft: 'auto', height: 28 }}>
          <div style={{ position: 'absolute', right: 0, fontFamily: FONT.mono, fontWeight: 700, fontSize: 15, letterSpacing: '0.16em', color: COLORS.textMuted, opacity: 1 - pro, whiteSpace: 'nowrap' }}>
            NOUTLIFE LITE
          </div>
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: -4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 999,
              background: rgba(COLORS.gold, 0.14),
              boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.gold, 0.55)}`,
              fontFamily: FONT.mono,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: '0.16em',
              color: COLORS.gold,
              whiteSpace: 'nowrap',
              opacity: pro,
              transform: `scale(${0.7 + 0.3 * proPop})`,
              transformOrigin: 'right center',
            }}
          >
            <Gem size={15} strokeWidth={2.4} />
            NOUTLIFE PRO
          </div>
        </div>
      </div>
      <div style={{ ...fadeUp(frame, at + 8), position: 'absolute', inset: 0 }}>
        <CardSlots cards={cards.filter((c) => c.key !== 'streak')} />
      </div>
      <div style={{ ...fadeUp(frame, at + 10), position: 'absolute', left: HABITS.x, top: HABITS.y, width: HABITS.w, height: HABITS.h }}>
        <HabitsCard frame={frame} />
      </div>
      <div style={{ ...fadeUp(frame, at + 12), position: 'absolute', inset: 0 }}>
        <CardSlots cards={cards.filter((c) => c.key === 'streak')} />
      </div>
      <div style={{ ...fadeUp(frame, at + 14), position: 'absolute', inset: 0 }}>
        <TabBar active="home" locks={{ coliseo: 1 - ramp(frame, UNLOCK.zones.coliseo, UNLOCK.zones.coliseo + 8) }} />
      </div>
    </ScreenBg>
  );
};
