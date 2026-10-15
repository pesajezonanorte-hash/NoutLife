-- Ciclo Menstrual: estado de ánimo múltiple y hábitos del día (tablas sin cambiar de nombre).
ALTER TABLE "cycle_logs" ADD COLUMN "moods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "cycle_logs" ADD COLUMN "sexualActivity" TEXT;
ALTER TABLE "cycle_logs" ADD COLUMN "contraception" TEXT;
ALTER TABLE "cycle_logs" ADD COLUMN "sleepQuality" INTEGER;
ALTER TABLE "cycle_logs" ADD COLUMN "stress" INTEGER;
ALTER TABLE "cycle_logs" ADD COLUMN "waterGlasses" INTEGER;
