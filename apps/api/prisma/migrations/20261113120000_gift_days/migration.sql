-- Total de días de la prueba de regalo (lo que se concedió). NULL = cuentas regaladas antes.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "giftDays" INTEGER;
