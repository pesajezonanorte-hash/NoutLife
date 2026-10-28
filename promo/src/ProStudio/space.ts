// El espacio que comparten Blender y Remotion. Blender exporta (track.json) dónde cae en
// el vídeo cada esquina de las dos tarjetas de cristal en cada fotograma y dónde está el
// teléfono; aquí se lee y se convierte en la transformación CSS que lleva un rectángulo
// plano a ese cuadrilátero (una homografía), así la tarjeta flota en el mismo espacio 3D
// que el teléfono.
import TRACK from './track.json';

export type Point = readonly [number, number];
/** Esquinas: sup. izq., sup. der., inf. der., inf. izq. (px del vídeo). */
export type Quad = readonly [Point, Point, Point, Point];
export type CardId = 'coliseo' | 'recreacion';

interface TrackFrame {
  coliseo: number[];
  recreacion: number[];
  /** Centro x, y del teléfono y su medio alto (px del vídeo). */
  phone: [number, number, number];
}
const FRAMES = TRACK.frames as unknown as TrackFrame[];
const clampFrame = (frame: number) => Math.min(Math.max(Math.round(frame), TRACK.from), TRACK.to) - TRACK.from;

/** Dónde está el teléfono en pantalla (fuera del tramo renderizado, el fotograma más cercano). */
export function phoneAt(frame: number) {
  const [x, y, h] = FRAMES[clampFrame(frame)].phone;
  return { x, y, h };
}

/** Dónde está una tarjeta en el fotograma (fuera del tramo renderizado, en el más cercano). */
export function cardQuad(card: CardId, frame: number): Quad | null {
  const q = FRAMES[clampFrame(frame)]?.[card];
  if (!q) return null;
  return [
    [q[0], q[1]],
    [q[2], q[3]],
    [q[4], q[5]],
    [q[6], q[7]],
  ];
}

/**
 * `matrix3d` que lleva el rectángulo 0,0–w,h (con `transform-origin: 0 0`) al cuadrilátero
 * `q`: la homografía de cuatro puntos, en forma de matriz 4 × 4 de CSS.
 */
export function quadToMatrix3d(w: number, h: number, q: Quad): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  // Cuadrado unidad → cuadrilátero (Heckbert)
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const hh = (dx1 * sy - sx * dy1) / den;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + hh * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + hh * y3;
  // Escala del rectángulo w × h al cuadrado unidad
  const m = [a / w, b / h, x0, d / w, e / h, y0, g / w, hh / h, 1];
  // [m0 m1 m2; m3 m4 m5; m6 m7 m8] → matrix3d en orden de columnas (z queda tal cual)
  const n = [m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]];
  return `matrix3d(${n.map((v) => +v.toFixed(9)).join(', ')})`;
}
