import { z } from 'zod';

export const completeFocusSchema = z.object({
  durationMin: z
    .number({ invalid_type_error: 'La duración debe ser un número entero de minutos.' })
    .int('La duración debe ser un número entero de minutos.')
    .min(1, 'La duración mínima es 1 minuto.')
    .max(480, 'La duración máxima es 480 minutos.'),
  questId: z.string().trim().min(1).max(100).optional(),
  taskLabel: z.string().trim().min(1).max(200).optional(),
}).strict();
