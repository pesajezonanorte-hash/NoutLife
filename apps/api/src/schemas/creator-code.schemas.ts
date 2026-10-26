import { z } from 'zod';
import { DEFAULT_SHARE_MONTHS, DEFAULT_SHARE_PERCENT, MAX_CREATOR_DISCOUNT_PERCENT } from '../lib/creator-codes';

const percent = (max: number) => z.number().int('Usa un número entero.').min(0).max(max);
const creatorName = z.string().trim().min(1).max(60);
/** Meses con comisión desde la conversión; null = sin límite. */
const shareMonths = z.number().int('Usa un número entero.').min(1).max(120).nullable();

/** Alta de un código desde el panel. El formato fino del código (mayúsculas, caracteres) lo decide lib/creator-codes. */
export const createCreatorCodeSchema = z.object({
  code: z.string().trim().min(3).max(20),
  creatorName,
  discountPercent: percent(MAX_CREATOR_DISCOUNT_PERCENT).default(0),
  sharePercent: percent(100).default(DEFAULT_SHARE_PERCENT),
  shareMonths: shareMonths.default(DEFAULT_SHARE_MONTHS),
});
export type CreateCreatorCodeBody = z.infer<typeof createCreatorCodeSchema>;

/** El código no cambia (ya circula en el contenido de los creadores): para otro texto se crea otro código. */
export const updateCreatorCodeSchema = z.object({
  creatorName: creatorName.optional(),
  discountPercent: percent(MAX_CREATOR_DISCOUNT_PERCENT).optional(),
  sharePercent: percent(100).optional(),
  shareMonths: shareMonths.optional(),
  active: z.boolean().optional(),
});
export type UpdateCreatorCodeBody = z.infer<typeof updateCreatorCodeSchema>;
