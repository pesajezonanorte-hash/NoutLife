/**
 * Espejo idempotente de prisma/migrations/20261101120000_referral_anti_abuse: marca de
 * auto-referido y dispositivos por cuenta. migrate-db.ts lo corre en cada build y arranque.
 */
export const REFERRAL_ANTI_ABUSE_SQL: string[] = [
  `ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "flaggedSelfReferral" BOOLEAN NOT NULL DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS "user_devices" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_devices_userId_deviceId_key" ON "user_devices"("userId", "deviceId")`,
  `CREATE INDEX IF NOT EXISTS "user_devices_deviceId_idx" ON "user_devices"("deviceId")`,
  `DO $$ BEGIN ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];
