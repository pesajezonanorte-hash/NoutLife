import axios from 'axios';
import type { BillingInterval, CreatorCodeInfo, Subscription } from '@noutlife/shared';
import api from '../lib/api';
import type { PlanPreview } from '@/lib/planPreview';
import { track } from '@/lib/analytics';

export interface BillingConfig {
  /** false si la API no tiene llaves de Wompi: la app sigue funcionando sin cobros. */
  enabled: boolean;
  /** Nequi solo se ofrece si la API tiene configurada la huella anti-abuso. */
  nequiEnabled: boolean;
  publicKey: string | null;
  /** URL base de la API de Wompi (sandbox o producción). */
  apiUrl: string;
  sandbox: boolean;
  priceCop: number;
  /** Ausente en APIs sin plan anual. */
  annualPriceCop?: number;
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
  /** Mensual o anual. Ausente en APIs anteriores (mensual). */
  interval?: BillingInterval;
  /** Descuento del código de creador en este cobro. */
  discountInCents?: number;
}

/**
 * Medio de pago que va a la API. Solo viajan tokens: la huella anti-abuso la
 * lee el servidor directo en Wompi. Con Nequi viaja además la cédula, que solo
 * entra en la huella y nunca se guarda en texto plano.
 */
export type PaymentMethodLink =
  /** Token de la tarjeta (tok_…). `brand` es solo para la etiqueta. */
  | { method: 'CARD'; token: string; brand?: string }
  /** Token de Nequi (nequi_…) ya aprobado en la app, y la cédula de la persona. */
  | { method: 'NEQUI'; nequiToken: string; documentNumber: string };

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

/** Vincula el medio de pago. `interval` deja elegido el plan del próximo cobro (fin de la prueba o renovación). */
export async function savePaymentMethod(link: PaymentMethodLink, interval?: BillingInterval): Promise<Subscription> {
  const { data } = await api.post<{ subscription: Subscription }>('/billing/payment-method', {
    ...link, acceptTerms: true, acceptPersonalData: true, ...(interval ? { interval } : {}),
  });
  return data.subscription;
}

/** Activa Pro con el plan elegido. Desde Lite cobra hoy el primer periodo; en prueba o con periodo pagado no cobra. */
export async function subscribe(interval?: BillingInterval): Promise<Subscription> {
  const { data } = await api.post<{ subscription: Subscription }>('/billing/subscribe', interval ? { interval } : {});
  const sub = data.subscription;
  if (sub.plan === 'pro' && !sub.pendingPayment && sub.status === 'active') {
    track('subscription_activated', { interval: sub.interval ?? 'month', with_code: Boolean(sub.creatorCode) });
  }
  return sub;
}

/** Cambia el plan del próximo cobro (mensual o anual). No cobra nada hoy. */
export async function setBillingInterval(interval: BillingInterval): Promise<Subscription> {
  const { data } = await api.put<{ subscription: Subscription }>('/billing/interval', { interval });
  track('plan_interval_changed', { interval });
  return data.subscription;
}

/** Creador y descuento de un código activo, sin aplicarlo (404 si no existe o está inactivo). */
export async function lookupCreatorCode(code: string): Promise<CreatorCodeInfo> {
  const { data } = await api.get<{ creatorCode: CreatorCodeInfo }>(`/billing/creator-codes/${encodeURIComponent(code.trim())}`);
  return data.creatorCode;
}

/** «¿Tienes un código de creador?»: lo valida y lo deja en la cuenta para el primer pago. */
export async function applyCreatorCode(code: string): Promise<Subscription> {
  const { data } = await api.put<{ subscription: Subscription }>('/billing/creator-code', { code });
  track('creator_code_applied', { code: data.subscription.creatorCode?.code ?? null });
  return data.subscription;
}

export async function removeCreatorCode(): Promise<Subscription> {
  const { data } = await api.delete<{ subscription: Subscription }>('/billing/creator-code');
  return data.subscription;
}

export async function cancelSubscription(): Promise<Subscription> {
  const { data } = await api.post<{ subscription: Subscription }>('/billing/cancel');
  return data.subscription;
}

/** Estado de la suscripción sin consultar a Wompi: lo lee el aviso de Nequi cada 5 s. */
export async function getSubscriptionState(): Promise<Subscription> {
  const { data } = await api.get<Subscription>('/billing/subscription');
  return data;
}

/** «Ya lo aprobé»: la API consulta el cobro en Wompi y devuelve el estado ya aplicado. */
export async function refreshPendingApproval(): Promise<Subscription> {
  const { data } = await api.post<Subscription>('/billing/pending/refresh');
  return data;
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

/** Campos del formulario de pago que pueden tener un error. */
export type PaymentField = 'number' | 'expiry' | 'cvc' | 'holder' | 'phone' | 'documentNumber';

/** Error apto para mostrar. `field` indica el campo que hay que corregir. */
export class PaymentError extends Error {
  constructor(message: string, readonly field?: PaymentField) {
    super(message);
  }
}

const WOMPI_CARD_FIELDS: Record<string, PaymentField> = {
  number: 'number', cvc: 'cvc', exp_month: 'expiry', exp_year: 'expiry', card_holder: 'holder',
};

/** Mensajes de validación de Wompi, por campo. */
function wompiMessages(error: unknown): Record<string, string[]> | undefined {
  return (error as { response?: { data?: { error?: { messages?: Record<string, string[]> } } } }).response?.data?.error?.messages;
}

const hasResponse = (error: unknown) => Boolean((error as { response?: unknown }).response);

/**
 * Tokeniza la tarjeta directo con Wompi usando la llave pública. Va con axios
 * «limpio» a propósito: la instancia `api` añadiría el token de sesión de
 * NoutLife a una petición de otro dominio. El número nunca pasa por la API.
 */
export async function tokenizeCard(config: BillingConfig, card: CardInput): Promise<PaymentMethodLink> {
  if (!config.publicKey) throw new PaymentError('Los pagos no están disponibles en este momento.');
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
    return { method: 'CARD', token: data.data.id, brand: data.data.brand };
  } catch (error) {
    const messages = wompiMessages(error);
    const field = messages ? Object.keys(messages).map((k) => WOMPI_CARD_FIELDS[k]).find(Boolean) : undefined;
    if (field) throw new PaymentError('Wompi no aceptó este dato. Revísalo.', field);
    if (hasResponse(error)) throw new PaymentError('Wompi no pudo validar la tarjeta. Revisa los datos.');
    throw new PaymentError('No pudimos conectar con Wompi. Revisa tu conexión e inténtalo de nuevo.');
  }
}

/** Ventana para aprobar la vinculación en la app de Nequi. */
export const NEQUI_APPROVAL_MS = 2 * 60_000;
const NEQUI_POLL_MS = 2_500;
/** Estados con los que Wompi cierra la vinculación sin aprobación. */
const NEQUI_FAILED = new Set(['DECLINED', 'ERROR', 'VOIDED', 'REJECTED', 'EXPIRED']);

/** Token de Nequi tal como lo devuelve Wompi: con el envoltorio `data` o sin él. */
interface NequiToken { id?: string; status?: string }
type NequiTokenResponse = NequiToken | { data: NequiToken };
const tokenOf = (body: NequiTokenResponse): NequiToken => ('data' in body ? body.data : body);

/** Pide a Wompi vincular el celular. Wompi manda la aprobación a la app de Nequi de la persona. */
export async function tokenizeNequi(config: BillingConfig, phone: string): Promise<string> {
  if (!config.publicKey) throw new PaymentError('Los pagos no están disponibles en este momento.');
  const body = await axios
    .post<NequiTokenResponse>(
      `${config.apiUrl}/tokens/nequi`,
      { phone_number: phone },
      { headers: { Authorization: `Bearer ${config.publicKey}` }, timeout: 20_000 },
    )
    .then((r) => r.data)
    .catch((error: unknown): never => {
      if (wompiMessages(error)?.phone_number) throw new PaymentError('Wompi no aceptó este celular. Revísalo.', 'phone');
      if (hasResponse(error)) throw new PaymentError('Wompi no pudo iniciar la vinculación con Nequi. Revisa el celular.', 'phone');
      throw new PaymentError('No pudimos conectar con Wompi. Revisa tu conexión e inténtalo de nuevo.');
    });
  const id = tokenOf(body).id;
  if (!id) throw new PaymentError('Wompi no devolvió la vinculación con Nequi. Inténtalo de nuevo.');
  return id;
}

/**
 * Espera a que la persona apruebe la vinculación en su app de Nequi. `stop`
 * cancela la espera (la persona salió del formulario).
 */
export async function waitForNequiApproval(config: BillingConfig, tokenId: string, stop: () => boolean): Promise<void> {
  const deadline = Date.now() + NEQUI_APPROVAL_MS;
  let failures = 0;
  while (Date.now() < deadline) {
    if (stop()) throw new PaymentError('La vinculación se canceló.');
    let status: string | undefined;
    try {
      const { data } = await axios.get<NequiTokenResponse>(
        `${config.apiUrl}/tokens/nequi/${encodeURIComponent(tokenId)}`,
        { headers: { Authorization: `Bearer ${config.publicKey}` }, timeout: 10_000 },
      );
      status = tokenOf(data).status;
      failures = 0;
    } catch {
      // Un corte de red puntual no cancela la espera: solo tres fallos seguidos.
      failures += 1;
      if (failures >= 3) throw new PaymentError('No pudimos confirmar tu aprobación en Nequi. Revisa tu conexión e inténtalo de nuevo.');
    }
    if (status === 'APPROVED') return;
    // Un estado de fallo corta; cualquier otro (PENDING u otro intermedio) sigue esperando hasta el plazo.
    if (status && NEQUI_FAILED.has(status)) throw new PaymentError('Nequi no aprobó la vinculación. Inténtalo de nuevo.');
    await new Promise((resolve) => setTimeout(resolve, NEQUI_POLL_MS));
  }
  throw new PaymentError('No recibimos tu aprobación en Nequi a tiempo. Inténtalo de nuevo.');
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

/** Qué cambia al pasar a Lite con tus datos reales (aviso de días 5 y 6 y diálogo de Pro). */
export async function getPlanPreview(): Promise<PlanPreview> {
  const { data } = await api.get<PlanPreview>('/billing/preview');
  return data;
}
