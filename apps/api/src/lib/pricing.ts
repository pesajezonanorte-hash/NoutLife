/**
 * Mercados de precio de NoutLife Pro. Colombia paga la lista en pesos de siempre (lib/plans). Fuera de
 * Colombia se muestra una lista en dólares, pero Wompi cobra solo en COP: cada cobro en USD se convierte a
 * pesos con la TRM del día del cobro (lib/fx) y el banco de la persona lo pasa de nuevo a su moneda.
 *
 * El mercado se fija al crear la cuenta por la zona horaria del dispositivo (la misma regla con que la
 * portada elige qué precios mostrar) y no cambia solo: el precio de quien ya paga no depende de un viaje.
 * Las cuentas anteriores a los mercados son 'CO' (valor por defecto de la columna).
 */
import { PRO_ANNUAL_PRICE_COP, PRO_PRICE_COP, type BillingInterval } from './plans';

export type Market = 'CO' | 'INTL';
export type PriceCurrency = 'COP' | 'USD';

/** Pro en dólares: $4,99 al mes o $39,99 al año (33 % menos que 12 meses: casi 4 meses gratis). Igual que la web (lib/plan). */
export const PRO_PRICE_USD_CENTS = 499;
export const PRO_ANNUAL_PRICE_USD_CENTS = 3999;

export interface PriceList {
  market: Market;
  currency: PriceCurrency;
  /** Centavos de la moneda (COP: pesos × 100, como amount_in_cents de Wompi). */
  monthInCents: number;
  yearInCents: number;
}

export const PRICE_LISTS: Record<Market, PriceList> = {
  CO: { market: 'CO', currency: 'COP', monthInCents: PRO_PRICE_COP * 100, yearInCents: PRO_ANNUAL_PRICE_COP * 100 },
  INTL: { market: 'INTL', currency: 'USD', monthInCents: PRO_PRICE_USD_CENTS, yearInCents: PRO_ANNUAL_PRICE_USD_CENTS },
};

/** Mercado guardado; cualquier valor desconocido (o una cuenta anterior) es Colombia. */
export function marketOf(value: string | null | undefined): Market {
  return value === 'INTL' ? 'INTL' : 'CO';
}

/** Colombia tiene una sola zona horaria IANA. */
export const COLOMBIA_TIMEZONE = 'America/Bogota';

/** Zona horaria IANA válida (la que da el navegador), o null. */
export function validTimezone(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > 64) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** Mercado de una cuenta nueva por la zona del dispositivo. Sin zona válida (clientes anteriores), Colombia. */
export function marketForTimezone(timezone: string | null | undefined): Market {
  const zone = validTimezone(timezone);
  return !zone || zone === COLOMBIA_TIMEZONE ? 'CO' : 'INTL';
}

/** Precio de lista de un periodo, en centavos de la moneda del mercado. */
export function listInCentsFor(market: Market, interval: BillingInterval): number {
  const list = PRICE_LISTS[market];
  return interval === 'year' ? list.yearInCents : list.monthInCents;
}

/** Centavos por unidad que se cobra: el COP se redondea a pesos enteros; el USD, a centavos. */
export const roundingUnitOf = (currency: PriceCurrency) => (currency === 'COP' ? 100 : 1);
