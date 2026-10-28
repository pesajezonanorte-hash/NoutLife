// Guías para editar (prop `showGuides`): las zonas que tapan los botones y textos
// de Reels/TikTok/Shorts y la frase de locución que toca en cada momento.
// Apagadas por defecto: no salen en el render.
import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { FONT } from '../theme';
import { VO_CUES } from '../timeline';

const band = (style: React.CSSProperties): React.CSSProperties => ({
  position: 'absolute',
  background: 'rgba(255, 60, 60, 0.16)',
  outline: '2px dashed rgba(255, 90, 90, 0.7)',
  outlineOffset: -2,
  ...style,
});

const label: React.CSSProperties = { position: 'absolute', fontFamily: FONT.mono, fontSize: 22, color: 'rgba(255, 140, 140, 0.95)' };

export const Guides: React.FC<{ frame: number; cues?: ReadonlyArray<{ from: number; to: number; text: string }> }> = ({
  frame,
  cues = VO_CUES,
}) => {
  const cue = cues.find((c) => frame >= c.from && frame < c.to);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={band({ left: 0, right: 0, top: 0, height: 220 })} />
      <div style={band({ left: 0, right: 0, top: 1480, bottom: 0 })} />
      <div style={band({ left: 940, right: 0, top: 700, height: 780 })} />
      <div style={{ ...label, left: 24, top: 180 }}>interfaz de la red social</div>
      <div style={{ ...label, left: 24, top: 1490 }}>pie de foto, audio y usuario</div>
      {cue && (
        <div
          style={{
            position: 'absolute',
            left: 40,
            right: 40,
            top: 1560,
            padding: '18px 24px',
            borderRadius: 18,
            background: 'rgba(0, 0, 0, 0.7)',
            fontFamily: FONT.sans,
            fontWeight: 600,
            fontSize: 34,
            color: '#fff',
            textAlign: 'center',
          }}
        >
          Locución: «{cue.text}»
        </div>
      )}
    </AbsoluteFill>
  );
};
