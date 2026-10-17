// Capas de ambiente de todo el vídeo: fondo con auroras, partículas que flotan y
// grano de película. Durante el gancho todo es gris y apagado; cuando aparece la
// marca, el jade se enciende y ya no se va.
import type React from 'react';
import { AbsoluteFill, interpolateColors } from 'remotion';
import { COLORS, rgba } from '../theme';
import { ramp, rng } from '../lib/anim';

/** 0 en el gancho (gris) → 1 desde la revelación de la marca. */
const brandTint = (frame: number) => ramp(frame, 92, 132);

export const Backdrop: React.FC<{ frame: number }> = ({ frame }) => {
  const tint = brandTint(frame);
  const cta = ramp(frame, 540, 610);
  const t = frame / 30;
  const a = { x: 22 + Math.sin(t * 0.35) * 7, y: 15 + Math.cos(t * 0.3) * 5 };
  const b = { x: 80 + Math.cos(t * 0.27) * 6, y: 84 + Math.sin(t * 0.33) * 4 };
  const glowA = interpolateColors(tint, [0, 1], [rgba('#3a4540', 0.32), rgba(COLORS.jade700, 0.5)]);
  const glowB = interpolateColors(tint, [0, 1], [rgba('#232b28', 0.4), rgba('#1a5547', 0.55)]);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #040907 0%, ${COLORS.bg} 42%, #050b08 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${a.x}% ${a.y}%, ${glowA} 0%, transparent 52%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${b.x}% ${b.y}%, ${glowB} 0%, transparent 48%)` }} />
      {/* Escena 4: un halo champán arriba, donde va el titular */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 30% at 50% 14%, ${rgba(COLORS.gold, 0.12 * cta)} 0%, transparent 70%)` }} />
    </AbsoluteFill>
  );
};

/** Viñeta suave: centra la mirada y esconde los bordes planos. */
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{ background: 'radial-gradient(ellipse 78% 62% at 50% 47%, transparent 52%, rgba(0, 0, 0, 0.62) 100%)', pointerEvents: 'none' }}
  />
);

const PARTICLES = (() => {
  const r = rng(7);
  return Array.from({ length: 72 }, () => ({
    x: r() * 1080,
    y: r() * 1920,
    z: 0.2 + r() * 0.8,
    speed: 0.35 + r() * 1.05,
    sway: 0.5 + r() * 1.6,
    phase: r() * Math.PI * 2,
    size: 1.6 + r() * 3.4,
  }));
})();

/**
 * Polvo de luz que sube despacio. `warp` lo estira desde un punto (el zoom del
 * gancho) para que la cámara parezca entrar de verdad.
 */
export const Particles: React.FC<{ frame: number; warp?: { s: number; x: number; y: number }; opacity?: number }> = ({
  frame,
  warp,
  opacity = 1,
}) => {
  const tint = brandTint(frame);
  const color = interpolateColors(tint, [0, 1], ['#aab5af', COLORS.jade300]);
  const transform = warp ? `translate(${warp.x}px, ${warp.y}px) scale(${warp.s}) translate(${-warp.x}px, ${-warp.y}px)` : undefined;
  return (
    <AbsoluteFill style={{ transform, opacity }}>
      {PARTICLES.map((p, i) => {
        const y = ((((p.y - frame * p.speed * p.z * 1.4) % 2020) + 2020) % 2020) - 50;
        const x = p.x + Math.sin((frame / 60) * p.sway + p.phase) * 18 * p.z;
        const size = p.size * (0.5 + p.z);
        const twinkle = 0.75 + 0.25 * Math.sin(frame / 9 + p.phase * 3);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: color,
              opacity: (0.1 + 0.5 * p.z) * twinkle,
              boxShadow: p.z > 0.78 ? `0 0 ${10 * p.z}px ${color}` : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

let grainUrl: string | null = null;
/** Una baldosa de ruido con semilla, generada una vez por pestaña del renderizador. */
function grainTile(): string {
  if (grainUrl) return grainUrl;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(size, size);
  const r = rng(42);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(r() * 256);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainUrl = canvas.toDataURL('image/png');
  return grainUrl;
}

/** Grano de película muy sutil: da textura y evita bandas en los degradados oscuros. */
export const Grain: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 0.045 }) => {
  const r = rng(frame * 7919 + 13);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${grainTile()})`,
        backgroundPosition: `${Math.floor(r() * 256)}px ${Math.floor(r() * 256)}px`,
        opacity,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      }}
    />
  );
};
