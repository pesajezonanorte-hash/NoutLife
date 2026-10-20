// 2. El problema: causas y realidad. Dos piezas grandes. Paso 1: el uso pasivo
// de pantallas (4 a 6 horas, pintadas sobre las 24 del día). Paso 2: lo que eso
// hace en el colegio: los efectos académicos, en tres viñetas que entran una a una.
// Lo analítico va en las notas.
import type React from 'react';
import { BellRing, BookOpen, GraduationCap, Infinity as InfinityIcon, type LucideIcon } from 'lucide-react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { GlassCard, IconChip } from '../components/GlassCard';
import { Lettering } from '../components/Lettering';
import { COLORS, FONT, rgba } from '../theme';
import { EASE, SPRING, clamp, ramp, springAt } from '../lib';

export const PROBLEMA_STOPS = [260, 500];
const [S1] = PROBLEMA_STOPS;

export const PROBLEMA_NOTES = [
  [
    'Estudios en colegios de la región Caribe: entre 4 y 6 horas al día en dispositivos, fuera del colegio.',
    'La mayor parte va a redes (TikTok, Instagram, WhatsApp) y a YouTube; solo una parte pequeña va a estudiar o a crear.',
    'Es uso pasivo: se hace sin pensar, ya es automático. Pregunta al salón: ¿cuántos creen que están en ese rango?',
  ],
  [
    'Lectura larga: acostumbrados a videos de segundos, sostener la atención en un texto largo cuesta más (Prensky: preferimos imágenes y respuestas rápidas).',
    'Scroll infinito: cada video nuevo es una recompensa inmediata, por eso cuesta soltarlo. Preséntalo como explicación general, no como un dato medido en el colegio.',
    'En el aula: el celular compite con la clase. Los profesores muchas veces no saben si pelear contra él o usarlo a su favor.',
    'Consumo frente a rendimiento: más horas de redes dejan menos tiempo y atención para estudiar; a veces las notas bajan.',
    'En casa tampoco hay una regla clara: unos padres quitan el celular, otros lo dejan todo el día, y nadie sabe bien qué funciona.',
  ],
];

const DayBar: React.FC<{ frame: number; at: number }> = ({ frame, at }) => (
  <div style={{ display: 'flex', gap: 5 }}>
    {Array.from({ length: 24 }, (_, h) => {
      const on = h < 6 ? ramp(frame, at + h * 6, at + h * 6 + 16, EASE.out) : 0;
      const color = h < 4 ? COLORS.text : rgba(COLORS.text, 0.45);
      return (
        <div
          key={h}
          style={{
            flex: 1,
            height: 40,
            borderRadius: 6,
            background: `linear-gradient(0deg, ${color} ${on * 100}%, ${rgba(COLORS.text, 0.07)} ${on * 100}%)`,
          }}
        />
      );
    })}
  </div>
);

const EFFECTS: Array<[LucideIcon, string]> = [
  [BookOpen, 'Dificultad para mantener el foco en tareas de lectura larga.'],
  [BellRing, 'Aumento de la distracción y fragmentación de la atención en clase.'],
  [InfinityIcon, 'Dependencia de recompensas de dopamina rápida (scroll infinito).'],
];

/** Efectos académicos: una viñeta tras otra, cada una con su ícono. */
const Effects: React.FC<{ frame: number; at: number }> = ({ frame, at }) => (
  <GlassCard at={at} padding="44px 48px" style={{ flex: 1.35 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <IconChip icon={GraduationCap} color={COLORS.onSurface} size={64} />
      <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em' }}>Efectos académicos</span>
    </div>
    <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 22 }}>
      {EFFECTS.map(([Icon, text], i) => {
        const p = springAt(frame, at + 18 + i * 14, SPRING.glide);
        return (
          <div
            key={text}
            style={{
              display: 'flex',
              gap: 18,
              alignItems: 'flex-start',
              fontSize: 27,
              lineHeight: 1.4,
              color: COLORS.onSurface,
              opacity: clamp(p * 1.4),
              transform: `translateX(${(1 - p) * 24}px)`,
            }}
          >
            <Icon size={28} color={COLORS.muted} strokeWidth={1.75} style={{ flex: 'none', marginTop: 4 }} />
            {text}
          </div>
        );
      })}
    </div>
  </GlassCard>
);

export const Slide2Problema: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <h2 style={{ position: 'absolute', left: 140, top: 150, margin: 0, fontSize: 92, fontWeight: 400, color: COLORS.text }}>
        <Lettering text="el problema" at={10} />
      </h2>

      <div style={{ position: 'absolute', left: 140, right: 140, top: 360, display: 'flex', gap: 36 }}>
        <GlassCard at={30} padding="44px 48px" style={{ flex: 1.25 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 150, fontWeight: 700, lineHeight: 0.9, letterSpacing: '-0.05em' }}>4–6</span>
            
          </div>
          <div style={{ marginTop: 22, marginBottom: 36, fontSize: 28, lineHeight: 1.4, color: COLORS.onSurface }}>
            horas diarias de uso de pantallas fuera del colegio
            <span style={{ display: 'block', fontSize: 22, color: COLORS.muted }}>Redes y videojuegos</span>
          </div>
          <DayBar frame={frame} at={60} />
        </GlassCard>
        <Effects frame={frame} at={S1 + 4} />
      </div>
    </AbsoluteFill>
  );
};
