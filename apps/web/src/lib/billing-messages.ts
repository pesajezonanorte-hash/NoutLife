// Mensajes de pagos que vienen de la API, que los escribe en español: errores (con su `code`) y el motivo
// del último cobro fallido (users.lastPaymentError, guardado como texto). En español se muestran tal cual;
// en inglés se traducen por código o por el texto conocido, y lo que no se conoce cae a un mensaje general
// en inglés (nunca a una frase en español en medio de la pantalla en inglés).
import type { Locale } from './locale';

/** Errores de la API de pagos (BillingError.code y los genéricos), en inglés. */
const EN_BY_CODE: Record<string, string> = {
  BILLING_DISABLED: 'Payments aren’t available right now. Your account keeps working as usual.',
  NEQUI_DISABLED: 'Nequi isn’t available right now.',
  CARD_REJECTED: 'We couldn’t link your payment method. Check the details and try again.',
  NEQUI_REJECTED: 'We couldn’t link your Nequi. Approve the request in your Nequi app and try again.',
  PAYMENT_METHOD_REQUIRED: 'Add a payment method to activate Pro.',
  COMPLIMENTARY: 'Your Pro is complimentary: there’s nothing to charge or change.',
  NOT_SUBSCRIBED: 'You don’t have an active subscription.',
  EXPIRED: 'Your Pro access has ended. Activate it again from Plan.',
  CREATOR_CODE_NOT_FOUND: 'That code doesn’t exist or is no longer active.',
  CREATOR_CODE_LOCKED: 'Creator codes apply to your first Pro payment only.',
  PAYMENT_PENDING: 'You have a charge in progress. Wait for it to be confirmed.',
  FX_UNAVAILABLE: 'Payments in US dollars are unavailable for a moment. Please try again in a few minutes.',
  NOT_FOUND: 'We couldn’t find your account. Sign in again.',
  BILLING_ERROR: 'We couldn’t complete the payment. Please try again.',
};

/** Motivos guardados del último cobro (billing.service de la API) → inglés. El detalle de Wompi entre paréntesis se conserva. */
const EN_BY_TEXT: Array<[string, string]> = [
  ['Tu banco rechazó el cobro.', 'Your bank declined the charge.'],
  ['El cobro fue anulado.', 'The charge was voided.'],
  ['No se pudo procesar el cobro.', 'The charge couldn’t be processed.'],
  ['Wompi no confirmó el cobro a tiempo.', 'Wompi didn’t confirm the charge in time.'],
  ['Wompi no confirmó el cobro.', 'Wompi didn’t confirm the charge.'],
  ['Este método de pago ya se usó en una prueba gratis.', 'This payment method was already used for a free trial.'],
  ['Ya usaste tu prueba gratis.', 'You’ve already used your free trial.'],
  ['No pudimos verificar este medio de pago para la prueba gratis. Puedes activar Pro o seguir en NoutLife Lite.', 'We couldn’t verify this payment method for the free trial. You can activate Pro or stay on NoutLife Lite.'],
  ['Los pagos no están disponibles en este momento.', 'Payments aren’t available right now.'],
];

/** Un motivo de cobro de la API en el idioma de la pantalla (null si no hay). */
export function localizeBillingMessage(message: string | null | undefined, locale: Locale): string | null {
  if (!message) return null;
  if (locale === 'es') return message;
  for (const [es, en] of EN_BY_TEXT) {
    if (message === es) return en;
    // «Tu banco rechazó el cobro. (Fondos insuficientes)»: se traduce la frase y se deja el detalle de Wompi.
    if (message.startsWith(`${es} (`)) return `${en}${message.slice(es.length)}`;
  }
  return null;
}

/**
 * El mensaje de un error de la API para mostrarlo: en español, el del servidor; en inglés, el de su código,
 * el de su texto conocido o, si no hay, `fallback` (que ya viene en el idioma de la pantalla).
 */
export function apiErrorMessage(error: unknown, locale: Locale, fallback: string): string {
  const res = (error as { response?: { status?: number; data?: { error?: string; code?: string } } }).response;
  const server = res?.data?.error;
  if (locale === 'es') return server ?? fallback;
  if (res?.data?.code && EN_BY_CODE[res.data.code]) return EN_BY_CODE[res.data.code];
  if (res?.status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  return localizeBillingMessage(server, locale) ?? fallback;
}
