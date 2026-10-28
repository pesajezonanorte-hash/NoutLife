// Curvas y muelles del anuncio. Lo grande se mueve como un objeto pesado: muelles con
// amortiguación crítica o algo más (ζ = damping / 2√(stiffness · mass) ≥ 1), sin rebote;
// el texto entra con curvas de desaceleración suave.
import { Easing, type SpringConfig } from 'remotion';
import { springAt } from '../Video/lib/anim';

/**
 * - `word` ζ 1,0 (~0,45 s): cada palabra que entra y el recentrado de su línea.
 * - `glass` ζ 1,05 (~0,8 s): las tarjetas de cristal que se funden en la oferta.
 * - `ui` ζ 1,03 (~0,5 s): cambios de estado pequeños (botón, insignias).
 */
export const KEY_SPRING = {
  word: { stiffness: 170, damping: 26, mass: 1 },
  glass: { stiffness: 60, damping: 16.3, mass: 1 },
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
 * Un muelle crítico recorre ~2 % de su camino en el primer fotograma; así la velocidad
 * y la aceleración empiezan en 0 y no hay tirón.
 */
export function softSpring(frame: number, start: number, config: Partial<SpringConfig>, window = 6) {
  const samples = 8;
  let sum = 0;
  for (let i = 0; i < samples; i++) sum += springAt(frame - (window * i) / (samples - 1), start, config);
  return sum / samples;
}
