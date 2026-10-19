// Ideas clave para guiar al expositor: uno o dos puntos breves por paso. Cada paso
// trae su juego de puntos; al avanzar, el anterior se desvanece y el nuevo entra
// punto por punto. Sin caja de vidrio: una línea de luz a la izquierda basta.
import type React from 'react';
import { MessageSquareText } from 'lucide-react';
import { useCurrentFrame } from 'remotion';
import { COLORS, rgba } from '../theme';
import { SPRING, clamp, ramp, springAt } from '../lib';

export const TalkingPoints: React.FC<{
  /** [fotograma en que entra, puntos]. En orden. */
  steps: Array<[number, string[]]>;
  style?: React.CSSProperties;
}> = ({ steps, style }) => {
  const frame = useCurrentFrame();
  const shown = steps.findLastIndex(([at]) => frame >= at);
  const line = ramp(frame, steps[0][0], steps[0][0] + 30);
  return (
    <div style={{ position: 'absolute', display: 'flex', gap: 18, ...style }}>
      <div
        style={{
          width: 3,
          borderRadius: 2,
          background: `linear-gradient(180deg, ${COLORS.indigo}, ${COLORS.violet})`,
          transform: `scaleY(${line})`,
          transformOrigin: 'top',
        }}
      />
      <MessageSquareText size={24} color={COLORS.indigo} style={{ flex: 'none', marginTop: 3, opacity: line }} />
      <div style={{ position: 'relative', flex: 1 }}>
        {steps.map(([at, points], i) => {
          if (i !== shown && i !== shown - 1) return null;
          const out = i < shown ? ramp(frame, steps[i + 1][0], steps[i + 1][0] + 14) : 0;
          if (out >= 1) return null;
          return (
            // El juego en curso ocupa espacio; el que sale queda encima, sin empujar
            <div key={at} style={{ position: i === shown ? 'relative' : 'absolute', inset: 0, opacity: 1 - out }}>
              {points.map((p, k) => {
                const s = springAt(frame, at + 6 + k * 10, SPRING.glide);
                return (
                  <div
                    key={p}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'baseline',
                      fontSize: 22,
                      lineHeight: 1.45,
                      color: COLORS.soft,
                      opacity: clamp(s * 1.4),
                      transform: `translateX(${(1 - s) * 24}px)`,
                    }}
                  >
                    <span style={{ flex: 'none', width: 7, height: 7, borderRadius: 4, background: rgba(COLORS.indigo, 0.9), transform: 'translateY(-3px)' }} />
                    {p}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
