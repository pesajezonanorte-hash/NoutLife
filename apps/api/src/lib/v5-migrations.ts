/**
 * Espejo idempotente de prisma/migrations/20261114120000_noutlife_v5: módulo académico, carteras de
 * Finanzas y archivos de oficina de la Libreta. migrate-db.ts lo corre en cada build, así que cada
 * sentencia puede repetirse. La migración de Prisma lleva estas mismas sentencias.
 */
const fk = (table: string, name: string, column: string, target: string, onDelete: 'CASCADE' | 'SET NULL') =>
  `DO $$ BEGIN ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "${target}"("id") ON DELETE ${onDelete} ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

const STAMPS = `"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL`;

export const V5_SQL: string[] = [
  // ── Académico ──
  `CREATE TABLE IF NOT EXISTS "academic_courses" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "period" TEXT NOT NULL, "teacher" TEXT, "color" TEXT NOT NULL DEFAULT 'jade', "credits" DOUBLE PRECISION NOT NULL DEFAULT 1, "scaleMin" DOUBLE PRECISION NOT NULL DEFAULT 0, "scaleMax" DOUBLE PRECISION NOT NULL DEFAULT 5, "passGrade" DOUBLE PRECISION NOT NULL DEFAULT 3, "targetGrade" DOUBLE PRECISION, "archivedAt" TIMESTAMP(3), ${STAMPS}, CONSTRAINT "academic_courses_pkey" PRIMARY KEY ("id"))`,
  `CREATE TABLE IF NOT EXISTS "academic_grades" ("id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "title" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'EXAM', "weight" DOUBLE PRECISION NOT NULL, "score" DOUBLE PRECISION, "predicted" DOUBLE PRECISION, "date" TIMESTAMP(3), "archivedAt" TIMESTAMP(3), ${STAMPS}, CONSTRAINT "academic_grades_pkey" PRIMARY KEY ("id"))`,
  `CREATE TABLE IF NOT EXISTS "academic_topics" ("id" TEXT NOT NULL, "courseId" TEXT NOT NULL, "gradeId" TEXT, "title" TEXT NOT NULL, "mastery" INTEGER NOT NULL DEFAULT 0, "order" INTEGER NOT NULL DEFAULT 0, "archivedAt" TIMESTAMP(3), ${STAMPS}, CONSTRAINT "academic_topics_pkey" PRIMARY KEY ("id"))`,
  `CREATE TABLE IF NOT EXISTS "academic_tasks" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "courseId" TEXT, "title" TEXT NOT NULL, "kind" TEXT NOT NULL DEFAULT 'DELIVERY', "dueAt" TIMESTAMP(3) NOT NULL, "done" BOOLEAN NOT NULL DEFAULT false, "doneAt" TIMESTAMP(3), "notes" TEXT, "archivedAt" TIMESTAMP(3), ${STAMPS}, CONSTRAINT "academic_tasks_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "academic_courses_userId_archivedAt_idx" ON "academic_courses"("userId", "archivedAt")`,
  `CREATE INDEX IF NOT EXISTS "academic_grades_courseId_idx" ON "academic_grades"("courseId")`,
  `CREATE INDEX IF NOT EXISTS "academic_topics_courseId_idx" ON "academic_topics"("courseId")`,
  `CREATE INDEX IF NOT EXISTS "academic_tasks_userId_done_dueAt_idx" ON "academic_tasks"("userId", "done", "dueAt")`,
  fk('academic_courses', 'academic_courses_userId_fkey', 'userId', 'users', 'CASCADE'),
  fk('academic_grades', 'academic_grades_courseId_fkey', 'courseId', 'academic_courses', 'CASCADE'),
  fk('academic_topics', 'academic_topics_courseId_fkey', 'courseId', 'academic_courses', 'CASCADE'),
  fk('academic_topics', 'academic_topics_gradeId_fkey', 'gradeId', 'academic_grades', 'SET NULL'),
  fk('academic_tasks', 'academic_tasks_userId_fkey', 'userId', 'users', 'CASCADE'),
  fk('academic_tasks', 'academic_tasks_courseId_fkey', 'courseId', 'academic_courses', 'CASCADE'),

  // ── Carteras de Finanzas ──
  `CREATE TABLE IF NOT EXISTS "finance_accounts" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" TEXT NOT NULL, "provider" TEXT, "last4" TEXT, "currency" TEXT NOT NULL DEFAULT 'COP', "color" TEXT NOT NULL DEFAULT 'jade', "openingBalance" DECIMAL(15,2) NOT NULL DEFAULT 0, "creditLimit" DECIMAL(15,2), "cutoffDay" INTEGER, "dueDay" INTEGER, "order" INTEGER NOT NULL DEFAULT 0, "archivedAt" TIMESTAMP(3), ${STAMPS}, CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id"))`,
  `CREATE TABLE IF NOT EXISTS "finance_transfers" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "fromAccountId" TEXT NOT NULL, "toAccountId" TEXT NOT NULL, "amount" DECIMAL(15,2) NOT NULL, "date" TIMESTAMP(3) NOT NULL, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "finance_transfers_pkey" PRIMARY KEY ("id"))`,
  `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "accountId" TEXT`,
  `CREATE INDEX IF NOT EXISTS "finance_accounts_userId_archivedAt_idx" ON "finance_accounts"("userId", "archivedAt")`,
  `CREATE INDEX IF NOT EXISTS "finance_transfers_userId_date_idx" ON "finance_transfers"("userId", "date")`,
  `CREATE INDEX IF NOT EXISTS "transactions_accountId_idx" ON "transactions"("accountId")`,
  fk('finance_accounts', 'finance_accounts_userId_fkey', 'userId', 'users', 'CASCADE'),
  fk('finance_transfers', 'finance_transfers_userId_fkey', 'userId', 'users', 'CASCADE'),
  fk('finance_transfers', 'finance_transfers_fromAccountId_fkey', 'fromAccountId', 'finance_accounts', 'CASCADE'),
  fk('finance_transfers', 'finance_transfers_toAccountId_fkey', 'toAccountId', 'finance_accounts', 'CASCADE'),
  fk('transactions', 'transactions_accountId_fkey', 'accountId', 'finance_accounts', 'SET NULL'),

  // ── Oficina de la Libreta ──
  `CREATE TABLE IF NOT EXISTS "office_files" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "kind" TEXT NOT NULL, "title" TEXT NOT NULL, "content" JSONB NOT NULL, ${STAMPS}, CONSTRAINT "office_files_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "office_files_userId_updatedAt_idx" ON "office_files"("userId", "updatedAt")`,
  fk('office_files', 'office_files_userId_fkey', 'userId', 'users', 'CASCADE'),

  // ── Enfoque: con qué sonó la sesión y cuánto se propuso ──
  `ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "plannedMin" INTEGER`,
  `ALTER TABLE "focus_sessions" ADD COLUMN IF NOT EXISTS "soundtrack" TEXT`,

  ...['academic_courses', 'academic_grades', 'academic_topics', 'academic_tasks', 'finance_accounts', 'finance_transfers', 'office_files']
    .map((table) => `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`),
];
