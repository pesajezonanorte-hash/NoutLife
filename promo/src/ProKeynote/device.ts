// El teléfono en cada fotograma (px del mundo, ver camera.ts) y cómo se pasa de un punto
// de su pantalla al mundo. Lo usan el teléfono, el haz, las tarjetas y el fondo.
import { PHONE, SCREEN, type PhonePose } from '../Video/layout';
import { lerp, ramp } from '../Video/lib/anim';
import { EASE, KEY_SPRING, softSpring } from './motion';
import { OFFER, REVEAL } from './timeline';

/** Escena 2: centrado, girado 3° en Y (el canto de titanio apenas asoma). */
export const POSE_REVEAL: PhonePose = { x: 540, y: 972, s: 0.84, rx: 0, ry: -3, rz: 0 };
/** De dónde sale: del centro, más lejos y algo más girado. */
const ENTRY = { y: 1020, s: 0.64, ry: -9 };
/** Mientras todo está abierto, el giro se suelta despacio de −3° a −1,5°. */
const TURN = -1.5;
/**
 * Escena 3: arriba, más pequeño y casi de frente; la tarjeta de cristal cubre su base.
 * El grado que le queda en Y lo mantiene en 3D: plano del todo, Chrome ajusta su texto
 * al píxel entero y la app avanzaría a saltos al final de la subida.
 */
export const POSE_OFFER: PhonePose = { x: 540, y: 600, s: 0.6, rx: 0, ry: -1, rz: 0 };

/** Escala geométrica: cada fotograma crece lo mismo en proporción. */
const scaleBetween = (a: number, b: number, t: number) => a * Math.pow(b / a, t);

export function phonePose(frame: number): PhonePose {
  const enter = softSpring(frame, REVEAL.phoneIn, KEY_SPRING.device);
  const rise = softSpring(frame, OFFER.rise, KEY_SPRING.device, 8);
  const turn = ramp(frame, 130, OFFER.rise, EASE.push);
  const ry = lerp(lerp(ENTRY.ry, POSE_REVEAL.ry, enter), TURN, turn);
  return {
    x: POSE_REVEAL.x,
    y: lerp(lerp(ENTRY.y, POSE_REVEAL.y, enter), POSE_OFFER.y, rise),
    s: scaleBetween(scaleBetween(ENTRY.s, POSE_REVEAL.s, enter), POSE_OFFER.s, rise),
    rx: 0,
    ry: lerp(ry, POSE_OFFER.ry, rise),
    rz: 0,
  };
}

/**
 * Aparición del teléfono: sale de la oscuridad y se enfoca (cambio de foco desde el texto).
 * El desenfoque baja con una curva cuadrática: el último píxel de foco es el que más se
 * nota, así que llega más despacio.
 */
export function phoneReveal(frame: number) {
  return {
    opacity: ramp(frame, REVEAL.phoneIn + 4, REVEAL.phoneIn + 24, EASE.inOut),
    blur: 10 * (1 - ramp(frame, REVEAL.phoneIn, REVEAL.phoneIn + 34, EASE.linear)) ** 2,
  };
}

/** Un punto de la pantalla (px de pantalla, 562 × 1190) en el mundo. Ignora el giro de 3°. */
export function screenToWorld(pose: PhonePose, sx: number, sy: number) {
  return {
    x: pose.x + (SCREEN.x + sx - PHONE.w / 2) * pose.s,
    y: pose.y + (SCREEN.y + sy - PHONE.h / 2) * pose.s,
  };
}
