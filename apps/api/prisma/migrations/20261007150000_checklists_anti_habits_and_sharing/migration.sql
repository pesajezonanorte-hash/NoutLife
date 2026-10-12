-- Reusable categorized checklists, measured anti-habit logs, and revocable
-- view/edit links for checklists and master goals.
CREATE TABLE IF NOT EXISTS "checklists" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'personal',
  "isTemplate" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "checklist_items" (
  "id" TEXT NOT NULL,
  "checklistId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "isDone" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "anti_habits" (
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
);

CREATE TABLE IF NOT EXISTS "anti_habit_logs" (
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
);

CREATE TABLE IF NOT EXISTS "resource_shares" (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS "resource_shares_code_key" ON "resource_shares"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "resource_shares_ownerId_resourceType_resourceId_key" ON "resource_shares"("ownerId", "resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS "resource_shares_resourceType_resourceId_isActive_idx" ON "resource_shares"("resourceType", "resourceId", "isActive");
CREATE INDEX IF NOT EXISTS "checklists_userId_category_updatedAt_idx" ON "checklists"("userId", "category", "updatedAt");
CREATE INDEX IF NOT EXISTS "checklist_items_checklistId_order_idx" ON "checklist_items"("checklistId", "order");
CREATE INDEX IF NOT EXISTS "anti_habits_userId_isActive_idx" ON "anti_habits"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "anti_habit_logs_userId_date_idx" ON "anti_habit_logs"("userId", "date");
CREATE INDEX IF NOT EXISTS "anti_habit_logs_antiHabitId_date_idx" ON "anti_habit_logs"("antiHabitId", "date");

DO $$ BEGIN
  ALTER TABLE "checklists" ADD CONSTRAINT "checklists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "anti_habits" ADD CONSTRAINT "anti_habits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "anti_habit_logs" ADD CONSTRAINT "anti_habit_logs_antiHabitId_fkey" FOREIGN KEY ("antiHabitId") REFERENCES "anti_habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "anti_habit_logs" ADD CONSTRAINT "anti_habit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "resource_shares" ADD CONSTRAINT "resource_shares_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "checklists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "checklist_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "anti_habits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "anti_habit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "resource_shares" ENABLE ROW LEVEL SECURITY;
