import { prisma } from './lib/prisma';
import { settleLevel } from './services/xp.service';
import { shouldSkipBuildDbStep } from './lib/build-env';
import { LETTERS_AND_GESTURES_SQL, REMOVE_LEGACY_HABIT_RITUAL_FLAG_SQL, SOCIAL_NETWORK_SQL, SOCIAL_PRO_SQL, RLS_LOCKDOWN_SQL } from './lib/schema-migrations';
import { BACKLOG_SQL, BACKLOG_V2_SQL, REVERSIBLE_HABIT_LOGS_SQL, WARDROBE_PHOTO_SQL } from './lib/backlog-migrations';
import { SUBSCRIPTIONS_SQL } from './lib/billing-migrations';
import { REFERRALS_PUSH_EVENTS_SQL } from './lib/referral-migrations';
import { COMP_PRO_SQL, GIFT_AVAILABLE_SQL, GIFT_TRIAL_SQL, MARK_GIFT_AVAILABLE_SQL } from './lib/gift-trial-migrations';
import { REFERRAL_ANTI_ABUSE_SQL } from './lib/anti-abuse-migrations';
import { CREATOR_CODES_PAYMENTS_SQL, CREATOR_CODES_USERS_SQL } from './lib/creator-code-migrations';
import { MARKETS_PAYMENTS_SQL, MARKETS_USERS_SQL } from './lib/market-migrations';
import { DEFAULT_SHOP_ITEMS } from './lib/default-catalog';
import { MAX_SHIELD_DAYS, STREAK_SHIELDS, shieldDaysOf } from './lib/streak-shields';

const ignoreDuplicate = (sql: string) =>
  `DO $$ BEGIN ${sql}; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`;

// Zona de Recreación (sala de cine).
const RECREATION_SQL = [
  `CREATE TABLE IF NOT EXISTS "recreation_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "rating" INTEGER,
    "minutes" INTEGER,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recreation_entries_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE INDEX IF NOT EXISTS "recreation_entries_userId_date_idx" ON "recreation_entries"("userId", "date");`,
  ignoreDuplicate(`ALTER TABLE "recreation_entries" ADD CONSTRAINT "recreation_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
];

// Idempotent mirror of prisma/migrations/20261027120000_notebooks: la zona Libreta.
const NOTEBOOKS_SQL = [
  `CREATE TABLE IF NOT EXISTS "notebooks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'personal',
    "color" TEXT NOT NULL DEFAULT 'jade',
    "paper" TEXT NOT NULL DEFAULT 'ruled',
    "pageCount" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notebooks_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "notebook_pages" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notebook_pages_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "notebook_images" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notebook_images_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE INDEX IF NOT EXISTS "notebooks_userId_updatedAt_idx" ON "notebooks"("userId", "updatedAt");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "notebook_pages_notebookId_index_key" ON "notebook_pages"("notebookId", "index");`,
  `CREATE INDEX IF NOT EXISTS "notebook_images_notebookId_idx" ON "notebook_images"("notebookId");`,
  ignoreDuplicate(`ALTER TABLE "notebooks" ADD CONSTRAINT "notebooks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "notebook_pages" ADD CONSTRAINT "notebook_pages_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "notebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "notebook_images" ADD CONSTRAINT "notebook_images_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "notebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
];

// Idempotent mirror of prisma/migrations/20261028120000_reminder_snoozes: avisos pospuestos.
const REMINDER_SNOOZES_SQL = [
  `CREATE TABLE IF NOT EXISTS "reminder_snoozes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reminder_snoozes_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE INDEX IF NOT EXISTS "reminder_snoozes_dueAt_sentAt_idx" ON "reminder_snoozes"("dueAt", "sentAt");`,
  `CREATE INDEX IF NOT EXISTS "reminder_snoozes_userId_tag_idx" ON "reminder_snoozes"("userId", "tag");`,
  ignoreDuplicate(`ALTER TABLE "reminder_snoozes" ADD CONSTRAINT "reminder_snoozes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
];

// Idempotent mirror of prisma/migrations/20261029120000_series_progress: temporadas y capítulos de las series.
const SERIES_PROGRESS_SQL = [
  `ALTER TABLE "recreation_entries" ADD COLUMN IF NOT EXISTS "season" INTEGER;`,
  `ALTER TABLE "recreation_entries" ADD COLUMN IF NOT EXISTS "episode" INTEGER;`,
  `ALTER TABLE "recreation_entries" ADD COLUMN IF NOT EXISTS "totalSeasons" INTEGER;`,
  `ALTER TABLE "recreation_entries" ADD COLUMN IF NOT EXISTS "totalEpisodes" INTEGER;`,
  `ALTER TABLE "recreation_entries" ADD COLUMN IF NOT EXISTS "episodesWatched" INTEGER NOT NULL DEFAULT 0;`,
];

// Idempotent mirror of prisma/migrations/20261024120000_gender_cycle_and_streak_shields:
// género declarado, escudo de la racha general y la zona Ciclo.
const GENDER_CYCLE_AND_SHIELDS_SQL = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender" TEXT;`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "streakShieldDays" INTEGER NOT NULL DEFAULT 0;`,
  `CREATE TABLE IF NOT EXISTS "cycle_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleLength" INTEGER NOT NULL DEFAULT 28,
    "periodLength" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cycle_settings_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "cycle_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cycle_periods_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "cycle_logs" (
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
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "cycle_settings_userId_key" ON "cycle_settings"("userId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "cycle_periods_userId_startDate_key" ON "cycle_periods"("userId", "startDate");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "cycle_logs_userId_date_key" ON "cycle_logs"("userId", "date");`,
  ignoreDuplicate(`ALTER TABLE "cycle_settings" ADD CONSTRAINT "cycle_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "cycle_periods" ADD CONSTRAINT "cycle_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "cycle_logs" ADD CONSTRAINT "cycle_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  // Ciclo Menstrual: mirror de prisma/migrations/20261015120000_menstrual_cycle_tracking.
  `ALTER TABLE "cycle_logs" ADD COLUMN IF NOT EXISTS "moods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];`,
  `ALTER TABLE "cycle_logs" ADD COLUMN IF NOT EXISTS "sexualActivity" TEXT;`,
  `ALTER TABLE "cycle_logs" ADD COLUMN IF NOT EXISTS "contraception" TEXT;`,
  `ALTER TABLE "cycle_logs" ADD COLUMN IF NOT EXISTS "sleepQuality" INTEGER;`,
  `ALTER TABLE "cycle_logs" ADD COLUMN IF NOT EXISTS "stress" INTEGER;`,
  `ALTER TABLE "cycle_logs" ADD COLUMN IF NOT EXISTS "waterGlasses" INTEGER;`,
];

// Idempotent mirror of prisma/migrations/20261026120000_smart_reminders (horarios de los avisos inteligentes).
const SMART_REMINDERS_SQL = [
  `ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "reminderSettings" JSONB;`,
];

// Idempotent mirror of prisma/migrations/20261016120000_habit_rituals_hygiene (rituales y Higiene Personal).
const HABIT_RITUALS_HYGIENE_SQL = [
  `ALTER TYPE "QuestCategory" ADD VALUE IF NOT EXISTS 'HYGIENE'`,
  `ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'habit'`,
  `ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "careRoutineId" TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "habits_careRoutineId_key" ON "habits"("careRoutineId")`,
  `CREATE TABLE IF NOT EXISTS "habit_steps" ("id" TEXT NOT NULL, "habitId" TEXT NOT NULL, "title" TEXT NOT NULL, "order" INTEGER NOT NULL, CONSTRAINT "habit_steps_pkey" PRIMARY KEY ("id"))`,
  `CREATE TABLE IF NOT EXISTS "habit_step_logs" ("id" TEXT NOT NULL, "stepId" TEXT NOT NULL, "habitId" TEXT NOT NULL, "userId" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL, "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "habit_step_logs_pkey" PRIMARY KEY ("id"))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "habit_step_logs_stepId_date_key" ON "habit_step_logs"("stepId", "date")`,
  ignoreDuplicate(`ALTER TABLE "habits" ADD CONSTRAINT "habits_careRoutineId_fkey" FOREIGN KEY ("careRoutineId") REFERENCES "care_routines"("id") ON DELETE SET NULL ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "habit_steps" ADD CONSTRAINT "habit_steps_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "habit_step_logs" ADD CONSTRAINT "habit_step_logs_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "habit_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "habit_step_logs" ADD CONSTRAINT "habit_step_logs_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
  ignoreDuplicate(`ALTER TABLE "habit_step_logs" ADD CONSTRAINT "habit_step_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
];

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

// Idempotent mirror of prisma/migrations/20261106120000_custom_exercises.
// Ejercicios propios: el nombre pasa a ser único por dueño; el catálogo (sin dueño), por nombre.
const CUSTOM_EXERCISES_SQL = [
  `ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "userId" TEXT;`,
  `DROP INDEX IF EXISTS "exercises_name_key";`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "exercises_userId_name_key" ON "exercises"("userId", "name");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "exercises_catalog_name_key" ON "exercises"("name") WHERE "userId" IS NULL;`,
  ignoreDuplicate(`ALTER TABLE "exercises" ADD CONSTRAINT "exercises_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`),
];

/**
 * One-time data fixes. Each op id is recorded in "_data_ops" and never runs
 * again, so a fix that deletes data cannot repeat on a later deploy.
 */
const DATA_OPS: Array<[string, () => Promise<void>]> = [
  // An account reset of miguelhero ran before the reset covered the gym, so
  // its workouts, routines, attendance and body tracking survived.
  ['2026-10-09-reset-gym-miguelhero', async () => {
    const user = await prisma.user.findUnique({ where: { username: 'miguelhero' }, select: { id: true } });
    if (!user) return;
    const userId = user.id;
    await prisma.$transaction([
      prisma.workoutExercise.deleteMany({ where: { workout: { userId } } }),
      prisma.workout.deleteMany({ where: { userId } }),
      prisma.routine.deleteMany({ where: { userId } }),
      prisma.coliseoAttendance.deleteMany({ where: { userId } }),
      prisma.bodyWeight.deleteMany({ where: { userId } }),
      prisma.progressPhoto.deleteMany({ where: { userId } }),
      prisma.user.update({ where: { id: userId }, data: { coliseoPlaylistUrl: null } }),
    ]);
    console.log('Gym data of miguelhero reset.');
  }],
  // Proteger una racha pasa a costar menos que revivirla. Los protectores ya
  // existentes bajan de precio, y las compras anteriores (que no protegían
  // nada) se convierten en días de escudo, con el tope de siempre.
  ['2026-10-24-streak-shield-economy', async () => {
    for (const item of DEFAULT_SHOP_ITEMS) {
      if (shieldDaysOf(item.imageKey) === 0) continue;
      await prisma.shopItem.updateMany({ where: { imageKey: item.imageKey }, data: { cost: item.cost, description: item.description } });
    }
    const bought = await prisma.inventoryItem.findMany({
      where: { shopItem: { imageKey: { in: Object.keys(STREAK_SHIELDS) } } },
      select: { id: true, userId: true, shopItem: { select: { imageKey: true } } },
    });
    const days = new Map<string, number>();
    for (const row of bought) days.set(row.userId, (days.get(row.userId) ?? 0) + shieldDaysOf(row.shopItem.imageKey));
    for (const [userId, total] of days) {
      await prisma.user.update({ where: { id: userId }, data: { streakShieldDays: Math.min(MAX_SHIELD_DAYS, total) } });
    }
    if (bought.length) await prisma.inventoryItem.updateMany({ where: { id: { in: bought.map((row) => row.id) } }, data: { usedAt: new Date() } });
    console.log(`Streak shields: ${days.size} players credited.`);
  }],
  // Temas rediseñados: los que ya existían toman su nombre, descripción, precio y
  // nivel nuevos (por imageKey, así quien los compró los conserva). Bosque Oscuro
  // pasa a ser Naturaleza. Los temas nuevos los crea ensureDefaultCatalog.
  ['2026-10-25-theme-rework', async () => {
    for (const item of DEFAULT_SHOP_ITEMS) {
      if (item.type !== 'THEME') continue;
      await prisma.shopItem.updateMany({ where: { imageKey: item.imageKey }, data: { name: item.name, description: item.description, cost: item.cost, levelRequired: item.levelRequired } });
    }
  }],
  // Los avisos de hábito completado llevaban la clave del ícono como texto
  // («code "Leer" completado»). Se quita de los que ya están en la bandeja.
  ['2026-10-28-habit-notice-icon-keys', async () => {
    const n = await prisma.$executeRawUnsafe(`UPDATE "notifications" SET "title" = regexp_replace("title", '^[a-z][a-z0-9_-]*\\s+', '') WHERE "type" = 'habit_completed' AND "title" ~ '^[a-z][a-z0-9_-]*\\s+"'`);
    console.log(`Habit notices cleaned: ${n}.`);
  }],
];

async function runDataOpsOnce() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "_data_ops" ("id" TEXT PRIMARY KEY, "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
  for (const [id, run] of DATA_OPS) {
    const done = await prisma.$queryRawUnsafe<unknown[]>(`SELECT 1 FROM "_data_ops" WHERE "id" = $1`, id);
    if (done.length) continue;
    await run();
    await prisma.$executeRawUnsafe(`INSERT INTO "_data_ops" ("id") VALUES ($1)`, id);
  }
}

async function migrate() {
  console.log('Running database schema updates...');

  // Idempotent mirror of prisma/migrations/20261024120000_gender_cycle_and_streak_shields.
  // Va primero: este cliente de Prisma ya lee "gender" y "streakShieldDays" en
  // cualquier consulta de users sin select (settleLevel, más abajo).
  for (const sql of GENDER_CYCLE_AND_SHIELDS_SQL) await prisma.$executeRawUnsafe(sql);
  // Idempotent mirror of prisma/migrations/20261104120000_annual_plan_creator_codes (columnas de users), por la misma razón.
  for (const sql of CREATOR_CODES_USERS_SQL) await prisma.$executeRawUnsafe(sql);
  // Idempotent mirror of prisma/migrations/20261105120000_markets_usd_pricing (columna de users), por la misma razón.
  for (const sql of MARKETS_USERS_SQL) await prisma.$executeRawUnsafe(sql);
  for (const sql of HABIT_RITUALS_HYGIENE_SQL) await prisma.$executeRawUnsafe(sql);
  for (const sql of SMART_REMINDERS_SQL) await prisma.$executeRawUnsafe(sql);
  // Antes de cualquier consulta a exercises: este cliente de Prisma ya lee "userId".
  for (const sql of CUSTOM_EXERCISES_SQL) await prisma.$executeRawUnsafe(sql);
  // Idempotent mirror of prisma/migrations/20261025120000_wisdom_source (antes del seed de Sabiduría).
  await prisma.$executeRawUnsafe(`ALTER TABLE "wisdom_cards" ADD COLUMN IF NOT EXISTS "source" TEXT;`);

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

  // Idempotent mirror of prisma/migrations/20261006120000_letters_and_gestures.
  for (const sql of LETTERS_AND_GESTURES_SQL) await prisma.$executeRawUnsafe(sql);

  // Idempotent mirror of prisma/migrations/20261008120000_social_pro.
  for (const sql of SOCIAL_PRO_SQL) await prisma.$executeRawUnsafe(sql);

  // Idempotent mirrors of the undoable habit check and private wardrobe-photo migrations.
  for (const sql of REVERSIBLE_HABIT_LOGS_SQL) await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRawUnsafe(WARDROBE_PHOTO_SQL);

  // Idempotent mirror of the backlog's checklist, anti-habit and sharing tables.
  for (const sql of BACKLOG_SQL) await prisma.$executeRawUnsafe(sql);
  for (const sql of BACKLOG_V2_SQL()) await prisma.$executeRawUnsafe(sql);

  // Idempotent mirror of prisma/migrations/20261009120000_oauth_only_and_stats.
  // The unused stat columns (mp, maxMp, per-area levels) are left in place here:
  // the previous deployment may still be serving while this one builds.
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleSub" TEXT;`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "users_googleSub_key" ON "users"("googleSub");`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ALTER COLUMN "displayName" SET DEFAULT 'Héroe';`);

  await runDataOpsOnce();

  // XP that was added without leveling up (achievements, focus, rituals, care
  // routines) left some players above their level threshold. Settle them once.
  const overflowing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "users" WHERE "xp" >= "xpToNextLevel"`);
  for (const { id } of overflowing) await settleLevel(id);
  if (overflowing.length) console.log(`Settled levels for ${overflowing.length} players.`);

  // Idempotent mirror of prisma/migrations/20261011120000_workout_cardio.
  await prisma.$executeRawUnsafe(ignoreDuplicate(`CREATE TYPE "WorkoutKind" AS ENUM ('STRENGTH', 'WALK', 'CARDIO')`));
  await prisma.$executeRawUnsafe(`ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "kind" "WorkoutKind" NOT NULL DEFAULT 'STRENGTH';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "distanceKm" DOUBLE PRECISION;`);

  // Idempotent mirror of prisma/migrations/20261012120000_income_categories.
  await prisma.$executeRawUnsafe(`ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'SALARY'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'FREELANCE'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'BUSINESS'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'SALES'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'GIFT'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'RENTAL'`);

  // Idempotent mirror of prisma/migrations/20261016120000_clothing_for_me_category:
  // «Ropa para mí», categoría de gasto con atajo al Espejo.
  await prisma.$executeRawUnsafe(`ALTER TYPE "TransactionCategory" ADD VALUE IF NOT EXISTS 'CLOTHING_FOR_ME'`);

  // Idempotent mirror of prisma/migrations/20261013120000_savings_pot.
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "savings_entries" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "counterpart" TEXT NOT NULL, "amount" DECIMAL(15,2) NOT NULL, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "savings_entries_pkey" PRIMARY KEY ("id"))`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "savings_entries_userId_createdAt_idx" ON "savings_entries"("userId", "createdAt")`);
  await prisma.$executeRawUnsafe(ignoreDuplicate(`ALTER TABLE "savings_entries" ADD CONSTRAINT "savings_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`));

  // Idempotent mirror of prisma/migrations/20261019120000_subscriptions.
  for (const sql of SUBSCRIPTIONS_SQL) await prisma.$executeRawUnsafe(sql);
  // Plan anual y códigos de creador en los cobros, y el libro del revenue share.
  for (const sql of CREATOR_CODES_PAYMENTS_SQL) await prisma.$executeRawUnsafe(sql);
  // Precio en la moneda del mercado de cada cobro (lista en dólares cobrada en COP).
  for (const sql of MARKETS_PAYMENTS_SQL) await prisma.$executeRawUnsafe(sql);
  // Antes de RLS_LOCKDOWN_SQL: las tablas nuevas también quedan con RLS activo.
  for (const sql of REFERRALS_PUSH_EVENTS_SQL) await prisma.$executeRawUnsafe(sql);
  for (const sql of GIFT_TRIAL_SQL) await prisma.$executeRawUnsafe(sql);
  for (const sql of COMP_PRO_SQL) await prisma.$executeRawUnsafe(sql);
  for (const sql of GIFT_AVAILABLE_SQL) await prisma.$executeRawUnsafe(sql);
  await prisma.$executeRawUnsafe(MARK_GIFT_AVAILABLE_SQL);
  for (const sql of REFERRAL_ANTI_ABUSE_SQL) await prisma.$executeRawUnsafe(sql);

  // Idempotent mirror of prisma/migrations/20261023120000_recreation_zone.
  for (const sql of RECREATION_SQL) await prisma.$executeRawUnsafe(sql);

  // Idempotent mirror of prisma/migrations/20261027120000_notebooks.
  for (const sql of NOTEBOOKS_SQL) await prisma.$executeRawUnsafe(sql);
  // Idempotent mirror of prisma/migrations/20261028120000_reminder_snoozes.
  for (const sql of REMINDER_SNOOZES_SQL) await prisma.$executeRawUnsafe(sql);
  for (const sql of SERIES_PROGRESS_SQL) await prisma.$executeRawUnsafe(sql);

  // Runs last so tables created above are covered too.
  await prisma.$executeRawUnsafe(RLS_LOCKDOWN_SQL);

  console.log('SUCCESS: Runtime database columns, indexes, ritual idempotency key, and legacy habit ritual cleanup applied.');
}

if (shouldSkipBuildDbStep('migrate-db')) process.exit(0);

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
