/**
 * Espejo idempotente de prisma/migrations/20261105120000_markets_usd_pricing: mercado de precios de cada
 * cuenta (lista en pesos o en dólares) y el precio que vio la persona en cada cobro. migrate-db.ts lo corre
 * en cada build y prisma.ts en cada arranque en frío, así que cada sentencia puede repetirse.
 */

/**
 * Va primero en migrate-db.ts: este cliente de Prisma ya lee "market" en cualquier consulta de users sin
 * select. El valor por defecto deja todas las cuentas existentes en 'CO', con sus precios de siempre.
 */
export const MARKETS_USERS_SQL: string[] = [
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "market" TEXT NOT NULL DEFAULT 'CO'`,
];

/** Después de SUBSCRIPTIONS_SQL: subscription_payments ya existe. */
export const MARKETS_PAYMENTS_SQL: string[] = [
  `ALTER TABLE "subscription_payments" ADD COLUMN IF NOT EXISTS "priceCurrency" TEXT, ADD COLUMN IF NOT EXISTS "priceAmountInCents" INTEGER`,
];
