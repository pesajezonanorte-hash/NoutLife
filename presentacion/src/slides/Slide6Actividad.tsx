// 6. Actividad en el aula: una sola pregunta de reflexión, grande y centrada, sobre
// ondas jade que se expanden despacio. «tu turno» se escribe con la letra de la
// marca. Paso 2: la pregunta sube; a los lados flotan dos tarjetas de ejemplo (una del
// colegio y una del hogar) para destrabar la conversación, y abajo la dinámica. El cronómetro de
// 2 minutos está en el Player (tecla T).
import type React from 'react';
import { Home, Mic, School, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { AnimatedText } from '../components/AnimatedText';
import { GlassCard } from '../components/GlassCard';
import { Lettering } from '../components/Lettering';
import { COLORS, rgba } from '../theme';
import { SPRING, clamp, lerp, rise, springAt } from '../lib';

export const ACTIVIDAD_STOPS = [300, 520];
const [S0] = ACTIVIDAD_STOPS;

export const ACTIVIDAD_NOTES = [
  [
    'Lee la pregunta despacio y deja unos segundos de silencio.',
    'Pide que piensen en algo concreto que les pase a ellos, no en un problema inventado.',
  ],
  [
    'Pide dos o tres participaciones rápidas (la tecla T inicia el cronómetro de 2 minutos).',
    'Con cada idea, pregunta: ¿qué haría tu herramienta? ¿Quién la usaría? ¿Sería una app, una página, una hoja de cálculo, un video?',
    'Cierra así: detectar un problema e imaginar la solución ya es el primer paso para crear.',
  ],
];

const QUESTION = '¿Qué problema real de tu colegio o de tu hogar crees que podrías solucionar creando una herramienta digital propia?';

/** Ondas concéntricas que nacen detrás de la pregunta y se desvanecen al crecer. */
const Ripples: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {[0, 1, 2, 3].map((k) => {
      const t = ((frame + k * 75) % 300) / 300;
      const size = lerp(360, 1800, t);
      return (
        <div
          key={k}
          style={{
            position: 'absolute',
            left: 960 - size / 2,
            top: 500 - size / 2,
            width: size,
            height: size,
            borderRadius: '50%',
            boxShadow: `inset 0 0 0 1.5px ${rgba(COLORS.jade, 0.22 * (1 - t) * clamp(frame / 40))}`,
          }}
        />
      );
    })}
  </>
);

const EXAMPLES: Array<{ icon: LucideIcon; label: string; side: 1 | -1; text: string }> = [
  { icon: School, label: 'Ejemplo en el colegio', side: -1, text: '¿Cómo organizar mejor las entregas o tareas de clase?' },
  { icon: Home, label: 'Ejemplo en el hogar', side: 1, text: '¿Cómo gestionar hábitos de estudio o recordatorios diarios?' },
];

/** Tarjeta de ejemplo: entra desde su lado y luego flota despacio. */
const Example: React.FC<{ frame: number; data: (typeof EXAMPLES)[number] }> = ({ frame, data }) => {
  const Icon = data.icon;
  const at = S0 + (data.side < 0 ? 12 : 26);
  const p = springAt(frame, at, SPRING.card);
  const drift = Math.sin((frame + (data.side < 0 ? 0 : 40)) / 58) * 6;
  return (
    <div
      style={{
        position: 'absolute',
        top: 700,
        [data.side < 0 ? 'left' : 'right']: 140,
        width: 520,
        opacity: clamp(p * 1.5),
        transform: `translate(${data.side * (1 - p) * 60}px, ${drift}px)`,
      }}
    >
      <GlassCard padding="26px 30px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, fontWeight: 600, color: COLORS.muted }}>
          <Icon size={22} strokeWidth={1.75} />
          {data.label}
        </div>
        <div style={{ marginTop: 10, fontSize: 27, fontWeight: 600, lineHeight: 1.35, textWrap: 'pretty' }}>{data.text}</div>
      </GlassCard>
    </div>
  );
};

export const Slide6Actividad: React.FC = () => {
  const frame = useCurrentFrame();
  const up = springAt(frame, S0 + 2, SPRING.glide);
  return (
    <AbsoluteFill>
      <Ripples frame={frame} />
      <div
        style={{
          position: 'absolute',
          left: 220,
          right: 220,
          top: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          transform: `translateY(${lerp(110, -40, up) + Math.sin(frame / 80) * 4}px) scale(${lerp(1, 0.9, up)})`,
        }}
      >
        <div style={{ fontSize: 76, color: COLORS.jade }}>
          <Lettering text="tu turno" at={8} />
        </div>
        <div style={{ ...rise(frame, 40, 12), marginTop: 26, fontSize: 34, fontWeight: 500, color: COLORS.muted }}>Pensando en tu día a día:</div>
        <p style={{ margin: '14px 0 0', fontSize: 62, fontWeight: 700, lineHeight: 1.16, letterSpacing: '-0.03em', textWrap: 'balance' }}>
          <AnimatedText text={QUESTION} at={62} stagger={5} />
        </p>
      </div>

      {EXAMPLES.map((d) => (
        <Example key={d.label} frame={frame} data={d} />
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 790, display: 'flex', justifyContent: 'center' }}>
        <GlassCard at={S0 + 50} glow={0.6} radius={99} padding="20px 34px" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Mic size={30} color={COLORS.jade} strokeWidth={1.75} />
          <span style={{ fontSize: 26, fontWeight: 600 }}>Dos o tres ideas rápidas</span>
        </GlassCard>
      </div>
    </AbsoluteFill>
  );
};
