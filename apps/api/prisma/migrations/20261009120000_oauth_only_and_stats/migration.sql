-- Sign-in is Google/Apple only: passwords become optional and each provider's
-- stable subject id links the account.
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleSub" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "appleSub" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleSub_key" ON "users"("googleSub");
CREATE UNIQUE INDEX IF NOT EXISTS "users_appleSub_key" ON "users"("appleSub");
ALTER TABLE "users" ALTER COLUMN "displayName" SET DEFAULT 'Héroe';

-- Simplified stats: mana and the unused per-area levels left the schema.
-- Their columns are dropped so the database matches the Prisma model.
ALTER TABLE "users" DROP COLUMN IF EXISTS "mp";
ALTER TABLE "users" DROP COLUMN IF EXISTS "maxMp";
ALTER TABLE "users" DROP COLUMN IF EXISTS "fitnessLevel";
ALTER TABLE "users" DROP COLUMN IF EXISTS "financeLevel";
ALTER TABLE "users" DROP COLUMN IF EXISTS "mindLevel";
ALTER TABLE "users" DROP COLUMN IF EXISTS "relationshipLevel";
ALTER TABLE "users" DROP COLUMN IF EXISTS "disciplineLevel";
