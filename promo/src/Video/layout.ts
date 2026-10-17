// Geometría compartida entre escenas (px del lienzo de 1080 × 1920). Las formas
// que cruzan de una escena a otra (el punto final → la luz → el isotipo, el punto
// de la «i» → el nodo → el teléfono) dependen de que estos números coincidan.
//
// Zona segura para Reels/TikTok/Shorts: lo importante va entre y = 220 y y = 1480
// y a la izquierda de x = 940 (a la derecha están los botones de la red social).
import { I_DOT, MARK_SIZE, WORDMARK_BOX } from './components/Brand';
import type { CardId } from './timeline';

/** Donde el punto final del gancho se vuelve luz: el centro del isotipo. */
export const ORB = { x: 540, y: 760, d: 150 };

/** Escena 2: isotipo, logotipo y lema. */
export const BRAND = {
  markHeight: 440,
  markWidth: (440 * MARK_SIZE.w) / MARK_SIZE.h,
  wordmarkWidth: 600,
  wordmarkTop: 1042,
  taglineTop: 1222,
};

/** Punto de la «i» de «Noutlife» en el lienzo. */
export const I_DOT_POS = (() => {
  const k = BRAND.wordmarkWidth / WORDMARK_BOX.w;
  return {
    x: ORB.x - BRAND.wordmarkWidth / 2 + (I_DOT.cx - WORDMARK_BOX.x) * k,
    y: BRAND.wordmarkTop + (I_DOT.cy - WORDMARK_BOX.y) * k,
    r: I_DOT.r * k,
  };
})();

/** Escena 3: el nodo (el punto de la «i») y la tarjeta de zona en primer plano. */
export const HUB = { x: 540, y: 292, r: 15 };
export const CARD = { w: 840, h: 1060, x: 540, y: 935 };
export const CARD_TOP = CARD.y - CARD.h / 2;

/** Ecosistema: las cuatro tarjetas en pequeño alrededor del nodo. */
export const ECO_CENTER = { x: 540, y: 935 };
export const SLOT_SCALE = 0.36;
export const SLOTS: Record<CardId, { x: number; y: number }> = {
  coliseo: { x: 330, y: 695 },
  ciclo: { x: 750, y: 695 },
  habitos: { x: 330, y: 1175 },
  sabio: { x: 750, y: 1175 },
};

/** Escena 4: el teléfono y su pantalla. */
export const PHONE = { w: 480, h: 1000, radius: 82, bezel: 12 };
export const SCREEN = { w: PHONE.w - PHONE.bezel * 2, h: PHONE.h - PHONE.bezel * 2 };
/** Pose A: grande y centrado (las zonas entran en él). Pose B: deja sitio al titular y al botón. */
export const PHONE_POSE_A = { x: 540, y: 950, s: 1 };
export const PHONE_POSE_B = { x: 540, y: 846, s: 0.78 };
/** Baldosas de zona dentro de la pantalla (px de la pantalla). */
export const PHONE_TILES: Record<CardId, { x: number; y: number; w: number; h: number }> = {
  coliseo: { x: 18, y: 404, w: 204, h: 168 },
  ciclo: { x: 234, y: 404, w: 204, h: 168 },
  habitos: { x: 18, y: 584, w: 204, h: 168 },
  sabio: { x: 234, y: 584, w: 204, h: 168 },
};

/** Centro de una baldosa en el lienzo con el teléfono en `pose`. */
export function tileCenter(id: CardId, pose: { x: number; y: number; s: number }) {
  const t = PHONE_TILES[id];
  const sx = t.x + t.w / 2 + PHONE.bezel - PHONE.w / 2;
  const sy = t.y + t.h / 2 + PHONE.bezel - PHONE.h / 2;
  return { x: pose.x + sx * pose.s, y: pose.y + sy * pose.s };
}

/** Botón y URL de la escena 4. */
export const BUTTON = { w: 790, h: 118, y: 1322 };
export const URL_Y = 1432;
