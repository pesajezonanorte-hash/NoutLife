-- NoutLife Pro: prueba de 7 días, cobro mensual con Wompi y paso a NoutLife Lite.
-- La prueba de las cuentas existentes empieza el día del lanzamiento (solo en la pasada que crea la columna).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'trialEndsAt'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
    UPDATE "users" SET "trialEndsAt" = CURRENT_TIMESTAMP + INTERVAL '7 days';
  END IF;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'trialing';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "paymentSourceId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "paymentMethodLabel" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "liteSince" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastPaymentError" TEXT;
CREATE INDEX IF NOT EXISTS "users_subscriptionStatus_trialEndsAt_idx" ON "users"("subscriptionStatus", "trialEndsAt");
CREATE INDEX IF NOT EXISTS "users_subscriptionStatus_currentPeriodEnd_idx" ON "users"("subscriptionStatus", "currentPeriodEnd");

CREATE TABLE IF NOT EXISTS "subscription_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "wompiTransactionId" TEXT,
    "amountInCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "statusMessage" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payments_reference_key" ON "subscription_payments"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payments_wompiTransactionId_key" ON "subscription_payments"("wompiTransactionId");
CREATE INDEX IF NOT EXISTS "subscription_payments_userId_createdAt_idx" ON "subscription_payments"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "subscription_payments_status_createdAt_idx" ON "subscription_payments"("status", "createdAt");
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_payments" ENABLE ROW LEVEL SECURITY;

-- Pruebas gratis ya usadas. Sin clave foránea a users: borrar la cuenta no la toca.
CREATE TABLE IF NOT EXISTS "used_trials" (
    "id" TEXT NOT NULL,
    "emailKey" TEXT NOT NULL,
    "deviceId" TEXT,
    "paymentKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "used_trials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "used_trials_emailKey_key" ON "used_trials"("emailKey");
CREATE INDEX IF NOT EXISTS "used_trials_deviceId_idx" ON "used_trials"("deviceId");
INSERT INTO "used_trials" ("id", "emailKey") SELECT 'ut_' || "id", lower(trim("email")) FROM "users" ON CONFLICT DO NOTHING;
ALTER TABLE "used_trials" ENABLE ROW LEVEL SECURITY;
