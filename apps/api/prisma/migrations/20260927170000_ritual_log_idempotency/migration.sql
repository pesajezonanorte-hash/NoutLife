-- Historical versions of the ritual endpoint inserted a row and awarded rewards
-- in separate operations. Keep the earliest completion for each ritual/day and
-- reverse the fixed duplicate reward before enforcing the database invariant.
-- The guard keeps this migration safe for legacy databases that are initialized
-- through prisma db push rather than the older, incomplete migration history.
DO $$
BEGIN
  IF to_regclass('public.ritual_logs') IS NOT NULL THEN
    EXECUTE $dedupe$
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
      WHERE users."id" = adjustments."userId"
    $dedupe$;

    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "ritual_logs_ritualId_date_key" ON "ritual_logs"("ritualId", "date")';
  END IF;
END $$;
