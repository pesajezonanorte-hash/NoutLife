-- Rituales en la Libreta de Hábitos y categoría Higiene Personal enlazada con Cuidado Personal.
ALTER TYPE "QuestCategory" ADD VALUE IF NOT EXISTS 'HYGIENE';

ALTER TABLE "habits" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'habit';
ALTER TABLE "habits" ADD COLUMN "careRoutineId" TEXT;
CREATE UNIQUE INDEX "habits_careRoutineId_key" ON "habits"("careRoutineId");
ALTER TABLE "habits" ADD CONSTRAINT "habits_careRoutineId_fkey" FOREIGN KEY ("careRoutineId") REFERENCES "care_routines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "habit_steps" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "habit_steps_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "habit_steps" ADD CONSTRAINT "habit_steps_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "habit_step_logs" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "habit_step_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "habit_step_logs_stepId_date_key" ON "habit_step_logs"("stepId", "date");
ALTER TABLE "habit_step_logs" ADD CONSTRAINT "habit_step_logs_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "habit_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "habit_step_logs" ADD CONSTRAINT "habit_step_logs_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "habit_step_logs" ADD CONSTRAINT "habit_step_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
