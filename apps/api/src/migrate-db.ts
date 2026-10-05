import { prisma } from './lib/prisma';
import { shouldSkipBuildDbStep } from './lib/build-env';
import { REMOVE_LEGACY_HABIT_RITUAL_FLAG_SQL, SOCIAL_NETWORK_SQL } from './lib/schema-migrations';

const ignoreDuplicate = (sql: string) =>
  `DO $$ BEGIN ${sql}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`;

// Idempotent mirror of prisma/migrations/20260930180000_gym_attendance_and_notification_controls.
const GYM_ATTENDANCE_AND_NOTIFICATION_CONTROLS_SQL = [
  ignoreDuplicate(`CREATE TYPE "GymAttendanceSource" AS ENUM ('HABIT', 'MANUAL')`),
  ignoreDuplicate(`CREATE TYPE "NotificationCategory" AS ENUM ('HABITS', 'QUESTS', 'GYM', 'FINANCE', 'SOCIAL', 'ACHIEVEMENTS', 'SYSTEM')`),

  `ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "createsGymAttendance" BOOLEAN NOT NULL DEFAULT false;`,
  `ALTER TABLE "routines" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;`,
  `ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "routineDayId" TEXT, ADD COLUMN IF NOT EXISTS "attendanceId" TEXT;`,

  `CREATE TABLE IF NOT EXISTS "routine_days" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "title" TEXT,
    "isRestDay" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "routine_days_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "routine_day_exercises" (
    "id" TEXT NOT NULL,
    "routineDayId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "targetSets" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "routine_day_exercises_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "gym_attendances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "source" "GymAttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "habitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "gym_attendances_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "routine_days_routineId_weekday_key" ON "routine_days"("routineId", "weekday");`,
  `CREATE INDEX IF NOT EXISTS "routine_days_routineId_weekday_idx" ON "routine_days"("routineId", "weekday");`,
  `CREATE INDEX IF NOT EXISTS "routine_day_exercises_routineDayId_order_idx" ON "routine_day_exercises"("routineDayId", "order");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "gym_attendances_userId_date_key" ON "gym_attendances"("userId", "date");`,
  `CREATE INDEX IF NOT EXISTS "gym_attendances_userId_date_idx" ON "gym_attendances"("userId", "date");`,

  ignoreDuplicate(`ALTER TABLE "routine_days" ADD CONSTRAINT "routine_days_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "routine_day_exercises" ADD CONSTRAINT "routine_day_exercises_routineDayId_fkey" FOREIGN KEY ("routineDayId") REFERENCES "routine_days"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "routine_day_exercises" ADD CONSTRAINT "routine_day_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "gym_attendances" ADD CONSTRAINT "gym_attendances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "gym_attendances" ADD CONSTRAINT "gym_attendances_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE SET NULL ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "workouts" ADD CONSTRAINT "workouts_routineDayId_fkey" FOREIGN KEY ("routineDayId") REFERENCES "routine_days"("id") ON DELETE SET NULL ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "workouts" ADD CONSTRAINT "workouts_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "gym_attendances"("id") ON DELETE SET NULL ON UPDATE CASCADE`),

  // Backfill categories only on the run that adds the column, so later runs never rewrite them.
  `DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'category'
    ) THEN
      ALTER TABLE "notifications"
        ADD COLUMN "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM';
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
    END IF;
  END $$;`,
  `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;`,

  `CREATE TABLE IF NOT EXISTS "notification_category_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_category_preferences_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "notification_category_preferences_userId_category_key" ON "notification_category_preferences"("userId", "category");`,
  `CREATE INDEX IF NOT EXISTS "notifications_userId_category_createdAt_idx" ON "notifications"("userId", "category", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "notifications_userId_dedupeKey_createdAt_idx" ON "notifications"("userId", "dedupeKey", "createdAt");`,
  ignoreDuplicate(`ALTER TABLE "notification_category_preferences" ADD CONSTRAINT "notification_category_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
];

async function migrate() {
  console.log('Running database schema updates...');
  
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleAccessToken" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleRefreshToken" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleTokenExpiresAt" TIMESTAMP(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT DEFAULT 'primary';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleCalendarSyncEnabled" BOOLEAN NOT NULL DEFAULT false;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleCalendarLastSyncAt" TIMESTAMP(3);`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "agenda_events" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "agenda_events_googleEventId_key" ON "agenda_events"("googleEventId");`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "syncToGoogleCalendar" BOOLEAN NOT NULL DEFAULT false;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "googleCalendarEventId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "agenda_events" ADD COLUMN IF NOT EXISTS "googleSeriesId" TEXT;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenda_events_userId_googleSeriesId_idx" ON "agenda_events"("userId", "googleSeriesId");`);

  // Historical versions allowed duplicate ritual logs. Deduplicate before the
  // unique key and compensate the fixed reward given by that old endpoint.
  await prisma.$executeRawUnsafe(`
    WITH ranked_logs AS (
      SELECT "id", "userId",
        ROW_NUMBER() OVER (
          PARTITION BY "ritualId", "date"
          ORDER BY "completedAt" ASC, "id" ASC
        ) AS row_number
      FROM "ritual_logs"
    ),
    removed_logs AS (
      DELETE FROM "ritual_logs" AS logs
      USING ranked_logs
      WHERE logs."id" = ranked_logs."id" AND ranked_logs.row_number > 1
      RETURNING logs."userId"
    ),
    adjustments AS (
      SELECT "userId", COUNT(*)::integer AS duplicate_count
      FROM removed_logs
      GROUP BY "userId"
    )
    UPDATE "users" AS users
    SET "xp" = GREATEST(0, users."xp" - adjustments.duplicate_count * 30),
        "gold" = GREATEST(0, users."gold" - adjustments.duplicate_count * 5)
    FROM adjustments
    WHERE users."id" = adjustments."userId";
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ritual_logs_ritualId_date_key" ON "ritual_logs"("ritualId", "date");`);

  await prisma.$executeRawUnsafe(REMOVE_LEGACY_HABIT_RITUAL_FLAG_SQL);

  for (const sql of GYM_ATTENDANCE_AND_NOTIFICATION_CONTROLS_SQL) {
    await prisma.$executeRawUnsafe(sql);
  }

  // Idempotent mirror of prisma/migrations/20261004120000_sleep_naps.
  await prisma.$executeRawUnsafe(`ALTER TABLE "sleep_logs" ADD COLUMN IF NOT EXISTS "isNap" BOOLEAN NOT NULL DEFAULT false;`);

  // Idempotent mirror of prisma/migrations/20261005150000_guild_photo.
  await prisma.$executeRawUnsafe(`ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;`);

  // Idempotent mirror of prisma/migrations/20261005180000_user_last_seen.
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);`);

  // Idempotent mirror of prisma/migrations/20261005200000_social_network.
  for (const sql of SOCIAL_NETWORK_SQL) await prisma.$executeRawUnsafe(sql);

  console.log('SUCCESS: Runtime database columns, indexes, ritual idempotency key, and legacy habit ritual cleanup applied.');
}

if (shouldSkipBuildDbStep('migrate-db')) process.exit(0);

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
