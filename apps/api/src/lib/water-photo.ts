// Agua por foto: prompt corto para la visión y lectura de su respuesta. Sin base de
// datos ni red: la llamada al modelo y el registro viven en services/water-photo.service.
import { extractJsonObject } from './json-extract';

/** Tope de un solo recipiente: una garrafa grande. Por encima, la lectura es un error. */
export const WATER_PHOTO_MAX_ML = 5000;
/** Menos de esto no se considera agua registrable (un chorrito o una gota en el vaso). */
export const WATER_PHOTO_MIN_ML = 20;

/** Prompt de visión de bajo consumo: JSON corto, sin texto libre que cobrar. */
export function waterPhotoPrompt(): string {
  return [
    'Photo of a drinking container (glass, bottle, jug). Estimate how many ml of WATER it holds now, from the visible water level and the size of the container.',
    'Reply JSON only: {"ok":true,"ml":water_ml,"cap":container_capacity_ml}',
    'No water or no container visible: {"ok":false}',
  ].join('\n');
}

export interface WaterReading {
  /** ml de agua en el recipiente, redondeados a 10 y nunca por encima de su capacidad. */
  ml: number;
  /** Capacidad total del recipiente si el modelo la dio y es coherente; si no, null. */
  containerMl: number | null;
}

/** Respuesta del modelo → lectura, o null si no se ve agua o la cifra no sirve. */
export function waterFromPhotoReply(text: string): WaterReading | null {
  const parsed = extractJsonObject(text) as Record<string, unknown> | null;
  if (!parsed || parsed.ok !== true) return null;

  const raw = Number(parsed.ml);
  if (!Number.isFinite(raw)) return null;

  const cap = Number(parsed.cap);
  const containerMl = Number.isFinite(cap) && cap >= WATER_PHOTO_MIN_ML ? Math.min(WATER_PHOTO_MAX_ML, Math.round(cap)) : null;

  const ceiling = containerMl ?? WATER_PHOTO_MAX_ML;
  const ml = Math.min(ceiling, Math.round(Math.max(0, raw) / 10) * 10);
  if (ml < WATER_PHOTO_MIN_ML) return null;

  return { ml, containerMl: containerMl !== null && containerMl >= ml ? containerMl : null };
}
