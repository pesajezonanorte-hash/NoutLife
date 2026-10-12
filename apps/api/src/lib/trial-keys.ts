import { createHash } from 'crypto';

export const emailKey = (email: string): string => email.trim().toLowerCase();

export interface CardFingerprintInput {
  bin: string;
  lastFour: string;
  expMonth: string;
  expYear: string;
  holder: string;
}

/** Huella de la tarjeta (BIN, últimos 4, vencimiento, titular). Nunca el número completo. */
export function cardKey(card: CardFingerprintInput): string {
  const holder = card.holder.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
  const exp = `${card.expMonth.padStart(2, '0')}/${card.expYear.slice(-2)}`;
  return createHash('sha256').update(`${card.bin}|${card.lastFour}|${exp}|${holder}`).digest('hex');
}
