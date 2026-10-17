// Ayudas de animación. Todo es una función pura del fotograma: cualquier fotograma
// se puede renderizar suelto y en cualquier orden (así trabaja Remotion en paralelo).
import { Easing, interpolate, spring, type SpringConfig } from 'remotion';
import { FPS } from '../timeline';

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const EASE = {
  /** Llegadas: rápido y se posa (expo-out). */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Movimientos de cámara. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Salidas que aceleran. */
  in: Easing.bezier(0.55, 0, 0.85, 0.3),
  linear: (t: number) => t,
};

/** Progreso 0→1 entre los fotogramas `a` y `b`. */
export function ramp(frame: number, a: number, b: number, easing: (t: number) => number = EASE.inOut) {
  return interpolate(frame, [a, b], [0, 1], { easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** Muelle 0→1 que arranca en `start` (antes vale 0). */
export function springAt(frame: number, start: number, config?: Partial<SpringConfig>, durationInFrames?: number) {
  if (frame <= start) return 0;
  return spring({ frame: frame - start, fps: FPS, config, durationInFrames });
}

/** Pseudoaleatorio con semilla (mulberry32): el mismo resultado en cada render. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Texto que se escribe solo: `cps` caracteres por fotograma desde `start`. */
export const typed = (text: string, frame: number, start: number, cps = 1) =>
  text.slice(0, clamp(Math.floor((frame - start) * cps), 0, text.length));

/** 12480 → «12.480» (separador de miles colombiano, como la app). */
export const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Pose 3D de un objeto en el escenario (px y grados). `o` = opacidad. */
export interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  s: number;
  o: number;
}

/** Mezcla dos poses. `t` puede pasarse de 1 (muelles con rebote); la opacidad no. */
export const mixPose = (a: Pose, b: Pose, t: number): Pose => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
  rx: lerp(a.rx, b.rx, t),
  ry: lerp(a.ry, b.ry, t),
  rz: lerp(a.rz, b.rz, t),
  s: lerp(a.s, b.s, t),
  o: lerp(a.o, b.o, clamp(t)),
});
