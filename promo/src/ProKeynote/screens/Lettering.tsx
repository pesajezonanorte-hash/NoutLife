// El saludo de Inicio con la letra de la marca (el trazo del wordmark), ya escrito.
// Mismo alfabeto que la app (letteringGlyphs.ts es copia de
// apps/web/src/components/layout/letteringGlyphs.ts) y la misma caja que
// presentacion/src/components/Lettering.tsx: 120 u por em, trazo de 15 u.
import type React from 'react';
import { GAP, GLYPHS, type Glyph } from './letteringGlyphs';

const EM = 120;
const PAD = 10;
const TOP = -14;
const HEIGHT = 162;

function layoutWord(word: string) {
  let x = PAD;
  const glyphs: Array<{ g: Glyph; x: number }> = [];
  [...word].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) throw new Error(`Lettering: «${ch}» no está en el alfabeto de la marca`);
    if (i > 0) x += g.lb ?? 0;
    glyphs.push({ g, x });
    x += g.w + GAP + (g.rb ?? 0);
  });
  return { glyphs, width: x - GAP + PAD };
}

/** `size` es el cuerpo en px (como font-size); el texto va en minúsculas, como el logo. */
export const Lettering: React.FC<{ text: string; size: number; color: string; style?: React.CSSProperties }> = ({ text, size, color, style }) => {
  const words = text.toLocaleLowerCase('es').split(/\s+/).filter(Boolean);
  const k = size / EM;
  const space = size * 0.28;
  let x = 0;
  const placed = words.map((word) => {
    const w = layoutWord(word);
    const at = x;
    x += w.width * k + space;
    return { ...w, at };
  });
  return (
    <svg
      width={x - space}
      height={HEIGHT * k}
      viewBox={`0 ${TOP} ${(x - space) / k} ${HEIGHT}`}
      style={{ overflow: 'visible', fill: 'none', stroke: color, strokeWidth: 15, strokeLinecap: 'round', strokeLinejoin: 'round', ...style }}
    >
      {placed.map((word, wi) => (
        <g key={wi} transform={`translate(${word.at / k} 0)`}>
          {word.glyphs.map(({ g, x: gx }, gi) => (
            <g key={gi} transform={`translate(${gx} 0)${g.t ? ` ${g.t}` : ''}`}>
              {g.d.map((d, j) => (
                <path key={j} d={d} />
              ))}
              {g.dots?.map(([cx, cy, r], j) => <circle key={`o${j}`} cx={cx} cy={cy} r={r} fill={color} stroke="none" />)}
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
};
