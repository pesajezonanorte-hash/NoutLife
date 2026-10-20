// Fondo común a todo el deck (las diapositivas son transparentes y se deslizan
// encima): el negro verdoso de la app y una luz de sala jade muy tenue que deriva
// despacio, como la del Inicio de la PWA. El grano evita bandas en el proyector.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, rgba } from '../theme';

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export const Backdrop: React.FC = () => {
  const t = useCurrentFrame() / 60;
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(48% 62% at ${22 + 5 * Math.sin(t / 6)}% ${12 + 6 * Math.cos(t / 7)}%, ${rgba(COLORS.jade, 0.09)}, transparent 72%)`,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(120% 95% at 50% 45%, transparent 60%, ${rgba(COLORS.bgDeep, 0.85)} 100%)` }} />
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.045, mixBlendMode: 'overlay' }} />
    </AbsoluteFill>
  );
};
