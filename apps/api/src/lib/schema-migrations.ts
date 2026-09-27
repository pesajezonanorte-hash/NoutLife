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
