// Panel de administración: una fila por usuario con su plan, sus pagos y cuándo
// cobra o vence. Lee la base; no cambia nada. Nunca devuelve la fuente de pago
// de Wompi ni el correo de los pagos: solo la etiqueta que ya ve la persona.
import { prisma } from '../lib/prisma';
import { accessEndsAt, planOf, statusOf, trialEndOf, willRenew } from '../lib/plans';
import { subscriptionView } from './billing.service';

export async function listUsers(now = new Date()) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, displayName: true, username: true, level: true, createdAt: true, lastSeenAt: true,
      subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true, paymentSourceId: true,
      paymentMethodType: true, paymentMethodLabel: true, liteSince: true, lastPaymentError: true, gender: true,
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

  return users.map((u) => {
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
      status: statusOf(u),
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
    };
  });
}
