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

/** Espejo idempotente de prisma/migrations/20261103120000_gift_available_flag: regalo disponible sin activar. */
export const GIFT_AVAILABLE_SQL: string[] = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "giftAvailable" BOOLEAN NOT NULL DEFAULT false`,
];

/**
 * Deja registrado a quién le corresponde el regalo y todavía no lo activó: cuenta Lite sin
 * periodo pagado, sin medio de pago, sin cortesía, sin prueba usada (used_trials) y sin cobros
 * aprobados. Quien deja de cumplirlo (vinculó un medio, ya lo activó) pierde la marca. Las
 * cuentas sin onboarding quedan marcadas: lo activan al entrar después de terminarlo.
 */
export const MARK_GIFT_AVAILABLE_SQL = `
  WITH eligible AS (
    SELECT u.id, (
      u."subscriptionStatus" = 'lite' AND u."currentPeriodEnd" IS NULL AND u."paymentSourceId" IS NULL AND u."compPro" = false
      AND NOT EXISTS (SELECT 1 FROM "used_trials" t WHERE t."emailKey" = lower(trim(u."email")))
      AND NOT EXISTS (SELECT 1 FROM "subscription_payments" p WHERE p."userId" = u.id AND p."status" = 'APPROVED')
    ) AS ok
    FROM "users" u
  )
  UPDATE "users" u SET "giftAvailable" = e.ok
  FROM eligible e
  WHERE u.id = e.id AND u."giftAvailable" IS DISTINCT FROM e.ok`;
