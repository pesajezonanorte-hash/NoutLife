import axios from 'axios';
import type { Subscription } from '@noutlife/shared';
import api from '../lib/api';

export interface BillingConfig {
  /** false si la API no tiene llaves de Wompi: la app sigue funcionando sin cobros. */
  enabled: boolean;
  publicKey: string | null;
  /** URL base de la API de Wompi (sandbox o producción). */
  apiUrl: string;
  sandbox: boolean;
  priceCop: number;
  trialDays: number;
  liteLimits: { activeHabits: number; historyDays: number };
  /** Contratos de Wompi que la persona acepta antes de vincular su método de pago. */
  termsUrl: string | null;
  personalDataUrl: string | null;
}

export interface BillingPayment {
  id: string;
  amountInCents: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

/**
 * Token de Wompi. Es lo único que va a la API: la huella anti-abuso (BIN,
 * últimos 4, vencimiento) la lee el servidor directo en Wompi. `brand` es solo
 * para la etiqueta.
 */
export interface CardToken {
  token: string;
  brand?: string;
}

let configPromise: Promise<BillingConfig> | null = null;

export function getBillingConfig(): Promise<BillingConfig> {
  configPromise ??= api.get<BillingConfig>('/billing/config').then((r) => r.data).catch((error) => {
    configPromise = null; // reintenta la próxima vez
    throw error;
  });
  return configPromise;
}

export async function getBillingStatus(): Promise<{ subscription: Subscription; payments: BillingPayment[] }> {
  const { data } = await api.get<{ subscription: Subscription; payments: BillingPayment[] }>('/billing/status');
  return data;
}

export async function savePaymentMethod(body: CardToken): Promise<Subscription> {
  const { data } = await api.post<{ subscription: Subscription }>('/billing/payment-method', { ...body, acceptTerms: true, acceptPersonalData: true });
  return data.subscription;
}

export async function subscribe(): Promise<Subscription> {
  const { data } = await api.post<{ subscription: Subscription }>('/billing/subscribe');
  return data.subscription;
}

export async function cancelSubscription(): Promise<Subscription> {
  const { data } = await api.post<{ subscription: Subscription }>('/billing/cancel');
  return data.subscription;
}

export async function resumeSubscription(): Promise<Subscription> {
  const { data } = await api.post<{ subscription: Subscription }>('/billing/resume');
  return data.subscription;
}

export interface CardInput {
  number: string;
  /** MM */
  expMonth: string;
  /** AA */
  expYear: string;
  cvc: string;
  holder: string;
}

export class CardError extends Error {
  constructor(message: string, readonly field?: keyof CardInput) {
    super(message);
  }
}

const WOMPI_FIELDS: Record<string, keyof CardInput> = {
  number: 'number', cvc: 'cvc', exp_month: 'expMonth', exp_year: 'expYear', card_holder: 'holder',
};

/**
 * Tokeniza la tarjeta directo con Wompi usando la llave pública. Va con axios
 * «limpio» a propósito: la instancia `api` añadiría el token de sesión de
 * NoutLife a una petición de otro dominio. El número nunca pasa por la API.
 */
export async function tokenizeCard(config: BillingConfig, card: CardInput): Promise<CardToken> {
  if (!config.publicKey) throw new CardError('Los pagos no están disponibles en este momento.');
  try {
    const { data } = await axios.post<{ data: { id: string; brand?: string } }>(
      `${config.apiUrl}/tokens/cards`,
      {
        number: card.number.replace(/\D/g, ''),
        cvc: card.cvc,
        exp_month: card.expMonth,
        exp_year: card.expYear,
        card_holder: card.holder.trim(),
      },
      { headers: { Authorization: `Bearer ${config.publicKey}` }, timeout: 20_000 },
    );
    return { token: data.data.id, brand: data.data.brand };
  } catch (error) {
    const messages = (error as { response?: { data?: { error?: { messages?: Record<string, string[]> } } } }).response?.data?.error?.messages;
    const field = messages ? Object.keys(messages).map((k) => WOMPI_FIELDS[k]).find(Boolean) : undefined;
    if (field) throw new CardError('Wompi no aceptó este dato. Revísalo.', field);
    if ((error as { response?: unknown }).response) throw new CardError('Wompi no pudo validar la tarjeta. Revisa los datos.');
    throw new CardError('No pudimos conectar con Wompi. Revisa tu conexión e inténtalo de nuevo.');
  }
}

/** Algoritmo de Luhn: descarta números mal escritos antes de enviarlos. */
export function isValidCardNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
