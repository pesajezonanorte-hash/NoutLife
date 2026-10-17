-- Avisos inteligentes: horarios por zona (Coliseo, cuidado, ciclo, agua, comidas, sabiduría).
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "reminderSettings" JSONB;
