-- System A represented rituals as a flag on a normal habit. System B is now the
-- single ritual model (rituals, ritual_steps and ritual_logs). Refuse to erase
-- any remaining legacy classification instead of silently dropping it: clear or
-- migrate those records deliberately, then rerun this migration.
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
