-- used_trials es un registro permanente: la base rechaza DELETE y TRUNCATE.
-- Borrar o reiniciar una cuenta nunca devuelve la prueba gratis. Idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'used_trials_is_permanent' AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE FUNCTION public.used_trials_is_permanent() RETURNS trigger
    LANGUAGE plpgsql SET search_path = '' AS $fn$
    BEGIN
      RAISE EXCEPTION 'used_trials es un registro permanente: sus filas nunca se borran.';
    END;
    $fn$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'used_trials_no_delete' AND tgrelid = 'public.used_trials'::regclass
  ) THEN
    CREATE TRIGGER used_trials_no_delete BEFORE DELETE ON public.used_trials
      FOR EACH ROW EXECUTE FUNCTION public.used_trials_is_permanent();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'used_trials_no_truncate' AND tgrelid = 'public.used_trials'::regclass
  ) THEN
    CREATE TRIGGER used_trials_no_truncate BEFORE TRUNCATE ON public.used_trials
      FOR EACH STATEMENT EXECUTE FUNCTION public.used_trials_is_permanent();
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  -- Es un refuerzo: sin permisos para crearlo, el despliegue sigue (el código nunca borra la tabla).
  RAISE WARNING 'used_trials: no se pudo crear el bloqueo de borrado (%).', SQLERRM;
END $$;
