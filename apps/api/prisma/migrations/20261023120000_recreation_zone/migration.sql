-- Zona de Recreación (sala de cine). El renombre Gimnasio → Coliseo no cambia la
-- base: el esquema usa @map/@@map con los nombres de siempre.

-- CreateTable
CREATE TABLE "recreation_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "rating" INTEGER,
    "minutes" INTEGER,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recreation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recreation_entries_userId_date_idx" ON "recreation_entries"("userId", "date");

-- AddForeignKey
ALTER TABLE "recreation_entries" ADD CONSTRAINT "recreation_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
