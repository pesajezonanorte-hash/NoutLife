// Métricas del plan v3 para el panel de administración: embudo del regalo de 7 días y
// invitaciones con su tope mensual (UTC). Reglas puras, sin base de datos, para probarlas
// sin conexión. Las consultas viven en services/admin.service.ts.
import { TRIAL_DAYS, addDays, statusOf } from './plans';
import { REFERRAL_MONTHLY_CAP_DAYS } from './referrals';
import { emailKey } from './trial-keys';

export interface GiftUserRow {
  id: string;
  email: string;
  createdAt: Date;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  giftTrial: boolean;
}

export interface UsedTrialRow {
  emailKey: string;
  paymentKey: string | null;
  paymentKeys: string[];
  createdAt: Date;
}

export interface GiftFunnel {
  /** Pruebas de regalo vigentes ahora (cuentas Lite e invitaciones). */
  active: number;
  /** Cuentas que recibieron el regalo alguna vez. */
  received: number;
  /** De ellas, con un cobro aprobado después del regalo. */
  converted: number;
  conversionRate: number | null;
  /** Regalo terminado sin pagar: la cuenta volvió a Lite. */
  backToLite: number;
}

/**
 * Fecha del regalo de cada cuenta. La prueba inversa de alta reclama su fila de used_trials
 * antes de crear la cuenta; el regalo a Lite la reclama después y sin medio de pago. Una
 * cuenta con giftTrial vigente sin esa fila (invitación) cuenta desde el inicio de su prueba.
 */
export function giftDates(users: GiftUserRow[], usedTrials: UsedTrialRow[]): Map<string, Date> {
  const byEmail = new Map(usedTrials.map((row) => [row.emailKey, row]));
  const dates = new Map<string, Date>();
  for (const user of users) {
    const row = byEmail.get(emailKey(user.email));
    if (row && !row.paymentKey && row.paymentKeys.length === 0 && row.createdAt.getTime() > user.createdAt.getTime()) {
      dates.set(user.id, row.createdAt);
    } else if (user.giftTrial && user.trialEndsAt) {
      dates.set(user.id, addDays(user.trialEndsAt, -TRIAL_DAYS));
    }
  }
  return dates;
}

export function giftFunnel(
  users: GiftUserRow[],
  usedTrials: UsedTrialRow[],
  approvedPayments: Array<{ userId: string; createdAt: Date }>,
  now = new Date(),
): GiftFunnel {
  const dates = giftDates(users, usedTrials);
  let active = 0, converted = 0, backToLite = 0;
  for (const user of users) {
    if (user.giftTrial && statusOf(user) === 'trialing' && user.trialEndsAt && user.trialEndsAt > now) active += 1;
    const giftedAt = dates.get(user.id);
    if (!giftedAt) continue;
    if (approvedPayments.some((p) => p.userId === user.id && p.createdAt >= giftedAt)) converted += 1;
    else if (statusOf(user) === 'lite') backToLite += 1;
  }
  const received = dates.size;
  return { active, received, converted, conversionRate: received ? converted / received : null, backToLite };
}

export interface ReferralRow {
  inviterId: string;
  inviteeId: string;
  status: string;
  inviterDays: number;
  inviteeDays: number;
  flaggedSelfReferral: boolean;
  activatedAt: Date | null;
}

export interface ReferralMetrics {
  total: number;
  pending: number;
  activated: number;
  flagged: number;
  /** Inicio del mes UTC en curso: la misma ventana del tope en referral.service. */
  monthStart: string;
  activatedThisMonth: number;
  daysGrantedThisMonth: number;
  capDays: number;
  /** Personas que ya llegaron al tope de días este mes. */
  atCap: number;
}

export const utcMonthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

export function referralMetrics(rows: ReferralRow[], now = new Date()): ReferralMetrics {
  const monthStart = utcMonthStart(now);
  const gained = new Map<string, number>();
  let activated = 0, flagged = 0, activatedThisMonth = 0, daysGrantedThisMonth = 0;
  for (const row of rows) {
    if (row.flaggedSelfReferral) flagged += 1;
    if (!row.activatedAt) continue;
    activated += 1;
    if (row.activatedAt < monthStart) continue;
    activatedThisMonth += 1;
    daysGrantedThisMonth += row.inviterDays + row.inviteeDays;
    gained.set(row.inviterId, (gained.get(row.inviterId) ?? 0) + row.inviterDays);
    gained.set(row.inviteeId, (gained.get(row.inviteeId) ?? 0) + row.inviteeDays);
  }
  return {
    total: rows.length,
    pending: rows.filter((row) => !row.activatedAt && !row.flaggedSelfReferral).length,
    activated,
    flagged,
    monthStart: monthStart.toISOString(),
    activatedThisMonth,
    daysGrantedThisMonth,
    capDays: REFERRAL_MONTHLY_CAP_DAYS,
    atCap: [...gained.values()].filter((days) => days >= REFERRAL_MONTHLY_CAP_DAYS).length,
  };
}
