// Formato del deck y ayudas de animación. Todo es función pura del fotograma:
// cualquier fotograma se puede renderizar suelto (así trabaja Remotion).
import type React from 'react';
import { Easing, interpolate, spring, type SpringConfig } from 'remotion';

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;
/** Fotogramas que dura cada transición entre diapositivas. */
export const TRANSITION = 45;

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};

/** Progreso 0→1 entre los fotogramas `a` y `b`. */
export function ramp(frame: number, a: number, b: number, easing: (t: number) => number = EASE.inOut) {
  return interpolate(frame, [a, b], [0, 1], { easing, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/**
 * - `smooth`: sin rebote (textos, fundidos).
 * - `glide`: críticamente amortiguado, entra y se posa (palabras).
 * - `card`: rebota poco (tarjetas).
 * - `pop`: rebota una vez, visible (chips, post-its, checks).
 * - `phone`: pesado y lento.
 */
export const SPRING: Record<'smooth' | 'glide' | 'card' | 'pop' | 'phone', Partial<SpringConfig>> = {
  smooth: { damping: 200 },
  glide: { stiffness: 140, damping: 24, mass: 1 },
  card: { stiffness: 150, damping: 17, mass: 0.9 },
  pop: { stiffness: 260, damping: 15, mass: 0.6 },
  phone: { stiffness: 70, damping: 17, mass: 1.2 },
};

/** Muelle 0→1 que arranca en `start` (antes vale 0). */
export function springAt(frame: number, start: number, config: Partial<SpringConfig> = SPRING.smooth) {
  if (frame <= start) return 0;
  return spring({ frame: frame - start, fps: FPS, config });
}

/** Entrada estándar: aparece y sube `dist` px. */
export function rise(frame: number, at: number, dist = 36, config = SPRING.smooth): React.CSSProperties {
  const p = springAt(frame, at, config);
  return { opacity: clamp(p * 1.3), transform: `translateY(${(1 - p) * dist}px)` };
}

/** Salida: se desvanece y sube desde `from` (para despejar la diapositiva entre pasos). */
export function leave(frame: number, from: number, len = 24): React.CSSProperties {
  const q = ramp(frame, from, from + len);
  return q === 0 ? {} : { opacity: 1 - q, transform: `translateY(${-40 * q}px)` };
}

/** 12480 → «12.480» (separador de miles colombiano, como la app). */
export const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
