// 2. El diagnóstico: efectos del uso pasivo frente a la creación.
// Paso 1: el dato de consumo (4 a 6 horas, pintadas sobre las 24 del día) y Prensky.
// Paso 2: la cadena causa → efecto → consecuencia en el rendimiento escolar; las
// flechas se dibujan y un punto de luz las recorre.
// Paso 3: la brecha. El bucle del algoritmo gira y, al lado, lo que hace quien solo
// usa frente a quien crea.
// Abajo, las ideas clave de cada paso para guiar al expositor.
import type React from 'react';
import { Brain, GraduationCap, Infinity as InfinityIcon, Smartphone, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { AnimatedText } from '../components/AnimatedText';
import { GlassCard, IconChip } from '../components/GlassCard';
import { TalkingPoints } from '../components/TalkingPoints';
import { COLORS, rgba } from '../theme';
import { EASE, SPRING, clamp, ramp, rise, springAt } from '../lib';

export const PROBLEMA_STOPS = [250, 480, 730];
const [S1, S2] = PROBLEMA_STOPS;

const APPS = ['TikTok', 'Reels', 'Free Fire', 'YouTube'];

const DayBar: React.FC<{ frame: number; at: number }> = ({ frame, at }) => (
  <div style={{ display: 'flex', gap: 4 }}>
    {Array.from({ length: 24 }, (_, h) => {
      const on = ramp(frame, at + h * 3, at + h * 3 + 14, EASE.out);
      const color = h < 4 ? rgba(COLORS.rose, 0.95) : h < 6 ? rgba(COLORS.rose, 0.45) : rgba(COLORS.muted, 0.14);
      return (
        <div
          key={h}
          style={{
            flex: 1,
            height: 30,
            borderRadius: 5,
            background: h < 6 ? `linear-gradient(0deg, ${color} ${on * 100}%, ${rgba(COLORS.muted, 0.14)} ${on * 100}%)` : color,
          }}
        />
      );
    })}
  </div>
);

// ---------- Paso 2: la cadena ----------

const CHAIN: Array<{ icon: LucideIcon; color: string; kind: string; title: string; text: string }> = [
  { icon: Smartphone, color: COLORS.rose, kind: 'Causa', title: 'Uso automático', text: 'Celular, redes y juegos sin un propósito claro.' },
  { icon: Brain, color: COLORS.violet, kind: 'Efecto', title: 'Atención fragmentada', text: 'Muchos estímulos rápidos, poca concentración sostenida.' },
  {
    icon: GraduationCap,
    color: COLORS.amber,
    kind: 'Consecuencia',
    title: 'Rendimiento que baja',
    text: 'Distracción en clase, hábitos débiles y notas más bajas.',
  },
];
const NODE_W = 320;
const GAP = 50;

/** Flecha entre dos nodos: se dibuja y un punto de luz la recorre una y otra vez. */
const Arrow: React.FC<{ frame: number; at: number; from: string; to: string }> = ({ frame, at, from, to }) => {
  const draw = ramp(frame, at, at + 18, EASE.out);
  const dot = ((frame - at) % 50) / 50;
  return (
    <svg width={GAP} height={24} style={{ position: 'absolute', top: 88, overflow: 'visible' }}>
      <defs>
        <linearGradient id={`a${at}`} x1="0" x2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <path d={`M4 12 H${GAP - 8}`} stroke={`url(#a${at})`} strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      <path d={`M${GAP - 15} 5 L${GAP - 7} 12 L${GAP - 15} 19`} fill="none" stroke={to} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={draw} />
      {draw >= 1 && <circle cx={4 + dot * (GAP - 12)} cy={12} r={4} fill="#fff" opacity={Math.sin(dot * Math.PI)} />}
    </svg>
  );
};

const Chain: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ position: 'relative', display: 'flex', gap: GAP }}>
    {CHAIN.map((c, i) => {
      const at = S1 + 6 + i * 30;
      return (
        <GlassCard key={c.kind} at={at} tint={c.color} glow={0.45} padding="22px 24px" style={{ width: NODE_W, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconChip icon={c.icon} color={c.color} size={46} />
            <span style={{ fontSize: 19, fontWeight: 600, color: c.color }}>{c.kind}</span>
          </div>
          <div style={{ marginTop: 14, fontSize: 25, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{c.title}</div>
          <div style={{ marginTop: 6, fontSize: 19, lineHeight: 1.4, color: COLORS.soft }}>{c.text}</div>
        </GlassCard>
      );
    })}
    {[0, 1].map((i) => (
      <div key={i} style={{ position: 'absolute', left: NODE_W * (i + 1) + GAP * i, top: 0 }}>
        <Arrow frame={frame} at={S1 + 22 + i * 30} from={CHAIN[i].color} to={CHAIN[i + 1].color} />
      </div>
    ))}
  </div>
);

// ---------- Paso 3: la brecha ----------

/** El bucle del algoritmo: dos arcos con flecha que giran alrededor de un ∞. */
const AlgorithmLoop: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const p = springAt(frame, at, SPRING.pop);
  const spin = (frame - at) * 2.2;
  return (
    <div style={{ position: 'relative', width: 150, height: 150, flex: 'none', transform: `scale(${0.6 + 0.4 * p})`, opacity: clamp(p * 2) }}>
      <svg width={150} height={150} viewBox="0 0 150 150" style={{ position: 'absolute', inset: 0, transform: `rotate(${spin}deg)` }}>
        {[0, 180].map((r) => (
          <g key={r} transform={`rotate(${r} 75 75)`}>
            <path d="M75 12 A63 63 0 0 1 135 60" fill="none" stroke={COLORS.rose} strokeWidth={6} strokeLinecap="round" />
            <path d="M126 52 L136 63 L141 48" fill="none" stroke={COLORS.rose} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <InfinityIcon size={50} color={COLORS.text} strokeWidth={2.2} />
      </div>
    </div>
  );
};

const Verbs: React.FC<{ frame: number; at: number; label: string; verbs: string[]; color: string; result: string; strong: boolean }> = ({
  frame,
  at,
  label,
  verbs,
  color,
  result,
  strong,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <span style={{ width: 150, fontSize: 21, fontWeight: 700, color }}>{label}</span>
    {verbs.map((v, i) => {
      const p = springAt(frame, at + i * 7, SPRING.pop);
      return (
        <span
          key={v}
          style={{
            padding: '8px 16px',
            borderRadius: 12,
            fontSize: 20,
            fontWeight: 600,
            background: rgba(color, strong ? 0.18 : 0.08),
            boxShadow: `inset 0 0 0 1px ${rgba(color, strong ? 0.5 : 0.2)}`,
            color: strong ? COLORS.text : COLORS.muted,
            opacity: clamp(p * 2),
            transform: `translateY(${(1 - p) * 14}px)`,
          }}
        >
          {v}
        </span>
      );
    })}
    <span style={{ ...rise(frame, at + 30, 10), marginLeft: 'auto', fontSize: 19, fontWeight: 600, color: strong ? color : COLORS.faint }}>{result}</span>
  </div>
);

const Gap: React.FC<{ frame: number }> = ({ frame }) => (
  <GlassCard at={S2 + 6} tint={COLORS.violet} padding="28px 32px" style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
    <AlgorithmLoop frame={frame} at={S2 + 16} />
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>Dependencia algorítmica</div>
      <div style={{ marginTop: 4, fontSize: 20, color: COLORS.soft }}>El algoritmo decide qué vemos. Saber usar una app no es saber construirla.</div>
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Verbs frame={frame} at={S2 + 40} label="Uso pasivo" verbs={['Recibe', 'Desliza', 'Repite']} color={COLORS.rose} result="Poco pensamiento crítico" strong={false} />
        <Verbs frame={frame} at={S2 + 70} label="Creación" verbs={['Pregunta', 'Diseña', 'Construye']} color={COLORS.indigo} result="Más pensamiento crítico" strong />
      </div>
    </div>
  </GlassCard>
);

// ---------- Diapositiva ----------

export const Slide2Problema: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <h2 style={{ position: 'absolute', left: 120, top: 84, margin: 0, fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em' }}>
        <AnimatedText text="El diagnóstico" at={8} />
      </h2>
      <div style={{ ...rise(frame, 30), position: 'absolute', left: 120, top: 170, fontSize: 28, color: COLORS.soft }}>
        Efectos del uso pasivo frente a la creación
      </div>

      {/* Paso 1: el dato y Prensky */}
      <div style={{ position: 'absolute', left: 120, top: 250, width: 560, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <GlassCard at={24} tint={COLORS.rose} padding="28px 32px">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontSize: 92, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em' }}>4 a 6</span>
            <span style={{ fontSize: 38, fontWeight: 700, color: COLORS.rose }}>horas</span>
          </div>
          <div style={{ marginTop: 8, marginBottom: 20, fontSize: 23, color: COLORS.soft }}>al día frente a pantallas, fuera del colegio</div>
          <DayBar frame={frame} at={50} />
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            {APPS.map((app, i) => {
              const p = springAt(frame, 100 + i * 7, SPRING.pop);
              return (
                <span
                  key={app}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 99,
                    fontSize: 19,
                    fontWeight: 600,
                    background: rgba(COLORS.rose, 0.12),
                    boxShadow: `inset 0 0 0 1px ${rgba(COLORS.rose, 0.35)}`,
                    opacity: clamp(p * 2),
                    transform: `scale(${0.6 + 0.4 * p})`,
                  }}
                >
                  {app}
                </span>
              );
            })}
          </div>
          <div style={{ marginTop: 14, fontSize: 16, color: COLORS.faint }}>Estudios en colegios de la región Caribe</div>
        </GlassCard>
        <GlassCard at={140} tint={COLORS.violet} padding="24px 32px">
          <div style={{ fontSize: 19, fontWeight: 600, color: COLORS.violet }}>Nativos digitales (Marc Prensky)</div>
          <div style={{ marginTop: 8, fontSize: 24, fontWeight: 600, lineHeight: 1.35 }}>
            Procesamos muchos estímulos a la vez, pero nos cuesta sostener la atención en una sola tarea.
          </div>
        </GlassCard>
      </div>

      {/* Pasos 2 y 3 */}
      <div style={{ position: 'absolute', left: 740, top: 250, width: 1060, display: 'flex', flexDirection: 'column', gap: 30 }}>
        <Chain frame={frame} />
        <Gap frame={frame} />
      </div>

      <TalkingPoints
        style={{ left: 740, top: 800, width: 1060 }}
        steps={[
          [60, ['4 a 6 horas fuera del colegio, casi todo en redes y videos.', 'Usar el celular ya es automático: casi no lo pensamos.']],
          [S1 + 1, ['Más estímulos rápidos, menos atención sostenida.', 'La distracción en clase termina notándose en las notas.']],
          [S2 + 1, ['El algoritmo elige por nosotros qué ver.', 'Consumir no entrena el pensamiento crítico; crear sí lo exige.']],
        ]}
      />
    </AbsoluteFill>
  );
};
