import { z } from 'zod';
import { COMP_MAX_DAYS } from '../lib/comp-grants';

/**
 * Concesión de Pro de cortesía desde el panel. days null = indefinido (Pro de cortesía sin fecha).
 * El formato del correo o @usuario lo valida lib/comp-grants (normalizeCompTarget) en el servicio.
 */
export const grantCompSchema = z.object({
  target: z.string().trim().min(1, 'Escribe un correo o un @usuario.').max(120),
  days: z.number().int('Usa un número entero de días.').min(1).max(COMP_MAX_DAYS).nullable(),
  note: z.string().trim().max(120).nullish(),
});
