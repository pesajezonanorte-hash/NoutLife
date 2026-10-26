import { z } from 'zod';

/** Único inicio de sesión: ID token firmado por Google. */
export const oauthSchema = z.object({
  provider: z.enum(['google']),
  idToken: z.string().min(20).max(8192),
  displayName: z.string().trim().max(50).optional(),
  /** Usuario de quien invitó (portada /i/:username). Solo cuenta si la cuenta es nueva. */
  referredBy: z.string().regex(/^[A-Za-z0-9_]{3,20}$/).optional(),
  /** Zona horaria IANA del dispositivo. Solo en una cuenta nueva: fija su zona y su mercado de precios (lib/pricing). */
  timezone: z.string().trim().max(64).optional(),
  /** Idioma con que la persona usó la portada. Solo se guarda en una cuenta nueva. */
  language: z.enum(['es', 'en']).optional(),
});

export type OAuthInput = z.infer<typeof oauthSchema>;

/** Explicit confirmation prevents an accidental destructive account reset or deletion. */
export const factoryResetSchema = z.object({
  confirmation: z.literal('RESET_MY_NOUTLIFE'),
});

export const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
});
