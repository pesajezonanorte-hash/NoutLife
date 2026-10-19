// Aviso pospuesto: lo que hace falta para volver a enviarlo a su hora. Solo datos
// del propio aviso; el enlace es siempre una ruta de la app.
import { z } from 'zod';

const CATEGORIES = ['HABITS', 'QUESTS', 'COLISEO', 'FINANCE', 'SOCIAL', 'ACHIEVEMENTS', 'SYSTEM'] as const;

export const snoozeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().max(300).default(''),
  /** Etiqueta del aviso original (su clave de deduplicación). */
  tag: z.string().min(1).max(200),
  link: z.string().max(300).regex(/^\/[^\s]*$/, 'El enlace no es válido.').optional(),
  category: z.enum(CATEGORIES).optional(),
  quick: z.enum(['habit_done', 'water_250']).optional(),
  quickRef: z.string().min(1).max(40).optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  priority: z.enum(['low', 'normal']).optional(),
}).strict();

export type SnoozeInput = z.infer<typeof snoozeSchema>;
