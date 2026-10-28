// Geometría 3D mínima para los objetos dorados (anillos y gemas): rotaciones, la
// misma perspectiva que el teléfono y un sombreado metálico. Se proyecta a mano y se
// dibuja en SVG plano, así cada objeto sabe qué parte queda delante del teléfono
// (z > 0, hacia la cámara) y cuál detrás, sin depender del orden 3D del navegador.
import { interpolateColors } from 'remotion';
import { GOLD_RAMP } from '../brand';

export type Vec3 = readonly [number, number, number];

const rad = (deg: number) => (deg * Math.PI) / 180;

export function rotateX([x, y, z]: Vec3, deg: number): Vec3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [x, y * c - z * s, y * s + z * c];
}
export function rotateY([x, y, z]: Vec3, deg: number): Vec3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [x * c + z * s, y, -x * s + z * c];
}
export function rotateZ([x, y, z]: Vec3, deg: number): Vec3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [x * c - y * s, x * s + y * c, z];
}

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** La misma lente que el teléfono (components/IPhone.tsx): poca deformación, foto de producto. */
export const PERSPECTIVE = 2100;

/** Proyección con la cámara en z = +PERSPECTIVE mirando hacia −z, como `perspective` de CSS. */
export function project([x, y, z]: Vec3, cx: number, cy: number) {
  const k = PERSPECTIVE / (PERSPECTIVE - z);
  return { x: cx + x * k, y: cy + y * k, k, z };
}

/** Luz principal: arriba a la izquierda y hacia la cámara (y crece hacia abajo, como en pantalla). */
export const LIGHT = normalize([-0.45, -0.8, 0.55]);
const VIEW: Vec3 = [0, 0, 1];
const HALF = normalize(add(LIGHT, VIEW));

/**
 * Oro según la normal de la cara: difuso suave más un brillo especular estrecho.
 * Devuelve el color de la rampa (sombra → reflejo) y cuánto brilla (0–1).
 */
export function goldAt(normal: Vec3, lift = 0) {
  const n = normalize(normal);
  const diffuse = Math.max(0, dot(n, LIGHT));
  const spec = Math.max(0, dot(n, HALF)) ** 28;
  const t = Math.min(1, 0.16 + 0.5 * diffuse + 0.55 * spec + lift);
  return { color: goldShade(t), spec };
}

const RAMP_STOPS = GOLD_RAMP.map((_, i) => i / (GOLD_RAMP.length - 1));
/** 0 = oro en sombra, 1 = reflejo casi blanco. */
export const goldShade = (t: number) => interpolateColors(Math.min(1, Math.max(0, t)), RAMP_STOPS, [...GOLD_RAMP]);
