-- Live chat: replies, reactions and "who has this letter open" (so that nobody is
-- notified about a message in the letter they are reading).
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "replyToId" TEXT, ADD COLUMN IF NOT EXISTS "reactedAt" TIMESTAMP(3);
ALTER TABLE "guild_messages" ADD COLUMN IF NOT EXISTS "replyToId" TEXT, ADD COLUMN IF NOT EXISTS "reactedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "direct_messages_senderId_receiverId_reactedAt_idx" ON "direct_messages"("senderId", "receiverId", "reactedAt");
CREATE INDEX IF NOT EXISTS "guild_messages_guildId_createdAt_idx" ON "guild_messages"("guildId", "createdAt");
CREATE INDEX IF NOT EXISTS "guild_messages_guildId_reactedAt_idx" ON "guild_messages"("guildId", "reactedAt");

CREATE TABLE IF NOT EXISTS "message_reactions" (
    "id" TEXT NOT NULL,
    "dmId" TEXT,
    "guildMessageId" TEXT,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "message_reactions_dmId_userId_key" ON "message_reactions"("dmId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "message_reactions_guildMessageId_userId_key" ON "message_reactions"("guildMessageId", "userId");
DO $$ BEGIN ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_dmId_fkey" FOREIGN KEY ("dmId") REFERENCES "direct_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_guildMessageId_fkey" FOREIGN KEY ("guildMessageId") REFERENCES "guild_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "chat_views" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_views_pkey" PRIMARY KEY ("userId", "key")
);
DO $$ BEGIN ALTER TABLE "chat_views" ADD CONSTRAINT "chat_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
