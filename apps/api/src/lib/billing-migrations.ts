/**
 * Idempotent mirror of prisma/migrations/20261019120000_subscriptions:
 * NoutLife Pro (prueba de 7 días + cobro mensual con Wompi) y NoutLife Lite.
 * Vercel corre migrate-db.ts y cada arranque en frío ensureDbMigrated(), así
 * que cada sentencia debe poder repetirse sin efecto.
 */

/** Disparadores que impiden DELETE y TRUNCATE en used_trials. Idempotente: solo crea lo que falta. */
export const USED_TRIALS_PERMANENT_SQL = `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'used_trials_is_permanent' AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE FUNCTION public.used_trials_is_permanent() RETURNS trigger
    LANGUAGE plpgsql SET search_path = '' AS $fn$
    BEGIN
      RAISE EXCEPTION 'used_trials es un registro permanente: sus filas nunca se borran.';
    END;
    $fn$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'used_trials_no_delete' AND tgrelid = 'public.used_trials'::regclass
  ) THEN
    CREATE TRIGGER used_trials_no_delete BEFORE DELETE ON public.used_trials
      FOR EACH ROW EXECUTE FUNCTION public.used_trials_is_permanent();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'used_trials_no_truncate' AND tgrelid = 'public.used_trials'::regclass
  ) THEN
    CREATE TRIGGER used_trials_no_truncate BEFORE TRUNCATE ON public.used_trials
      FOR EACH STATEMENT EXECUTE FUNCTION public.used_trials_is_permanent();
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  -- Es un refuerzo: sin permisos para crearlo, el despliegue sigue (el código nunca borra la tabla).
  RAISE WARNING 'used_trials: no se pudo crear el bloqueo de borrado (%).', SQLERRM;
END $$;`;

export const SUBSCRIPTIONS_SQL: string[] = [
  // La prueba de quienes ya juegan empieza el día del lanzamiento, igual que la
  // de una cuenta nueva. El relleno solo corre en la pasada que crea la columna.
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'trialEndsAt'
    ) THEN
      ALTER TABLE "users" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
      UPDATE "users" SET "trialEndsAt" = CURRENT_TIMESTAMP + INTERVAL '7 days';
    END IF;
  END $$;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'trialing';`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "paymentSourceId" TEXT, ADD COLUMN IF NOT EXISTS "paymentMethodLabel" TEXT, ADD COLUMN IF NOT EXISTS "liteSince" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "lastPaymentError" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "users_subscriptionStatus_trialEndsAt_idx" ON "users"("subscriptionStatus", "trialEndsAt");`,
  `CREATE INDEX IF NOT EXISTS "users_subscriptionStatus_currentPeriodEnd_idx" ON "users"("subscriptionStatus", "currentPeriodEnd");`,
  `CREATE TABLE IF NOT EXISTS "subscription_payments" (
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
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payments_reference_key" ON "subscription_payments"("reference");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payments_wompiTransactionId_key" ON "subscription_payments"("wompiTransactionId");`,
  `CREATE INDEX IF NOT EXISTS "subscription_payments_userId_createdAt_idx" ON "subscription_payments"("userId", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "subscription_payments_status_createdAt_idx" ON "subscription_payments"("status", "createdAt");`,
  `DO $$ BEGIN
    ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  `ALTER TABLE "subscription_payments" ENABLE ROW LEVEL SECURITY;`,
  // used_trials: sin clave foránea a users, así borrar la cuenta no la toca. Quienes ya
  // jugaban recibieron su prueba al lanzar: se registran una sola vez (al crear la tabla).
  `DO $$
  BEGIN
    IF to_regclass('public.used_trials') IS NULL THEN
      CREATE TABLE "used_trials" (
        "id" TEXT NOT NULL,
        "emailKey" TEXT NOT NULL,
        "deviceId" TEXT,
        "paymentKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "used_trials_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX "used_trials_emailKey_key" ON "used_trials"("emailKey");
      CREATE INDEX "used_trials_deviceId_idx" ON "used_trials"("deviceId");
      INSERT INTO "used_trials" ("id", "emailKey") SELECT 'ut_' || "id", lower(trim("email")) FROM "users" ON CONFLICT DO NOTHING;
    END IF;
  END $$;`,
  `ALTER TABLE "used_trials" ENABLE ROW LEVEL SECURITY;`,
  // Mirror of prisma/migrations/20261020120000_trial_payment_key: huella del medio de pago
  // calculada en el servidor, única (un medio de pago, una prueba, incluso con registros simultáneos).
  `ALTER TABLE "used_trials" ADD COLUMN IF NOT EXISTS "paymentKey" TEXT;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "used_trials_paymentKey_key" ON "used_trials"("paymentKey");`,
  // Mirror of prisma/migrations/20261021120000_nequi_payment_method: tipo del medio de pago ('CARD' | 'NEQUI').
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "paymentMethodType" TEXT;`,
  // Mirror of prisma/migrations/20261022120000_used_trials_permanent: used_trials es un registro
  // permanente. La base rechaza borrar o vaciar la tabla, venga de donde venga la orden.
  USED_TRIALS_PERMANENT_SQL,
];
