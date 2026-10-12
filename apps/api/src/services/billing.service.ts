import type { Prisma, SubscriptionPayment } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { hasAIProvider } from '../lib/ai';
import { paymentKey } from '../lib/trial-keys';
import { claimTrial, trialAvailable } from './trial.service';
import {
  LITE_LIMITS, PRO_AMOUNT_IN_CENTS, PRO_CURRENCY, PRO_PRICE_COP, RENEWAL_GRACE_MS, TRIAL_DAYS,
  accessEndsAt, addDays, addMonth, hasProAccess, nextAction, paymentReference, planOf, statusOf, trialEndOf, willRenew,
  type Plan, type SubscriptionStatus,
} from '../lib/plans';
import {
  WompiError, createPaymentSource, createTransaction, getAcceptance, getPaymentSource, getTransaction, verifyEventChecksum, wompiConfig,
  type WompiEvent,
} from '../lib/wompi';

/** Error de negocio con mensaje apto para mostrar y su código HTTP. */
export class BillingError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message);
    this.name = 'BillingError';
  }
}

const SUBSCRIPTION_SELECT = {
  id: true,
  email: true,
  createdAt: true,
  subscriptionStatus: true,
  trialEndsAt: true,
  currentPeriodEnd: true,
  paymentSourceId: true,
  paymentMethodLabel: true,
  liteSince: true,
  lastPaymentError: true,
} satisfies Prisma.UserSelect;

type SubscriptionUser = Prisma.UserGetPayload<{ select: typeof SUBSCRIPTION_SELECT }>;

const FINAL_STATUSES = new Set(['APPROVED', 'DECLINED', 'VOIDED', 'ERROR']);
/** Un cobro sin id de Wompi (el proceso cayó entre guardar y cobrar) se da por fallido tras este tiempo. */
const STALE_PENDING_MS = 30 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface SubscriptionView {
  status: SubscriptionStatus;
  plan: Plan;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  /** Fin del Pro ya concedido (prueba o mes pagado). null en Lite. */
  accessEndsAt: string | null;
  /** Se cobrará automáticamente al vencer. */
  renews: boolean;
  hasPaymentMethod: boolean;
  paymentMethodLabel: string | null;
  liteSince: string | null;
  lastPaymentError: string | null;
  pendingPayment: boolean;
  /** Puede empezar la prueba vinculando un medio de pago (el servidor la confirma al vincularlo). */
  trialAvailable: boolean;
  priceCop: number;
  trialDays: number;
}

export function subscriptionView(user: SubscriptionUser, now = new Date(), pendingPayment = false, canTrial = false): SubscriptionView {
  const status = statusOf(user);
  return {
    status,
    plan: planOf(user, now),
    trialEndsAt: trialEndOf(user).toISOString(),
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
    accessEndsAt: status === 'lite' ? null : accessEndsAt(user).toISOString(),
    renews: willRenew(user),
    hasPaymentMethod: Boolean(user.paymentSourceId),
    paymentMethodLabel: user.paymentMethodLabel,
    liteSince: user.liteSince?.toISOString() ?? null,
    lastPaymentError: user.lastPaymentError,
    pendingPayment,
    trialAvailable: canTrial,
    priceCop: PRO_PRICE_COP,
    trialDays: TRIAL_DAYS,
  };
}

/** La prueba solo existe para cuentas en Lite que nunca pagaron y cuyo correo no la usó. */
async function canStartTrial(user: SubscriptionUser): Promise<boolean> {
  return statusOf(user) === 'lite' && !user.currentPeriodEnd && trialAvailable(user.email);
}

async function loadUser(userId: string): Promise<SubscriptionUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SUBSCRIPTION_SELECT });
  if (!user) throw new BillingError('NOT_FOUND', 'Usuario no encontrado.', 404);
  return user;
}

async function getView(userId: string): Promise<SubscriptionView> {
  const [user, pending] = await Promise.all([
    loadUser(userId),
    prisma.subscriptionPayment.count({ where: { userId, status: 'PENDING' } }),
  ]);
  return subscriptionView(user, new Date(), pending > 0, await canStartTrial(user));
}

/** Estado de la suscripción sin aplicar vencimientos (lectura rápida para /auth/me). */
export const getSubscription = getView;

/** Plan efectivo ahora mismo (lectura pura: nunca cobra). Lo usan los límites de Lite. */
export async function getPlan(userId: string): Promise<Plan> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SUBSCRIPTION_SELECT });
  return user ? planOf(user) : 'lite';
}

export async function isPro(userId: string): Promise<boolean> {
  return (await getPlan(userId)) === 'pro';
}

/** IA solo en Pro: en NoutLife Lite cada función usa su texto sin IA. */
export async function canUseAI(userId: string): Promise<boolean> {
  return hasAIProvider() && isPro(userId);
}

/** Pasa la cuenta a Lite. Sin bloqueo: todo sigue guardado y funciona con los límites de Lite. */
async function moveToLite(userId: string, error: string | null): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, NOT: { subscriptionStatus: 'lite' } },
    data: { subscriptionStatus: 'lite', liteSince: new Date() },
  });
  await prisma.user.update({ where: { id: userId }, data: { lastPaymentError: error } });
}

function paymentErrorMessage(status: string, detail: string | null): string {
  const base = status === 'DECLINED'
    ? 'Tu banco rechazó el cobro.'
    : status === 'VOIDED' ? 'El cobro fue anulado.' : 'No se pudo procesar el cobro.';
  return detail ? `${base} (${detail})` : base;
}

/**
 * Aplica el estado final de un cobro. Idempotente: el webhook, el cron y el
 * inicio de sesión pueden llamarlo para el mismo cobro sin efectos dobles.
 * Wompi manda: un cobro marcado ERROR por un corte de red que luego llega
 * APPROVED por webhook reactiva el Pro.
 */
async function settlePayment(paymentId: string, status: string, message: string | null): Promise<void> {
  const payment = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId }, include: { user: { select: SUBSCRIPTION_SELECT } } });
  if (!payment) return;
  // Un cobro aprobado no se revierte con estados de reintentos viejos (solo una anulación).
  if (payment.status === 'APPROVED' && status !== 'APPROVED' && status !== 'VOIDED') return;
  if (payment.status !== status || payment.statusMessage !== message) {
    await prisma.subscriptionPayment.update({ where: { id: payment.id }, data: { status, statusMessage: message } });
  }
  if (status === 'PENDING') return;

  const user = payment.user;
  if (status === 'APPROVED') {
    const periodEnd = user.currentPeriodEnd && user.currentPeriodEnd > payment.periodEnd ? user.currentPeriodEnd : payment.periodEnd;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Si canceló mientras el cobro estaba en curso, conserva el mes pagado pero no renueva.
        subscriptionStatus: user.subscriptionStatus === 'canceled' ? 'canceled' : 'active',
        currentPeriodEnd: periodEnd,
        liteSince: null,
        lastPaymentError: null,
      },
    });
    return;
  }

  // DECLINED / VOIDED / ERROR: sin otro mes pagado vigente, la cuenta pasa a Lite.
  const covered = user.currentPeriodEnd !== null && user.currentPeriodEnd.getTime() > Date.now();
  if (covered) {
    await prisma.user.update({ where: { id: user.id }, data: { lastPaymentError: paymentErrorMessage(status, message) } });
  } else {
    await moveToLite(user.id, paymentErrorMessage(status, message));
  }
}

/** Consulta un cobro en curso. Con `wait`, reintenta unos segundos antes de dejarlo al webhook/cron. */
async function refreshPendingPayment(payment: SubscriptionPayment, wait: boolean): Promise<void> {
  if (!payment.wompiTransactionId) {
    if (Date.now() - payment.createdAt.getTime() > STALE_PENDING_MS) {
      await settlePayment(payment.id, 'ERROR', payment.statusMessage ?? 'Wompi no confirmó el cobro.');
    }
    return;
  }
  const attempts = wait ? 4 : 1;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(1500);
    const tx = await getTransaction(payment.wompiTransactionId).catch(() => null);
    if (tx && FINAL_STATUSES.has(tx.status)) {
      await settlePayment(payment.id, tx.status, tx.statusMessage);
      return;
    }
  }
}

/**
 * Cobra un periodo a la tarjeta guardada. `periodKey` fija la referencia
 * (única por usuario y periodo); si otro proceso ya creó ese cobro, aquí no se
 * vuelve a cobrar: solo se consulta su estado.
 */
async function chargePeriod(user: SubscriptionUser, periodKey: Date, periodStart: Date, wait: boolean): Promise<void> {
  if (!user.paymentSourceId) return;
  const reference = paymentReference(user.id, periodKey);
  let payment = await prisma.subscriptionPayment.findUnique({ where: { reference } });

  if (!payment) {
    try {
      payment = await prisma.subscriptionPayment.create({
        data: {
          userId: user.id, reference, amountInCents: PRO_AMOUNT_IN_CENTS, currency: PRO_CURRENCY,
          periodStart, periodEnd: addMonth(periodStart),
        },
      });
    } catch (error) {
      if ((error as { code?: unknown }).code === 'P2002') return; // otro proceso está cobrando este periodo
      throw error;
    }

    let tx;
    try {
      tx = await createTransaction({
        paymentSourceId: user.paymentSourceId, reference, amountInCents: payment.amountInCents,
        currency: payment.currency, customerEmail: user.email,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      if (error instanceof WompiError && error.status && error.status >= 400 && error.status < 500) {
        // Wompi rechazó la petición: el cobro no existe allá.
        await settlePayment(payment.id, 'ERROR', message);
      } else {
        // Corte de red: el cobro pudo crearse. El webhook (por referencia) o el cron lo resuelven.
        await prisma.subscriptionPayment.update({ where: { id: payment.id }, data: { statusMessage: message } });
      }
      return;
    }

    payment = await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { wompiTransactionId: tx.id, statusMessage: tx.statusMessage },
    });
    if (FINAL_STATUSES.has(tx.status)) {
      await settlePayment(payment.id, tx.status, tx.statusMessage);
      return;
    }
  }

  if (payment.status !== 'PENDING') {
    // Ya resuelto en otra pasada: reaplicarlo es inocuo y repara un corte a medias.
    await settlePayment(payment.id, payment.status, payment.statusMessage);
    return;
  }
  await refreshPendingPayment(payment, wait);
}

/**
 * Revisa la suscripción y aplica lo que toque: cobrar el mes si la prueba o el
 * periodo vencieron con tarjeta, o pasar a Lite si no hay pago. Corre en cada
 * inicio de sesión (y al reabrir la app), en /billing/status y en el cron.
 */
export async function syncSubscription(userId: string, options: { wait?: boolean } = {}): Promise<SubscriptionView> {
  const user = await loadUser(userId);
  const now = new Date();
  const action = nextAction(user, now);

  if (action === 'downgrade') {
    await moveToLite(user.id, null);
  } else if (action === 'charge') {
    if (!wompiConfig().configured) {
      // Sin llaves no se puede cobrar: el margen conserva el Pro y después pasa a Lite.
      if (!hasProAccess(user, now)) await moveToLite(user.id, 'Los pagos no están disponibles en este momento.');
    } else {
      const periodKey = accessEndsAt(user);
      // Muy atrasado (el cron no corrió): el mes nuevo empieza hoy, no en el pasado.
      const periodStart = now.getTime() - periodKey.getTime() > RENEWAL_GRACE_MS ? now : periodKey;
      await chargePeriod(user, periodKey, periodStart, Boolean(options.wait)).catch((error) => {
        console.error('[BILLING_CHARGE_ERROR]', user.id, error);
      });
    }
  }
  return getView(userId);
}

export interface PaymentMethodInput {
  /** Token de Wompi (tok_…) creado en el navegador: lo único del cliente que cuenta. */
  token: string;
  /** Solo para la etiqueta («VISA •••• 4242»). */
  brand?: string;
  /** Cookie HttpOnly o cabecera del dispositivo. Solo auditoría: nunca bloquea. */
  deviceId: string | null;
}

/**
 * Vincula el medio de pago como fuente de Wompi. No cobra nada. Si la cuenta
 * nunca tuvo prueba, aquí empieza: el servidor lee de Wompi los datos reales
 * del medio de pago (no los del navegador) y concede los 7 días solo si ni el
 * correo ni ese medio de pago tuvieron ya una prueba. Si no, sigue en Lite.
 */
export async function savePaymentMethod(userId: string, input: PaymentMethodInput): Promise<SubscriptionView> {
  if (!wompiConfig().configured) throw new BillingError('BILLING_DISABLED', 'Los pagos no están disponibles en este momento.', 503);
  const user = await loadUser(userId);

  let source;
  let details;
  try {
    const acceptance = await getAcceptance({ fresh: true });
    source = await createPaymentSource({ token: input.token, customerEmail: user.email, acceptance });
    details = await getPaymentSource(source.id);
  } catch (error) {
    if (error instanceof WompiError) {
      console.error('[BILLING_PAYMENT_SOURCE_ERROR]', userId, error.message);
      throw new BillingError('CARD_REJECTED', 'No pudimos vincular tu método de pago. Revisa los datos e inténtalo de nuevo.', 422);
    }
    throw error;
  }
  if (source.status !== 'AVAILABLE') {
    throw new BillingError('CARD_REJECTED', 'Wompi no pudo verificar este método de pago. Prueba con otro.', 422);
  }

  const now = new Date();
  const pub = details.publicData;
  const brand = input.brand?.trim().toUpperCase() || (pub.type === 'NEQUI' ? 'NEQUI' : 'Tarjeta');
  const lastFour = pub.last_four ?? pub.phone_number?.slice(-4);
  const data: Prisma.UserUpdateInput = {
    paymentSourceId: source.id,
    paymentMethodLabel: lastFour ? `${brand} •••• ${lastFour}` : brand,
    lastPaymentError: null,
  };
  // Vincular un medio de pago durante una cancelación vigente la deshace.
  if (statusOf(user) === 'canceled' && now < accessEndsAt(user)) {
    data.subscriptionStatus = user.currentPeriodEnd && user.currentPeriodEnd > now ? 'active' : 'trialing';
  }

  if (await canStartTrial(user)) {
    const key = paymentKey(pub);
    if (!key) {
      // Sin huella real no se concede: fallar cerrado y avisar (nunca confiar en el navegador).
      console.error('[BILLING_NO_PAYMENT_KEY]', userId, source.id, Object.keys(pub));
      throw new BillingError('PAYMENT_UNVERIFIED', 'No pudimos verificar tu método de pago con Wompi. Inténtalo de nuevo en unos minutos.', 502);
    }
    const outcome = await claimTrial(user.email, key, input.deviceId);
    if (outcome === 'granted') {
      Object.assign(data, { subscriptionStatus: 'trialing', trialEndsAt: addDays(now, TRIAL_DAYS), liteSince: null });
    } else {
      data.lastPaymentError = outcome === 'payment_used' ? 'Este método de pago ya se usó en una prueba gratis.' : 'Ya usaste tu prueba gratis.';
    }
  }
  await prisma.user.update({ where: { id: userId }, data });
  return getView(userId);
}

/** Activa Pro ya. Desde Lite cobra el primer mes en el acto; en prueba o con mes pagado no cobra nada. */
export async function subscribeNow(userId: string): Promise<SubscriptionView> {
  await syncSubscription(userId, { wait: true }); // aplica vencimientos pendientes primero
  const user = await loadUser(userId);
  const status = statusOf(user);
  if (status === 'canceled') return resumeSubscription(userId);
  if (status !== 'lite') return getView(userId);

  if (!user.paymentSourceId) throw new BillingError('PAYMENT_METHOD_REQUIRED', 'Agrega un método de pago para activar Pro.', 409);
  if (!wompiConfig().configured) throw new BillingError('BILLING_DISABLED', 'Los pagos no están disponibles en este momento.', 503);

  const now = new Date();
  // Doble toque: un cobro reciente en curso o aprobado se reutiliza en vez de cobrar otra vez.
  const recent = await prisma.subscriptionPayment.findFirst({
    where: { userId, status: { in: ['PENDING', 'APPROVED'] }, createdAt: { gte: new Date(now.getTime() - 10 * 60_000) } },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    if (recent.status === 'PENDING') await refreshPendingPayment(recent, true);
    else await settlePayment(recent.id, recent.status, recent.statusMessage);
    return getView(userId);
  }

  // La clave por minuto hace que dos peticiones simultáneas choquen en la referencia única.
  const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  await chargePeriod(user, minute, now, true);
  return getView(userId);
}

/** Cancelar en un clic: conserva el Pro hasta el fin de la prueba o del mes pagado, sin más cobros. */
export async function cancelSubscription(userId: string): Promise<SubscriptionView> {
  const user = await loadUser(userId);
  const status = statusOf(user);
  if (status === 'lite') throw new BillingError('NOT_SUBSCRIBED', 'No tienes una suscripción activa.', 409);
  if (status !== 'canceled') {
    await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'canceled' } });
  }
  return getView(userId);
}

export async function resumeSubscription(userId: string): Promise<SubscriptionView> {
  const user = await loadUser(userId);
  const now = new Date();
  if (statusOf(user) !== 'canceled') return getView(userId);
  if (now >= accessEndsAt(user)) throw new BillingError('EXPIRED', 'Tu acceso Pro ya terminó. Actívalo de nuevo desde Planes.', 409);
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionStatus: user.currentPeriodEnd && user.currentPeriodEnd > now ? 'active' : 'trialing' },
  });
  return getView(userId);
}

export interface BillingStatus {
  subscription: SubscriptionView;
  payments: Array<{ id: string; amountInCents: number; currency: string; status: string; periodStart: string; periodEnd: string; createdAt: string }>;
}

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const subscription = await syncSubscription(userId);
  const payments = await prisma.subscriptionPayment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 6 });
  return {
    subscription,
    payments: payments.map((p) => ({
      id: p.id, amountInCents: p.amountInCents, currency: p.currency, status: p.status,
      periodStart: p.periodStart.toISOString(), periodEnd: p.periodEnd.toISOString(), createdAt: p.createdAt.toISOString(),
    })),
  };
}

/** Datos públicos para el navegador: la llave pública tokeniza la tarjeta directo con Wompi. */
export async function getBillingConfig() {
  const config = wompiConfig();
  let acceptance = null;
  if (config.configured) acceptance = await getAcceptance().catch(() => null);
  return {
    enabled: config.configured,
    publicKey: config.publicKey,
    apiUrl: config.baseUrl,
    sandbox: config.sandbox,
    priceCop: PRO_PRICE_COP,
    trialDays: TRIAL_DAYS,
    liteLimits: LITE_LIMITS,
    termsUrl: acceptance?.termsUrl ?? null,
    personalDataUrl: acceptance?.personalDataUrl ?? null,
  };
}

/** Evento de Wompi (POST /billing/webhook). Solo se aceptan eventos con checksum válido. */
export async function handleWompiEvent(event: WompiEvent, headerChecksum?: string | null): Promise<{ handled: boolean }> {
  const { eventsSecret } = wompiConfig();
  if (!eventsSecret) throw new BillingError('WEBHOOK_DISABLED', 'Eventos de pago no configurados.', 503);
  if (!verifyEventChecksum(event, eventsSecret, headerChecksum)) throw new BillingError('BAD_SIGNATURE', 'Firma inválida.', 401);
  if (event.event !== 'transaction.updated') return { handled: false };

  const tx = (event.data as { transaction?: { id?: string | number; reference?: string; status?: string; status_message?: string | null; amount_in_cents?: number; currency?: string } } | undefined)?.transaction;
  if (!tx?.reference || !tx.status) return { handled: false };
  const payment = await prisma.subscriptionPayment.findUnique({ where: { reference: tx.reference } });
  if (!payment) return { handled: false }; // no es un cobro de suscripción

  if (tx.amount_in_cents !== payment.amountInCents || tx.currency !== payment.currency) {
    console.error('[BILLING_WEBHOOK_MISMATCH]', payment.reference, tx.amount_in_cents, tx.currency);
    return { handled: false };
  }
  if (!payment.wompiTransactionId && tx.id !== undefined) {
    await prisma.subscriptionPayment.update({ where: { id: payment.id }, data: { wompiTransactionId: String(tx.id) } }).catch(() => null);
  }
  if (FINAL_STATUSES.has(tx.status)) await settlePayment(payment.id, tx.status, tx.status_message ?? null);
  return { handled: true };
}

/**
 * Pasada periódica (cron /cron/tick cada 5 min): cobra o pasa a Lite las
 * suscripciones vencidas y consulta los cobros en curso. Lotes pequeños para
 * caber en el tiempo de una función serverless.
 */
export async function runBillingTick(now = new Date(), limit = 20): Promise<{ billingDue: number; billingPending: number }> {
  const due = await prisma.user.findMany({
    where: {
      subscriptionStatus: { in: ['trialing', 'active', 'canceled'] },
      // Los que ya tienen un cobro en curso se atienden abajo.
      subscriptionPayments: { none: { status: 'PENDING' } },
      OR: [
        { currentPeriodEnd: { lte: now } },
        { currentPeriodEnd: null, trialEndsAt: { lte: now } },
        { currentPeriodEnd: null, trialEndsAt: null, createdAt: { lte: addDays(now, -TRIAL_DAYS) } },
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });
  for (const { id } of due) {
    await syncSubscription(id).catch((error) => console.error('[BILLING_TICK_ERROR]', id, error));
  }

  const pending = await prisma.subscriptionPayment.findMany({
    where: { status: 'PENDING', createdAt: { lte: new Date(now.getTime() - 60_000) } },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });
  for (const payment of pending) {
    await refreshPendingPayment(payment, false).catch((error) => console.error('[BILLING_PENDING_ERROR]', payment.id, error));
    // Rota la cola: el siguiente tick empieza por otros cobros.
    await prisma.subscriptionPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { updatedAt: new Date() } });
  }
  return { billingDue: due.length, billingPending: pending.length };
}
