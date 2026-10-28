// La cámara: un plano de mundo de 1080 × 1920 que se ve como el lienzo cuando la cámara
// está en reposo. `z` es el acercamiento del plano de foco (la cámara se acerca o se
// aleja, no cambia de lente) y (x, y) el punto del mundo que queda en el centro.
// Cada capa tiene una profundidad `depth` respecto del plano de foco (negativa = más
// cerca): al moverse la cámara, lo cercano se desplaza y crece más que lo lejano, así
// que las tarjetas de cristal flotan delante del teléfono con paralaje real.
//
// Movimientos (OpenMontage, multi-phase camera):
// 1. Gancho: empuje continuo de 1 a 1,05 que se frena justo al llegar a los 3 s.
// 2. El teléfono: retroceso con inercia a 1 y, con todo abierto, deriva lenta (se acerca
//    un 1,4 % y panea 12 px a la izquierda): las tarjetas, más cerca, se mueven algo más.
// 3. La oferta: vuelve al reposo antes de que aparezca el titular (el texto queda quieto).
import { WIDTH, HEIGHT, HOOK, OFFER, REVEAL } from './timeline';
import { EASE, KEY_SPRING, softSpring } from './motion';
import { ramp } from '../Video/lib/anim';

export interface Cam {
  z: number;
  x: number;
  y: number;
}

export const REST: Cam = { z: 1, x: WIDTH / 2, y: HEIGHT / 2 };
/** Deriva de la escena 2: acercamiento y paneo de unos píxeles, sin prisa. */
const DRIFT = { z: 0.014, x: -12 };

export function cameraAt(frame: number): Cam {
  const push = HOOK.zoom.scale - 1;
  const zoomIn = push * ramp(frame, 0, HOOK.zoom.to, EASE.push);
  const pullBack = push * softSpring(frame, REVEAL.pullBack, KEY_SPRING.lens);
  const drift = ramp(frame, REVEAL.drift.from, REVEAL.drift.to, EASE.push) * (1 - softSpring(frame, OFFER.sheetDown, KEY_SPRING.lens));
  return {
    z: 1 + zoomIn - pullBack + DRIFT.z * drift,
    x: REST.x + DRIFT.x * drift,
    y: REST.y,
  };
}

/** Escala y desplazamiento de una capa a `depth` (px del lienzo = t + k · (p − centro)). */
export function layerAt(cam: Cam, depth = 0) {
  const inv = depth + 1 / cam.z;
  return {
    k: (1 + depth) / inv,
    tx: WIDTH / 2 + (REST.x - cam.x) / inv,
    ty: HEIGHT / 2 + (REST.y - cam.y) / inv,
  };
}

/** Transformación CSS de una capa de 1080 × 1920 con `transform-origin: 0 0`. */
export function layerTransform(cam: Cam, depth = 0) {
  const { k, tx, ty } = layerAt(cam, depth);
  return `translate(${tx}px, ${ty}px) scale(${k}) translate(${-WIDTH / 2}px, ${-HEIGHT / 2}px)`;
}

/** Dónde se ve en el lienzo un punto de una capa a `depth`. */
export function project(cam: Cam, depth: number, p: { x: number; y: number }) {
  const { k, tx, ty } = layerAt(cam, depth);
  return { x: tx + k * (p.x - WIDTH / 2), y: ty + k * (p.y - HEIGHT / 2), k };
}
