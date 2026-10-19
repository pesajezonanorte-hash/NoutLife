// Fondo común a todo el deck (las diapositivas son transparentes y se deslizan
// encima). Dos halos derivan despacio y cambian de color con cada diapositiva,
// durante su transición. El grano evita bandas en el proyector y en el MP4.
import type React from 'react';
import { AbsoluteFill, interpolateColors, useCurrentFrame } from 'remotion';
import { COLORS, rgba } from '../theme';
import { TRANSITION } from '../lib';
import { SLIDE_STARTS } from '../timeline';

/** Halo de arriba a la izquierda y de abajo a la derecha, por diapositiva. */
const MOODS: Array<[string, string]> = [
  [COLORS.indigoDeep, COLORS.violetDeep], // portada
  [COLORS.rose, COLORS.indigoDeep], // la cruda realidad
  [COLORS.jade, COLORS.indigoDeep], // NoutLife
  [COLORS.violetDeep, COLORS.amber], // actividad
  [COLORS.indigoDeep, COLORS.violet], // conclusión
];

const INPUT = [0, ...SLIDE_STARTS.slice(1).flatMap((s) => [s, s + TRANSITION])];
const pick = (k: 0 | 1) => [MOODS[0][k], ...MOODS.slice(1).flatMap((m, i) => [MOODS[i][k], m[k]])];

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const a = interpolateColors(frame, INPUT, pick(0));
  const b = interpolateColors(frame, INPUT, pick(1));
  const t = frame / 60;
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(55% 70% at ${18 + 6 * Math.sin(t / 5)}% ${14 + 8 * Math.cos(t / 6)}%, ${rgba(a, 0.32)}, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(50% 65% at ${86 + 5 * Math.cos(t / 7)}% ${92 + 6 * Math.sin(t / 5)}%, ${rgba(b, 0.28)}, transparent 70%)`,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(120% 95% at 50% 45%, transparent 55%, ${rgba(COLORS.inkDeep, 0.8)} 100%)` }} />
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.05, mixBlendMode: 'overlay' }} />
    </AbsoluteFill>
  );
};
