-- Savings pot: deposits and withdrawals with their origin/destination.
CREATE TABLE IF NOT EXISTS "savings_entries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "counterpart" TEXT NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "savings_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "savings_entries_userId_createdAt_idx" ON "savings_entries"("userId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "savings_entries" ADD CONSTRAINT "savings_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
