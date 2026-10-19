// Texto que se revela por palabra o por letra: cada pieza sube, se enfoca y aparece
// con un muelle sin rebote, en cascada. Por letra, cada palabra sigue siendo un
// bloque que no se parte al final de la línea.
import type React from 'react';
import { useCurrentFrame } from 'remotion';
import { SPRING, clamp, springAt } from '../lib';

const Piece: React.FC<{ frame: number; at: number; children: string }> = ({ frame, at, children }) => {
  const p = springAt(frame, at, SPRING.glide);
  return (
    <span
      style={{
        display: 'inline-block',
        whiteSpace: 'pre',
        opacity: clamp(p * 1.5),
        transform: `translateY(${(1 - p) * 0.45}em)`,
        filter: p < 0.98 ? `blur(${(1 - p) * 10}px)` : undefined,
      }}
    >
      {children}
    </span>
  );
};

export const AnimatedText: React.FC<{
  text: string;
  /** Fotograma en que entra la primera pieza. */
  at: number;
  by?: 'word' | 'letter';
  /** Fotogramas entre una pieza y la siguiente. */
  stagger?: number;
  style?: React.CSSProperties;
}> = ({ text, at, by = 'word', stagger, style }) => {
  const frame = useCurrentFrame();
  const step = stagger ?? (by === 'word' ? 4 : 1.6);
  let i = 0;
  return (
    <span style={style}>
      {text.split(' ').map((word, w) => (
        <span key={w}>
          {w > 0 && ' '}
          {by === 'word' ? (
            <Piece frame={frame} at={at + i++ * step}>
              {word}
            </Piece>
          ) : (
            <span style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
              {Array.from(word).map((ch, c) => (
                <Piece key={c} frame={frame} at={at + i++ * step}>
                  {ch}
                </Piece>
              ))}
            </span>
          )}
        </span>
      ))}
    </span>
  );
};
