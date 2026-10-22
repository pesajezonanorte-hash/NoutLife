/**
 * Espejo idempotente de prisma/migrations/20261031120000_gift_trial_flag: las pruebas de
 * regalo (invitación o cuenta Lite) vencen sin cobro. migrate-db.ts lo corre en cada build.
 */
export const GIFT_TRIAL_SQL: string[] = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "giftTrial" BOOLEAN NOT NULL DEFAULT false`,
];

/** Espejo idempotente de prisma/migrations/20261102120000_comp_pro_flag: Pro de cortesía guardado en la base. */
export const COMP_PRO_SQL: string[] = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "compPro" BOOLEAN NOT NULL DEFAULT false`,
];
