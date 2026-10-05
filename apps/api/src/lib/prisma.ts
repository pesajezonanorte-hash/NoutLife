import { PrismaClient } from '@prisma/client';
import { REMOVE_LEGACY_HABIT_RITUAL_FLAG_SQL } from './schema-migrations';
import { ensureDefaultCatalog } from './default-catalog';

function getDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || '';
  if (url.includes('.supabase.co') || url.includes('.pooler.supabase.com')) {
    const refMatch = url.match(/db\.([a-z0-9]+)\.supabase\.co/) || url.match(/postgres\.([a-z0-9]+):/);
    const ref = refMatch ? refMatch[1] : 'dkgjvvypliyfxdmbbnwt';

    url = url.replace(/db\.[a-z0-9]+\.supabase\.co:?\d*/g, 'aws-0-us-east-1.pooler.supabase.com:6543');
    if (ref && !url.includes(`postgres.${ref}`)) {
      url = url.replace(/postgres:/g, `postgres.${ref}:`);
    }
    if (!url.includes('pgbouncer=true')) {
      url += (url.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
  }
  return url;
}

const dbUrl = getDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

let migrationPromise: Promise<void> | null = null;

export function ensureDbMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleAccessToken" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleRefreshToken" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleTokenExpiresAt" TIMESTAMP(3);`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT DEFAULT 'primary';`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleCalendarSyncEnabled" BOOLEAN NOT NULL DEFAULT false;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "googleCalendarLastSyncAt" TIMESTAMP(3);`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "agenda_events" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;`);
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "agenda_events_googleEventId_key" ON "agenda_events"("googleEventId");`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "syncToGoogleCalendar" BOOLEAN NOT NULL DEFAULT false;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "googleCalendarEventId" TEXT;`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "agenda_events" ADD COLUMN IF NOT EXISTS "googleSeriesId" TEXT;`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "agenda_events_userId_googleSeriesId_idx" ON "agenda_events"("userId", "googleSeriesId");`);

        // Keep only the first historical completion per ritual calendar day
        // before adding the idempotency key. Existing duplicate reward rows
        // were created by the old non-atomic endpoint, so compensate their
        // fixed +30 XP / +5 gold reward as the duplicate logs are removed.
        await prisma.$executeRawUnsafe(`
          WITH ranked_logs AS (
            SELECT "id", "userId",
              ROW_NUMBER() OVER (
                PARTITION BY "ritualId", "date"
                ORDER BY "completedAt" ASC, "id" ASC
              ) AS row_number
            FROM "ritual_logs"
          ),
          removed_logs AS (
            DELETE FROM "ritual_logs" AS logs
            USING ranked_logs
            WHERE logs."id" = ranked_logs."id" AND ranked_logs.row_number > 1
            RETURNING logs."userId"
          ),
          adjustments AS (
            SELECT "userId", COUNT(*)::integer AS duplicate_count
            FROM removed_logs
            GROUP BY "userId"
          )
          UPDATE "users" AS users
          SET "xp" = GREATEST(0, users."xp" - adjustments.duplicate_count * 30),
              "gold" = GREATEST(0, users."gold" - adjustments.duplicate_count * 5)
          FROM adjustments
          WHERE users."id" = adjustments."userId";
        `);
        await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ritual_logs_ritualId_date_key" ON "ritual_logs"("ritualId", "date");`);
        await prisma.$executeRawUnsafe(REMOVE_LEGACY_HABIT_RITUAL_FLAG_SQL);
        await prisma.$executeRawUnsafe(`ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;`);

        // Global catalog rows are not player-owned. Bootstrap missing entries on
        // cold production databases so Shop and Achievements never render as a
        // successful-but-empty page after account cleanup or a fresh deploy.
        await ensureDefaultCatalog(prisma);
      } catch (err) {
        console.error('Runtime DB migration error:', err);
      }
    })();
  }
  return migrationPromise;
}

