import { createHash, createHmac } from 'crypto';

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

/** Lo que aporta la persona para una prueba con Nequi: su cédula y el secreto del servidor. */
export interface NequiProof {
  documentNumber: string;
  secret: string;
}

/** Celular Nequi en 10 dígitos, sin indicativo ni espacios. null si no queda un número de 10 dígitos. */
export function nequiPhone(raw: string | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? digits : null;
}

/** Secreto de la huella de Nequi (TRIAL_FINGERPRINT_SECRET). Sin él no hay pruebas con Nequi. */
export const fingerprintSecret = (): string | null => process.env.TRIAL_FINGERPRINT_SECRET?.trim() || null;

/**
 * Huella del medio de pago con los datos que Wompi entrega al servidor, nunca
 * con los que manda el navegador. null si faltan datos: el servidor no concede la prueba.
 *
 *  - Tarjeta: SHA-256 de BIN + últimos 4 + vencimiento. El titular se escribe a
 *    mano, así que no cuenta. No revela el número completo.
 *  - Nequi: HMAC de celular (el de Wompi) + cédula, con un secreto del servidor.
 *    Celular y cédula tienen pocos dígitos: con un SHA-256 plano, una tabla
 *    filtrada se revierte en segundos. Sin el secreto, la huella no sirve.
 */
export function paymentKey(data: PaymentPublicData, proof: NequiProof | null = null): string | null {
  if (data.type === 'CARD') {
    if (!data.bin || !data.last_four || !data.exp_month || !data.exp_year) return null;
    const raw = `CARD|${data.bin.slice(0, 6)}|${data.last_four}|${data.exp_month.padStart(2, '0')}/${data.exp_year.slice(-2)}`;
    return createHash('sha256').update(raw).digest('hex');
  }
  if (data.type === 'NEQUI') {
    const phone = nequiPhone(data.phone_number);
    if (!phone || !proof?.documentNumber || !proof.secret) return null;
    return createHmac('sha256', proof.secret).update(`NEQUI|${phone}|${proof.documentNumber}`).digest('hex');
  }
  return null;
}
