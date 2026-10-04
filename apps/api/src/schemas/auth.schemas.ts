import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email invÃ¡lido'),
  username: z
    .string()
    .min(3, 'MÃ­nimo 3 caracteres')
    .max(20, 'MÃ¡ximo 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, nÃºmeros y guion bajo'),
  password: z.string().min(8, 'MÃ­nimo 8 caracteres'),
  displayName: z.string().min(2, 'MÃ­nimo 2 caracteres').max(50).optional(),
  gender: z.enum(['male', 'female']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Email invÃ¡lido'),
  password: z.string().min(1, 'ContraseÃ±a requerida'),
});

/** Pre-check used before onboarding: the account is only created once onboarding finishes. */
export const availabilitySchema = registerSchema.pick({ email: true, username: true });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Explicit confirmation prevents an accidental destructive account reset. */
export const factoryResetSchema = z.object({
  password: z.string().min(1, 'Contraseña requerida'),
  confirmation: z.literal('RESET_MY_LIFEQUEST'),
});
