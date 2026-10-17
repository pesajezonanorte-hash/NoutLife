// Geometría compartida entre escenas (px del lienzo de 1080 × 1920). Las formas
// que cruzan de una escena a otra dependen de que estos números coincidan: la
// frase del gancho se encoge hasta el centro del isotipo, y el logo de la escena 2
// es, píxel a píxel, la pantalla de arranque del teléfono con la pose de relevo.
//
// Zona segura para Reels/TikTok/Shorts: lo importante va entre y = 220 y y = 1480
// y a la izquierda de x = 940 (a la derecha están los botones de la red social).
import { MARK_SIZE, WORDMARK_BOX } from './components/Brand';

/** Escena 1: centro del bloque de texto del gancho. */
export const HOOK_CENTER = { x: 540, y: 860 };

/** Escena 2: isotipo y logotipo apilados, centrados en (cx, cy). */
export const LOCKUP = (() => {
  const markHeight = 400;
  const markWidth = (markHeight * MARK_SIZE.w) / MARK_SIZE.h;
  const wordmarkWidth = 560;
  const wordmarkHeight = (wordmarkWidth * WORDMARK_BOX.h) / WORDMARK_BOX.w;
  const gap = 64;
  const cx = 540;
  const cy = 900;
  const top = cy - (markHeight + gap + wordmarkHeight) / 2;
  return {
    cx,
    cy,
    markWidth,
    markHeight,
    wordmarkWidth,
    wordmarkHeight,
    gap,
    /** Centro del isotipo: de aquí salen las tres hojas. */
    mark: { x: cx, y: top + markHeight / 2 },
    wordmarkTop: top + markHeight + gap,
  };
})();

/**
 * El teléfono (px de su propio plano, sin escalar): cuerpo, borde de titanio, cristal
 * negro y pantalla. `depth` es el grosor que se ve de canto cuando gira.
 */
export const PHONE = { w: 600, h: 1228, r: 96, rim: 6, depth: 52 };
export const SCREEN = { x: 19, y: 19, w: 562, h: 1190, r: 80 };
export const ISLAND = { w: 176, h: 52, top: 20 };

export interface PhonePose {
  x: number;
  y: number;
  s: number;
  rx: number;
  ry: number;
  rz: number;
}

/** Relevo: la pantalla cubre el lienzo y su logo coincide con el de la escena 2. */
export const POSE_HANDOFF: PhonePose = { x: LOCKUP.cx, y: LOCKUP.cy, s: 2.4, rx: 0, ry: 0, rz: 0 };
/** El inicio de la app: centrado, todavía sin título encima. */
export const POSE_HOME: PhonePose = { x: 540, y: 960, s: 0.9, rx: 6, ry: -15, rz: 1.5 };
/** Las zonas: baja para dejar sitio a los títulos, inclinado. */
export const POSE_HERO: PhonePose = { x: 540, y: 1078, s: 0.9, rx: 6, ry: -15, rz: 1.5 };
/** El Sabio: el teléfono gira hacia el otro lado y sube un poco. */
export const POSE_SABIO: PhonePose = { x: 540, y: 1060, s: 0.92, rx: 4, ry: 17, rz: -1.5 };
/** Llamada a la acción: entre el titular y el botón, que tapa el pie del teléfono. */
export const POSE_CTA: PhonePose = { x: 540, y: 930, s: 0.68, rx: 7, ry: -13, rz: 1.5 };

/** Títulos de zona, arriba (por debajo de la interfaz de la red social). */
export const TITLE = { kickerTop: 252, titleTop: 316, titleSize: 94 };

/** Escena 4: titular, botón y URL. */
export const HEADLINE_TOP = 246;
export const BUTTON = { w: 800, h: 116, y: 1350 };
export const URL_Y = 1452;
