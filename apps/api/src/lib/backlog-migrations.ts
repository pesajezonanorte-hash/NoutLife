const addFk = (table: string, name: string, column: string, ref: string) => `
  DO $$ BEGIN
    ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "${ref}"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;`;

/** Idempotent mirrors of the backlog migrations used by production runtime builds. */
export const REVERSIBLE_HABIT_LOGS_SQL: string[] = [
  `ALTER TABLE "habit_logs" ADD COLUMN IF NOT EXISTS "rewardsGranted" BOOLEAN NOT NULL DEFAULT false;`,
  // Existing completed entries already earned rewards before the flag existed.
  `UPDATE "habit_logs" SET "rewardsGranted" = true WHERE "completed" = true;`,
];

export const WARDROBE_PHOTO_SQL = `ALTER TABLE "clothing_items" ADD COLUMN IF NOT EXISTS "photoData" TEXT;`;

export const BACKLOG_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS "checklists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'personal',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "checklist_items" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "anti_habits" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "cue" TEXT,
    "targetPerWeek" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "anti_habits_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "anti_habit_logs" (
    "id" TEXT NOT NULL,
    "antiHabitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "occurred" BOOLEAN NOT NULL DEFAULT false,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "intensity" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anti_habit_logs_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE TABLE IF NOT EXISTS "resource_shares" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'VIEW',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resource_shares_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "resource_shares_code_key" ON "resource_shares"("code");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "resource_shares_ownerId_resourceType_resourceId_key" ON "resource_shares"("ownerId", "resourceType", "resourceId");`,
  `CREATE INDEX IF NOT EXISTS "resource_shares_resourceType_resourceId_isActive_idx" ON "resource_shares"("resourceType", "resourceId", "isActive");`,
  `CREATE INDEX IF NOT EXISTS "checklists_userId_category_updatedAt_idx" ON "checklists"("userId", "category", "updatedAt");`,
  `CREATE INDEX IF NOT EXISTS "checklist_items_checklistId_order_idx" ON "checklist_items"("checklistId", "order");`,
  `CREATE INDEX IF NOT EXISTS "anti_habits_userId_isActive_idx" ON "anti_habits"("userId", "isActive");`,
  `CREATE INDEX IF NOT EXISTS "anti_habit_logs_userId_date_idx" ON "anti_habit_logs"("userId", "date");`,
  `CREATE INDEX IF NOT EXISTS "anti_habit_logs_antiHabitId_date_idx" ON "anti_habit_logs"("antiHabitId", "date");`,
  addFk('checklists', 'checklists_userId_fkey', 'userId', 'users'),
  addFk('checklist_items', 'checklist_items_checklistId_fkey', 'checklistId', 'checklists'),
  addFk('anti_habits', 'anti_habits_userId_fkey', 'userId', 'users'),
  addFk('anti_habit_logs', 'anti_habit_logs_antiHabitId_fkey', 'antiHabitId', 'anti_habits'),
  addFk('anti_habit_logs', 'anti_habit_logs_userId_fkey', 'userId', 'users'),
  addFk('resource_shares', 'resource_shares_ownerId_fkey', 'ownerId', 'users'),
];
