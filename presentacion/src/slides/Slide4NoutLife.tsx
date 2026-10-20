// 4. El caso NoutLife: la evidencia de lo que pasa cuando un estudiante crea. El
// teléfono muestra la PWA y cambia con cada hallazgo de la derecha:
// - Resolver un problema real: la Libreta (tareas y fechas dispersas, en orden).
// - Diseñar y programar: el Inicio se vuelve plano, con cada bloque recuadrado y el
//   nombre de su componente (así se estructura una pantalla).
// - Organizar hábitos y mente: los hábitos del día se van marcando.
import type React from 'react';
import { Blocks, CheckCircle2, Lightbulb, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { GlassCard, IconChip } from '../components/GlassCard';
import { Lettering } from '../components/Lettering';
import { PhoneMockup } from '../components/PhoneMockup';
import { HabitosScreen, HomeScreen, LibretaScreen } from '../screens/AppScreens';
import { COLORS, rgba } from '../theme';
import { SPRING, clamp, ramp, rise, springAt } from '../lib';

export const NOUTLIFE_STOPS = [240, 450, 670, 890];
const [S0, S1, S2] = NOUTLIFE_STOPS;

export const NOUTLIFE_NOTES = [
  [
    'NoutLife es el ejemplo vivo de la investigación: una app creada por un estudiante de grado 11°.',
    'Es una PWA: se abre desde el navegador y se instala como una app, sin tienda.',
    'Organiza rutina, cuerpo y mente: hábitos, misiones, libreta, agenda y otras zonas.',
    'Sin algoritmos de distracción: no hay un feed infinito. La app muestra lo que tú decides organizar, no lo que te retiene más tiempo.',
  ],
  [
    'Crear empieza por observar un problema propio: tareas, fechas y hábitos dispersos.',
    'Pasar de «me quejo» a «¿cómo lo resuelvo?» es el primer cambio de consumidor a creador.',
  ],
  [
    'Antes de programar hay que diseñar: decidir qué va en cada pantalla y cómo se organiza la información.',
    'Programar es una parte. Cada error obliga a preguntarse qué falla y por qué: pensamiento crítico en la práctica (objetivo específico 3).',
  ],
  [
    'La misma tecnología que distrae puede ayudar a organizar el estudio y los hábitos.',
    'La diferencia no está en el aparato, sino en usarlo con un propósito.',
  ],
];

/** [etiqueta, detalle] de las píldoras que rodean el teléfono. */
const PILLS: Array<[string, string]> = [
  ['PWA nativa', 'Hábitos, rutinas y cuidado mental'],
  ['Libreta digital interactiva', 'Canvas y notas adhesivas'],
  ['Gestión del tiempo', 'Sin algoritmos de distracción'],
];

const FINDINGS: Array<{ icon: LucideIcon; title: string }> = [
  { icon: Lightbulb, title: 'Resolver un problema real' },
  { icon: Blocks, title: 'Diseñar, estructurar, programar' },
  { icon: CheckCircle2, title: 'Organizar hábitos y mente' },
];

/** [desde, pantalla]: cada pantalla entra empujando a la anterior. */
const SCREENS: Array<[number, (frame: number, t: number) => React.ReactNode]> = [
  [20, (_, t) => <HomeScreen t={t} />],
  [S0 + 1, (_, t) => <LibretaScreen t={t} />],
  [S1 + 1, (frame, t) => <HomeScreen t={t + 200} wire={ramp(frame, S1 + 30, S1 + 90)} />],
  [S2 + 1, (_, t) => <HabitosScreen t={t} />], // HABITS_AT
];

const ScreenStack: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {SCREENS.map(([at, render], i) => {
      const enter = i === 0 ? 1 : springAt(frame, at, SPRING.smooth);
      const next = SCREENS[i + 1];
      const out = next ? springAt(frame, next[0], SPRING.smooth) : 0;
      if (enter <= 0 || out >= 0.999) return null;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translateX(${(1 - enter) * 100 - out * 30}%)`,
            filter: out > 0 ? `brightness(${1 - 0.5 * out})` : undefined,
          }}
        >
          {render(frame, frame - at)}
        </div>
      );
    })}
  </>
);

/** Dónde queda el teléfono (la diapositiva 5 lo recoge exactamente aquí para guardarlo). */
export const PHONE_POSE = { left: 1330, top: 120, width: 390, tilt: -12 };
/** Fotograma en que entra la pantalla de Hábitos, la que queda al final. */
export const HABITS_AT = S2 + 1;

/** Con `phone={false}` pinta solo la columna de texto (la diapositiva 5 la congela y la retira). */
export const Slide4NoutLife: React.FC<{ phone?: boolean }> = ({ phone = true }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {phone && (
        <PhoneMockup width={PHONE_POSE.width} at={10} tilt={PHONE_POSE.tilt} style={{ position: 'absolute', left: PHONE_POSE.left, top: PHONE_POSE.top }}>
          <ScreenStack frame={frame} />
        </PhoneMockup>
      )}

      {/* Píldoras junto al teléfono (van con la columna de texto: la diapositiva 5 las retira con ella) */}
      {PILLS.map(([label, line], i) => {
        const p = springAt(frame, 100 + i * 14, SPRING.card);
        const drift = Math.sin((frame + i * 41) / (60 + i * 11)) * 5;
        return (
          <div
            key={label}
            style={{
              position: 'absolute',
              right: 1920 - PHONE_POSE.left + 14,
              top: 250 + i * 220,
              opacity: clamp(p * 1.5),
              transform: `translate(${(1 - p) * 40}px, ${drift}px)`,
            }}
          >
            <GlassCard radius={20} padding="16px 22px" style={{ background: rgba(COLORS.surface, 0.86) }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{label}</div>
              <div style={{ marginTop: 2, fontSize: 18, color: COLORS.muted }}>{line}</div>
            </GlassCard>
          </div>
        );
      })}

      <div style={{ position: 'absolute', left: 140, top: 150, width: 840 }}>
        <h2 style={{ margin: 0, fontSize: 92, fontWeight: 400, color: COLORS.text }}>
          <Lettering text="el caso noutlife" at={10} />
        </h2>
        <div style={{ ...rise(frame, 70), marginTop: 22, fontSize: 30, color: COLORS.muted }}>Una app creada por un estudiante de grado 11°.</div>

        <div style={{ marginTop: 70, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {FINDINGS.map((f, i) => {
            const at = NOUTLIFE_STOPS[i] + 4;
            const shown = springAt(frame, at, SPRING.card);
            const next = i < FINDINGS.length - 1 ? NOUTLIFE_STOPS[i + 1] : null;
            // Encendido mientras es el hallazgo en curso
            const on = ramp(frame, at, at + 20) * (next === null ? 1 : 1 - ramp(frame, next, next + 20));
            return (
              <GlassCard
                key={f.title}
                at={at}
                glow={on}
                padding="30px 36px"
                style={{ display: 'flex', alignItems: 'center', gap: 30, opacity: clamp(shown * 1.4) * (0.55 + 0.45 * Math.max(on, next === null ? 1 : 0)) }}
              >
                <IconChip icon={f.icon} color={on > 0.5 ? COLORS.jade : COLORS.muted} size={72} />
                <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', color: on > 0.5 ? COLORS.text : COLORS.onSurface }}>{f.title}</span>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
