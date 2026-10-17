// Capas de ambiente de todo el vídeo: un fondo casi negro con tres luces de color
// que siguen a lo que hay en pantalla (palette.ts), polvo de luz del mismo tono,
// una viñeta y grano de película.
import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { rgba } from '../theme';
import { clamp, lerp, ramp, rng } from '../lib/anim';
import { lightAt } from '../palette';
import { LOCKUP } from '../layout';
import { BRAND, DEVICE, HOOK } from '../timeline';

const POINT = { x: (LOCKUP.mark.x / 1080) * 100, y: (LOCKUP.mark.y / 1920) * 100 };

export const Backdrop: React.FC<{ frame: number }> = ({ frame }) => {
  const L = lightAt(frame);
  const t = frame / 30;
  // Mientras la frase se encoge, las tres luces caen al punto con ella
  const fall = ramp(frame, HOOK.collapse.from - 10, HOOK.collapse.to) * (1 - ramp(frame, BRAND.burst, BRAND.burst + 20));
  const at = (x: number, y: number) => ({ x: lerp(x, POINT.x, fall), y: lerp(y, POINT.y, fall) });
  const A = at(20 + Math.sin(t * 0.35) * 8, 24 + Math.cos(t * 0.3) * 6);
  const B = at(82 + Math.cos(t * 0.27) * 7, 78 + Math.sin(t * 0.33) * 5);
  const C = at(50 + Math.sin(t * 0.2) * 4, 52 + Math.cos(t * 0.25) * 4);
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #040706 0%, #060b09 45%, #030504 100%)' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${A.x}% ${A.y}%, ${rgba(L.a, 0.4 * L.k)} 0%, transparent 46%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${B.x}% ${B.y}%, ${rgba(L.b, 0.34 * L.k)} 0%, transparent 46%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 62% 42% at ${C.x}% ${C.y}%, ${rgba(L.c, 0.2 * L.k)} 0%, transparent 70%)` }} />
    </AbsoluteFill>
  );
};

/** Viñeta suave: centra la mirada y esconde los bordes planos. */
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{ background: 'radial-gradient(ellipse 80% 64% at 50% 48%, transparent 54%, rgba(0, 0, 0, 0.6) 100%)', pointerEvents: 'none' }}
  />
);

const PARTICLES = (() => {
  const r = rng(7);
  return Array.from({ length: 64 }, () => ({
    x: r() * 1080,
    y: r() * 1920,
    z: 0.2 + r() * 0.8,
    speed: 0.35 + r() * 1.05,
    sway: 0.5 + r() * 1.6,
    phase: r() * Math.PI * 2,
    size: 1.6 + r() * 3.2,
  }));
})();

/** Polvo de luz que sube despacio, del color de la escena. Se va antes del relevo al teléfono. */
export const Particles: React.FC<{ frame: number }> = ({ frame }) => {
  const visible = clamp(1 - ramp(frame, BRAND.handoff.from - 22, BRAND.handoff.from) + ramp(frame, DEVICE.pullBack.to - 4, DEVICE.pullBack.to + 26));
  if (visible <= 0.001) return null;
  const color = lightAt(frame).c;
  return (
    <AbsoluteFill style={{ opacity: visible }}>
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
              opacity: (0.08 + 0.45 * p.z) * twinkle,
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
