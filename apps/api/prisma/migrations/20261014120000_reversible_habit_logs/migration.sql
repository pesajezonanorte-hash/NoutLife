-- Allow undoing today's habit check without resetting the streak or awarding twice.
ALTER TABLE "habit_logs"
  ADD COLUMN IF NOT EXISTS "rewardsGranted" BOOLEAN NOT NULL DEFAULT false;

-- Existing completed logs already earned their rewards before this flag existed.
UPDATE "habit_logs"
SET "rewardsGranted" = true
WHERE "completed" = true;
