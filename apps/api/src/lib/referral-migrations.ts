/**
 * Espejo idempotente de prisma/migrations/20261030120000_referrals_push_events:
 * invitaciones (referrals) y medición de avisos (push_events). migrate-db.ts lo
 * corre en cada build y arranque en frío, así que cada sentencia puede repetirse.
 */
export const REFERRALS_PUSH_EVENTS_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS "referrals" ("id" TEXT NOT NULL, "inviterId" TEXT NOT NULL, "inviteeId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "inviterDays" INTEGER NOT NULL DEFAULT 0, "inviteeDays" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "activatedAt" TIMESTAMP(3), CONSTRAINT "referrals_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "referrals_inviteeId_key" ON "referrals"("inviteeId")`,
  `CREATE INDEX IF NOT EXISTS "referrals_inviterId_activatedAt_idx" ON "referrals"("inviterId", "activatedAt")`,
  `CREATE INDEX IF NOT EXISTS "referrals_inviteeId_activatedAt_idx" ON "referrals"("inviteeId", "activatedAt")`,
  `DO $$ BEGIN ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER TABLE "referrals" ADD CONSTRAINT "referrals_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS "push_events" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "category" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "push_events_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "push_events_kind_category_createdAt_idx" ON "push_events"("kind", "category", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "push_events_userId_createdAt_idx" ON "push_events"("userId", "createdAt")`,
  `DO $$ BEGIN ALTER TABLE "push_events" ADD CONSTRAINT "push_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];
