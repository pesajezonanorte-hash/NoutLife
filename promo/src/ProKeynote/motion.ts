// Curvas y muelles del anuncio. Todo llega sin rebote: los muelles tienen amortiguación
// crítica o algo más (ζ = damping / 2√(stiffness · mass) ≥ 1) y el texto usa curvas de
// desaceleración suave, nunca muelles.
import { Easing, type SpringConfig } from 'remotion';
import { springAt } from '../Video/lib/anim';

/**
 * - `lens` ζ 1,05 (~1 s): la cámara, un objeto pesado con inercia.
 * - `device` ζ 1,04 (~0,9 s): el teléfono.
 * - `glass` ζ 1,03 (~0,7 s): las tarjetas de cristal.
 * - `sheet` ζ 1,05 (~0,45 s): la hoja del menú, como en la app.
 * - `ui` ζ 1,03 (~0,5 s): cambios de estado pequeños (candados, insignias).
 */
export const KEY_SPRING = {
  lens: { stiffness: 40, damping: 13.3, mass: 1 },
  device: { stiffness: 52, damping: 15, mass: 1 },
  glass: { stiffness: 95, damping: 20, mass: 1 },
  sheet: { stiffness: 220, damping: 31, mass: 1 },
  ui: { stiffness: 160, damping: 26, mass: 1 },
} satisfies Record<string, Partial<SpringConfig>>;

export const EASE = {
  /** Entrada del texto: arranca con decisión y se posa despacio. */
  text: Easing.bezier(0.22, 1, 0.36, 1),
  /** Fundidos y cambios de color. */
  inOut: Easing.bezier(0.45, 0, 0.55, 1),
  /** Salidas que aceleran. */
  exit: Easing.bezier(0.5, 0, 0.75, 0),
  /** Empuje continuo de la cámara: casi lineal, con los extremos suaves. */
  push: Easing.bezier(0.33, 0, 0.67, 1),
  linear: (t: number) => t,
};

/**
 * Muelle con arranque suave: la media del muelle en los últimos `window` fotogramas.
 * Un muelle crítico recorre ~2 % de su camino en el primer fotograma (en un recorrido
 * de 400 px eso es un tirón de 8 px); así la velocidad y la aceleración empiezan en 0.
 */
export function softSpring(frame: number, start: number, config: Partial<SpringConfig>, window = 6) {
  const samples = 8;
  let sum = 0;
  for (let i = 0; i < samples; i++) sum += springAt(frame - (window * i) / (samples - 1), start, config);
  return sum / samples;
}
