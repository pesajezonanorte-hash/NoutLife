// 7. Recomendaciones y cierre. Paso 1: tres vías de mejora (estudiantes, aula,
// casa), una frase cada una, y debajo tres pautas de acción numeradas. Paso 2: el mensaje final, sobre crear en sentido
// amplio: la mitad del scroll apagada y la de crear encendida, y debajo las formas
// de crear como fichas (programar es una más). Paso 3: el mensaje sube, llegan el
// reto y el caso NoutLife, y «gracias» se escribe con la letra de la marca.
import type React from 'react';
import { GraduationCap, Home, Rocket, User, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { AnimatedText } from '../components/AnimatedText';
import { NoutLifeMark } from '../components/Brand';
import { GlassCard, IconChip } from '../components/GlassCard';
import { Lettering } from '../components/Lettering';
import { COLORS, FONT, rgba } from '../theme';
import { SPRING, clamp, lerp, leave, rise, springAt } from '../lib';

export const CONCLUSION_STOPS = [280, 600, 860];
const [S1, S2] = CONCLUSION_STOPS;

export const CONCLUSION_NOTES = [
  [
    'Estudiantes: medir el tiempo en pantalla y cambiar una parte del scroll por proyectos propios.',
    'Aula: usar la tecnología para investigar y crear, no solo para consultar; proyectos donde se construyan soluciones (la Ley 115 pide formar pensamiento crítico y reflexivo).',
    'Casa: ni quitar el celular ni dejarlo todo el día. Mejor acuerdos claros y conversar sobre lo que se ve y se crea.',
    'Las tres pautas van en orden: primero poner límites al uso pasivo, luego usar la tecnología para aprender y diseñar, y al final convertir una idea en proyecto.',
  ],
  [
    'Crear no es solo programar: también es diseñar, organizar información, hacer contenido interactivo, planear hábitos y armar proyectos.',
    'Programar es un medio clave, porque entrena la lógica, pero no es el único. Lo importante es pasar de recibir a construir.',
    'Cierra con la pregunta del trabajo: la tecnología influye en lo académico y lo cognitivo según cómo se use; crear es la forma más formativa de usarla.',
  ],
  [
    'El reto: escoger un problema del colegio o de la casa y dar el primer paso esta semana.',
    'NoutLife sirve de ejemplo: noutlife.vercel.app.',
    'Agradece y abre el espacio de preguntas.',
  ],
];

const PATHS: Array<{ icon: LucideIcon; title: string; line: string }> = [
  { icon: User, title: 'Estudiantes', line: 'Menos scroll, más proyectos propios.' },
  { icon: GraduationCap, title: 'En el aula', line: 'Tecnología para crear, no solo para consultar.' },
  { icon: Home, title: 'En casa', line: 'Acuerdos, en vez de prohibir o permitirlo todo.' },
];

const ACTIONS = [
  'Establecer límites de uso pasivo.',
  'Usar la tecnología como lienzo de diseño y aprendizaje.',
  'Convertir ideas cotidianas en proyectos de creación digital.',
];

const WAYS = ['Diseñar', 'Resolver problemas', 'Crear proyectos', 'Pensar con lógica', 'Programar'];

export const Slide7Cierre: React.FC = () => {
  const frame = useCurrentFrame();
  const up = springAt(frame, S2 + 2, SPRING.glide);
  const caption = rise(frame, S1 + 250, 10);
  return (
    <AbsoluteFill>
      {/* Paso 1 */}
      <div style={{ ...leave(frame, S1 + 1), position: 'absolute', inset: 0 }}>
        <h2 style={{ position: 'absolute', left: 140, top: 150, margin: 0, fontSize: 92, fontWeight: 400, color: COLORS.text }}>
          <Lettering text="recomendaciones" at={10} />
        </h2>
        <div style={{ position: 'absolute', left: 140, right: 140, top: 340, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 36 }}>
          {PATHS.map((p, i) => (
            <GlassCard key={p.title} at={60 + i * 16} padding="36px 40px">
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <IconChip icon={p.icon} size={64} />
                <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>{p.title}</span>
              </div>
              <div style={{ marginTop: 18, fontSize: 26, lineHeight: 1.4, color: COLORS.muted, textWrap: 'pretty' }}>{p.line}</div>
            </GlassCard>
          ))}
        </div>

        {/* Pautas de acción: una secuencia, por eso van numeradas */}
        <div style={{ ...rise(frame, 130, 12), position: 'absolute', left: 140, top: 650, fontSize: 26, fontWeight: 600, color: COLORS.muted }}>Pautas de acción</div>
        <div style={{ position: 'absolute', left: 140, right: 140, top: 704, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 36 }}>
          {ACTIONS.map((a, i) => {
            const p = springAt(frame, 145 + i * 14, SPRING.glide);
            return (
              <div key={a} style={{ display: 'flex', gap: 18, alignItems: 'flex-start', opacity: clamp(p * 1.4), transform: `translateY(${(1 - p) * 20}px)` }}>
                <span
                  style={{
                    flex: 'none',
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: FONT.mono,
                    fontSize: 22,
                    fontWeight: 700,
                    color: COLORS.bg,
                    background: COLORS.jade,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.35, textWrap: 'pretty' }}>{a}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paso 2: el mensaje final (en el paso 3 sube y se achica) */}
      <div
        style={{
          position: 'absolute',
          left: 180,
          right: 180,
          top: 230,
          textAlign: 'center',
          transform: `translateY(${lerp(0, -80, up)}px) scale(${lerp(1, 0.66, up)})`,
          transformOrigin: 'top center',
        }}
      >
        <p style={{ margin: 0, fontSize: 68, fontWeight: 700, lineHeight: 1.16, letterSpacing: '-0.03em', textWrap: 'balance' }}>
          <AnimatedText text="El futuro no necesita más gente que solo haga scroll;" at={S1 + 26} stagger={5} style={{ color: COLORS.faint }} />{' '}
          <AnimatedText
            text="necesita personas que diseñen, resuelvan problemas y creen proyectos propios."
            at={S1 + 90}
            stagger={5}
            style={{ color: COLORS.text }}
          />
        </p>
        <div style={{ opacity: 1 - up, marginTop: 56, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 14 }}>
          {WAYS.map((w, i) => {
            const p = springAt(frame, S1 + 190 + i * 8, SPRING.pop);
            return (
              <span
                key={w}
                style={{
                  padding: '12px 24px',
                  borderRadius: 99,
                  fontSize: 26,
                  fontWeight: 600,
                  color: COLORS.jade300,
                  background: rgba(COLORS.jade, 0.14),
                  opacity: clamp(p * 2),
                  transform: `translateY(${(1 - p) * 20}px)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
        <div style={{ ...caption, opacity: Number(caption.opacity) * (1 - up), marginTop: 22, fontSize: 24, color: COLORS.muted }}>
          Programar es un medio clave, pero no el único.
        </div>
      </div>

      {/* Paso 3: el reto */}
      <div style={{ position: 'absolute', left: 180, right: 180, top: 470, display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 36 }}>
        <GlassCard at={S2 + 14} glow={0.6} padding="38px 42px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <IconChip icon={Rocket} size={60} />
            <span style={{ fontSize: 38, fontWeight: 700 }}>Pasa de consumir a crear</span>
          </div>
          <div style={{ marginTop: 18, fontSize: 26, lineHeight: 1.45, color: COLORS.muted, textWrap: 'pretty' }}>
            Escoge un problema real y da el primer paso esta semana.
          </div>
        </GlassCard>
        <GlassCard at={S2 + 28} padding="38px 42px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <NoutLifeMark height={46} />
            <span style={{ fontSize: 30, fontWeight: 700 }}>Conoce el caso</span>
          </div>
          <div style={{ marginTop: 20, fontFamily: FONT.mono, fontSize: 34, fontWeight: 600, color: COLORS.jade }}>noutlife.vercel.app</div>
        </GlassCard>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 790, textAlign: 'center', fontSize: 92, color: COLORS.jade }}>
        {frame > S2 && <Lettering text="gracias" at={S2 + 70} />}
      </div>
    </AbsoluteFill>
  );
};
