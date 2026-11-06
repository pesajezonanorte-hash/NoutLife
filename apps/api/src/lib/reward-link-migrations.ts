/**
 * Espejo idempotente de prisma/migrations/20261111120000_reward_links: enlaces de recompensa de un
 * solo uso. migrate-db.ts lo corre en cada build, así que cada sentencia puede repetirse.
 */
export const REWARD_LINKS_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS "reward_links" ("id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "note" TEXT, "proDays" INTEGER NOT NULL DEFAULT 7, "themeKey" TEXT NOT NULL DEFAULT 'theme_calma', "expiresAt" TIMESTAMP(3), "createdById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "claimedAt" TIMESTAMP(3), "claimedById" TEXT, "outcome" TEXT, CONSTRAINT "reward_links_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "reward_links_tokenHash_key" ON "reward_links"("tokenHash")`,
  `CREATE INDEX IF NOT EXISTS "reward_links_createdAt_idx" ON "reward_links"("createdAt")`,
  `ALTER TABLE "reward_links" ENABLE ROW LEVEL SECURITY`,
];
