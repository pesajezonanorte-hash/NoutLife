// Panel de administración: una fila por usuario con su plan, sus pagos y cuándo
// cobra o vence. Lee la base; no cambia nada. Nunca devuelve la fuente de pago
// de Wompi ni el correo de los pagos: solo la etiqueta que ya ve la persona.
import { prisma } from '../lib/prisma';
import { accessEndsAt, isComplimentary, planOf, statusOf, trialEndOf, willRenew } from '../lib/plans';
import { recheckTimedOutPayments, subscriptionView, syncSubscription } from './billing.service';
import { resetAccountData } from './account-reset.service';
import { isAdminEmail } from '../lib/admin';
import { giftFunnel, referralMetrics } from '../lib/admin-metrics';

export async function listUsers(now = new Date()) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, displayName: true, username: true, level: true, createdAt: true, lastSeenAt: true,
      subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true, paymentSourceId: true,
      paymentMethodType: true, paymentMethodLabel: true, liteSince: true, lastPaymentError: true, gender: true, giftTrial: true, compPro: true, giftAvailable: true,
    },
  });
  const payments = await prisma.subscriptionPayment.findMany({
    where: { status: { in: ['APPROVED', 'PENDING'] } },
    select: { userId: true, status: true, amountInCents: true, createdAt: true, periodEnd: true },
    orderBy: { createdAt: 'desc' },
  });
  const byUser = new Map<string, { approved: typeof payments; pending: number }>();
  for (const p of payments) {
    const row = byUser.get(p.userId) ?? { approved: [], pending: 0 };
    if (p.status === 'APPROVED') row.approved.push(p);
    else row.pending += 1;
    byUser.set(p.userId, row);
  }

  return users.map((row) => {
    // La cortesía gana sobre lo guardado (cancelado, Lite o fechas viejas), igual que en la app.
    const u = { ...row, complimentary: isComplimentary(row) };
    const pays = byUser.get(u.id) ?? { approved: [], pending: 0 };
    const access = accessEndsAt(u);
    const view = subscriptionView(u, now, pays.pending > 0);
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      username: u.username,
      level: u.level,
      gender: u.gender,
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: u.lastSeenAt?.toISOString() ?? null,
      plan: planOf(u, now),
      // Estado real: una prueba o un mes vencidos que el cron aún no pasó a Lite se ven como Lite.
      status: u.complimentary ? 'active' : planOf(u, now) === 'lite' ? 'lite' : statusOf(u),
      hasPaid: pays.approved.length > 0,
      paidCount: pays.approved.length,
      paidTotalCop: pays.approved.reduce((sum, p) => sum + p.amountInCents, 0) / 100,
      lastPaidAt: pays.approved[0]?.createdAt.toISOString() ?? null,
      pendingPayments: pays.pending,
      hasPaymentMethod: Boolean(u.paymentSourceId),
      paymentMethod: u.paymentSourceId ? (u.paymentMethodLabel ?? (u.paymentMethodType === 'NEQUI' ? 'NEQUI' : 'Tarjeta')) : null,
      complimentary: view.complimentary,
      trialEndsAt: trialEndOf(u).toISOString(),
      accessEndsAt: view.accessEndsAt,
      currentPeriodEnd: u.currentPeriodEnd?.toISOString() ?? null,
      /** Cuándo se cobra (con tarjeta) o cuándo pasa a Lite (sin tarjeta). null si no aplica. */
      nextEventAt: view.complimentary || statusOf(u) === 'lite' ? null : access.toISOString(),
      nextEvent: view.complimentary || statusOf(u) === 'lite' ? 'none' : willRenew(u) ? 'charge' : 'expire',
      liteSince: u.liteSince?.toISOString() ?? null,
      lastPaymentError: u.lastPaymentError,
      giftTrial: u.giftTrial,
      giftAvailable: u.giftAvailable,
    };
  });
}

export class AdminError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Borra una cuenta y todos sus datos. Nunca una cuenta admin ni la propia. */
export async function deleteUser(adminId: string, targetId: string) {
  if (adminId === targetId) throw new AdminError('No puedes borrar tu propia cuenta desde aquí.', 400);
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { email: true } });
  if (!target) throw new AdminError('Usuario no encontrado.', 404);
  if (isAdminEmail(target.email)) throw new AdminError('No se borra una cuenta de administración.', 400);
  await resetAccountData(targetId);
  await prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: targetId }, { blockedId: targetId }] } });
  await prisma.user.delete({ where: { id: targetId } });
  return { deleted: true as const, email: target.email };
}

/**
 * Tasas de avisos web push de los últimos 30 días, por categoría (T8): envíos, clics y
 * desactivaciones. Sirve para el tablero de tasa de clics y bajas por tipo de aviso.
 */
export async function pushStats(now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const rows = await prisma.pushEvent.groupBy({
    by: ['category', 'kind'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
  const byCategory: Record<string, { sent: number; clicked: number; disabled: number; clickRate: number | null; disableRate: number | null }> = {};
  for (const row of rows) {
    const entry = (byCategory[row.category] ??= { sent: 0, clicked: 0, disabled: 0, clickRate: null, disableRate: null });
    const n = row._count._all;
    if (row.kind === 'sent') entry.sent += n;
    else if (row.kind === 'clicked') entry.clicked += n;
    else if (row.kind === 'disabled') entry.disabled += n;
  }
  for (const entry of Object.values(byCategory)) {
    entry.clickRate = entry.sent ? entry.clicked / entry.sent : null;
    entry.disableRate = entry.sent ? entry.disabled / entry.sent : null;
  }
  return { since: since.toISOString(), byCategory };
}

/**
 * Revisa en Wompi los cobros de la persona que se cerraron por tiempo (sin esperar al cron) y
 * después aplica vencimientos. Si Wompi aprobó el cobro, la cuenta queda en Pro pagado.
 */
export async function recheckBilling(userId: string, now = new Date()) {
  const result = await recheckTimedOutPayments(now, { userId, minAgeMs: 0 });
  const subscription = await syncSubscription(userId);
  return { ...result, subscription };
}

/**
 * Métricas del plan v3 (solo lectura): embudo del regalo de 7 días (vigentes, recibidos,
 * convertidos a Pro pagado) e invitaciones con el tope mensual en UTC.
 */
export async function metrics(now = new Date()) {
  const [users, usedTrials, payments, referrals] = await Promise.all([
    prisma.user.findMany({ select: { id: true, email: true, createdAt: true, subscriptionStatus: true, trialEndsAt: true, giftTrial: true, giftAvailable: true } }),
    prisma.usedTrial.findMany({ select: { emailKey: true, paymentKey: true, paymentKeys: true, createdAt: true } }),
    prisma.subscriptionPayment.findMany({ where: { status: 'APPROVED' }, select: { userId: true, createdAt: true } }),
    prisma.referral.findMany({ select: { inviterId: true, inviteeId: true, status: true, inviterDays: true, inviteeDays: true, flaggedSelfReferral: true, activatedAt: true } }),
  ]);
  return { gift: giftFunnel(users, usedTrials, payments, now), referrals: referralMetrics(referrals, now) };
}
