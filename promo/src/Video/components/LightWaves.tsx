// El Sabio: ondas de luz. Cuatro zonas mandan su señal como ondas que viajan hacia
// una luz central (la inteligencia que las conecta), que a su vez emite ondas.
// Detrás, tres cintas de luz largas fluyen de lado a lado.
import type React from 'react';
import { CheckCircle2, Dumbbell, Moon, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { COLORS, FONT, rgba } from '../theme';
import { EASE, clamp, ramp, springAt } from '../lib/anim';

const W = 840;
const H = 470;
const ORB = { x: W / 2, y: H / 2 };

const SOURCES: Array<{ label: string; icon: LucideIcon; color: string; x: number; y: number; side: -1 | 1 }> = [
  { label: 'Sueño', icon: Moon, color: COLORS.info, x: 120, y: 92, side: -1 },
  { label: 'Coliseo', icon: Dumbbell, color: COLORS.jade, x: 120, y: 378, side: -1 },
  { label: 'Hábitos', icon: CheckCircle2, color: COLORS.success, x: 720, y: 92, side: 1 },
  { label: 'Comida', icon: UtensilsCrossed, color: COLORS.warning, x: 720, y: 378, side: 1 },
];

/** Punto de la onda i en s ∈ [0, 1] (0 = la zona, 1 = la luz central). */
function wavePoint(i: number, s: number, phase: number) {
  const src = SOURCES[i];
  // Sale del borde interior del chip de la zona
  const from = { x: src.x - src.side * 96, y: src.y };
  const dx = ORB.x - from.x;
  const dy = ORB.y - from.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const env = Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05)), 0.9);
  const off = Math.sin(s * Math.PI * 5 - phase) * 16 * env;
  return { x: from.x + dx * s + nx * off, y: from.y + dy * s + ny * off };
}

function wavePath(i: number, phase: number) {
  let d = '';
  for (let k = 0; k <= 60; k++) {
    const p = wavePoint(i, k / 60, phase);
    d += `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return d;
}

function ribbonPath(y: number, amp: number, freq: number, phase: number) {
  let d = '';
  for (let k = 0; k <= 70; k++) {
    const x = -40 + (k / 70) * (W + 80);
    const yy = y + Math.sin((x / W) * Math.PI * 2 * freq + phase) * amp * (0.55 + 0.45 * Math.sin((x / W) * Math.PI));
    d += `${k === 0 ? 'M' : 'L'}${x.toFixed(1)} ${yy.toFixed(1)}`;
  }
  return d;
}

/** `local` = fotogramas desde que entra la tarjeta. */
export const LightWaves: React.FC<{ local: number; frame: number }> = ({ local, frame }) => {
  const phase = frame * 0.24;
  const orbIn = springAt(local, 4, { damping: 13, stiffness: 160, mass: 0.7 });
  const ribbons = [
    { y: ORB.y - 6, amp: 70, freq: 1.2, color: COLORS.jade, speed: 0.05 },
    { y: ORB.y + 10, amp: 54, freq: 1.7, color: COLORS.info, speed: -0.04 },
    { y: ORB.y, amp: 86, freq: 0.9, color: COLORS.gold, speed: 0.032 },
  ];
  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          {SOURCES.map((s, i) => (
            <linearGradient key={i} id={`sabio-wave-${i}`} gradientUnits="userSpaceOnUse" x1={s.x} y1={s.y} x2={ORB.x} y2={ORB.y}>
              <stop offset="0" stopColor={s.color} stopOpacity="0.9" />
              <stop offset="1" stopColor={COLORS.goldLight} stopOpacity="1" />
            </linearGradient>
          ))}
          <radialGradient id="sabio-orb">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.35" stopColor={COLORS.goldLight} />
            <stop offset="0.7" stopColor={rgba(COLORS.gold, 0.55)} />
            <stop offset="1" stopColor={rgba(COLORS.gold, 0)} />
          </radialGradient>
        </defs>

        {/* Cintas de fondo */}
        {ribbons.map((r, i) => {
          const d = ribbonPath(r.y, r.amp, r.freq, frame * r.speed * 2 + i * 1.7);
          const vis = ramp(local, 2 + i * 3, 18 + i * 3);
          return (
            <g key={i} opacity={vis}>
              <path d={d} fill="none" stroke={rgba(r.color, 0.07)} strokeWidth={26} strokeLinecap="round" />
              <path d={d} fill="none" stroke={rgba(r.color, 0.38)} strokeWidth={2} strokeLinecap="round" />
            </g>
          );
        })}

        {/* Ondas de cada zona hacia la luz */}
        {SOURCES.map((_, i) => {
          const draw = ramp(local, 6 + i * 3, 22 + i * 3, EASE.out);
          const d = wavePath(i, phase + i * 0.8);
          return (
            <g key={i} opacity={draw > 0.01 ? 1 : 0}>
              <path d={d} fill="none" stroke={`url(#sabio-wave-${i})`} strokeOpacity={0.22} strokeWidth={14} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} />
              <path d={d} fill="none" stroke={`url(#sabio-wave-${i})`} strokeWidth={3.2} strokeLinecap="round" pathLength={1} strokeDasharray={`${draw} 1`} />
            </g>
          );
        })}

        {/* Pulsos que viajan por cada onda */}
        {SOURCES.map((s, i) => {
          if (local < 22) return null;
          return [0, 0.5].map((off) => {
            const t = (((frame - 22) * 0.034 + i * 0.27 + off) % 1 + 1) % 1;
            const p = wavePoint(i, t, phase + i * 0.8);
            const a = Math.sin(Math.PI * t);
            return <circle key={`${i}-${off}`} cx={p.x} cy={p.y} r={5 + 3 * a} fill={s.color} opacity={0.9 * a} style={{ filter: `drop-shadow(0 0 8px ${s.color})` }} />;
          });
        })}

        {/* Ondas que emite la luz */}
        {[0, 1, 2].map((n) => {
          const t = ((((frame - 8) / 30 + n / 3) % 1) + 1) % 1;
          return (
            <circle
              key={n}
              cx={ORB.x}
              cy={ORB.y}
              r={46 + t * 190}
              fill="none"
              stroke={rgba(COLORS.goldLight, 0.55 * (1 - t) * orbIn)}
              strokeWidth={2.2 - t * 1.4}
            />
          );
        })}

        {/* La luz */}
        <circle cx={ORB.x} cy={ORB.y} r={150 * orbIn} fill="url(#sabio-orb)" opacity={0.35 + 0.1 * Math.sin(frame / 8)} />
        <circle cx={ORB.x} cy={ORB.y} r={58 * orbIn} fill="url(#sabio-orb)" />
      </svg>

      {SOURCES.map((s, i) => {
        const Icon = s.icon;
        const p = springAt(local, 2 + i * 3, { damping: 14, stiffness: 240, mass: 0.55 });
        return (
          <div
            key={s.label}
            style={{
              position: 'absolute',
              left: s.x - 96,
              top: s.y - 30,
              width: 192,
              height: 60,
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: `linear-gradient(180deg, ${rgba(s.color, 0.16)}, ${rgba(s.color, 0.08)})`,
              boxShadow: `inset 0 0 0 1.5px ${rgba(s.color, 0.45)}, 0 0 24px ${rgba(s.color, 0.2)}`,
              backgroundColor: '#0e1913',
              color: COLORS.text,
              fontFamily: FONT.sans,
              fontWeight: 600,
              fontSize: 25,
              transform: `scale(${p})`,
              opacity: clamp(p * 1.5),
            }}
          >
            <Icon size={26} color={s.color} strokeWidth={2.2} />
            {s.label}
          </div>
        );
      })}
    </div>
  );
};
