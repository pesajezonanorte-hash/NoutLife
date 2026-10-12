-- Nequi como medio de pago: tipo de la fuente guardada ('CARD' | 'NEQUI').
-- Las cuentas anteriores quedan en NULL y se leen como tarjeta.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "paymentMethodType" TEXT;
