import { z } from 'zod';

const parsableDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'La fecha no es válida.');

const nonNegative = (label: string) =>
  z.number({ invalid_type_error: `${label} debe ser un número.` }).finite().min(0, `${label}: no se admiten valores negativos.`);

const quality = z
  .number({ invalid_type_error: 'La calidad debe ser un número.' })
  .int('La calidad debe ser un número entero.')
  .min(1, 'La calidad va de 1 (peor) a 5 (mejor).')
  .max(5, 'La calidad va de 1 (peor) a 5 (mejor).');

/** Same wrap-around rule as sleep.service: a wake time "before" bedtime means the next day. */
function sleepHours(bedtime: string, wakeTime: string): number {
  const hours = (Date.parse(wakeTime) - Date.parse(bedtime)) / 3600000;
  return hours < 0 ? hours + 24 : hours;
}

export const createSleepSchema = z
  .object({
    bedtime: parsableDate,
    wakeTime: parsableDate,
    quality,
    notes: z.string().max(2000).optional(),
    date: parsableDate.optional(),
    caffeineLate: z.boolean().optional(),
    screensBeforeBed: z.boolean().optional(),
    exercisedToday: z.boolean().optional(),
  })
  .refine((body) => {
    const hours = sleepHours(body.bedtime, body.wakeTime);
    return hours >= 0.5 && hours <= 12;
  }, { message: 'La duración del sueño debe estar entre 0.5 y 12 horas.', path: ['wakeTime'] });

export const updateSleepSchema = z.object({
  bedtime: parsableDate.optional(),
  wakeTime: parsableDate.optional(),
  quality: quality.optional(),
  notes: z.string().max(2000).optional(),
});

export const createMealSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  mealType: z.string().trim().min(1, 'El tipo de comida es obligatorio.'),
  calories: nonNegative('Las calorías').optional(),
  protein: nonNegative('La proteína').optional(),
  carbs: nonNegative('Los carbohidratos').optional(),
  fat: nonNegative('La grasa').optional(),
  waterMl: nonNegative('El agua').optional(),
  date: parsableDate.optional(),
});

export const createJournalSchema = z.object({
  title: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1, 'La entrada no puede estar vacía.').max(20000),
  mood: z.number().int().min(1).max(5).optional(),
  date: parsableDate.optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

export const updateJournalSchema = createJournalSchema.partial();

export const createWorkoutSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio.').max(200),
  date: parsableDate.optional(),
  notes: z.string().max(2000).optional(),
  routineDayId: z.string().min(1).optional(),
});

export const createLearningSchema = z.object({
  type: z.string().trim().min(1, 'El tipo es obligatorio.'),
  title: z.string().trim().min(1, 'El título es obligatorio.').max(300),
  author: z.string().trim().max(200).optional(),
  platform: z.string().trim().max(200).optional(),
  totalProgress: nonNegative('El progreso total').optional(),
  notes: z.string().max(5000).optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(50).optional(),
  timezone: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  gymPlaylistUrl: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
});

export const importantDateSchema = z.object({
  label: z.string().trim().min(1, 'El nombre de la fecha es obligatorio.').max(100),
  date: parsableDate,
  isRecurring: z.boolean().optional(),
  emoji: z.string().max(50).optional(),
});
