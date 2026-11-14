-- NoutLife v5: módulo académico, carteras de Finanzas y oficina de la Libreta.
-- Generado de src/lib/v5-migrations.ts (V5_SQL): cada sentencia es idempotente.

CREATE TABLE IF NOT EXISTS "academic_courses" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "period" TEXT NOT NULL, "teacher" TEXT, "color" TEXT NOT NULL DEFAULT 'jade', "credits" DOUBLE PRECISION NOT NULL DEFAULT 1, "scaleMin" DOUBLE PRECISION NOT NULL DEFAULT 0, "scaleMax" DOUBLE PRECISION NOT NULL DEFAULT 5, "passGrade" DOUBLE PRECISION NOT NULL DEFAULT 3, "targetGrade" DOUBLE PRECISION, "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "academic_courses_pkey" PRIMARY KEY ("id"));

CREATE TABLE IF NOT EXISTS "academic_grades" ("id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "title" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'EXAM', "weight" DOUBLE PRECISION NOT NULL, "score" DOUBLE PRECISION, "predicted" DOUBLE PRECISION, "date" TIMESTAMP(3), "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "academic_grades_pkey" PRIMARY KEY ("id"));

CREATE TABLE IF NOT EXISTS "academic_topics" ("id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "gradeId" TEXT, "title" TEXT NOT NULL, "mastery" INTEGER NOT NULL DEFAULT 0, "order" INTEGER NOT NULL DEFAULT 0, "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "academic_topics_pkey" PRIMARY KEY ("id"));

CREATE TABLE IF NOT EXISTS "academic_tasks" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "courseId" TEXT, "title" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'DELIVERY', "dueAt" TIMESTAMP(3) NOT NULL, "done" BOOLEAN NOT NULL DEFAULT false, "doneAt" TIMESTAMP(3), "notes" TEXT, "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "academic_tasks_pkey" PRIMARY KEY ("id"));

CREATE INDEX IF NOT EXISTS "academic_courses_userId_archivedAt_idx" ON "academic_courses"("userId", "archivedAt");

CREATE INDEX IF NOT EXISTS "academic_grades_courseId_idx" ON "academic_grades"("courseId");

CREATE INDEX IF NOT EXISTS "academic_topics_courseId_idx" ON "academic_topics"("courseId");

CREATE INDEX IF NOT EXISTS "academic_tasks_userId_done_dueAt_idx" ON "academic_tasks"("userId", "done", "dueAt");

DO $$ BEGIN ALTER TABLE "academic_courses" ADD CONSTRAINT "academic_courses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "academic_grades" ADD CONSTRAINT "academic_grades_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "academic_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "academic_topics" ADD CONSTRAINT "academic_topics_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "academic_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "academic_topics" ADD CONSTRAINT "academic_topics_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "academic_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "academic_tasks" ADD CONSTRAINT "academic_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "academic_tasks" ADD CONSTRAINT "academic_tasks_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "academic_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "finance_accounts" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" TEXT NOT NULL, "provider" TEXT, "last4" TEXT, "currency" TEXT NOT NULL DEFAULT 'COP', "color" TEXT NOT NULL DEFAULT 'jade', "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0, "creditLimit" DECIMAL(15,2), "cutoffDay" INTEGER, "dueDay" INTEGER, "order" INTEGER NOT NULL DEFAULT 0, "archivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id"));

CREATE TABLE IF NOT EXISTS "finance_transfers" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "fromAccountId" TEXT NOT NULL, "toAccountId" TEXT NOT NULL, "amount" DECIMAL(15,2) NOT NULL, "date" TIMESTAMP(3) NOT NULL, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "finance_transfers_pkey" PRIMARY KEY ("id"));

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "accountId" TEXT;

CREATE INDEX IF NOT EXISTS "finance_accounts_userId_archivedAt_idx" ON "finance_accounts"("userId", "archivedAt");

CREATE INDEX IF NOT EXISTS "finance_transfers_userId_date_idx" ON "finance_transfers"("userId", "date");

CREATE INDEX IF NOT EXISTS "transactions_accountId_idx" ON "transactions"("accountId");

DO $$ BEGIN ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "finance_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "finance_transfers" ADD CONSTRAINT "finance_transfers_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "finance_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "office_files" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "title" TEXT NOT NULL, "content" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "office_files_pkey" PRIMARY KEY ("id"));

CREATE INDEX IF NOT EXISTS "office_files_userId_updatedAt_idx" ON "office_files"("userId", "updatedAt");

DO $$ BEGIN ALTER TABLE "office_files" ADD CONSTRAINT "office_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "plannedMin" INTEGER;

ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "soundtrack" TEXT;

ALTER TABLE "academic_courses" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "academic_grades" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "academic_topics" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "academic_tasks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "finance_accounts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "finance_transfers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "office_files" ENABLE ROW LEVEL SECURITY;
