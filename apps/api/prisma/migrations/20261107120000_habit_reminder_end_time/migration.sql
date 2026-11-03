-- Hora de fin del bloque de un hábito (HH:mm). Convive con reminderTime (inicio).
-- Sin valor, el bloque sigue durando 30 min como antes.
ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "reminderEndTime" TEXT;
