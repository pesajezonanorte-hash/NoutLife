import { z } from 'zod';

/** Único inicio de sesión: ID token firmado por Google. */
export const oauthSchema = z.object({
  provider: z.enum(['google']),
  idToken: z.string().min(20).max(8192),
  displayName: z.string().trim().max(50).optional(),
});

export type OAuthInput = z.infer<typeof oauthSchema>;

/** Explicit confirmation prevents an accidental destructive account reset or deletion. */
export const factoryResetSchema = z.object({
  confirmation: z.literal('RESET_MY_LIFEQUEST'),
});

export const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT'),
});
