/**
 * Runtime mirror of the SQL migration. Vercel builds run migrate-db.ts rather
 * than prisma migrate deploy, so the production path must retain the same
 * safety gate as prisma/migrations/20260927200000_remove_legacy_habit_ritual_flag.
 */
export const REMOVE_LEGACY_HABIT_RITUAL_FLAG_SQL = `
  DO $$
  DECLARE
    legacy_ritual_count INTEGER;
  BEGIN
    IF to_regclass('public.habits') IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'habits'
           AND column_name = 'isRitual'
       ) THEN
      EXECUTE 'SELECT COUNT(*) FROM "habits" WHERE "isRitual" = TRUE'
        INTO legacy_ritual_count;

      IF legacy_ritual_count > 0 THEN
        RAISE EXCEPTION
          'Refusing to remove legacy Habit.isRitual: % marked habit(s) require inventory or migration first.',
          legacy_ritual_count;
      END IF;

      EXECUTE 'ALTER TABLE "habits" DROP COLUMN "isRitual"';
    END IF;
  END $$;
`;

const addFk = (table: string, name: string, column: string, ref: string) => `
  DO $$ BEGIN
    ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "${ref}"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;`;

/**
 * Idempotent mirror of prisma/migrations/20261005200000_social_network:
 * privacy and presence, streaks that can be revived with gold, shared gardens,
 * several guilds per person with daily photo streaks, guild invites and DMs.
 */
export const SOCIAL_NETWORK_SQL: string[] = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" TEXT, ADD COLUMN IF NOT EXISTS "privacy" JSONB NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS "presenceAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "presenceZone" TEXT, ADD COLUMN IF NOT EXISTS "lostStreak" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "lostStreakAt" TIMESTAMP(3);`,
  `ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "lostStreak" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "lostStreakAt" TIMESTAMP(3);`,
  `ALTER TABLE "relationships" ADD COLUMN IF NOT EXISTS "partnerUserId" TEXT, ADD COLUMN IF NOT EXISTS "linkStatus" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "relationships_partnerUserId_idx" ON "relationships"("partnerUserId");`,
  `ALTER TABLE "friendships" ADD COLUMN IF NOT EXISTS "streakCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "streakBest" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "streakDay" TEXT;`,
  `ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "streakCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "streakBest" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "streakDay" TEXT;`,
  // Several guilds per person: the one-guild unique key becomes (guild, person).
  `ALTER TABLE "guild_members" DROP CONSTRAINT IF EXISTS "guild_members_userId_key";`,
  `DROP INDEX IF EXISTS "guild_members_userId_key";`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "guild_members_guildId_userId_key" ON "guild_members"("guildId", "userId");`,
  `CREATE INDEX IF NOT EXISTS "guild_members_userId_idx" ON "guild_members"("userId");`,
  `ALTER TABLE "guild_messages" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'TEXT', ADD COLUMN IF NOT EXISTS "photoUrl" TEXT, ADD COLUMN IF NOT EXISTS "dayKey" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "guild_messages_guildId_dayKey_idx" ON "guild_messages"("guildId", "dayKey");`,
  `CREATE TABLE IF NOT EXISTS "guild_invites" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "guild_invites_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "guild_invites_guildId_inviteeId_key" ON "guild_invites"("guildId", "inviteeId");`,
  `CREATE INDEX IF NOT EXISTS "guild_invites_inviteeId_status_idx" ON "guild_invites"("inviteeId", "status");`,
  addFk('guild_invites', 'guild_invites_guildId_fkey', 'guildId', 'guilds'),
  addFk('guild_invites', 'guild_invites_inviterId_fkey', 'inviterId', 'users'),
  addFk('guild_invites', 'guild_invites_inviteeId_fkey', 'inviteeId', 'users'),
  `CREATE TABLE IF NOT EXISTS "direct_messages" (
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
  );`,
  `CREATE INDEX IF NOT EXISTS "direct_messages_senderId_receiverId_createdAt_idx" ON "direct_messages"("senderId", "receiverId", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "direct_messages_receiverId_readAt_idx" ON "direct_messages"("receiverId", "readAt");`,
  addFk('direct_messages', 'direct_messages_senderId_fkey', 'senderId', 'users'),
  addFk('direct_messages', 'direct_messages_receiverId_fkey', 'receiverId', 'users'),
];

/**
 * Idempotent mirror of prisma/migrations/20261006120000_letters_and_gestures:
 * shared chat backgrounds (letter paper photo) for friends and guilds, gestures
 * between friends shown on their pixel avatars, and how far each member read
 * the guild letter.
 */
export const LETTERS_AND_GESTURES_SQL: string[] = [
  `ALTER TABLE "guild_members" ADD COLUMN IF NOT EXISTS "lastReadAt" TIMESTAMP(3);`,
  `CREATE TABLE IF NOT EXISTS "chat_backgrounds" (
    "id" TEXT NOT NULL,
    "friendshipId" TEXT,
    "guildId" TEXT,
    "photoUrl" TEXT NOT NULL,
    "fit" JSONB NOT NULL DEFAULT '{}',
    "setById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_backgrounds_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "chat_backgrounds_friendshipId_key" ON "chat_backgrounds"("friendshipId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "chat_backgrounds_guildId_key" ON "chat_backgrounds"("guildId");`,
  addFk('chat_backgrounds', 'chat_backgrounds_friendshipId_fkey', 'friendshipId', 'friendships'),
  addFk('chat_backgrounds', 'chat_backgrounds_guildId_fkey', 'guildId', 'guilds'),
  `CREATE TABLE IF NOT EXISTS "social_gestures" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "zone" TEXT,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "social_gestures_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE INDEX IF NOT EXISTS "social_gestures_toId_seenAt_createdAt_idx" ON "social_gestures"("toId", "seenAt", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "social_gestures_fromId_toId_createdAt_idx" ON "social_gestures"("fromId", "toId", "createdAt");`,
  addFk('social_gestures', 'social_gestures_fromId_fkey', 'fromId', 'users'),
  addFk('social_gestures', 'social_gestures_toId_fkey', 'toId', 'users'),
  `ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "replyToId" TEXT, ADD COLUMN IF NOT EXISTS "reactedAt" TIMESTAMP(3);`,
  `ALTER TABLE "guild_messages" ADD COLUMN IF NOT EXISTS "replyToId" TEXT, ADD COLUMN IF NOT EXISTS "reactedAt" TIMESTAMP(3);`,
  `CREATE INDEX IF NOT EXISTS "direct_messages_senderId_receiverId_reactedAt_idx" ON "direct_messages"("senderId", "receiverId", "reactedAt");`,
  `CREATE INDEX IF NOT EXISTS "guild_messages_guildId_createdAt_idx" ON "guild_messages"("guildId", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "guild_messages_guildId_reactedAt_idx" ON "guild_messages"("guildId", "reactedAt");`,
  `CREATE TABLE IF NOT EXISTS "message_reactions" (
    "id" TEXT NOT NULL,
    "dmId" TEXT,
    "guildMessageId" TEXT,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "message_reactions_dmId_userId_key" ON "message_reactions"("dmId", "userId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "message_reactions_guildMessageId_userId_key" ON "message_reactions"("guildMessageId", "userId");`,
  addFk("message_reactions", "message_reactions_dmId_fkey", "dmId", "direct_messages"),
  addFk("message_reactions", "message_reactions_guildMessageId_fkey", "guildMessageId", "guild_messages"),
  addFk("message_reactions", "message_reactions_userId_fkey", "userId", "users"),
  `CREATE TABLE IF NOT EXISTS "chat_views" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_views_pkey" PRIMARY KEY ("userId", "key")
  );`,
  addFk("chat_views", "chat_views_userId_fkey", "userId", "users"),
];

/**
 * Idempotent mirror of prisma/migrations/20261008120000_social_pro: live signals,
 * typing, edited/deleted messages, voice notes, chat prefs, blocks, stickers,
 * the name color and exclusive shop items.
 */
export const SOCIAL_PRO_SQL: string[] = [
  "ALTER TABLE \"direct_messages\" ADD COLUMN IF NOT EXISTS \"audioUrl\" TEXT, ADD COLUMN IF NOT EXISTS \"meta\" JSONB, ADD COLUMN IF NOT EXISTS \"editedAt\" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS \"deletedAt\" TIMESTAMP(3);",
  "ALTER TABLE \"guild_messages\" ADD COLUMN IF NOT EXISTS \"audioUrl\" TEXT, ADD COLUMN IF NOT EXISTS \"meta\" JSONB, ADD COLUMN IF NOT EXISTS \"editedAt\" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS \"deletedAt\" TIMESTAMP(3);",
  "ALTER TABLE \"chat_views\" ADD COLUMN IF NOT EXISTS \"typingAt\" TIMESTAMP(3);",
  "ALTER TABLE \"users\" ADD COLUMN IF NOT EXISTS \"nameColor\" TEXT;",
  "ALTER TABLE \"shop_items\" ADD COLUMN IF NOT EXISTS \"slot\" TEXT, ADD COLUMN IF NOT EXISTS \"value\" TEXT, ADD COLUMN IF NOT EXISTS \"stock\" INTEGER, ADD COLUMN IF NOT EXISTS \"sold\" INTEGER NOT NULL DEFAULT 0;",
  "CREATE TABLE IF NOT EXISTS \"live_signals\" (\n    \"userId\" TEXT NOT NULL,\n    \"seq\" BIGINT NOT NULL DEFAULT 0,\n    \"at\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    CONSTRAINT \"live_signals_pkey\" PRIMARY KEY (\"userId\")\n);",
  "CREATE TABLE IF NOT EXISTS \"chat_prefs\" (\n    \"userId\" TEXT NOT NULL,\n    \"key\" TEXT NOT NULL,\n    \"archivedAt\" TIMESTAMP(3),\n    \"clearedAt\" TIMESTAMP(3),\n    \"updatedAt\" TIMESTAMP(3) NOT NULL,\n    CONSTRAINT \"chat_prefs_pkey\" PRIMARY KEY (\"userId\", \"key\")\n);",
  "DO $$ BEGIN ALTER TABLE \"chat_prefs\" ADD CONSTRAINT \"chat_prefs_userId_fkey\" FOREIGN KEY (\"userId\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;",
  "CREATE TABLE IF NOT EXISTS \"user_blocks\" (\n    \"blockerId\" TEXT NOT NULL,\n    \"blockedId\" TEXT NOT NULL,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    CONSTRAINT \"user_blocks_pkey\" PRIMARY KEY (\"blockerId\", \"blockedId\")\n);",
  "CREATE INDEX IF NOT EXISTS \"user_blocks_blockedId_idx\" ON \"user_blocks\"(\"blockedId\");",
  "DO $$ BEGIN ALTER TABLE \"user_blocks\" ADD CONSTRAINT \"user_blocks_blockerId_fkey\" FOREIGN KEY (\"blockerId\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;",
  "DO $$ BEGIN ALTER TABLE \"user_blocks\" ADD CONSTRAINT \"user_blocks_blockedId_fkey\" FOREIGN KEY (\"blockedId\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;",
  "CREATE TABLE IF NOT EXISTS \"sticker_images\" (\n    \"hash\" TEXT NOT NULL,\n    \"imageUrl\" TEXT NOT NULL,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    CONSTRAINT \"sticker_images_pkey\" PRIMARY KEY (\"hash\")\n);",
  "CREATE TABLE IF NOT EXISTS \"stickers\" (\n    \"id\" TEXT NOT NULL,\n    \"ownerId\" TEXT NOT NULL,\n    \"hash\" TEXT NOT NULL,\n    \"authorId\" TEXT,\n    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,\n    CONSTRAINT \"stickers_pkey\" PRIMARY KEY (\"id\")\n);",
  "CREATE UNIQUE INDEX IF NOT EXISTS \"stickers_ownerId_hash_key\" ON \"stickers\"(\"ownerId\", \"hash\");",
  "DO $$ BEGIN ALTER TABLE \"stickers\" ADD CONSTRAINT \"stickers_ownerId_fkey\" FOREIGN KEY (\"ownerId\") REFERENCES \"users\"(\"id\") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;",
  "DO $$ BEGIN ALTER TABLE \"stickers\" ADD CONSTRAINT \"stickers_hash_fkey\" FOREIGN KEY (\"hash\") REFERENCES \"sticker_images\"(\"hash\") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;",
];

// Idempotent mirror of prisma/migrations/20261010120000_enable_rls_lockdown.
export const RLS_LOCKDOWN_SQL = `DO $$
DECLARE
  t record;
  r text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;`;
