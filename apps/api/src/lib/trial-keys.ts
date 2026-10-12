import { createHash } from 'crypto';

export const emailKey = (email: string): string => email.trim().toLowerCase();

/** `public_data` de una fuente de pago, tal como la devuelve Wompi (GET /payment_sources/:id). */
export interface PaymentPublicData {
  type?: string;
  bin?: string;
  last_four?: string;
  exp_month?: string;
  exp_year?: string;
  phone_number?: string;
}

/**
 * Huella del medio de pago con los datos que Wompi entrega al servidor, nunca
 * con los que manda el navegador. Tarjeta: BIN + últimos 4 + vencimiento (el
 * titular se escribe a mano, así que no cuenta). Nequi: el celular. null si
 * Wompi no trae esos datos.
 */
export function paymentKey(data: PaymentPublicData): string | null {
  let raw: string | null = null;
  if (data.type === 'CARD' && data.bin && data.last_four && data.exp_month && data.exp_year) {
    raw = `CARD|${data.bin.slice(0, 6)}|${data.last_four}|${data.exp_month.padStart(2, '0')}/${data.exp_year.slice(-2)}`;
  } else if (data.type === 'NEQUI' && data.phone_number) {
    raw = `NEQUI|${data.phone_number.replace(/\D/g, '').slice(-10)}`;
  }
  return raw && createHash('sha256').update(raw).digest('hex');
}
