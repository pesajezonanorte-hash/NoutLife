import { z } from 'zod';
import { REWARD_MAX_BATCH } from '../lib/reward-links';

/** Alta de enlaces desde el panel. expiresInDays null = no vence; sin enviarlo, la vigencia por defecto. */
export const createRewardLinksSchema = z.object({
  count: z.number().int('Usa un número entero.').min(1).max(REWARD_MAX_BATCH).default(1),
  note: z.string().trim().max(120).nullish(),
  expiresInDays: z.number().int('Usa un número entero.').min(1).max(365).nullable().optional(),
});

/** El formato fino del token lo valida lib/reward-links (isRewardToken). */
export const claimRewardSchema = z.object({ token: z.string().max(100) });
