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
