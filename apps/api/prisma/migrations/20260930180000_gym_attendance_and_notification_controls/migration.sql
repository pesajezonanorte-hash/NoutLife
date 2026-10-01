-- Gym: normalized weekly routines plus a single attendance record per local day.
CREATE TYPE "GymAttendanceSource" AS ENUM ('HABIT', 'MANUAL');
CREATE TYPE "NotificationCategory" AS ENUM ('HABITS', 'QUESTS', 'GYM', 'FINANCE', 'SOCIAL', 'ACHIEVEMENTS', 'SYSTEM');

ALTER TABLE "habits"
  ADD COLUMN "createsGymAttendance" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "routines"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "workouts"
  ADD COLUMN "routineDayId" TEXT,
  ADD COLUMN "attendanceId" TEXT;

CREATE TABLE "routine_days" (
  "id" TEXT NOT NULL,
  "routineId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "title" TEXT,
  "isRestDay" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "routine_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "routine_day_exercises" (
  "id" TEXT NOT NULL,
  "routineDayId" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "targetSets" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "routine_day_exercises_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gym_attendances" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "source" "GymAttendanceSource" NOT NULL DEFAULT 'MANUAL',
  "habitId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gym_attendances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "routine_days_routineId_weekday_key" ON "routine_days"("routineId", "weekday");
CREATE INDEX "routine_days_routineId_weekday_idx" ON "routine_days"("routineId", "weekday");
CREATE INDEX "routine_day_exercises_routineDayId_order_idx" ON "routine_day_exercises"("routineDayId", "order");
CREATE UNIQUE INDEX "gym_attendances_userId_date_key" ON "gym_attendances"("userId", "date");
CREATE INDEX "gym_attendances_userId_date_idx" ON "gym_attendances"("userId", "date");

ALTER TABLE "routine_days"
  ADD CONSTRAINT "routine_days_routineId_fkey"
  FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "routine_day_exercises"
  ADD CONSTRAINT "routine_day_exercises_routineDayId_fkey"
  FOREIGN KEY ("routineDayId") REFERENCES "routine_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "routine_day_exercises"
  ADD CONSTRAINT "routine_day_exercises_exerciseId_fkey"
  FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "gym_attendances"
  ADD CONSTRAINT "gym_attendances_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gym_attendances"
  ADD CONSTRAINT "gym_attendances_habitId_fkey"
  FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workouts"
  ADD CONSTRAINT "workouts_routineDayId_fkey"
  FOREIGN KEY ("routineDayId") REFERENCES "routine_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workouts"
  ADD CONSTRAINT "workouts_attendanceId_fkey"
  FOREIGN KEY ("attendanceId") REFERENCES "gym_attendances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Notifications: categories, per-channel preferences, de-duplication keys and indexes.
ALTER TABLE "notifications"
  ADD COLUMN "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "dedupeKey" TEXT;

UPDATE "notifications"
SET "category" = CASE
  WHEN "type" IN ('habit_completed', 'streak', 'reminder') THEN 'HABITS'::"NotificationCategory"
  WHEN "type" IN ('quest_completed', 'quest_deadline') THEN 'QUESTS'::"NotificationCategory"
  WHEN "type" IN ('workout', 'gym') THEN 'GYM'::"NotificationCategory"
  WHEN "type" IN ('achievement') THEN 'ACHIEVEMENTS'::"NotificationCategory"
  WHEN "type" IN ('friend', 'guild', 'social') THEN 'SOCIAL'::"NotificationCategory"
  WHEN "type" IN ('finance', 'budget') THEN 'FINANCE'::"NotificationCategory"
  ELSE 'SYSTEM'::"NotificationCategory"
END;

CREATE TABLE "notification_category_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_category_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_category_preferences_userId_category_key"
  ON "notification_category_preferences"("userId", "category");
CREATE INDEX "notifications_userId_category_createdAt_idx"
  ON "notifications"("userId", "category", "createdAt");
CREATE INDEX "notifications_userId_dedupeKey_createdAt_idx"
  ON "notifications"("userId", "dedupeKey", "createdAt");

ALTER TABLE "notification_category_preferences"
  ADD CONSTRAINT "notification_category_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
