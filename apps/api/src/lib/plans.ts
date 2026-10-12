/**
 * Planes de NoutLife. Reglas puras (sin base de datos) para que el cobro, los
 * límites de Lite y las pruebas usen exactamente la misma lógica.
 *
 *   trialing  7 días de Pro desde que se vincula un medio de pago. Al vencer se cobra el primer mes.
 *   active    mes pagado. Al vencer se cobra el siguiente.
 *   canceled  la persona canceló: conserva Pro hasta el fin de su prueba o mes pagado.
 *   lite      sin pago activo (y toda cuenta nueva). Funciona con los límites de Lite y las zonas Pro con candado.
 *
 * Paywall de entrada: con Wompi configurado, nadie entra al Dashboard sin
 * vincular antes un medio de pago (paywallRequired).
 */
export const TRIAL_DAYS = 7;
// ponytail: «tarifa congelada» = esta constante. Antes de subir el precio, guarda el monto por usuario.
export const PRO_PRICE_COP = 9900;
export const PRO_AMOUNT_IN_CENTS = PRO_PRICE_COP * 100;
export const PRO_CURRENCY = 'COP';

/** NoutLife Lite. La IA es solo de Pro (requirePro('ai') y canUseAI). */
export const LITE_LIMITS = {
  /** Hábitos activos a la vez. */
  activeHabits: 3,
  /** Rutinas (rituales) activas a la vez. */
  activeRoutines: 3,
  /** Días de historial y estadísticas visibles. */
  historyDays: 5,
} as const;

/**
 * Zonas solo de Pro (requireProZone). En Lite quedan con candado: lo guardado
 * se conserva y vuelve a verse al activar Pro. Inicio, hábitos, misiones,
 * logros, agenda, rituales y social siguen en Lite.
 */
export const PRO_ZONES = ['finances', 'gym', 'food', 'sleep', 'journal', 'learning', 'love', 'mirror', 'wisdom', 'custom-zones'] as const;
export type ProZone = (typeof PRO_ZONES)[number];

export const PRO_ZONE_LABELS: Record<ProZone, string> = {
  finances: 'Finanzas',
  gym: 'Gimnasio',
  food: 'Comida',
  sleep: 'Sueño',
  journal: 'Diario',
  learning: 'Aprendizaje',
  love: 'Relaciones',
  mirror: 'Espejo',
  wisdom: 'Sabiduría',
  'custom-zones': 'Mis zonas',
};

/**
 * Margen mientras se cobra una renovación: el cron corre cada 5 min, pero
 * GitHub Actions puede retrasarse. Durante el margen la cuenta sigue en Pro.
 */
export const RENEWAL_GRACE_MS = 2 * 24 * 60 * 60_000;

const DAY_MS = 24 * 60 * 60_000;

export type SubscriptionStatus = 'trialing' | 'active' | 'canceled' | 'lite';
export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = ['trialing', 'active', 'canceled', 'lite'];
export type Plan = 'pro' | 'lite';

export interface SubscriptionFields {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  paymentSourceId: string | null;
  createdAt: Date;
  /** Pro de cortesía (COMP_PRO_EMAILS): Pro sin fecha, sin paywall y sin cobros. Lo decide el servidor, no la base. */
  complimentary?: boolean;
}

export function statusOf(user: Pick<SubscriptionFields, 'subscriptionStatus'>): SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(user.subscriptionStatus)
    ? (user.subscriptionStatus as SubscriptionStatus)
    : 'lite';
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Mismo día del mes siguiente; el 31 de enero pasa al último día de febrero. */
export function addMonth(date: Date): Date {
  const next = new Date(date);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

/** Fin de la prueba. Las cuentas sin fecha (creadas antes del campo) cuentan desde su alta. */
export function trialEndOf(user: Pick<SubscriptionFields, 'trialEndsAt' | 'createdAt'>): Date {
  return user.trialEndsAt ?? addDays(user.createdAt, TRIAL_DAYS);
}

/** Hasta cuándo dura el Pro ya concedido (prueba o mes pagado). */
export function accessEndsAt(user: SubscriptionFields): Date {
  return user.currentPeriodEnd ?? trialEndOf(user);
}

/** ¿Se intentará cobrar al vencer? Solo con tarjeta guardada y sin cancelar. */
export function willRenew(user: SubscriptionFields): boolean {
  if (user.complimentary) return false;
  const status = statusOf(user);
  return (status === 'trialing' || status === 'active') && Boolean(user.paymentSourceId);
}

export function hasProAccess(user: SubscriptionFields, now = new Date()): boolean {
  if (user.complimentary) return true;
  if (statusOf(user) === 'lite') return false;
  const end = accessEndsAt(user).getTime();
  if (now.getTime() < end) return true;
  // Vencido con renovación en curso: Pro durante el margen, hasta que el cobro se resuelva.
  return willRenew(user) && now.getTime() < end + RENEWAL_GRACE_MS;
}

export function planOf(user: SubscriptionFields, now = new Date()): Plan {
  return hasProAccess(user, now) ? 'pro' : 'lite';
}

/**
 * Paywall de entrada: sin medio de pago vinculado no se entra al Dashboard.
 * Sin llaves de Wompi no hay forma de vincularlo, así que no se exige. Las
 * cuentas de cortesía entran sin él.
 */
export function paywallRequired(user: Pick<SubscriptionFields, 'paymentSourceId' | 'complimentary'>, billingEnabled: boolean): boolean {
  return billingEnabled && !user.paymentSourceId && !user.complimentary;
}

/** Correos con Pro de cortesía (COMP_PRO_EMAILS, separados por comas). Sin distinguir mayúsculas. */
export function complimentaryEmails(list: string | undefined): Set<string> {
  return new Set((list ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}

/** Qué toca hacer con la suscripción ahora: nada, cobrar el periodo o pasar a Lite. */
export function nextAction(user: SubscriptionFields, now = new Date()): 'none' | 'charge' | 'downgrade' {
  if (user.complimentary || statusOf(user) === 'lite') return 'none';
  if (now.getTime() < accessEndsAt(user).getTime()) return 'none';
  return willRenew(user) ? 'charge' : 'downgrade';
}

/**
 * Referencia del cobro de un periodo. Depende solo del usuario y del inicio
 * del periodo, así que dos procesos que cobran a la vez chocan en la clave
 * única de la tabla y Wompi recibe un solo cobro.
 */
export function paymentReference(userId: string, periodKey: Date): string {
  return `NL-${userId}-${periodKey.getTime().toString(36)}`;
}
