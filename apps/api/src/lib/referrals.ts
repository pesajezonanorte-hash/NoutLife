// Invitaciones (plan v3, T9): reglas puras, sin base de datos, para que el tope mensual
// y los días de Pro se prueben sin conexión. La base vive en services/referral.service.ts.
import { addDays, statusOf, trialEndOf, type SubscriptionFields } from './plans';

/** Días de Pro que gana cada persona por una invitación activada. */
export const REFERRAL_REWARD_DAYS = 7;
/** Tope de días de Pro ganados por invitaciones, por persona y por mes (UTC). */
export const REFERRAL_MONTHLY_CAP_DAYS = 30;
/** Días distintos con al menos un hábito cumplido para activar la invitación. */
export const REFERRAL_ACTIVATION_CHECKINS = 3;

/** Primer instante del mes (UTC) en el que cae `now`. */
export function referralMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Días que todavía caben en el tope mensual, sin pasar de `wanted`. */
export function grantableDays(gainedThisMonth: number, wanted = REFERRAL_REWARD_DAYS): number {
  return Math.max(0, Math.min(wanted, REFERRAL_MONTHLY_CAP_DAYS - gainedThisMonth));
}

/**
 * Campos que suman `days` de Pro según el estado: Lite pasa a prueba de regalo (sin
 * fecha de Lite); con periodo pagado o cancelado se extiende el periodo; si no, la prueba.
 * null si no hay nada que dar (cortesía o sin días).
 */
export function proExtension(
  user: SubscriptionFields & { liteSince?: Date | null },
  days: number,
  now = new Date(),
): { subscriptionStatus?: string; trialEndsAt?: Date; currentPeriodEnd?: Date | null; liteSince?: null } | null {
  if (days <= 0 || user.complimentary) return null;
  const later = (a: Date) => new Date(Math.max(a.getTime(), now.getTime()));
  if (statusOf(user) === 'lite') {
    return { subscriptionStatus: 'trialing', trialEndsAt: addDays(now, days), currentPeriodEnd: null, liteSince: null };
  }
  if (user.currentPeriodEnd) return { currentPeriodEnd: addDays(later(user.currentPeriodEnd), days) };
  return { trialEndsAt: addDays(later(trialEndOf(user)), days) };
}
