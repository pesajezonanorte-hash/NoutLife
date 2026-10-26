/**
 * Espejo idempotente de prisma/migrations/20261104120000_annual_plan_creator_codes: plan anual
 * (billingInterval) y códigos de creador con su libro de revenue share. migrate-db.ts lo corre en
 * cada build y prisma.ts en cada arranque en frío, así que cada sentencia puede repetirse.
 */

/**
 * Va primero en migrate-db.ts: este cliente de Prisma ya lee las columnas nuevas de users en
 * cualquier consulta sin select (settleLevel, los arreglos de datos). Crea creator_codes antes,
 * porque users la referencia.
 */
export const CREATOR_CODES_USERS_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS "creator_codes" ("id" TEXT NOT NULL, "code" TEXT NOT NULL, "creatorName" TEXT NOT NULL, "discountPercent" INTEGER NOT NULL DEFAULT 0, "sharePercent" INTEGER NOT NULL DEFAULT 30, "shareMonths" INTEGER DEFAULT 6, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "creator_codes_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "creator_codes_code_key" ON "creator_codes"("code")`,
  `ALTER TABLE "creator_codes" ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "billingInterval" TEXT NOT NULL DEFAULT 'month', ADD COLUMN IF NOT EXISTS "creatorCodeAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "creatorCodeId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "users_creatorCodeId_idx" ON "users"("creatorCodeId")`,
  `DO $$ BEGIN ALTER TABLE "users" ADD CONSTRAINT "users_creatorCodeId_fkey" FOREIGN KEY ("creatorCodeId") REFERENCES "creator_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

/** Después de SUBSCRIPTIONS_SQL: subscription_payments ya existe. */
export const CREATOR_CODES_PAYMENTS_SQL: string[] = [
  `ALTER TABLE "subscription_payments" ADD COLUMN IF NOT EXISTS "billingInterval" TEXT NOT NULL DEFAULT 'month', ADD COLUMN IF NOT EXISTS "creatorCodeId" TEXT, ADD COLUMN IF NOT EXISTS "discountInCents" INTEGER NOT NULL DEFAULT 0`,
  `DO $$ BEGIN ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_creatorCodeId_fkey" FOREIGN KEY ("creatorCodeId") REFERENCES "creator_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS "creator_code_payments" ("id" TEXT NOT NULL, "creatorCodeId" TEXT NOT NULL, "userId" TEXT NOT NULL, "reference" TEXT NOT NULL, "interval" TEXT NOT NULL, "amountInCents" INTEGER NOT NULL, "discountInCents" INTEGER NOT NULL DEFAULT 0, "kind" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'APPROVED', "paidAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "creator_code_payments_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "creator_code_payments_reference_key" ON "creator_code_payments"("reference")`,
  `CREATE INDEX IF NOT EXISTS "creator_code_payments_creatorCodeId_paidAt_idx" ON "creator_code_payments"("creatorCodeId", "paidAt")`,
  `CREATE INDEX IF NOT EXISTS "creator_code_payments_userId_idx" ON "creator_code_payments"("userId")`,
  `DO $$ BEGIN ALTER TABLE "creator_code_payments" ADD CONSTRAINT "creator_code_payments_creatorCodeId_fkey" FOREIGN KEY ("creatorCodeId") REFERENCES "creator_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `ALTER TABLE "creator_code_payments" ENABLE ROW LEVEL SECURITY`,
];
