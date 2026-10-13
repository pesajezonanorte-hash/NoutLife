import { createHash, createHmac } from 'crypto';

export const emailKey = (email: string): string => email.trim().toLowerCase();

/**
 * `public_data` de una fuente de pago, tal como la devuelve Wompi (GET /payment_sources/:id).
 * Tarjeta en producción (12-10-2026): bin, last_four, card_holder, validity_ends_at y type.
 * Wompi no manda exp_month ni exp_year. Nequi: type y phone_number.
 */
export interface PaymentPublicData {
  type?: string;
  bin?: string;
  last_four?: string;
  card_holder?: string;
  validity_ends_at?: string;
  /** Solo en respuestas de otros ambientes o versiones: la huella no los usa. */
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
 *  - Tarjeta: SHA-256 de BIN (6) + últimos 4: lo único estable que Wompi entrega.
 *    El titular se escribe a mano y Wompi no manda el vencimiento
 *    (validity_ends_at no está documentado, así que no entra). No revela el número completo.
 *  - Nequi: HMAC de celular (el de Wompi) + cédula, con un secreto del servidor.
 *    Celular y cédula tienen pocos dígitos: con un SHA-256 plano, una tabla
 *    filtrada se revierte en segundos. Sin el secreto, la huella no sirve.
 */
export function paymentKey(data: PaymentPublicData, proof: NequiProof | null = null): string | null {
  if (data.type === 'CARD') {
    const bin = (data.bin ?? '').replace(/\D/g, '').slice(0, 6);
    const lastFour = (data.last_four ?? '').replace(/\D/g, '');
    if (bin.length !== 6 || lastFour.length !== 4) return null;
    return createHash('sha256').update(`CARD|${bin}|${lastFour}`).digest('hex');
  }
  if (data.type === 'NEQUI') {
    const phone = nequiPhone(data.phone_number);
    if (!phone || !proof?.documentNumber || !proof.secret) return null;
    return createHmac('sha256', proof.secret).update(`NEQUI|${phone}|${proof.documentNumber}`).digest('hex');
  }
  return null;
}

/** Para los logs: qué campos trajo `public_data` y con qué forma (letras → a, dígitos → 9), nunca sus valores. */
export function publicDataShape(data: PaymentPublicData): Record<string, string> {
  return Object.fromEntries(Object.entries(data).map(([field, value]) => [
    field,
    field === 'type' ? String(value) : String(value ?? '').replace(/\p{L}/gu, 'a').replace(/\d/g, '9'),
  ]));
}
