// 5. Recomendaciones y cierre. Paso 1: vías de mejora para estudiantes, el aula y la
// casa (el objetivo 4 de la investigación), con sus ideas clave. Paso 2: la sala se
// despeja y entra el mensaje final palabra por palabra; la mitad del scroll apagada
// y la de crear encendida, igual que el título de la portada. Paso 3: el mensaje sube
// y llega el reto: empezar un proyecto propio, con NoutLife como ejemplo.
import type React from 'react';
import { GraduationCap, Home, Rocket, User, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { AnimatedText } from '../components/AnimatedText';
import { NoutLifeMark } from '../components/Brand';
import { GlassCard, IconChip } from '../components/GlassCard';
import { TalkingPoints } from '../components/TalkingPoints';
import { COLORS, FONT, rgba } from '../theme';
import { SPRING, clamp, lerp, leave, rise, springAt } from '../lib';

export const CONCLUSION_STOPS = [300, 580, 840];
const [S1, S2] = CONCLUSION_STOPS;

const PATHS: Array<{ icon: LucideIcon; color: string; title: string; points: string[] }> = [
  {
    icon: User,
    color: COLORS.rose,
    title: 'Estudiantes',
    points: ['Medir y limitar el tiempo en pantalla.', 'Cambiar una hora de scroll por una de crear.'],
  },
  {
    icon: GraduationCap,
    color: COLORS.indigo,
    title: 'En el aula',
    points: ['Usar la tecnología para investigar y crear, no solo para consultar.', 'Proyectos donde los estudiantes construyan soluciones.'],
  },
  {
    icon: Home,
    color: COLORS.amber,
    title: 'En casa',
    points: ['Acuerdos de uso en familia, en vez de prohibirlo o permitirlo todo.', 'Hablar de lo que se ve y de lo que se crea.'],
  },
];

export const Slide5Conclusion: React.FC = () => {
  const frame = useCurrentFrame();
  const up = springAt(frame, S2 + 2, SPRING.glide);
  return (
    <AbsoluteFill>
      {/* Paso 1 */}
      <div style={{ ...leave(frame, S1 + 1), position: 'absolute', inset: 0 }}>
        <h2 style={{ position: 'absolute', left: 120, top: 84, margin: 0, fontSize: 64, fontWeight: 800, letterSpacing: '-0.03em' }}>
          <AnimatedText text="Recomendaciones" at={8} />
        </h2>
        <div style={{ ...rise(frame, 30), position: 'absolute', left: 120, top: 170, fontSize: 28, color: COLORS.soft }}>
          Vías para integrar mejor la tecnología en el colegio y en la casa
        </div>
        <div style={{ position: 'absolute', left: 120, top: 270, width: 1680, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 36 }}>
          {PATHS.map((path, i) => (
            <GlassCard key={path.title} at={60 + i * 16} tint={path.color} glow={0.35} padding="36px 36px 30px">
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <IconChip icon={path.icon} color={path.color} size={64} />
                <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.015em' }}>{path.title}</span>
              </div>
              {path.points.map((point, k) => {
                const p = springAt(frame, 90 + i * 16 + k * 12, SPRING.glide);
                return (
                  <div
                    key={point}
                    style={{
                      display: 'flex',
                      gap: 14,
                      marginTop: 22,
                      fontSize: 25,
                      lineHeight: 1.4,
                      color: COLORS.soft,
                      opacity: clamp(p * 1.4),
                      transform: `translateX(${(1 - p) * 20}px)`,
                    }}
                  >
                    <span style={{ flex: 'none', width: 9, height: 9, marginTop: 13, borderRadius: 5, background: path.color }} />
                    {point}
                  </div>
                );
              })}
            </GlassCard>
          ))}
        </div>
        <TalkingPoints
          style={{ left: 120, top: 640, width: 1680 }}
          steps={[[150, ['Ni prohibir todo ni permitir todo: orientar.', 'El colegio puede enseñar a crear, no solo a usar.']]]}
        />
      </div>

      {/* Paso 2: el mensaje final (en el paso 3 sube y se achica) */}
      <div
        style={{
          position: 'absolute',
          left: 160,
          right: 160,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          transform: `translateY(${lerp(0, -265, up)}px) scale(${lerp(1, 0.66, up)})`,
        }}
      >
        <p style={{ margin: 0, fontSize: 72, fontWeight: 750, lineHeight: 1.16, letterSpacing: '-0.03em', textWrap: 'balance' }}>
          <AnimatedText
            text="El mundo laboral y el futuro no necesitan más gente que haga scroll;"
            at={S1 + 26}
            stagger={5}
            style={{ color: COLORS.faint }}
          />{' '}
          <AnimatedText text="necesitan mentes que diseñen, programen y creen soluciones." at={S1 + 100} stagger={6} style={{ color: COLORS.text }} />
        </p>
      </div>

      {/* Paso 3: el reto */}
      <div style={{ position: 'absolute', left: 160, right: 160, top: 470, display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 40 }}>
        <GlassCard at={S2 + 14} tint={COLORS.violet} glow={0.7} padding="34px 38px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <IconChip icon={Rocket} color={COLORS.violet} size={56} />
            <span style={{ fontSize: 38, fontWeight: 800 }}>El reto: pasa de consumir a crear</span>
          </div>
          <div style={{ marginTop: 18, fontSize: 25, lineHeight: 1.45, color: COLORS.soft, textWrap: 'pretty' }}>
            Escoge un problema real del colegio o de tu casa, dibuja la idea y aprende lo necesario para construirla.
          </div>
        </GlassCard>
        <GlassCard at={S2 + 28} tint={COLORS.jade} glow={0.4} padding="34px 38px">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <NoutLifeMark height={48} />
            <span style={{ fontSize: 30, fontWeight: 700 }}>Conoce el caso NoutLife</span>
          </div>
          <div style={{ marginTop: 18, fontFamily: FONT.mono, fontSize: 34, fontWeight: 700, color: COLORS.jade }}>noutlife.vercel.app</div>
          <div style={{ marginTop: 8, fontSize: 21, color: rgba(COLORS.soft, 0.9) }}>Ábrela en el navegador del celular.</div>
        </GlassCard>
      </div>
      <div style={{ ...rise(frame, S2 + 80), position: 'absolute', left: 0, right: 0, top: 815, textAlign: 'center', fontSize: 46, fontWeight: 800 }}>
        Gracias. <span style={{ color: COLORS.muted, fontWeight: 600 }}>¿Preguntas?</span>
      </div>
    </AbsoluteFill>
  );
};
