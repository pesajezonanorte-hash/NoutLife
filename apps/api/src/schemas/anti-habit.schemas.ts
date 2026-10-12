import { z } from 'zod';

export const createAntiHabitSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(80),
  icon: z.string().max(10).optional(),
});

export const logSlipSchema = z.object({
  note: z.string().trim().max(300).optional(),
});
