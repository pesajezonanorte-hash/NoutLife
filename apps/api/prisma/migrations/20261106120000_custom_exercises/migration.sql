-- Ejercicios propios: cada persona puede crear los suyos (solo los ve ella).
-- El nombre ya no es único en toda la tabla: es único por dueño, y el catálogo
-- (sin dueño) conserva un índice único parcial por nombre.

-- DropIndex
DROP INDEX IF EXISTS "exercises_name_key";

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "exercises_userId_name_key" ON "exercises"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_catalog_name_key" ON "exercises"("name") WHERE "userId" IS NULL;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
