// Agua por foto: la visión estima cuántos ml hay en el vaso o la botella y la cantidad
// se suma sola al día de la persona (registro WATER, igual que un vaso manual). La
// respuesta trae la cifra para que la app la muestre; quitarla es un toque (último
// registro de agua). Sin proveedor de visión o sin agua visible, no se registra nada.
import { generateFromImage, hasVisionProvider } from '../lib/ai';
import { waterFromPhotoReply, waterPhotoPrompt } from '../lib/water-photo';
import { createMeal } from './meal.service';

export interface WaterPhotoResult {
  recognized: boolean;
  /** ml registrados a partir de la foto (0 si no se registró nada). */
  waterMl: number;
  /** Capacidad del recipiente que vio el modelo, si la dio. */
  containerMl: number | null;
  /** Por qué no se registró: sin proveedor, fallo de la IA o sin agua visible. */
  reason?: 'no_provider' | 'ai_error' | 'no_water';
  meal: Awaited<ReturnType<typeof createMeal>> | null;
}

export async function scanWaterPhoto(
  userId: string,
  input: { image: string; mimeType: string; date?: string; lang?: 'es' | 'en' },
): Promise<WaterPhotoResult> {
  if (!hasVisionProvider()) return { recognized: false, waterMl: 0, containerMl: null, reason: 'no_provider', meal: null };

  let reading: ReturnType<typeof waterFromPhotoReply>;
  try {
    const text = await generateFromImage(waterPhotoPrompt(), { data: input.image, mimeType: input.mimeType }, { temperature: 0.1, maxTokens: 80 });
    reading = waterFromPhotoReply(text);
  } catch (e) {
    console.error('[scanWaterPhoto] AI provider failed:', e instanceof Error ? e.message : e);
    return { recognized: false, waterMl: 0, containerMl: null, reason: 'ai_error', meal: null };
  }
  if (!reading) return { recognized: false, waterMl: 0, containerMl: null, reason: 'no_water', meal: null };

  const meal = await createMeal(userId, { name: 'Agua (foto)', mealType: 'WATER', waterMl: reading.ml, date: input.date });
  return { recognized: true, waterMl: reading.ml, containerMl: reading.containerMl, meal };
}
