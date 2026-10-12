-- Prueba gratis: huella del medio de pago calculada en el servidor con datos de Wompi.
-- Única: dos cuentas no pueden empezar la prueba con el mismo medio de pago, ni siquiera a la vez.
-- "paymentKeys" (huellas armadas con datos del navegador) queda sin uso; no se borra para no
-- romper las instancias del despliegue anterior mientras el nuevo arranca.
ALTER TABLE "used_trials" ADD COLUMN IF NOT EXISTS "paymentKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "used_trials_paymentKey_key" ON "used_trials"("paymentKey");
