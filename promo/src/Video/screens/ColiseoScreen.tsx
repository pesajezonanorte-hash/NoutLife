// Pantalla del Coliseo: el mapa de calor muscular (la misma figura y los mismos
// estados de fatiga que MuscleMap.tsx, en rojo y naranja neón) y el 1RM estimado.
// Las dos tarjetas se levantan de la pantalla en 3D. Datos de ejemplo.
import type React from 'react';
import { Swords, TrendingUp } from 'lucide-react';
import { COLORS, FONT, SPRING, ZONE, rgba } from '../theme';
import { EASE, clamp, ramp, springAt } from '../lib/anim';
import { BodyMap, FATIGUE_COLORS } from '../components/BodyMap';
import { COLISEO } from '../timeline';
import { CardSlots, Kicker, ScreenBg, StatusBar, TabBar, ZoneBar, liftCurve, surface, type PopCard } from './kit';

const ACCENT = ZONE.coliseo.glow;
const HEAT: typeof FATIGUE_COLORS = { high: '#ff4a4a', moderate: '#ff9b3d', fresh: '#46dc9a', idle: rgba(COLORS.textMuted, 0.3) };
const ROWS = [
  { label: 'Pecho', pct: 82, color: HEAT.high },
  { label: 'Hombros', pct: 64, color: HEAT.moderate },
  { label: 'Abdomen', pct: 12, color: HEAT.fresh },
];
/** 1RM de las últimas sesiones (kg): sube hasta hoy. */
const TREND = [92.5, 95, 95, 97.5, 100, 102.5];

const HeatCard: React.FC<{ local: number; frame: number }> = ({ local, frame }) => (
  <div style={{ position: 'absolute', inset: 0, ...surface(ACCENT, 1.3), overflow: 'hidden' }}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(60% 50% at 30% 42%, ${rgba(ACCENT, 0.16)}, transparent 70%)`,
      }}
    />
    <div style={{ position: 'absolute', left: 22, top: 26 }}>
      <BodyMap local={local} frame={frame} height={472} palette={HEAT} />
    </div>
    <div style={{ position: 'absolute', left: 264, right: 24, top: 34 }}>
      <Kicker color={rgba(ACCENT, 0.9)}>MAPA DE CALOR</Kicker>
      {ROWS.map((row, i) => {
        const p = springAt(local, 10 + i * 4, SPRING.pop);
        const n = Math.round(row.pct * clamp(ramp(local, 10 + i * 4, 26 + i * 4, EASE.out)));
        return (
          <div key={row.label} style={{ marginTop: i === 0 ? 22 : 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 26 }}>{row.label}</span>
              <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 24, color: row.color }}>{n}%</span>
            </div>
            <div style={{ marginTop: 9, height: 11, borderRadius: 6, background: rgba(COLORS.text, 0.08), overflow: 'hidden' }}>
              <div
                style={{
                  width: `${row.pct * clamp(p, 0, 1.05)}%`,
                  height: '100%',
                  borderRadius: 6,
                  background: `linear-gradient(90deg, ${rgba(row.color, 0.65)}, ${row.color})`,
                  boxShadow: `0 0 12px ${rgba(row.color, 0.7)}`,
                }}
              />
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['Fatiga alta', HEAT.high],
          ['Moderada', HEAT.moderate],
          ['Recuperado', HEAT.fresh],
        ].map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 19, fontWeight: 500, color: COLORS.textMuted }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  </div>
);

const OneRmCard: React.FC<{ local: number }> = ({ local }) => {
  const kg = 92.5 + 10 * ramp(local, 8, 34, EASE.out);
  const draw = ramp(local, 10, 34, EASE.out);
  const pts = TREND.map((v, i) => [12 + i * 34, 86 - ((v - 90) / 15) * 70] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  return (
    <div style={{ position: 'absolute', inset: 0, ...surface(ACCENT, 1.4), padding: '24px 26px' }}>
      <Kicker color={rgba(ACCENT, 0.9)}>1RM ESTIMADO</Kicker>
      <div style={{ marginTop: 6, fontWeight: 700, fontSize: 25 }}>Press banca</div>
      <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 56, letterSpacing: '-0.04em' }}>{kg.toFixed(1).replace('.', ',')}</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 26, color: COLORS.textMuted }}>kg</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 26,
          bottom: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 999,
          background: rgba(HEAT.fresh, 0.14),
          boxShadow: `inset 0 0 0 1.5px ${rgba(HEAT.fresh, 0.4)}`,
          fontFamily: FONT.mono,
          fontWeight: 700,
          fontSize: 19,
          color: HEAT.fresh,
          opacity: ramp(local, 30, 36),
        }}
      >
        <TrendingUp size={20} strokeWidth={2.4} />
        +10 kg
      </div>
      <svg width={200} height={100} viewBox="0 0 200 100" style={{ position: 'absolute', right: 24, top: 52, overflow: 'visible' }}>
        <defs>
          <linearGradient id="onerm" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={ZONE.coliseo.from} />
            <stop offset="1" stopColor={ZONE.coliseo.to} />
          </linearGradient>
        </defs>
        <path d={d} fill="none" stroke={rgba(ACCENT, 0.25)} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${draw} 1`} />
        <path d={d} fill="none" stroke="url(#onerm)" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={`${draw} 1`} />
        {draw > 0.98 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={8} fill="#fff" stroke={ACCENT} strokeWidth={4} />}
      </svg>
    </div>
  );
};

/** `local` = fotogramas desde que se abre la pantalla. */
export function coliseoCards(frame: number, local: number): PopCard[] {
  return [
    {
      key: 'heat',
      rect: { x: 20, y: 262, w: 522, h: 540 },
      lift: liftCurve(frame, COLISEO.lift, COLISEO.drop),
      z: 120,
      shift: { x: -26, y: -40 },
      grow: 0.05,
      node: <HeatCard local={local - 8} frame={frame} />,
    },
    {
      key: '1rm',
      rect: { x: 20, y: 822, w: 522, h: 210 },
      lift: liftCurve(frame, COLISEO.lift + 6, COLISEO.drop - 4),
      z: 230,
      shift: { x: 30, y: 40 },
      grow: 0.1,
      node: <OneRmCard local={local - 14} />,
    },
  ];
}

export const ColiseoScreen: React.FC<{ cards: PopCard[] }> = ({ cards }) => (
  <ScreenBg accent={ACCENT}>
    <StatusBar />
    <ZoneBar icon={Swords} accent={ACCENT} title="Coliseo" pro />
    <div style={{ position: 'absolute', left: 20, right: 20, top: 186, height: 56, display: 'flex', gap: 10 }}>
      {['Hoy', 'Mapa de calor', 'Récords'].map((t) => {
        const on = t === 'Mapa de calor';
        return (
          <div
            key={t}
            style={{
              flex: on ? 1.6 : 1,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: on ? 700 : 500,
              fontSize: 21,
              color: on ? COLORS.text : COLORS.textMuted,
              background: on ? rgba(ACCENT, 0.2) : rgba(COLORS.text, 0.04),
              boxShadow: on ? `inset 0 0 0 1.5px ${rgba(ACCENT, 0.5)}` : 'none',
            }}
          >
            {t}
          </div>
        );
      })}
    </div>
    <CardSlots cards={cards} />
    <TabBar active="coliseo" accent={ACCENT} />
  </ScreenBg>
);
