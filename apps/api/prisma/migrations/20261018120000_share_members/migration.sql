-- Colaboración: invitar a otras personas (por usuario o ID) a una lista o meta compartida.
CREATE TABLE IF NOT EXISTS "resource_share_members" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "resource_share_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "resource_share_members_shareId_userId_key" ON "resource_share_members"("shareId", "userId");
CREATE INDEX IF NOT EXISTS "resource_share_members_userId_idx" ON "resource_share_members"("userId");
ALTER TABLE "resource_share_members" ADD CONSTRAINT "resource_share_members_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "resource_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_share_members" ADD CONSTRAINT "resource_share_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_share_members" ENABLE ROW LEVEL SECURITY;
