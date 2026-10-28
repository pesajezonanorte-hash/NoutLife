// La banda del haz dibujada dentro de una superficie (la pantalla del teléfono o una
// tarjeta de cristal), en sus propias coordenadas. El contenedor debe recortar
// (overflow hidden) para que la luz no salga de la superficie.
import type React from 'react';
import { rgba } from '../../Video/theme';
import { BEAM, beamY } from '../beam';

/** Perfil de campana (±3σ) en paradas de degradado. */
const PROFILE = [0, 0.15, 0.28, 0.38, 0.45, 0.5, 0.55, 0.62, 0.72, 0.85, 1].map((o) => [o, Math.exp(-0.5 * ((o - 0.5) * 6) ** 2)] as const);

export const BeamLight: React.FC<{
  frame: number;
  /** Esquina superior izquierda de la superficie en el mundo, y px del mundo por px propio. */
  origin: { x: number; y: number };
  scale: number;
  width: number;
  height: number;
  color: string;
  /** Opacidad en el centro de la banda. */
  peak?: number;
}> = ({ frame, origin, scale, width, height, color, peak = 0.3 }) => {
  if (frame <= BEAM.from || frame >= BEAM.to + 8) return null;
  const cx = width / 2;
  const cy = (beamY(frame) + (origin.x + cx * scale - 540) * BEAM.slope - origin.y) / scale;
  const band = (6 * BEAM.sigma) / scale;
  if (cy < -band || cy > height + band) return null;
  const stops = PROFILE.map(([o, a]) => `${rgba(color, peak * a)} ${(o * 100).toFixed(1)}%`).join(', ');
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - width,
        top: cy - band / 2,
        width: width * 2,
        height: band,
        background: `linear-gradient(180deg, ${stops})`,
        transform: `rotate(${(Math.atan(BEAM.slope) * 180) / Math.PI}deg)`,
        mixBlendMode: 'screen',
        pointerEvents: 'none',
      }}
    />
  );
};
