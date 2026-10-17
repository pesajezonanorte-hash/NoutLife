// Tarjeta del Coliseo: mapa muscular por fatiga, barras de fatiga y volumen
// semanal que se levanta. Datos de ejemplo verosímiles (12.480 kg = suma de las barras).
import type React from 'react';
import { BatteryLow, Dumbbell } from 'lucide-react';
import { COLORS, FONT, SPRING, rgba } from '../../theme';
import { EASE, clamp, ramp, springAt, thousands } from '../../lib/anim';
import { BodyMap } from '../../components/BodyMap';
import { GlowCard, ZoneHeader } from '../../components/ui';
import { CARD } from '../../layout';

const FATIGUE = [
  { label: 'Pecho', pct: 82, color: COLORS.error, note: 'Fatiga alta' },
  { label: 'Bíceps', pct: 54, color: COLORS.warning, note: 'Fatiga moderada' },
  { label: 'Abdomen', pct: 12, color: COLORS.success, note: 'Recuperado' },
];
const VOLUME = [
  { day: 'L', kg: 2100 },
  { day: 'M', kg: 2860 },
  { day: 'X', kg: 0 },
  { day: 'J', kg: 2450 },
  { day: 'V', kg: 1980 },
  { day: 'S', kg: 3090 },
  { day: 'D', kg: 0 },
];
const TOTAL = VOLUME.reduce((s, v) => s + v.kg, 0);
const MAX = Math.max(...VOLUME.map((v) => v.kg));
const TODAY = 5;
const BAR_H = 92;

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: FONT.mono, fontSize: 19, fontWeight: 600, letterSpacing: '0.18em', color: COLORS.textMuted }}>{children}</div>
);

export const ColiseoCard: React.FC<{ local: number; frame: number }> = ({ local, frame }) => {
  const volume = ramp(local, 12, 38, EASE.out);
  const pill = springAt(local, 30, SPRING.snappy);
  return (
    <GlowCard frame={frame} accent={COLORS.jade} width={CARD.w} height={CARD.h}>
      <ZoneHeader icon={Dumbbell} accent={COLORS.jade} kicker="ZONA 01" title="Coliseo" subtitle="Fuerza, volumen y recuperación" pro />

      <div style={{ position: 'absolute', left: 52, top: 266 }}>
        <BodyMap local={local} frame={frame} height={588} />
      </div>

      <div style={{ position: 'absolute', left: 370, top: 268, width: 418 }}>
        <Kicker>RECUPERACIÓN MUSCULAR</Kicker>
        {FATIGUE.map((row, i) => {
          const p = springAt(local, 10 + i * 4, SPRING.snappy);
          const n = Math.round(row.pct * clamp(ramp(local, 10 + i * 4, 24 + i * 4, EASE.out)));
          return (
            <div key={row.label} style={{ marginTop: i === 0 ? 18 : 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 30, color: COLORS.text }}>{row.label}</span>
                <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 28, color: row.color }}>{n} %</span>
              </div>
              <div style={{ marginTop: 10, height: 12, borderRadius: 6, background: rgba(COLORS.text, 0.07), overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${row.pct * p}%`,
                    height: '100%',
                    borderRadius: 6,
                    background: `linear-gradient(90deg, ${rgba(row.color, 0.7)}, ${row.color})`,
                    boxShadow: `0 0 14px ${rgba(row.color, 0.6)}`,
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontFamily: FONT.sans, fontWeight: 500, fontSize: 20, color: COLORS.textMuted }}>{row.note}</div>
            </div>
          );
        })}

        <div style={{ marginTop: 26 }}>
          <Kicker>VOLUMEN SEMANAL</Kicker>
          <div style={{ marginTop: 6, fontFamily: FONT.mono, fontWeight: 700, fontSize: 50, lineHeight: 1.1, letterSpacing: '-0.03em', color: COLORS.text }}>
            {thousands(TOTAL * volume)}
            <span style={{ fontSize: 28, color: COLORS.textMuted, marginLeft: 10 }}>kg</span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 16, height: BAR_H }}>
            {VOLUME.map((v, i) => {
              const p = springAt(local, 14 + i * 2, SPRING.card);
              const h = v.kg > 0 ? (v.kg / MAX) * BAR_H * p : 6;
              const today = i === TODAY;
              return (
                <div
                  key={v.day}
                  style={{
                    width: 44,
                    height: h,
                    borderRadius: 10,
                    background: v.kg === 0 ? rgba(COLORS.text, 0.08) : today ? `linear-gradient(180deg, ${COLORS.jade300}, ${COLORS.jade})` : rgba(COLORS.jade, 0.34),
                    boxShadow: today ? `0 0 22px ${rgba(COLORS.jade, 0.6)}` : undefined,
                  }}
                />
              );
            })}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
            {VOLUME.map((v, i) => (
              <div
                key={v.day}
                style={{ width: 44, textAlign: 'center', fontFamily: FONT.mono, fontSize: 19, fontWeight: 600, color: i === TODAY ? COLORS.jade300 : COLORS.textMuted }}
              >
                {v.day}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 52,
          right: 52,
          top: 918,
          height: 92,
          borderRadius: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '0 28px',
          background: rgba(COLORS.error, 0.1),
          boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.error, 0.32)}`,
          opacity: clamp(pill * 1.4),
          transform: `translateY(${(1 - pill) * 26}px)`,
        }}
      >
        <BatteryLow size={38} color={COLORS.error} strokeWidth={2} />
        <span style={{ fontFamily: FONT.sans, fontWeight: 600, fontSize: 30, color: COLORS.text }}>Pecho y hombros necesitan descanso</span>
      </div>
    </GlowCard>
  );
};
