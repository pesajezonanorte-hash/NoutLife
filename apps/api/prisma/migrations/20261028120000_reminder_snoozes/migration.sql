-- Avisos pospuestos («Posponer 10 min»): el cron de recordatorios los envía a su hora.

-- CreateTable
CREATE TABLE "reminder_snoozes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_snoozes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_snoozes_dueAt_sentAt_idx" ON "reminder_snoozes"("dueAt", "sentAt");

-- CreateIndex
CREATE INDEX "reminder_snoozes_userId_tag_idx" ON "reminder_snoozes"("userId", "tag");

-- AddForeignKey
ALTER TABLE "reminder_snoozes" ADD CONSTRAINT "reminder_snoozes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
