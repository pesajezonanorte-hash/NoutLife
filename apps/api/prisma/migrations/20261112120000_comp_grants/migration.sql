-- Historial de Pro de cortesía concedido desde el panel (días o indefinido).
-- Sin FK a users: el registro sobrevive al borrar la cuenta, igual que reward_links.
CREATE TABLE IF NOT EXISTS "comp_grants" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "targetUsername" TEXT NOT NULL,
  "days" INTEGER,
  "outcome" TEXT NOT NULL,
  "accessEndsAt" TIMESTAMP(3),
  "note" TEXT,
  "grantedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comp_grants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "comp_grants_createdAt_idx" ON "comp_grants"("createdAt");
ALTER TABLE "comp_grants" ENABLE ROW LEVEL SECURITY;
