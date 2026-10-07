-- DropIndex
DROP INDEX IF EXISTS "users_appleSub_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN IF EXISTS "appleSub";
