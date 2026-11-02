// Matemática pura de la inclinación de las tarjetas (lib/motion/tilt): sin DOM, la usan los tests.

export interface TiltTarget {
  /** Grados: alrededor de X (positivo: se inclina hacia atrás por arriba) y de Y. */
  rx: number;
  ry: number;
  /** Elevación en px, hacia quien mira. */
  z: number;
}

/** Cuanto más grande la tarjeta, menos se inclina: en una ancha unos grados ya mueven mucho las esquinas. */
export function tiltLimits(width: number, height: number) {
  const size = Math.max(width, height, 1);
  return {
    deg: Math.max(1.1, Math.min(5.5, 1400 / size)),
    lift: Math.max(4, Math.min(14, 5000 / size)),
  };
}

/** Destino para un puntero en (x, y) dentro de la tarjeta. El lado que se toca se aleja. */
export function tiltTarget(x: number, y: number, width: number, height: number, touch = false): TiltTarget {
  const { deg, lift } = tiltLimits(width, height);
  const nx = Math.max(-1, Math.min(1, (x / Math.max(width, 1)) * 2 - 1));
  const ny = Math.max(-1, Math.min(1, (y / Math.max(height, 1)) * 2 - 1));
  // Con el dedo, el mismo gesto más contenido: se ve poco y dura lo que dura el toque.
  const k = touch ? 0.7 : 1;
  return { rx: -ny * deg * k, ry: nx * deg * k, z: lift * k };
}

/** Un paso del muelle (Euler semi-implícito). Un poco subamortiguado: llega y se pasa apenas. */
export const TILT_SPRING = { stiffness: 170, damping: 18 };

export function springStep(x: number, v: number, to: number, dt: number) {
  const a = TILT_SPRING.stiffness * (to - x) - TILT_SPRING.damping * v;
  const nv = v + a * dt;
  return { x: x + nv * dt, v: nv };
}

export const settled = (x: number, v: number, to: number) => Math.abs(x - to) < 0.01 && Math.abs(v) < 0.05;

/** Sombra proyectada: la luz viene de arriba a la izquierda. Al subir se separa y se difumina; al inclinarse, se corre.
 *  Devuelve una box-shadow que usa --lq-shadow-ink (el color de sombra del tema). Redondeada: en una sombra
 *  tan difusa un píxel no se ve, y mientras el texto no cambia la tarjeta no se vuelve a pintar. */
export function castShadow(rx: number, ry: number, z: number, strength = 1) {
  const up = Math.max(0, z);
  const offX = Math.round(2 + up * 0.5 - ry * 1.5);
  const offY = Math.round(5 + up * 0.95 + rx * 1.5);
  const blur = Math.round((14 + up * 2.2) / 2) * 2;
  const spread = Math.round(-6 - up * 0.35);
  const far = ((0.11 + up * 0.0048) * strength).toFixed(2);
  const near = (Math.max(0, 0.07 - up * 0.004) * strength).toFixed(2);
  return `0 1px 2px rgb(var(--lq-shadow-ink) / ${near}), ${offX}px ${offY}px ${blur}px ${spread}px rgb(var(--lq-shadow-ink) / ${far})`;
}
