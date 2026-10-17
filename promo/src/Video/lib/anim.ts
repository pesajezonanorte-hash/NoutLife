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

/**
 * Un valor que cambia de objetivo varias veces y va hacia cada uno con su muelle:
 * `track(f, 0, [[30, 1], [60, -1, SPRING.swing]])`. Los muelles se suman, así que un
 * cambio a mitad de camino sigue siendo continuo.
 */
export function track(frame: number, from: number, keys: ReadonlyArray<readonly [number, number, Partial<SpringConfig>?]>) {
  let value = from;
  let previous = from;
  for (const [at, target, config] of keys) {
    value += (target - previous) * springAt(frame, at, config);
    previous = target;
  }
  return value;
}

/** Campana centrada en `at`: 1 en `at`, casi 0 a dos anchos de distancia (destellos, golpes). */
export const pulse = (frame: number, at: number, width: number) => Math.exp(-(((frame - at) / width) ** 2));

/** Caída exponencial desde `at` (0 antes): el brillo que deja un golpe. */
export const decay = (frame: number, at: number, tau: number) => (frame < at ? 0 : Math.exp(-(frame - at) / tau));

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
