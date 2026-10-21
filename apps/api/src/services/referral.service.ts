// Invitaciones de doble vía (plan v3, T9). Quien invita y quien entra reciben 7 días de
// Pro cuando la persona invitada tiene 3 días distintos con hábitos cumplidos. Cada cuenta
// tiene como mucho un invitador y cada persona gana como mucho 30 días al mes por invitaciones.
import { prisma } from '../lib/prisma';
import {
  REFERRAL_ACTIVATION_CHECKINS, REFERRAL_REWARD_DAYS, grantableDays, referralMonthStart,
} from '../lib/referrals';
import { extendProAccess } from './billing.service';

/** Nombre público de quien invita (la portada /i/:username). Sin correo ni datos privados. */
export async function inviterPreview(username: string) {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return null;
  return prisma.user.findUnique({ where: { username }, select: { username: true, displayName: true } });
}

/** Registra la invitación al crear la cuenta. Ignora nombres inexistentes y autoinvitaciones. */
export async function attachReferral(inviteeId: string, inviterUsername: string): Promise<void> {
  const inviter = await inviterPreview(inviterUsername);
  if (!inviter) return;
  const found = await prisma.user.findUnique({ where: { username: inviter.username }, select: { id: true } });
  if (!found || found.id === inviteeId) return;
  await prisma.referral.create({ data: { inviterId: found.id, inviteeId } }).catch((error: { code?: string }) => {
    // Una cuenta tiene un solo invitador: si ya existe, se conserva el primero.
    if (error.code !== 'P2002') throw error;
  });
}

/** Días de Pro ganados por invitaciones este mes (como invitador y como invitado). */
async function gainedThisMonth(userId: string, now: Date): Promise<number> {
  const since = referralMonthStart(now);
  const [asInviter, asInvitee] = await Promise.all([
    prisma.referral.aggregate({ where: { inviterId: userId, activatedAt: { gte: since } }, _sum: { inviterDays: true } }),
    prisma.referral.aggregate({ where: { inviteeId: userId, activatedAt: { gte: since } }, _sum: { inviteeDays: true } }),
  ]);
  return (asInviter._sum.inviterDays ?? 0) + (asInvitee._sum.inviteeDays ?? 0);
}

/**
 * Llamada tras cada hábito cumplido de la persona invitada. Activa la invitación cuando
 * tiene REFERRAL_ACTIVATION_CHECKINS días distintos con hábitos cumplidos. Devuelve true
 * si esta llamada la activó. La fila se reclama con status PENDING → ACTIVE: solo una
 * petición concurrente gana.
 */
export async function checkReferralActivation(inviteeId: string, now = new Date()): Promise<boolean> {
  const referral = await prisma.referral.findUnique({ where: { inviteeId } });
  if (!referral || referral.status !== 'PENDING') return false;

  const days = await prisma.habitLog.findMany({
    where: { userId: inviteeId, completed: true },
    distinct: ['date'],
    select: { date: true },
    take: REFERRAL_ACTIVATION_CHECKINS,
  });
  if (days.length < REFERRAL_ACTIVATION_CHECKINS) return false;

  const claim = await prisma.referral.updateMany({
    where: { id: referral.id, status: 'PENDING' },
    data: { status: 'ACTIVE', activatedAt: now },
  });
  if (claim.count !== 1) return false;

  // La fila ya reclamada no suma al tope (activatedAt es ahora pero los días aún son 0).
  const inviteeDays = grantableDays(await gainedThisMonth(inviteeId, now), REFERRAL_REWARD_DAYS);
  const inviterDays = grantableDays(await gainedThisMonth(referral.inviterId, now), REFERRAL_REWARD_DAYS);
  await prisma.referral.update({ where: { id: referral.id }, data: { inviteeDays, inviterDays } });
  if (inviteeDays) await extendProAccess(inviteeId, inviteeDays, now);
  if (inviterDays) await extendProAccess(referral.inviterId, inviterDays, now);
  await befriend(referral.inviterId, inviteeId);
  return true;
}

/** Amistad automática al activarse. Si ya existía en cualquier sentido, no se toca. */
async function befriend(a: string, b: string): Promise<void> {
  const exists = await prisma.friendship.findFirst({
    where: { OR: [{ requesterId: a, receiverId: b }, { requesterId: b, receiverId: a }] },
    select: { id: true },
  });
  if (exists) return;
  await prisma.friendship.create({ data: { requesterId: a, receiverId: b, status: 'ACCEPTED' } });
}
