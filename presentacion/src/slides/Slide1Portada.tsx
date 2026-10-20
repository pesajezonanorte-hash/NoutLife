// 1. Portada. A la derecha, el splash de NoutLife: las tres hojas vuelan y forman
// la N, y «noutlife» se escribe debajo. A la izquierda, el título de la charla
// escrito con la letra de la marca («de consumidores» apagado, «a creadores» en
// jade), el título formal del trabajo de grado y el autor.
// Paso 2: la pregunta de investigación, con sus tres dimensiones.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { NoutLifeMark, SplashMark, Wordmark } from '../components/Brand';
import { GlassCard } from '../components/GlassCard';
import { Lettering } from '../components/Lettering';
import { COLORS, rgba } from '../theme';
import { SPRING, clamp, rise, springAt } from '../lib';

export const PORTADA_STOPS = [330, 520];

/** Notas del expositor, una lista por paso (se ven en la ventana de notas, tecla N). */
export const PORTADA_NOTES = [
  [
    'Preséntate: Miguel Ángel Romero Torres, grado 11°. Asesor: Rubén Darío Ospino Mestra.',
    'Esta charla continúa el trabajo de grado: cómo influye usar y crear herramientas digitales en lo académico y lo cognitivo.',
    'Idea de fondo: casi todos sabemos usar la tecnología, pero muy pocos sabemos crearla.',
  ],
  [
    'Lee la pregunta de investigación en voz alta.',
    'Tres dimensiones: académica (rendimiento), cognitiva (concentración y pensamiento crítico) y social.',
    'Objetivo general: analizar esos efectos y proponer orientaciones para aprovechar la tecnología en el colegio.',
  ],
];

const TITLE =
  'Influencia del Uso y la Creación de Herramientas Digitales en el Desarrollo Académico y Cognitivo de los Estudiantes del Colegio Jorge Isaacs';
const DIMENSIONS = ['Académica', 'Cognitiva', 'Social'];
const QUESTION_H = 230;

export const Slide1Portada: React.FC = () => {
  const frame = useCurrentFrame();
  const ask = springAt(frame, PORTADA_STOPS[0] + 1, SPRING.glide);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 0,
          bottom: 0,
          width: 1000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          transform: `translateY(${((1 - ask) * QUESTION_H) / 2}px)`,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 100, fontWeight: 400, lineHeight: 1.05 }}>
          <Lettering text="de consumidores" at={150} style={{ color: COLORS.faint, display: 'block' }} />
          <Lettering text="a creadores" at={185} style={{ color: COLORS.jade, display: 'block' }} />
        </h1>
        <div style={{ ...rise(frame, 222), marginTop: 30, maxWidth: 900, fontSize: 30, fontWeight: 500, lineHeight: 1.4, color: COLORS.onSurface, textWrap: 'balance' }}>
          Un análisis sobre el paso del consumo pasivo a la creación activa de soluciones digitales cotidianas.
        </div>
        <div style={{ ...rise(frame, 240), marginTop: 22, maxWidth: 860, fontSize: 21, lineHeight: 1.5, color: COLORS.muted, textWrap: 'pretty' }}>{TITLE}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
          {['Colegio Jorge Isaacs', 'Grado 11° (2026)'].map((t, i) => {
            const p = springAt(frame, 256 + i * 8, SPRING.pop);
            return (
              <span
                key={t}
                style={{
                  padding: '8px 18px',
                  borderRadius: 99,
                  fontSize: 19,
                  fontWeight: 600,
                  color: COLORS.jade300,
                  background: rgba(COLORS.jade, 0.14),
                  opacity: clamp(p * 2),
                  transform: `scale(${0.7 + 0.3 * p})`,
                }}
              >
                {t}
              </span>
            );
          })}
        </div>
        <div style={{ ...rise(frame, 272), marginTop: 18, display: 'flex', gap: 20, fontSize: 20, color: COLORS.muted }}>
          <span style={{ color: COLORS.text, fontWeight: 600 }}>Miguel Ángel Romero Torres</span>
          <span>Asesor: Rubén Darío Ospino Mestra</span>
        </div>
        <div style={{ height: QUESTION_H, paddingTop: 44, boxSizing: 'border-box' }}>
          <GlassCard at={PORTADA_STOPS[0] + 6} glow={0.5} padding="26px 32px">
            <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.4, textWrap: 'balance' }}>
              ¿Cómo influye usar y crear herramientas digitales en nuestro desarrollo?
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
              {DIMENSIONS.map((d, i) => {
                const p = springAt(frame, PORTADA_STOPS[0] + 40 + i * 8, SPRING.pop);
                return (
                  <span
                    key={d}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 99,
                      fontSize: 19,
                      fontWeight: 600,
                      color: COLORS.jade300,
                      background: rgba(COLORS.jade, 0.16),
                      opacity: clamp(p * 2),
                      transform: `scale(${0.6 + 0.4 * p})`,
                    }}
                  >
                    {d}
                  </span>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* El splash de la PWA */}
      <div style={{ position: 'absolute', left: 1240, top: 250, width: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44 }}>
        <SplashMark height={380} at={10} />
        <div style={{ ...rise(frame, 95, 10) }}>
          <Wordmark height={64} at={96} />
        </div>
        <div style={{ ...rise(frame, 150, 8), fontSize: 22, color: COLORS.muted }}>Haz crecer tu vida</div>
      </div>
    </AbsoluteFill>
  );
};

/** Lockup chico (cabecera de las demás diapositivas). */
export const Lockup: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <NoutLifeMark height={34} />
    <Wordmark height={24} />
  </div>
);
