// Texto con la letra de la marca (el trazo del wordmark «noutlife»), siempre en
// minúsculas como el logo, igual que los títulos de la app
// (apps/web/src/components/layout/Lettering.tsx). Se escribe trazo a trazo desde
// `at`, con los tiempos del splash: cada letra empieza un poco después de la
// anterior (una frase larga no tarda más de ~1 s en arrancar entera), cada trazo
// tarda 0,62 s y los puntos aparecen con un pequeño rebote.
// Cada palabra es un SVG en línea, así el texto parte línea entre palabras.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { GAP, GLYPHS, type Glyph } from './letteringGlyphs';
import { EASE, SPRING, ramp, springAt } from '../lib';

/** Unidades del alfabeto por em: la altura x queda como la de Montserrat. */
const EM = 120;
const PAD = 10;
const TOP = -14;
const HEIGHT = 162;
const STROKE_FRAMES = 37; // 0,62 s
const lower = (s: string) => s.toLocaleLowerCase('es');

function layoutWord(word: string) {
  let x = PAD;
  const glyphs: { g: Glyph; x: number }[] = [];
  [...word].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (i > 0) x += g.lb ?? 0;
    glyphs.push({ g, x });
    x += g.w + GAP + (g.rb ?? 0);
  });
  return { glyphs, width: x - GAP + PAD };
}

export const Lettering: React.FC<{
  text: string;
  /** Fotograma del primer trazo (sin él, ya está escrito). */
  at?: number;
  /** Reloj propio (p. ej. el de una pantalla del teléfono); por defecto, el de la secuencia. */
  frame?: number;
  style?: React.CSSProperties;
}> = ({ text, at, frame: ownFrame, style }) => {
  const sequenceFrame = useCurrentFrame();
  const frame = ownFrame ?? sequenceFrame;
  if (![...lower(text)].every((c) => /\s/.test(c) || c in GLYPHS)) throw new Error(`Lettering: «${text}» tiene caracteres sin glifo`);
  const words = lower(text).split(/\s+/).filter(Boolean);
  const count = words.reduce((n, w) => n + [...w].length, 0);
  const step = Math.min(3.9, 57 / Math.max(1, count));
  const drawn = (start: number) => (at === undefined ? 1 : ramp(frame, start, start + STROKE_FRAMES, EASE.inOut));
  const popped = (start: number) => (at === undefined ? 1 : springAt(frame, start, SPRING.pop));
  let k = 0;
  return (
    <span style={{ lineHeight: 1.2, ...style }}>
      {words.map((word, wi) => {
        const { glyphs, width } = layoutWord(word);
        return (
          <React.Fragment key={wi}>
            {wi > 0 && ' '}
            <svg
              viewBox={`0 ${TOP} ${width} ${HEIGHT}`}
              style={{
                display: 'inline-block',
                width: `${width / EM}em`,
                height: '1.35em',
                verticalAlign: '-0.4em',
                margin: '-0.05em 0 -0.22em',
                overflow: 'visible',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 15,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }}
            >
              {glyphs.map(({ g, x }, gi) => {
                const start = (at ?? 0) + k++ * step;
                return (
                  <g key={gi} transform={`translate(${x} 0)${g.t ? ` ${g.t}` : ''}`}>
                    {g.d.map((d, j) => (
                      <path key={j} d={d} pathLength={1} strokeDasharray="1 2" strokeDashoffset={1.01 * (1 - drawn(start + j * 4.8))} />
                    ))}
                    {g.dots?.map(([cx, cy, r], j) => (
                      <circle
                        key={`o${j}`}
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="currentColor"
                        stroke="none"
                        style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `scale(${popped(start + g.d.length * 4.8 + 8.4)})` }}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
          </React.Fragment>
        );
      })}
    </span>
  );
};
