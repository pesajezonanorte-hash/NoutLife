// El haz de luz jade de la escena 2: una banda suave, inclinada 10°, que baja por la
// escena (px del mundo) de encima del teléfono a debajo de él. Cada cosa que toca (los
// candados de la hoja, las tarjetas de cristal) se abre en el fotograma en que el centro
// de la banda pasa por ella, así que el orden de desbloqueo sale de la geometría.
import { clamp, lerp, ramp } from '../Video/lib/anim';
import { EASE } from './motion';
import { POSE_REVEAL } from './device';
import { PHONE } from '../Video/layout';
import { REVEAL } from './timeline';

const half = (PHONE.h / 2) * POSE_REVEAL.s;
export const BEAM = {
  from: REVEAL.beam.from,
  to: REVEAL.beam.to,
  /** Recorrido del centro de la banda (en x = 540). */
  y0: POSE_REVEAL.y - half - 160,
  y1: POSE_REVEAL.y + half + 160,
  /** Pendiente: la banda sube hacia la derecha. */
  slope: Math.tan((-10 * Math.PI) / 180),
  /** Medio ancho de la banda (σ de la campana, px del mundo). */
  sigma: 64,
};

/** Centro de la banda en x = 540. */
export const beamY = (frame: number) => lerp(BEAM.y0, BEAM.y1, ramp(frame, BEAM.from, BEAM.to, EASE.inOut));

/** Distancia vertical (px del mundo) del punto al centro de la banda; positiva = la banda aún no llega. */
export const beamOffset = (frame: number, p: { x: number; y: number }) => p.y - (beamY(frame) + (p.x - 540) * BEAM.slope);

/** Intensidad de la luz en el punto (0–1), mientras dura el barrido. */
export function beamGlow(frame: number, p: { x: number; y: number }) {
  if (frame <= BEAM.from || frame >= BEAM.to + 8) return 0;
  return Math.exp(-0.5 * (beamOffset(frame, p) / BEAM.sigma) ** 2);
}

/** Fotograma (con decimales) en que el centro de la banda cruza el punto. */
export function beamCrossing(p: { x: number; y: number }) {
  let lo = BEAM.from;
  let hi = BEAM.to;
  if (beamOffset(lo, p) <= 0) return lo;
  if (beamOffset(hi, p) > 0) return hi;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (beamOffset(mid, p) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 0 → 1 en los fotogramas que siguen al paso de la banda: lo que se abre con ella. */
export const unlockAt = (frame: number, p: { x: number; y: number }, frames = 9) => {
  const at = beamCrossing(p);
  return clamp(ramp(frame, at - 1, at - 1 + frames, EASE.inOut));
};
