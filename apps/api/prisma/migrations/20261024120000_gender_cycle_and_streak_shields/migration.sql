-- Género declarado (abre la zona Ciclo), días de escudo de la racha general y
-- la zona Ciclo: ajustes, periodos y registro diario.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "gender" TEXT;
ALTER TABLE "users" ADD COLUMN "streakShieldDays" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "cycle_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleLength" INTEGER NOT NULL DEFAULT 28,
    "periodLength" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "flow" TEXT,
    "mood" INTEGER,
    "energy" INTEGER,
    "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cycle_settings_userId_key" ON "cycle_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_periods_userId_startDate_key" ON "cycle_periods"("userId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_logs_userId_date_key" ON "cycle_logs"("userId", "date");

-- AddForeignKey
ALTER TABLE "cycle_settings" ADD CONSTRAINT "cycle_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_periods" ADD CONSTRAINT "cycle_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_logs" ADD CONSTRAINT "cycle_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
