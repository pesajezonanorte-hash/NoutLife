// Tarjeta de la Libreta de Hábitos y Rituales: renglones de libreta, checks de
// tinta que se trazan en corcheas (con «+10 XP» que sube) y el ritual de mañana
// que se completa. Como en la app, el check es un círculo hecho a mano.
import type React from 'react';
import { CheckCircle2, Flame, Sun } from 'lucide-react';
import { COLORS, FONT, SPRING, rgba } from '../../theme';
import { EASE, clamp, ramp, springAt } from '../../lib/anim';
import { GlowCard, ZoneHeader } from '../../components/ui';
import { CARD } from '../../layout';

/** Fotograma (desde que entra la tarjeta) de cada check: f378, 386, 394, 402. */
const HABITS = [
  { name: 'Meditar 10 min', streak: 12, at: 18 },
  { name: 'Leer 20 páginas', streak: 8, at: 26 },
  { name: 'Beber 2 L de agua', streak: 21, at: 34 },
  { name: 'Entrenar', streak: 5, at: 42 },
];
const ROW_TOP = 278;
const ROW_H = 98;
const RITUAL_STEPS = [24, 30, 36, 42];

/** Círculo «a mano»: un radio que ondula un poco y no cierra perfecto. */
const SKETCH_CIRCLE = (() => {
  let d = '';
  for (let k = 0; k <= 64; k++) {
    const a = (k / 64) * Math.PI * 2.06 - 1.9;
    const r = 25 + Math.sin(a * 3 + 0.6) * 1.1 + Math.sin(a * 5) * 0.6;
    d += `${k === 0 ? 'M' : 'L'}${(30 + r * Math.cos(a)).toFixed(2)} ${(30 + r * Math.sin(a)).toFixed(2)}`;
  }
  return d;
})();

const InkCheck: React.FC<{ local: number; at: number }> = ({ local, at }) => {
  const press = ramp(local, at - 3, at, EASE.out);
  const back = springAt(local, at, SPRING.snappy);
  const scale = 1 - 0.14 * press + 0.14 * back;
  const ink = ramp(local, at, at + 7, EASE.out);
  const on = local >= at;
  return (
    <svg width={60} height={60} viewBox="0 0 60 60" style={{ overflow: 'visible', transform: `scale(${scale})`, flexShrink: 0 }}>
      <path d={SKETCH_CIRCLE} fill={on ? rgba(COLORS.jade, 0.14 * ink) : 'none'} stroke={on ? COLORS.jade : rgba(COLORS.text, 0.38)} strokeWidth={3} strokeLinecap="round" />
      <path
        d="M17 31 L26.5 40.5 L44 20"
        fill="none"
        stroke={COLORS.jade300}
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={`${ink} 1`}
        opacity={ink > 0.01 ? 1 : 0}
        style={{ filter: `drop-shadow(0 0 6px ${rgba(COLORS.jade, 0.7)})` }}
      />
    </svg>
  );
};

export const HabitosCard: React.FC<{ local: number; frame: number }> = ({ local, frame }) => {
  const ritualSteps = RITUAL_STEPS.filter((s) => local >= s).length;
  // El anillo avanza un cuarto con cada paso, con un rebote corto
  const ring = RITUAL_STEPS.reduce((sum, s) => sum + springAt(local, s, SPRING.snappy), 0) / RITUAL_STEPS.length;
  const done = springAt(local, 44, SPRING.snappy);
  const C = 2 * Math.PI * 54;
  return (
    <GlowCard frame={frame} accent={COLORS.jade} width={CARD.w} height={CARD.h}>
      <ZoneHeader
        icon={CheckCircle2}
        accent={COLORS.success}
        kicker="ZONA 03 · LIBRETA"
        title="Hábitos y Rituales"
        titleSize={54}
        subtitle="Rachas, XP y rituales de cada día"
      />

      {/* Renglones y margen de libreta */}
      {HABITS.map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: 40, right: 40, top: ROW_TOP + (i + 1) * ROW_H - 10, height: 1.5, background: rgba(COLORS.jade, 0.12) }} />
      ))}
      <div style={{ position: 'absolute', left: 140, top: ROW_TOP - 14, width: 1.5, height: ROW_H * 4 + 4, background: rgba(COLORS.error, 0.22) }} />

      {HABITS.map((h, i) => {
        const p = springAt(local, 4 + i * 3, SPRING.smooth, 14);
        const xp = ramp(local, h.at, h.at + 18, EASE.out);
        const xpOpacity = ramp(local, h.at, h.at + 4) * (1 - ramp(local, h.at + 10, h.at + 18));
        return (
          <div
            key={h.name}
            style={{
              position: 'absolute',
              left: 58,
              right: 54,
              top: ROW_TOP + i * ROW_H,
              height: ROW_H - 10,
              display: 'flex',
              alignItems: 'center',
              gap: 52,
              opacity: p,
              transform: `translateX(${(1 - p) * 30}px)`,
            }}
          >
            <InkCheck local={local} at={h.at} />
            <span style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 34, color: local >= h.at ? COLORS.text : COLORS.textSoft }}>{h.name}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontFamily: FONT.mono, fontWeight: 700, fontSize: 28, color: COLORS.gold }}>
              <Flame size={28} color={COLORS.gold} strokeWidth={2.2} />
              {h.streak + (local >= h.at ? 1 : 0)}
            </span>
            <span
              style={{
                position: 'absolute',
                right: 96,
                top: 4,
                fontFamily: FONT.mono,
                fontWeight: 700,
                fontSize: 26,
                color: COLORS.goldLight,
                textShadow: `0 0 14px ${rgba(COLORS.gold, 0.8)}`,
                opacity: xpOpacity,
                transform: `translateY(${-46 * xp}px)`,
              }}
            >
              +10 XP
            </span>
          </div>
        );
      })}

      {/* Ritual de mañana */}
      <div
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          top: 702,
          height: 300,
          borderRadius: 34,
          background: `linear-gradient(160deg, ${rgba(COLORS.warning, 0.1)}, ${rgba(COLORS.warning, 0.03)})`,
          boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.warning, 0.25)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 34,
          padding: '0 36px',
        }}
      >
        <div style={{ position: 'relative', width: 132, height: 132, flexShrink: 0 }}>
          <svg width={132} height={132} viewBox="0 0 132 132">
            <circle cx={66} cy={66} r={54} fill="none" stroke={rgba(COLORS.text, 0.08)} strokeWidth={11} />
            <circle
              cx={66}
              cy={66}
              r={54}
              fill="none"
              stroke={COLORS.warning}
              strokeWidth={11}
              strokeLinecap="round"
              strokeDasharray={`${C * ring} ${C}`}
              transform="rotate(-90 66 66)"
              style={{ filter: `drop-shadow(0 0 8px ${rgba(COLORS.warning, 0.6)})` }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT.mono,
              fontWeight: 700,
              fontSize: 32,
              color: COLORS.text,
            }}
          >
            {ritualSteps}/4
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Sun size={34} color={COLORS.warning} strokeWidth={2.2} />
            <span style={{ fontFamily: FONT.sans, fontWeight: 800, fontSize: 36, color: COLORS.text }}>Ritual de mañana</span>
          </div>
          <div style={{ fontFamily: FONT.sans, fontWeight: 500, fontSize: 25, color: COLORS.textMuted }}>Agua · Estirar · Diario · Plan del día</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, opacity: clamp(done * 1.5), transform: `scale(${0.7 + 0.3 * done})`, transformOrigin: 'left center' }}>
            <span
              style={{
                padding: '8px 18px',
                borderRadius: 999,
                background: rgba(COLORS.success, 0.14),
                boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.success, 0.45)}`,
                fontFamily: FONT.sans,
                fontWeight: 700,
                fontSize: 24,
                color: COLORS.success,
              }}
            >
              Completado
            </span>
            <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 26, color: COLORS.gold }}>+40 XP</span>
          </div>
        </div>
      </div>
    </GlowCard>
  );
};
