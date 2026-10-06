-- Social pro: live signals (one cheap row per person that the live chat watches),
-- typing state, edited/deleted messages, voice notes and light message metadata,
-- archived/cleared chats, blocks, stickers, the name color and exclusive shop items.
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "audioUrl" TEXT, ADD COLUMN IF NOT EXISTS "meta" JSONB, ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "guild_messages" ADD COLUMN IF NOT EXISTS "audioUrl" TEXT, ADD COLUMN IF NOT EXISTS "meta" JSONB, ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "chat_views" ADD COLUMN IF NOT EXISTS "typingAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nameColor" TEXT;
ALTER TABLE "shop_items" ADD COLUMN IF NOT EXISTS "slot" TEXT, ADD COLUMN IF NOT EXISTS "value" TEXT, ADD COLUMN IF NOT EXISTS "stock" INTEGER, ADD COLUMN IF NOT EXISTS "sold" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "live_signals" (
    "userId" TEXT NOT NULL,
    "seq" BIGINT NOT NULL DEFAULT 0,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "live_signals_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "chat_prefs" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_prefs_pkey" PRIMARY KEY ("userId", "key")
);
DO $$ BEGIN ALTER TABLE "chat_prefs" ADD CONSTRAINT "chat_prefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "user_blocks" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blockerId", "blockedId")
);
CREATE INDEX IF NOT EXISTS "user_blocks_blockedId_idx" ON "user_blocks"("blockedId");
DO $$ BEGIN ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "sticker_images" (
    "hash" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sticker_images_pkey" PRIMARY KEY ("hash")
);

CREATE TABLE IF NOT EXISTS "stickers" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stickers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "stickers_ownerId_hash_key" ON "stickers"("ownerId", "hash");
DO $$ BEGIN ALTER TABLE "stickers" ADD CONSTRAINT "stickers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "stickers" ADD CONSTRAINT "stickers_hash_fkey" FOREIGN KEY ("hash") REFERENCES "sticker_images"("hash") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
