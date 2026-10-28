// Dónde está el teléfono en cada fotograma (px del lienzo). Lo usan el teléfono, sus
// anillos y su sombra, la luz del fondo y la tarjeta de la oferta.
import type { PhonePose } from '../Video/layout';
import { lerp, ramp, springAt, track } from '../Video/lib/anim';
import { AD_SPRING } from './brand';
import { OFFER, UNLOCK } from './timeline';

/** Escena 2: centrado y algo bajo (el titular va arriba), girado para que se vea el canto. */
export const POSE_UNLOCK: PhonePose = { x: 540, y: 1036, s: 0.9, rx: 6, ry: -10, rz: 1.2 };
/** Escena 3: arriba y más pequeño; la tarjeta de cristal tapa su pie. */
export const POSE_OFFER: PhonePose = { x: 540, y: 586, s: 0.6, rx: 8, ry: -7, rz: 1 };
/** Al transformarse la pantalla gira 18° en Y (un 5 % de vuelta): de −10° a +8°. */
const TURN_RY = 8;
/** De dónde sale: muy por debajo del lienzo, inclinado hacia atrás. */
const ENTRY = { dy: 1500, rx: 30, ry: -24, rz: -4 };
/** La subida de la escena 3: casi sin rebote, sin prisa. */
const RISE = { stiffness: 80, damping: 17, mass: 1.1 };
/** Flotación: un seno lento (3,2 s) en altura y giro. */
const FLOAT_PERIOD = 96;

/** La flotación en este fotograma, de −1 a 1 (0 antes de que el teléfono se pose). */
export function phoneFloat(frame: number, phase = 0) {
  const idle = ramp(frame, UNLOCK.phoneIn + 16, UNLOCK.phoneIn + 50);
  return Math.sin(((frame - UNLOCK.phoneIn) / FLOAT_PERIOD) * Math.PI * 2 + phase) * idle;
}

export function phonePose(frame: number): PhonePose {
  const enter = springAt(frame, UNLOCK.phoneIn, AD_SPRING.inertia);
  const rise = springAt(frame, OFFER.rise, RISE);
  const wave = (phase: number) => phoneFloat(frame, phase);
  const between = (key: 'x' | 'y' | 'rx' | 'rz') => (POSE_OFFER[key] - POSE_UNLOCK[key]) * rise;
  // Escala geométrica: la subida se siente uniforme
  const s = POSE_UNLOCK.s * Math.pow(POSE_OFFER.s / POSE_UNLOCK.s, rise);
  return {
    x: POSE_UNLOCK.x + between('x'),
    y: lerp(POSE_UNLOCK.y + ENTRY.dy, POSE_UNLOCK.y, enter) + between('y') + 10 * wave(0),
    s,
    rx: lerp(ENTRY.rx, POSE_UNLOCK.rx, enter) + between('rx') + 1.2 * wave(1.3),
    ry:
      lerp(ENTRY.ry - POSE_UNLOCK.ry, 0, enter) +
      track(frame, POSE_UNLOCK.ry, [
        [UNLOCK.turn, TURN_RY, AD_SPRING.turn],
        [OFFER.rise, POSE_OFFER.ry, RISE],
      ]) +
      2 * wave(2.1),
    rz: lerp(ENTRY.rz, POSE_UNLOCK.rz, enter) + between('rz'),
  };
}
