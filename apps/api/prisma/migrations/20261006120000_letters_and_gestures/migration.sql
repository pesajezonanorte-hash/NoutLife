-- Letters and gestures: shared chat backgrounds (a photo on letter paper) for
-- friends and guilds, gestures between friends shown on their pixel avatars,
-- and how far each member read the guild letter.
ALTER TABLE "guild_members" ADD COLUMN IF NOT EXISTS "lastReadAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "chat_backgrounds" (
    "id" TEXT NOT NULL,
    "friendshipId" TEXT,
    "guildId" TEXT,
    "photoUrl" TEXT NOT NULL,
    "fit" JSONB NOT NULL DEFAULT '{}',
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_backgrounds_pkey" PRIMARY KEY ("id")
  );

CREATE UNIQUE INDEX IF NOT EXISTS "chat_backgrounds_friendshipId_key" ON "chat_backgrounds"("friendshipId");

CREATE UNIQUE INDEX IF NOT EXISTS "chat_backgrounds_guildId_key" ON "chat_backgrounds"("guildId");

DO $$ BEGIN
    ALTER TABLE "chat_backgrounds" ADD CONSTRAINT "chat_backgrounds_friendshipId_fkey" FOREIGN KEY ("friendshipId") REFERENCES "friendships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "chat_backgrounds" ADD CONSTRAINT "chat_backgrounds_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "social_gestures" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "zone" TEXT,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_gestures_pkey" PRIMARY KEY ("id")
  );

CREATE INDEX IF NOT EXISTS "social_gestures_toId_seenAt_createdAt_idx" ON "social_gestures"("toId", "seenAt", "createdAt");

CREATE INDEX IF NOT EXISTS "social_gestures_fromId_toId_createdAt_idx" ON "social_gestures"("fromId", "toId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "social_gestures" ADD CONSTRAINT "social_gestures_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "social_gestures" ADD CONSTRAINT "social_gestures_toId_fkey" FOREIGN KEY ("toId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
