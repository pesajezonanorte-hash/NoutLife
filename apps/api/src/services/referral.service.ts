// Invitaciones de doble vía (plan v3, T9). Quien invita y quien entra reciben 7 días de
// Pro cuando la persona invitada tiene 3 días distintos con hábitos cumplidos. Cada cuenta
// tiene como mucho un invitador y cada persona gana como mucho 30 días al mes por invitaciones.
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { REFERRAL_ACTIVATION_CHECKINS, REFERRAL_REWARD_DAYS, grantableDays } from '../lib/referrals';
import { extendProAccessTx } from './billing.service';

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

/**
 * Días de Pro ganados por invitaciones en el mes UTC en curso. La ventana la calcula la
 * base: date_trunc sobre la hora UTC, así el mes no depende de la zona del servidor.
 */
async function gainedThisMonth(tx: Prisma.TransactionClient, userId: string): Promise<number> {
  const [row] = await tx.$queryRaw<Array<{ gained: number }>>`
    SELECT (
      COALESCE(SUM(CASE WHEN "inviterId" = ${userId} THEN "inviterDays" ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN "inviteeId" = ${userId} THEN "inviteeDays" ELSE 0 END), 0)
    )::int AS gained
    FROM "referrals"
    WHERE ("inviterId" = ${userId} OR "inviteeId" = ${userId})
      AND "activatedAt" >= date_trunc('month', timezone('UTC', now()))`;
  return row?.gained ?? 0;
}

/**
 * Llamada tras cada hábito cumplido nuevo de la persona invitada. Activa la invitación cuando
 * tiene REFERRAL_ACTIVATION_CHECKINS días distintos con hábitos cumplidos. Todo el cambio va en
 * una transacción que bloquea a las dos cuentas: dos activaciones simultáneas se turnan y el
 * tope mensual siempre se lee con los días ya concedidos. Devuelve true si esta llamada activó.
 */
export async function checkReferralActivation(inviteeId: string, now = new Date()): Promise<boolean> {
  const referral = await prisma.referral.findUnique({
    where: { inviteeId }, select: { id: true, inviterId: true, status: true },
  });
  if (!referral || referral.status !== 'PENDING') return false;

  const days = await prisma.habitLog.findMany({
    where: { userId: inviteeId, completed: true },
    distinct: ['date'],
    select: { date: true },
    take: REFERRAL_ACTIVATION_CHECKINS,
  });
  if (days.length < REFERRAL_ACTIVATION_CHECKINS) return false;

  return prisma.$transaction(async (tx) => {
    // Bloqueo en orden de id para que dos transacciones nunca esperen una a la otra en cruz.
    const [first, second] = [inviteeId, referral.inviterId].sort();
    await tx.$queryRaw`SELECT id FROM "users" WHERE id IN (${first}, ${second}) ORDER BY id FOR UPDATE`;

    const claim = await tx.referral.updateMany({
      where: { id: referral.id, status: 'PENDING' },
      data: { status: 'ACTIVE', activatedAt: now },
    });
    if (claim.count !== 1) return false;

    // La fila recién reclamada aún tiene 0 días: no suma al tope de su propio cálculo.
    const inviteeDays = grantableDays(await gainedThisMonth(tx, inviteeId), REFERRAL_REWARD_DAYS);
    const inviterDays = grantableDays(await gainedThisMonth(tx, referral.inviterId), REFERRAL_REWARD_DAYS);
    await tx.referral.update({ where: { id: referral.id }, data: { inviteeDays, inviterDays } });
    if (inviteeDays) await extendProAccessTx(tx, inviteeId, inviteeDays, now);
    if (inviterDays) await extendProAccessTx(tx, referral.inviterId, inviterDays, now);
    await befriend(tx, referral.inviterId, inviteeId);
    return true;
  });
}

/** Amistad automática al activarse. Si ya existía en cualquier sentido, no se toca. */
async function befriend(tx: Prisma.TransactionClient, a: string, b: string): Promise<void> {
  const exists = await tx.friendship.findFirst({
    where: { OR: [{ requesterId: a, receiverId: b }, { requesterId: b, receiverId: a }] },
    select: { id: true },
  });
  if (exists) return;
  await tx.friendship.create({ data: { requesterId: a, receiverId: b, status: 'ACCEPTED' } });
}
