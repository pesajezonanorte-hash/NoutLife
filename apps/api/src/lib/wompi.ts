import { createHash, timingSafeEqual } from 'crypto';

/**
 * Cliente mínimo de la API de Wompi (Colombia). Docs: https://docs.wompi.co
 *
 * La tarjeta se tokeniza en el navegador con la llave pública (POST /tokens/cards):
 * el número nunca llega a este servidor. Aquí solo se usan la llave privada
 * (fuentes de pago y cobros), el secreto de integridad (firma de cada cobro)
 * y el secreto de eventos (firma de los webhooks).
 */

export class WompiError extends Error {
  constructor(message: string, readonly status?: number, readonly details?: unknown) {
    super(message);
    this.name = 'WompiError';
  }
}

export interface WompiConfig {
  publicKey: string | null;
  privateKey: string | null;
  integritySecret: string | null;
  eventsSecret: string | null;
  baseUrl: string;
  sandbox: boolean;
  /** Llaves suficientes para guardar tarjetas y cobrar. */
  configured: boolean;
}

export function wompiConfig(): WompiConfig {
  const read = (name: string) => process.env[name]?.trim() || null;
  const publicKey = read('WOMPI_PUBLIC_KEY');
  const privateKey = read('WOMPI_PRIVATE_KEY');
  const integritySecret = read('WOMPI_INTEGRITY_SECRET');
  const eventsSecret = read('WOMPI_EVENTS_SECRET');
  // Las llaves de pruebas empiezan por pub_test_ / prv_test_.
  const sandbox = (publicKey ?? privateKey ?? '').includes('_test_');
  const baseUrl = (read('WOMPI_API_URL') ?? (sandbox ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1')).replace(/\/+$/, '');
  return {
    publicKey, privateKey, integritySecret, eventsSecret, baseUrl, sandbox,
    configured: Boolean(publicKey && privateKey && integritySecret),
  };
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Firma de integridad de un cobro: SHA-256 de referencia + monto en centavos + moneda + secreto. */
export function integritySignature(reference: string, amountInCents: number, currency: string, secret: string): string {
  return sha256(`${reference}${amountInCents}${currency}${secret}`);
}

export interface WompiEvent {
  event?: string;
  data?: Record<string, unknown>;
  environment?: string;
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number | string;
  sent_at?: string;
}

/**
 * Checksum de un evento: valores de `signature.properties` (rutas dentro de
 * `data`, en ese orden) + `timestamp` + secreto de eventos, en SHA-256. Las
 * propiedades se leen de cada evento: Wompi puede cambiarlas.
 */
export function eventChecksum(event: WompiEvent, secret: string): string {
  const values = (event.signature?.properties ?? []).map((path) => {
    const value = path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), event.data);
    return value === undefined || value === null ? '' : String(value);
  });
  return sha256(`${values.join('')}${event.timestamp ?? ''}${secret}`);
}

export function verifyEventChecksum(event: WompiEvent, secret: string, received?: string | null): boolean {
  const given = (received ?? event.signature?.checksum ?? '').trim().toLowerCase();
  if (!given || !event.signature?.properties?.length) return false;
  const expected = eventChecksum(event, secret);
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function errorMessage(json: unknown): string | null {
  const error = (json as { error?: { reason?: string; type?: string; messages?: Record<string, string[]> } } | null)?.error;
  if (!error) return null;
  if (error.reason) return error.reason;
  if (error.messages) return Object.entries(error.messages).map(([field, list]) => `${field}: ${list.join(', ')}`).join('; ');
  return error.type ?? null;
}

async function request<T>(path: string, init: { method?: 'GET' | 'POST'; key?: string | null; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const { baseUrl } = wompiConfig();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.key ? { Authorization: `Bearer ${init.key}` } : {}),
        ...init.headers,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new WompiError(`No se pudo contactar a Wompi: ${(err as Error).message}`);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new WompiError(errorMessage(json) ?? `Wompi respondió HTTP ${res.status}`, res.status, json);
  return json as T;
}

export interface MerchantAcceptance {
  /** Token de la política de privacidad (acceptance_token). */
  acceptanceToken: string;
  /** Token de la autorización de datos personales (accept_personal_auth). */
  personalAuthToken: string | null;
  termsUrl: string | null;
  personalDataUrl: string | null;
}

interface MerchantResponse {
  data: {
    presigned_acceptance?: { acceptance_token: string; permalink?: string };
    presigned_personal_data_auth?: { acceptance_token: string; permalink?: string };
  };
}

let acceptanceCache: { at: number; value: MerchantAcceptance } | null = null;
const ACCEPTANCE_TTL_MS = 10 * 60_000;

/**
 * Contratos que la persona acepta antes de guardar su tarjeta. Usa
 * GET /merchants/info (el endpoint /merchants/:llave se retira el 31-10-2026)
 * y solo cae al antiguo si el nuevo no existe en ese ambiente.
 */
export async function getAcceptance(options: { fresh?: boolean } = {}): Promise<MerchantAcceptance> {
  if (!options.fresh && acceptanceCache && Date.now() - acceptanceCache.at < ACCEPTANCE_TTL_MS) return acceptanceCache.value;
  const { publicKey } = wompiConfig();
  if (!publicKey) throw new WompiError('Falta WOMPI_PUBLIC_KEY.');

  let merchant: MerchantResponse;
  try {
    merchant = await request<MerchantResponse>('/merchants/info', { headers: { 'x-merchant-public-key': publicKey } });
  } catch (err) {
    if (!(err instanceof WompiError) || err.status !== 404) throw err;
    merchant = await request<MerchantResponse>(`/merchants/${encodeURIComponent(publicKey)}`);
  }

  const terms = merchant.data.presigned_acceptance;
  if (!terms?.acceptance_token) throw new WompiError('Wompi no devolvió el token de aceptación.');
  const personal = merchant.data.presigned_personal_data_auth;
  const value: MerchantAcceptance = {
    acceptanceToken: terms.acceptance_token,
    personalAuthToken: personal?.acceptance_token ?? null,
    termsUrl: terms.permalink ?? null,
    personalDataUrl: personal?.permalink ?? null,
  };
  acceptanceCache = { at: Date.now(), value };
  return value;
}

/** Guarda la tarjeta tokenizada como fuente de pago reutilizable (sin cobrar nada). */
export async function createPaymentSource(input: { token: string; customerEmail: string; acceptance: MerchantAcceptance }): Promise<{ id: string; status: string }> {
  const { privateKey } = wompiConfig();
  const { data } = await request<{ data: { id: number | string; status: string } }>('/payment_sources', {
    method: 'POST',
    key: privateKey,
    body: {
      type: 'CARD',
      token: input.token,
      customer_email: input.customerEmail,
      acceptance_token: input.acceptance.acceptanceToken,
      ...(input.acceptance.personalAuthToken ? { accept_personal_auth: input.acceptance.personalAuthToken } : {}),
    },
  });
  return { id: String(data.id), status: data.status };
}

export interface WompiTransaction {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | string;
  statusMessage: string | null;
  reference: string;
  amountInCents: number;
  currency: string;
}

interface TransactionResponse {
  data: { id: string; status: string; status_message?: string | null; reference: string; amount_in_cents: number; currency: string };
}

const toTransaction = ({ data }: TransactionResponse): WompiTransaction => ({
  id: String(data.id),
  status: data.status,
  statusMessage: data.status_message ?? null,
  reference: data.reference,
  amountInCents: data.amount_in_cents,
  currency: data.currency,
});

/** Cobra a una fuente de pago guardada. `recurrent` marca el cobro periódico (COF) en VISA/Mastercard. */
export async function createTransaction(input: { paymentSourceId: string; reference: string; amountInCents: number; currency: string; customerEmail: string }): Promise<WompiTransaction> {
  const { privateKey, integritySecret } = wompiConfig();
  if (!integritySecret) throw new WompiError('Falta WOMPI_INTEGRITY_SECRET.');
  const sourceId = /^\d+$/.test(input.paymentSourceId) ? Number(input.paymentSourceId) : input.paymentSourceId;
  return toTransaction(await request<TransactionResponse>('/transactions', {
    method: 'POST',
    key: privateKey,
    body: {
      amount_in_cents: input.amountInCents,
      currency: input.currency,
      signature: integritySignature(input.reference, input.amountInCents, input.currency, integritySecret),
      customer_email: input.customerEmail,
      payment_method: { installments: 1 },
      reference: input.reference,
      payment_source_id: sourceId,
      recurrent: true,
    },
  }));
}

export async function getTransaction(id: string): Promise<WompiTransaction> {
  const { privateKey } = wompiConfig();
  return toTransaction(await request<TransactionResponse>(`/transactions/${encodeURIComponent(id)}`, { key: privateKey }));
}
