// 3. Evidencia práctica: el caso NoutLife. No es una demostración de producto, sino
// la prueba de lo que plantea la investigación: qué desarrolla un estudiante cuando
// pasa de usar herramientas a crearlas. Tres hallazgos, uno por paso, y el teléfono
// los ilustra:
// - Solución de problemas: la Libreta (tareas y fechas dispersas, ahora en orden).
// - Desarrollo de habilidades: una tarjeta de código se escribe junto al teléfono.
// - Organización de hábitos y mente: los hábitos del día se van marcando.
import type React from 'react';
import { Brain, Check, Code2, Lightbulb, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { AnimatedText } from '../components/AnimatedText';
import { NoutLifeMark, Wordmark } from '../components/Brand';
import { GlassCard, IconChip } from '../components/GlassCard';
import { PhoneMockup } from '../components/PhoneMockup';
import { TalkingPoints } from '../components/TalkingPoints';
import { HabitosScreen, HomeScreen, LibretaScreen } from '../screens/AppScreens';
import { COLORS, FONT, rgba } from '../theme';
import { SPRING, clamp, ramp, rise, springAt } from '../lib';

export const NOUTLIFE_STOPS = [240, 460, 680, 900];
const [S0, S1, S2] = NOUTLIFE_STOPS;

const FINDINGS: Array<{ icon: LucideIcon; color: string; title: string; text: string }> = [
  {
    icon: Lightbulb,
    color: COLORS.amber,
    title: 'Solución de problemas',
    text: 'Parte de un problema real: tareas, fechas y hábitos dispersos.',
  },
  {
    icon: Code2,
    color: COLORS.indigo,
    title: 'Desarrollo de habilidades',
    text: 'Programar y corregir errores entrena lógica y pensamiento crítico.',
  },
  {
    icon: Brain,
    color: COLORS.jade,
    title: 'Organización de hábitos y mente',
    text: 'Ayuda a sostener rutinas, rachas y metas de estudio.',
  },
];

/** Pantallas del teléfono: inicio y, desde cada paso que lo pide, la suya. */
const SCREENS: Array<[number, React.FC<{ t: number }>]> = [
  [20, HomeScreen],
  [S0 + 1, LibretaScreen],
  [S2 + 1, HabitosScreen],
];

const ScreenStack: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {SCREENS.map(([at, S], i) => {
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
          <S t={frame - at} />
        </div>
      );
    })}
  </>
);

const CODE = ['const racha = dias', '  .filter((d) => d.hecho)', '  .length;', '', 'mostrar(`Racha: ${racha} días`);'];
const CODE_LEN = CODE.join('\n').length;

/** Paso 2: el código detrás de una racha se escribe junto al teléfono y se prueba. */
const CodeCard: React.FC<{ frame: number }> = ({ frame }) => {
  const at = S1 + 4;
  const p = springAt(frame, at, SPRING.card);
  const out = ramp(frame, S2 + 1, S2 + 20);
  const typed = Math.floor(clamp((frame - at - 16) / 80) * CODE_LEN);
  const ok = springAt(frame, at + 104, SPRING.pop);
  if (p === 0 || out >= 1) return null;
  let left = typed;
  return (
    <div
      style={{
        position: 'absolute',
        left: 590,
        top: 360,
        width: 380,
        opacity: clamp(p * 1.5) * (1 - out),
        transform: `translateX(${(1 - p) * 120 + out * 60}px) rotate(${(1 - p) * 6}deg)`,
      }}
    >
      <GlassCard tint={COLORS.indigo} glow={0.7} radius={22} padding={0} style={{ background: rgba('#0b1222', 0.82) }}>
        <div style={{ padding: '12px 18px', fontFamily: FONT.mono, fontSize: 14, color: COLORS.muted, borderBottom: `1px solid ${rgba('#ffffff', 0.08)}` }}>racha.js</div>
        <div style={{ padding: '14px 18px', fontFamily: FONT.mono, fontSize: 15.5, lineHeight: 1.7, whiteSpace: 'pre', minHeight: 5 * 26 }}>
          {CODE.map((line, i) => {
            const shown = line.slice(0, Math.max(0, left));
            left -= line.length + 1;
            return (
              <div key={i} style={{ color: i === 4 ? COLORS.jade : COLORS.text, minHeight: 26 }}>
                {shown}
              </div>
            );
          })}
        </div>
        <div style={{ padding: '0 18px 14px', height: 30 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 99,
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.jade,
              background: rgba(COLORS.jade, 0.12),
              opacity: clamp(ok * 2),
              transform: `scale(${0.6 + 0.4 * ok})`,
            }}
          >
            <Check size={15} strokeWidth={2.6} />
            Racha: 12 días
          </span>
        </div>
      </GlassCard>
    </div>
  );
};

export const Slide3NoutLife: React.FC = () => {
  const frame = useCurrentFrame();
  const sticker = springAt(frame, 110, SPRING.pop);
  // El teléfono se aparta un poco mientras se escribe el código
  const aside = springAt(frame, S1 + 2, SPRING.smooth) - springAt(frame, S2 + 1, SPRING.smooth);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 300 - 60 * aside, top: 140, filter: aside > 0.01 ? `brightness(${1 - 0.3 * aside})` : undefined }}>
        <PhoneMockup width={380} at={10} tilt={14}>
          <ScreenStack frame={frame} />
        </PhoneMockup>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 220,
          width: 230,
          padding: '22px 22px 28px',
          background: COLORS.postit,
          color: '#1f2937',
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.3,
          opacity: clamp(sticker * 2),
          transform: `rotate(${-6 + (1 - sticker) * 14}deg) scale(${0.5 + 0.5 * sticker})`,
          boxShadow: '0 10px 18px -10px rgba(2, 6, 23, 0.7)',
        }}
      >
        <div style={{ position: 'absolute', top: -10, left: '50%', width: 80, height: 22, marginLeft: -40, background: rgba('#ffffff', 0.45) }} />
        Hecha por un estudiante de grado 11°
      </div>
      <CodeCard frame={frame} />

      <div style={{ position: 'absolute', left: 1000, top: 96, width: 800 }}>
        <div style={{ ...rise(frame, 16), display: 'flex', alignItems: 'center', gap: 12, fontSize: 22, fontWeight: 600, color: COLORS.muted }}>
          <NoutLifeMark height={34} />
          <Wordmark width={140} />
          <span style={{ marginLeft: 6 }}>como caso de estudio</span>
        </div>
        <h2 style={{ margin: '16px 0 0', fontSize: 46, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', textWrap: 'balance' }}>
          <AnimatedText text="Evidencia práctica: ¿qué pasa cuando un estudiante crea?" at={34} />
        </h2>
        <div style={{ ...rise(frame, 80), marginTop: 14, fontSize: 23, lineHeight: 1.45, color: COLORS.soft, textWrap: 'pretty' }}>
          Una app para organizar rutina, hábitos y mente que muestra lo que se desarrolla al pasar de usar herramientas a crearlas.
        </div>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {FINDINGS.map((f, i) => {
            const at = NOUTLIFE_STOPS[i] + 4;
            // Al pasar al siguiente hallazgo, este se apaga un poco
            const next = i < FINDINGS.length - 1 ? NOUTLIFE_STOPS[i + 1] : null;
            const fade = next === null ? 0 : ramp(frame, next, next + 20);
            return (
              <div key={f.title} style={{ opacity: 1 - 0.45 * fade }}>
                <GlassCard
                  at={at}
                  tint={f.color}
                  glow={ramp(frame, at, at + 20) * (1 - fade)}
                  padding="16px 24px"
                  style={{ display: 'flex', alignItems: 'center', gap: 22 }}
                >
                  <IconChip icon={f.icon} color={f.color} size={58} />
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 700 }}>{f.title}</div>
                    <div style={{ marginTop: 2, fontSize: 19, lineHeight: 1.4, color: COLORS.soft }}>{f.text}</div>
                  </div>
                </GlassCard>
              </div>
            );
          })}
        </div>
      </div>

      <TalkingPoints
        style={{ left: 1000, top: 720, width: 800 }}
        steps={[
          [110, ['NoutLife es la prueba viva de la investigación: crear sí es posible desde el colegio.']],
          [S0 + 1, ['Crear empieza por observar: ¿qué problema tengo yo o mi colegio?']],
          [S1 + 1, ['Cada error del código obliga a pensar: ¿qué falla y por qué?']],
          [S2 + 1, ['La misma tecnología que distrae puede ayudar a organizar el estudio.']],
        ]}
      />
    </AbsoluteFill>
  );
};
