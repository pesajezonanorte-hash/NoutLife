import { prisma } from './lib/prisma';

async function migrate() {
  console.log('Running database schema updates...');
  
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

  // Historical versions allowed duplicate ritual logs. Deduplicate before the
  // unique key and compensate the fixed reward given by that old endpoint.
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

  console.log('SUCCESS: Runtime database columns, indexes and ritual idempotency key applied.');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
