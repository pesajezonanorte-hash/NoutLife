-- Social network: privacy, presence, revivable streaks, shared gardens,
-- several guilds per person, guild invites and direct messages.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT, ADD COLUMN IF NOT EXISTS "privacy" JSONB NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS "presenceAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "presenceZone" TEXT, ADD COLUMN IF NOT EXISTS "lostStreak" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "lostStreakAt" TIMESTAMP(3);

ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "lostStreak" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "lostStreakAt" TIMESTAMP(3);

ALTER TABLE "relationships" ADD COLUMN IF NOT EXISTS "partnerUserId" TEXT, ADD COLUMN IF NOT EXISTS "linkStatus" TEXT;

CREATE INDEX IF NOT EXISTS "relationships_partnerUserId_idx" ON "relationships"("partnerUserId");

ALTER TABLE "friendships" ADD COLUMN IF NOT EXISTS "streakCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "streakBest" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "streakDay" TEXT;

ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "streakCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "streakBest" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "streakDay" TEXT;

ALTER TABLE "guild_members" DROP CONSTRAINT IF EXISTS "guild_members_userId_key";

DROP INDEX IF EXISTS "guild_members_userId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "guild_members_guildId_userId_key" ON "guild_members"("guildId", "userId");

CREATE INDEX IF NOT EXISTS "guild_members_userId_idx" ON "guild_members"("userId");

ALTER TABLE "guild_messages" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'TEXT', ADD COLUMN IF NOT EXISTS "photoUrl" TEXT, ADD COLUMN IF NOT EXISTS "dayKey" TEXT;

CREATE INDEX IF NOT EXISTS "guild_messages_guildId_dayKey_idx" ON "guild_messages"("guildId", "dayKey");

CREATE TABLE IF NOT EXISTS "guild_invites" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guild_invites_pkey" PRIMARY KEY ("id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "guild_invites_guildId_inviteeId_key" ON "guild_invites"("guildId", "inviteeId");

CREATE INDEX IF NOT EXISTS "guild_invites_inviteeId_status_idx" ON "guild_invites"("inviteeId", "status");

DO $$ BEGIN
    ALTER TABLE "guild_invites" ADD CONSTRAINT "guild_invites_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "guild_invites" ADD CONSTRAINT "guild_invites_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "guild_invites" ADD CONSTRAINT "guild_invites_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "direct_messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT,
    "photoUrl" TEXT,
    "habitTitle" TEXT,
    "dayKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
  );

CREATE INDEX IF NOT EXISTS "direct_messages_senderId_receiverId_createdAt_idx" ON "direct_messages"("senderId", "receiverId", "createdAt");

CREATE INDEX IF NOT EXISTS "direct_messages_receiverId_readAt_idx" ON "direct_messages"("receiverId", "readAt");

DO $$ BEGIN
    ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
