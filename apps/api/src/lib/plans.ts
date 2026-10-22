/**
 * Planes de NoutLife. Reglas puras (sin base de datos) para que el cobro, los
 * límites de Lite y las pruebas usen exactamente la misma lógica.
 *
 *   trialing  7 días de Pro. Toda cuenta nueva nace así, sin medio de pago (prueba inversa): al
 *             vencer pasa sola a Lite sin perder nada. Con un medio de pago vinculado, al vencer se cobra el primer mes.
 *   active    mes pagado. Al vencer se cobra el siguiente.
 *   canceled  la persona canceló: conserva Pro hasta el fin de su prueba o mes pagado.
 *   lite      sin pago activo. Funciona con los límites de Lite y las zonas Pro con candado.
 *
 * No hay paywall de entrada: nadie tiene que vincular un medio de pago para entrar.
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
  /** Libretas que se pueden crear. */
  notebooks: 2,
  /** Páginas por libreta (Pro no tiene límite). */
  notebookPages: 10,
} as const;

/** Candados de la Libreta en Lite (la API responde 402 con `lock`). */
export type NotebookLock = 'notebooks' | 'notebook-pages' | 'notebook-draw' | 'notebook-images' | 'notebook-stickies';

export const NOTEBOOK_LOCK_MESSAGES: Record<NotebookLock, string> = {
  notebooks: `NoutLife Lite admite ${LITE_LIMITS.notebooks} libretas. Con Pro no hay límite.`,
  'notebook-pages': `NoutLife Lite admite ${LITE_LIMITS.notebookPages} páginas por libreta. Con Pro, las que quieras.`,
  'notebook-draw': 'Dibujar en la libreta es de NoutLife Pro.',
  'notebook-images': 'Pegar imágenes en la libreta es de NoutLife Pro.',
  'notebook-stickies': 'Las notas adhesivas de colores son de NoutLife Pro.',
};

/**
 * Zonas solo de Pro (requireProZone). En Lite quedan con candado: lo guardado
 * se conserva y vuelve a verse al activar Pro. Inicio, hábitos, misiones,
 * logros, agenda, rituales y social siguen en Lite.
 */
export const PRO_ZONES = ['finances', 'coliseo', 'recreation', 'food', 'sleep', 'journal', 'learning', 'love', 'mirror', 'wisdom', 'custom-zones'] as const;
export type ProZone = (typeof PRO_ZONES)[number];

export const PRO_ZONE_LABELS: Record<ProZone, string> = {
  finances: 'Finanzas',
  coliseo: 'Coliseo',
  recreation: 'Recreación',
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
  /** Prueba de regalo: vence sin cobro aunque la cuenta tenga tarjeta guardada. */
  giftTrial?: boolean;
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
  if (user.complimentary || user.giftTrial) return false;
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

/** Correos con Pro de cortesía (COMP_PRO_EMAILS, separados por comas). Sin distinguir mayúsculas. */
export function complimentaryEmails(list: string | undefined): Set<string> {
  return new Set((list ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}

/**
 * Regalo de 7 días a una cuenta Lite actual (cuentas anteriores a la prueba inversa): solo si
 * completó el onboarding, está en Lite, nunca tuvo periodo pagado ni tarjeta, nunca pagó un cobro
 * aprobado y no es de cortesía. La fila de used_trials (claimReverseTrial) evita el segundo regalo.
 */
export function giftEligible(
  user: { subscriptionStatus: string; currentPeriodEnd: Date | null; paymentSourceId: string | null; onboardingCompleted: boolean; complimentary?: boolean },
  paidBefore: boolean,
): boolean {
  return user.onboardingCompleted
    && statusOf(user) === 'lite'
    && !user.currentPeriodEnd
    && !user.paymentSourceId
    && !user.complimentary
    && !paidBefore;
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
