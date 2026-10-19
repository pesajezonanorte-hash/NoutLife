// 4. Actividad en el aula: una sola pregunta de reflexión, grande y en el centro.
// Paso 1: la pregunta entra palabra por palabra sobre ondas que se expanden despacio
// (la sala «escucha»). Paso 2: la pregunta sube un poco; a los lados flotan ejemplos
// del colegio y del hogar para destrabar la conversación, y abajo la dinámica: dos o
// tres participaciones rápidas. El cronómetro está en el Player (tecla T).
import type React from 'react';
import { Home, Mic, School, Timer, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { AnimatedText } from '../components/AnimatedText';
import { GlassCard } from '../components/GlassCard';
import { COLORS, rgba } from '../theme';
import { SPRING, clamp, lerp, rise, springAt } from '../lib';

export const ACTIVIDAD_STOPS = [300, 520];
const [S0] = ACTIVIDAD_STOPS;

const QUESTION = '¿Qué problema real de tu colegio o de tu hogar crees que podrías solucionar creando una herramienta digital propia?';

/** Ondas concéntricas que nacen detrás de la pregunta y se desvanecen al crecer. */
const Ripples: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {[0, 1, 2, 3].map((k) => {
      const t = ((frame + k * 60) % 240) / 240;
      const size = lerp(320, 1700, t);
      return (
        <div
          key={k}
          style={{
            position: 'absolute',
            left: 960 - size / 2,
            top: 470 - size / 2,
            width: size,
            height: size,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 1.5px ${rgba(k % 2 ? COLORS.violet : COLORS.indigo, 0.32 * (1 - t) * clamp(frame / 40))}`,
          }}
        />
      );
    })}
  </>
);

const EXAMPLES: Array<{ icon: LucideIcon; label: string; color: string; side: 1 | -1; items: string[] }> = [
  { icon: School, label: 'En el colegio', color: COLORS.indigo, side: -1, items: ['Filas en la cafetería', 'Tareas que se olvidan', 'Objetos perdidos'] },
  { icon: Home, label: 'En el hogar', color: COLORS.amber, side: 1, items: ['Turnos de oficios', 'Gastos de la semana', 'Horario de estudio'] },
];

const Cluster: React.FC<{ frame: number; data: (typeof EXAMPLES)[number] }> = ({ frame, data }) => {
  const Icon = data.icon;
  const at = S0 + (data.side < 0 ? 10 : 22);
  return (
    <div
      style={{
        position: 'absolute',
        top: 690,
        [data.side < 0 ? 'left' : 'right']: 120,
        width: 420,
        display: 'flex',
        flexDirection: 'column',
        alignItems: data.side < 0 ? 'flex-start' : 'flex-end',
        gap: 12,
      }}
    >
      <div style={{ ...rise(frame, at, 20), display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 700, color: data.color }}>
        <Icon size={24} />
        {data.label}
      </div>
      {data.items.map((item, i) => {
        const p = springAt(frame, at + 10 + i * 9, SPRING.pop);
        // Cada ejemplo flota a su ritmo
        const drift = Math.sin((frame + i * 37) / (48 + i * 9)) * 6;
        return (
          <span
            key={item}
            style={{
              padding: '10px 18px',
              borderRadius: 14,
              fontSize: 21,
              fontWeight: 600,
              background: rgba(data.color, 0.1),
              boxShadow: `inset 0 0 0 1px ${rgba(data.color, 0.35)}`,
              opacity: clamp(p * 2),
              transform: `translate(${data.side * (1 - p) * -60 + data.side * i * 18}px, ${drift}px) scale(${0.7 + 0.3 * p})`,
            }}
          >
            {item}
          </span>
        );
      })}
    </div>
  );
};

export const Slide4Actividad: React.FC = () => {
  const frame = useCurrentFrame();
  const up = springAt(frame, S0 + 2, SPRING.glide);
  const pill = springAt(frame, 6, SPRING.pop);
  return (
    <AbsoluteFill>
      <Ripples frame={frame} />
      <div
        style={{
          position: 'absolute',
          left: 200,
          right: 200,
          top: 150,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          transform: `translateY(${lerp(130, -30, up) + Math.sin(frame / 80) * 4}px) scale(${lerp(1, 0.9, up)})`,
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 20px',
            borderRadius: 99,
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.amber,
            background: rgba(COLORS.amber, 0.12),
            boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.amber, 0.45)}`,
            opacity: clamp(pill * 2),
            transform: `scale(${0.6 + 0.4 * pill})`,
          }}
        >
          <Timer size={22} />
          Actividad en el aula, 2 minutos
        </span>
        <div style={{ ...rise(frame, 20), marginTop: 34, fontSize: 38, fontWeight: 600, color: COLORS.muted }}>Pensando en tu día a día:</div>
        <p style={{ margin: '18px 0 0', fontSize: 74, fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.03em', textWrap: 'balance' }}>
          <AnimatedText text={QUESTION} at={44} stagger={5} />
        </p>
      </div>

      {EXAMPLES.map((d) => (
        <Cluster key={d.label} frame={frame} data={d} />
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 770, display: 'flex', justifyContent: 'center' }}>
        <GlassCard at={S0 + 50} tint={COLORS.violet} glow={0.6} radius={24} padding="22px 30px" style={{ width: 640, display: 'flex', alignItems: 'center', gap: 20 }}>
          <Mic size={34} color={COLORS.violet} style={{ flex: 'none' }} />
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.4, textAlign: 'left' }}>
            Dos o tres participaciones rápidas: el problema y la herramienta que crearías.
          </div>
        </GlassCard>
      </div>
    </AbsoluteFill>
  );
};
