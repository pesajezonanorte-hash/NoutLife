// Paleta y muelles del anuncio. La capa del vídeo (fondo, titulares, tarjeta, botón)
// usa los colores del brief: slate oscuro de fondo, jade brillante para las acciones
// y oro champán solo para Pro. Dentro del teléfono la app se ve con sus tokens
// reales (Video/theme.ts, Aurora oscuro), como en la app de verdad.
import type { SpringConfig } from 'remotion';

export const AD = {
  slate: '#0f172a',
  slateDeep: '#070b16',
  slateLift: '#1e293b',
  ink: '#f8fafc',
  inkSoft: '#cbd5e1',
  inkMuted: '#94a3b8',
  jade: '#10b981',
  jadeLight: '#6ee7b7',
  jadeDeep: '#047857',
  jadeInk: '#022c1d',
  gold: '#d4af37',
  goldLight: '#f1dc9c',
  goldPale: '#fbf3d6',
  goldDeep: '#8c6b1f',
} as const;

/** Rampa del oro para el sombreado 3D: de la sombra al brillo especular. */
export const GOLD_RAMP = ['#3d2c0a', '#7a5a17', '#b8902c', AD.gold, '#e9cd78', AD.goldPale, '#fffdf6'] as const;

/**
 * Muelles calibrados (ζ = damping / 2√(stiffness · mass)):
 * - `elastic` ζ ≈ 0,5: el revelado del texto, con un rebote visible y orgánico.
 * - `inertia` ζ ≈ 0,7: el teléfono, un objeto con peso que se pasa un 5 % y se posa.
 * - `lens` ζ ≈ 0,7 y rápido: zooms de cámara con inercia.
 * - `settle` ζ ≈ 1: llega sin rebote (subidas de la oferta, tarjetas).
 * - `pop` ζ ≈ 0,45: chips, candados y el botón.
 * - `turn` ζ ≈ 0,6: el giro del teléfono en Y.
 */
export const AD_SPRING: Record<'elastic' | 'inertia' | 'lens' | 'settle' | 'pop' | 'turn', Partial<SpringConfig>> = {
  elastic: { stiffness: 170, damping: 11, mass: 0.7 },
  inertia: { stiffness: 90, damping: 14, mass: 1.1 },
  lens: { stiffness: 240, damping: 20, mass: 0.8 },
  settle: { stiffness: 120, damping: 22, mass: 1 },
  pop: { stiffness: 260, damping: 13, mass: 0.7 },
  turn: { stiffness: 110, damping: 13, mass: 1 },
};

/** Texto con un degradado dorado: solo para lo que es Pro. */
export const goldText = (angle = 100): Record<string, string> => ({
  backgroundImage: `linear-gradient(${angle}deg, ${AD.goldPale} 0%, ${AD.goldLight} 28%, ${AD.gold} 62%, ${AD.goldDeep} 100%)`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});

/** Texto jade (acciones y lo que se desbloquea). */
export const jadeText = (angle = 100): Record<string, string> => ({
  backgroundImage: `linear-gradient(${angle}deg, ${AD.jadeLight} 0%, ${AD.jade} 70%, #0e9f6e 100%)`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
});
