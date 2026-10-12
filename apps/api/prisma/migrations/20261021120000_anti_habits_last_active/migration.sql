-- Anti-habits (obstacles) with their slips, plus activity gap tracking for sleep suggestions.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nightGapStartAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nightGapEndAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "anti_habits" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anti_habits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "anti_habits_userId_idx" ON "anti_habits"("userId");
DO $$ BEGIN
  ALTER TABLE "anti_habits" ADD CONSTRAINT "anti_habits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "anti_habit_slips" (
  "id" TEXT NOT NULL,
  "antiHabitId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "note" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anti_habit_slips_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "anti_habit_slips_antiHabitId_occurredAt_idx" ON "anti_habit_slips"("antiHabitId", "occurredAt");
CREATE INDEX IF NOT EXISTS "anti_habit_slips_userId_idx" ON "anti_habit_slips"("userId");
DO $$ BEGIN
  ALTER TABLE "anti_habit_slips" ADD CONSTRAINT "anti_habit_slips_antiHabitId_fkey" FOREIGN KEY ("antiHabitId") REFERENCES "anti_habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "anti_habit_slips" ADD CONSTRAINT "anti_habit_slips_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
