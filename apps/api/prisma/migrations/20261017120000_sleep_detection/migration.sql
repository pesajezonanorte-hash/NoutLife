-- Detección automática de sueño: último uso visible y descanso sugerido.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sleepSuggestionStart" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sleepSuggestionEnd" TIMESTAMP(3);
