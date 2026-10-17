// La rueda del Ciclo Menstrual, como apps/web/src/components/cycle/CycleRing.tsx:
// el ciclo es un anillo que empieza arriba (día 1) y avanza como el reloj; cada
// fase es un arco de su largo, los arcos se trazan uno tras otro y una semilla de
// luz recorre el anillo hasta hoy. La fase de hoy es más gruesa y respira.
import type React from 'react';
import { CircleDot, Droplet, Moon, Sprout, type LucideIcon } from 'lucide-react';
import { COLORS, CYCLE, FONT, rgba } from '../theme';
import { EASE, clamp, ramp, springAt } from '../lib/anim';

const SIZE = 320;
const C = SIZE / 2;
const R = 118;
const GAP_DEG = 1.6;
const LENGTH = 28;
const TODAY = 14;
const OVULATION_DAY = 14;
type Phase = keyof typeof CYCLE;
const PHASES: Array<{ id: Phase; start: number; end: number; icon: LucideIcon; name: string }> = [
  { id: 'menstrual', start: 1, end: 5, icon: Droplet, name: 'Menstruación' },
  { id: 'follicular', start: 6, end: 12, icon: Sprout, name: 'Fase folicular' },
  { id: 'ovulation', start: 13, end: 15, icon: CircleDot, name: 'Ovulación' },
  { id: 'luteal', start: 16, end: 28, icon: Moon, name: 'Fase lútea' },
];
const CURRENT: Phase = 'ovulation';

const capDeg = (stroke: number) => (stroke / 2 / R) * (180 / Math.PI);
const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};
function arc(r: number, from: number, to: number) {
  const a = polar(r, from);
  const b = polar(r, to);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/** `local` = fotogramas desde que entra la tarjeta. */
export const CycleRing: React.FC<{ local: number; frame: number; size: number }> = ({ local, frame, size }) => {
  const step = 360 / LENGTH;
  const k = size / SIZE;
  const breathe = 0.6 + 0.4 * Math.sin(frame / 10);
  // La semilla viaja del día 1 a hoy con el muelle lento de la app
  const seedP = springAt(local, 10, { stiffness: 38, damping: 14, mass: 1.4 });
  const seedDeg = seedP * (TODAY - 0.5) * step;
  const seed = polar(R, seedDeg);
  const fertile = ramp(local, 24, 34);
  const center = springAt(local, 14, { damping: 200 }, 16);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <circle cx={C} cy={C} r={R} fill="none" strokeWidth={22} stroke={rgba(COLORS.text, 0.05)} />
        <path
          d={arc(R + 21, (OVULATION_DAY - 6) * step, (OVULATION_DAY + 1) * step)}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="1 6"
          stroke={rgba(CYCLE.ovulation, 0.8)}
          opacity={fertile}
        />
        {PHASES.map((ph, i) => {
          const current = ph.id === CURRENT;
          const stroke = current ? 22 : 14;
          const trim = capDeg(stroke) + GAP_DEG / 2;
          const start = (ph.start - 1) * step;
          const end = ph.end * step;
          const from = start + trim;
          const to = end - trim;
          const draw = ramp(local, 4 + i * 4, 16 + i * 4, EASE.out);
          return (
            <g key={ph.id}>
              {current && draw > 0.9 && (
                <path d={arc(R, from, to)} fill="none" strokeWidth={34} strokeLinecap="round" stroke={rgba(CYCLE[ph.id], 0.12 + 0.12 * breathe)} />
              )}
              <path
                d={arc(R, from, to)}
                fill="none"
                strokeLinecap="round"
                strokeWidth={stroke}
                stroke={CYCLE[ph.id]}
                strokeOpacity={current ? 1 : 0.55}
                pathLength={1}
                strokeDasharray={`${draw} 1`}
                opacity={draw > 0.01 ? 1 : 0}
              />
            </g>
          );
        })}
        {Array.from({ length: LENGTH }, (_, i) => {
          const d = i + 1;
          const p = polar(R - 24, (d - 0.5) * step);
          const bleed = d <= 5;
          const show = clamp(ramp(local, 8 + i * 0.5, 14 + i * 0.5));
          return (
            <circle
              key={d}
              cx={p.x}
              cy={p.y}
              r={bleed ? 3.2 : 2}
              fill={bleed ? CYCLE.menstrual : rgba(COLORS.textMuted, d < TODAY ? 0.5 : 0.2)}
              opacity={show}
            />
          );
        })}
        {/* Semilla de luz */}
        {local > 10 && (
          <g opacity={clamp((local - 10) / 4)}>
            <circle cx={seed.x} cy={seed.y} r={18} fill={rgba(CYCLE[CURRENT], 0.35)} />
            <circle cx={seed.x} cy={seed.y} r={11} fill={COLORS.surface} stroke={CYCLE[CURRENT]} strokeWidth={4} />
          </g>
        )}
      </svg>
      {/* Ícono de cada fase por fuera de su arco */}
      {PHASES.map((ph, i) => {
        const mid = ((ph.start - 1 + ph.end) / 2) * step;
        const pos = polar(R + 40, mid);
        const Icon = ph.icon;
        const p = springAt(local, 10 + i * 4, { damping: 14, stiffness: 240, mass: 0.55 });
        return (
          <div
            key={ph.id}
            style={{
              position: 'absolute',
              left: pos.x * k - 26,
              top: pos.y * k - 26,
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: COLORS.surface,
              boxShadow: `0 0 0 1.5px ${rgba(CYCLE[ph.id], 0.45)}, 0 6px 16px rgba(0,0,0,0.4)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${p})`,
            }}
          >
            <Icon size={26} color={CYCLE[ph.id]} strokeWidth={2} />
          </div>
        );
      })}
      {/* Centro: hoy */}
      <div
        style={{
          position: 'absolute',
          inset: '24%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          opacity: center,
          transform: `scale(${0.9 + 0.1 * center})`,
        }}
      >
        <div style={{ fontFamily: FONT.mono, fontSize: 22, letterSpacing: '0.22em', color: COLORS.textMuted }}>DÍA</div>
        <div style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 104, lineHeight: 1, color: COLORS.text, letterSpacing: '-0.04em' }}>
          {Math.max(1, Math.round(seedP * TODAY))}
        </div>
        <div style={{ marginTop: 8, fontFamily: FONT.sans, fontWeight: 700, fontSize: 32, color: CYCLE[CURRENT] }}>Ovulación</div>
        <div style={{ marginTop: 6, fontFamily: FONT.sans, fontWeight: 500, fontSize: 22, color: COLORS.textMuted }}>Periodo en 15 días</div>
      </div>
    </div>
  );
};
