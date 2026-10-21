// Invitaciones (plan v3, T9): reglas puras, sin base de datos, para que el tope mensual
// y los días de Pro se prueben sin conexión. La base vive en services/referral.service.ts.
import { addDays, statusOf, trialEndOf, type SubscriptionFields } from './plans';

/** Días de Pro que gana cada persona por una invitación activada. */
export const REFERRAL_REWARD_DAYS = 7;
/** Tope de días de Pro ganados por invitaciones, por persona y por mes (UTC). */
export const REFERRAL_MONTHLY_CAP_DAYS = 30;
/** Días distintos con al menos un hábito cumplido para activar la invitación. */
export const REFERRAL_ACTIVATION_CHECKINS = 3;

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
): { subscriptionStatus?: string; trialEndsAt?: Date; currentPeriodEnd?: Date | null; liteSince?: null; giftTrial?: boolean } | null {
  if (days <= 0 || user.complimentary) return null;
  const later = (a: Date) => new Date(Math.max(a.getTime(), now.getTime()));
  if (statusOf(user) === 'lite') {
    // Regalo sin cobro: aunque haya tarjeta guardada, al vencer vuelve a Lite sin cargo (giftTrial).
    return { subscriptionStatus: 'trialing', trialEndsAt: addDays(now, days), currentPeriodEnd: null, liteSince: null, giftTrial: true };
  }
  if (user.currentPeriodEnd) return { currentPeriodEnd: addDays(later(user.currentPeriodEnd), days) };
  return { trialEndsAt: addDays(later(trialEndOf(user)), days) };
}

/** Separación mínima entre dos días con hábitos cumplidos que cuentan para la activación. */
export const REFERRAL_MIN_GAP_MS = 12 * 60 * 60_000;

/**
 * Cuántos cumplimientos válidos hay (hasta `need`): días distintos y, entre dos elegidos,
 * al menos `minGapMs` de separación. Greedy por fecha: toma el primero de cada día que
 * cumpla la separación. `day` es el día de calendario del hábito (AAAA-MM-DD); `at` es el
 * instante en que se marcó.
 */
export function pickSpacedCheckins(
  logs: Array<{ day: string; at: Date }>,
  need = REFERRAL_ACTIVATION_CHECKINS,
  minGapMs = REFERRAL_MIN_GAP_MS,
): number {
  const sorted = [...logs].sort((a, b) => a.at.getTime() - b.at.getTime());
  const days = new Set<string>();
  let last: number | null = null;
  let count = 0;
  for (const log of sorted) {
    if (count >= need) break;
    if (days.has(log.day)) continue;
    if (last !== null && log.at.getTime() - last < minGapMs) continue;
    days.add(log.day);
    last = log.at.getTime();
    count += 1;
  }
  return count;
}

/** ¿Hay algún dispositivo en común entre las dos listas? */
export function sharesDevice(a: readonly string[], b: readonly string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const mine = new Set(a);
  return b.some((id) => mine.has(id));
}

export type ReferralVerdict = 'flag' | 'activate' | 'wait';

/**
 * Decisión sobre una invitación pendiente. 'flag': auto-referido (marca permanente, sin
 * recompensa). 'activate': cumple los dos requisitos de uso real. 'wait': todavía no.
 */
export function referralVerdict(state: {
  flagged: boolean;
  sharedDevice: boolean;
  spacedCheckins: number;
  spaceInteraction: boolean;
}): ReferralVerdict {
  if (state.flagged || state.sharedDevice) return 'flag';
  if (state.spacedCheckins >= REFERRAL_ACTIVATION_CHECKINS && state.spaceInteraction) return 'activate';
  return 'wait';
}
