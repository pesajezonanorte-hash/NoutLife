-- Reusable checklists with sharing, plus Google Calendar event id on quests.
ALTER TABLE "quests" ADD COLUMN IF NOT EXISTS "googleCalendarEventId" TEXT;
CREATE TABLE IF NOT EXISTS "checklists" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'General',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "checklists_userId_category_idx" ON "checklists"("userId", "category");
CREATE TABLE IF NOT EXISTS "checklist_items" (
  "id" TEXT NOT NULL,
  "checklistId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "checklist_items_checklistId_position_idx" ON "checklist_items"("checklistId", "position");
CREATE TABLE IF NOT EXISTS "checklist_shares" (
  "id" TEXT NOT NULL,
  "checklistId" TEXT NOT NULL,
  "userId" TEXT,
  "token" TEXT NOT NULL,
  "permission" TEXT NOT NULL DEFAULT 'VIEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checklist_shares_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "checklist_shares_token_key" ON "checklist_shares"("token");
CREATE INDEX IF NOT EXISTS "checklist_shares_checklistId_idx" ON "checklist_shares"("checklistId");
CREATE INDEX IF NOT EXISTS "checklist_shares_userId_idx" ON "checklist_shares"("userId");
DO $$ BEGIN
  ALTER TABLE "checklists" ADD CONSTRAINT "checklists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "checklist_shares" ADD CONSTRAINT "checklist_shares_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
