import { z } from 'zod';
import { GENDERS } from '../lib/gender';

/**
 * Acepta nombres de campo anteriores a un renombre (p. ej. Gimnasio → Coliseo):
 * un cliente viejo sigue funcionando y el campo nuevo gana si llegan los dos.
 */
export function withLegacyKeys<T extends z.ZodTypeAny>(schema: T, legacy: Record<string, string>) {
  return z.preprocess((body) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
    const copy: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const [old, now] of Object.entries(legacy)) {
      if (old in copy) {
        if (!(now in copy)) copy[now] = copy[old];
        delete copy[old];
      }
    }
    return copy;
  }, schema);
}

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
    isNap: z.boolean().optional(),
  })
  .refine((body) => {
    const hours = sleepHours(body.bedtime, body.wakeTime);
    // Cualquier descanso real (siesta o noche): de 1 min a 20 h.
    return hours >= 1 / 60 && hours <= 20;
  }, { message: 'La duración no es válida: debe estar entre 1 min y 20 h.', path: ['wakeTime'] });

export const updateSleepSchema = z.object({
  bedtime: parsableDate.optional(),
  wakeTime: parsableDate.optional(),
  quality: quality.optional(),
  notes: z.string().max(2000).optional(),
});

/** Momentos de comida válidos (WATER = registro de hidratación). Se guarda el que la persona eligió, sin valor por defecto. */
export const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'WATER'] as const;

export const createMealSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(200),
  mealType: z.enum(MEAL_TYPES, { errorMap: () => ({ message: 'Elige el momento de la comida: desayuno, almuerzo, merienda o cena.' }) }),
  calories: nonNegative('Las calorías').optional(),
  protein: nonNegative('La proteína').optional(),
  carbs: nonNegative('Los carbohidratos').optional(),
  fat: nonNegative('La grasa').optional(),
  waterMl: nonNegative('El agua').optional(),
  date: parsableDate.optional(),
});

/** Recreación: qué tipo de ocio fue y si ya se vivió o está en cartelera. */
export const RECREATION_KINDS = ['MOVIE', 'SERIES', 'GAME', 'OUTING', 'HOBBY', 'MUSIC', 'OTHER'] as const;
export const RECREATION_STATUSES = ['DONE', 'PLANNED'] as const;
const recreationFields = {
  title: z.string().trim().min(1, 'Ponle nombre a la función.').max(120),
  kind: z.enum(RECREATION_KINDS, { errorMap: () => ({ message: 'Elige qué tipo de ocio fue.' }) }),
  status: z.enum(RECREATION_STATUSES).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  minutes: z.number().int().min(1).max(24 * 60).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  date: parsableDate.optional(),
};
export const createRecreationSchema = z.object(recreationFields);
export const updateRecreationSchema = z.object(recreationFields).partial();

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
  kind: z.enum(['STRENGTH', 'WALK', 'CARDIO']).optional(),
  date: parsableDate.optional(),
  notes: z.string().max(2000).optional(),
  routineDayId: z.string().min(1).optional(),
});

/** Clase de serie (packages/shared SetType). Sin tipo = 'normal'. */
export const SET_TYPES = ['normal', 'warmup', 'drop', 'myo', 'rest_pause', 'failure'] as const;

// Las series se guardan tal cual en JSON: aquí se acotan. Límites holgados para no
// rechazar al terminar una sesión real; las claves desconocidas se descartan.
const workoutSetSchema = z.object({
  weight: z.number().finite().min(0).max(10000).optional(),
  reps: z.number().finite().min(0).max(10000).optional(),
  duration: z.number().finite().min(0).max(86400).optional(),
  completed: z.boolean(),
  type: z.enum(SET_TYPES).optional(),
  rpe: z.number().min(1, 'El RPE va de 1 a 10.').max(10, 'El RPE va de 1 a 10.').optional(),
  rir: z.number().int().min(0, 'Las repeticiones en reserva van de 0 a 4.').max(4, 'Las repeticiones en reserva van de 0 a 4.').optional(),
});

/** Cuerpo de POST /workouts/:id/finish (el servicio acota duración y distancia). */
export const finishWorkoutSchema = z.object({
  notes: z.string().max(2000).optional(),
  duration: z.number().finite().min(0).optional(),
  distanceKm: z.number().finite().min(0).optional(),
  exercises: z.array(z.object({
    exerciseId: z.string().min(1).max(64),
    sets: z.array(workoutSetSchema).max(100),
    notes: z.string().max(2000).optional(),
    order: z.number().int().min(0).max(1000).optional(),
  })).max(100).optional(),
});

export const updateWorkoutSchema = finishWorkoutSchema.extend({
  title: z.string().trim().min(1).max(200).optional(),
});

export const createLearningSchema = z.object({
  type: z.string().trim().min(1, 'El tipo es obligatorio.'),
  title: z.string().trim().min(1, 'El título es obligatorio.').max(300),
  author: z.string().trim().max(200).optional(),
  platform: z.string().trim().max(200).optional(),
  totalProgress: nonNegative('El progreso total').optional(),
  notes: z.string().max(5000).optional(),
});

export const updateProfileSchema = withLegacyKeys(z.object({
  displayName: z.string().trim().min(1, 'El nombre no puede estar vacío.').max(50).optional(),
  timezone: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  coliseoPlaylistUrl: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  gender: z.enum(GENDERS).nullable().optional(),
}), { gymPlaylistUrl: 'coliseoPlaylistUrl' });

export const importantDateSchema = z.object({
  label: z.string().trim().min(1, 'El nombre de la fecha es obligatorio.').max(100),
  date: parsableDate,
  isRecurring: z.boolean().optional(),
  emoji: z.string().max(50).optional(),
});
