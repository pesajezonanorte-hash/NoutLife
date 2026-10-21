// Invitaciones de doble vía (plan v3, T9). Quien invita y quien entra reciben 7 días de Pro
// cuando la persona invitada usa NoutLife de verdad: 3 días distintos con hábitos cumplidos
// (con 12 h entre dos de ellos) y al menos un espacio creado (página de Libreta, meta
// principal u obstáculo). Un auto-referido (mismo dispositivo que la invitadora) se marca y
// no recibe recompensa. Cada cuenta tiene como mucho un invitador; cada persona gana como
// mucho 30 días al mes por invitaciones.
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { isDeviceId } from '../lib/device';
import {
  REFERRAL_REWARD_DAYS, grantableDays, pickSpacedCheckins, referralVerdict, sharesDevice,
} from '../lib/referrals';
import { extendProAccessTx } from './billing.service';

/** Nombre público de quien invita (la portada /i/:username). Sin correo ni datos privados. */
export async function inviterPreview(username: string) {
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return null;
  return prisma.user.findUnique({ where: { username }, select: { username: true, displayName: true } });
}

/**
 * Guarda un dispositivo de la cuenta (inicio de sesión y renovación de sesión). Solo sirve para
 * detectar auto-referidos: nunca bloquea el acceso ni rompe la sesión.
 */
export async function recordDevice(userId: string, deviceId: string | null | undefined): Promise<void> {
  if (!isDeviceId(deviceId)) return;
  await prisma.userDevice.upsert({
    where: { userId_deviceId: { userId, deviceId } },
    create: { userId, deviceId },
    update: { lastSeenAt: new Date() },
  }).catch((error) => console.error('[DEVICE_RECORD_ERROR]', userId, error));
}

async function devicesOf(userId: string): Promise<string[]> {
  const rows = await prisma.userDevice.findMany({ where: { userId }, select: { deviceId: true } });
  return rows.map((row) => row.deviceId);
}

/**
 * Registra la invitación al crear la cuenta. Si el dispositivo de registro ya es de la
 * invitadora, la relación se guarda igual pero marcada (flaggedSelfReferral): sin recompensa y sin
 * mensaje a la persona. Ignora nombres inexistentes.
 */
export async function attachReferral(inviteeId: string, inviterUsername: string, deviceId?: string | null): Promise<void> {
  const inviter = await inviterPreview(inviterUsername);
  if (!inviter) return;
  const found = await prisma.user.findUnique({ where: { username: inviter.username }, select: { id: true } });
  if (!found) return;
  await recordDevice(inviteeId, deviceId);
  const sameAccount = found.id === inviteeId;
  const sameDevice = isDeviceId(deviceId) && sharesDevice(await devicesOf(found.id), [deviceId]);
  await prisma.referral.create({
    data: { inviterId: found.id, inviteeId, flaggedSelfReferral: sameAccount || sameDevice },
  }).catch((error: { code?: string }) => {
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
 * Uso real del espacio desde que se aceptó la invitación: una página de la Libreta escrita (la
 * página no guarda fecha de creación; solo se escribe la propia persona, así que se usa
 * updatedAt), una meta principal (misión MAIN) o un obstáculo creado.
 */
export async function hasSpaceInteraction(userId: string, since: Date): Promise<boolean> {
  const [page, goal, obstacle] = await Promise.all([
    prisma.notebookPage.findFirst({ where: { notebook: { userId }, updatedAt: { gte: since } }, select: { id: true } }),
    prisma.quest.findFirst({ where: { userId, type: 'MAIN', createdAt: { gte: since } }, select: { id: true } }),
    prisma.antiHabit.findFirst({ where: { userId, createdAt: { gte: since } }, select: { id: true } }),
  ]);
  return Boolean(page || goal || obstacle);
}

/** Gancho para cualquier espacio que la persona usa: no rompe la acción que lo llamó. */
export async function onSpaceUsed(userId: string): Promise<void> {
  await checkReferralActivation(userId).catch((error) => console.error('[REFERRAL_CHECK_ERROR]', userId, error));
}

/**
 * Llamada tras cada acción de la persona invitada que puede completar la activación (un hábito
 * cumplido, una página, una meta o un obstáculo). Decide con referralVerdict: 'flag' marca un
 * auto-referido de forma permanente; 'activate' da los días a los dos en una transacción que
 * bloquea a las cuentas (el tope mensual siempre se lee con lo ya concedido); 'wait' no hace nada.
 * Devuelve true si esta llamada activó la invitación.
 */
export async function checkReferralActivation(inviteeId: string, now = new Date()): Promise<boolean> {
  const referral = await prisma.referral.findUnique({
    where: { inviteeId },
    select: { id: true, inviterId: true, status: true, flaggedSelfReferral: true, createdAt: true },
  });
  if (!referral || referral.status !== 'PENDING' || referral.flaggedSelfReferral) return false;

  const space = await hasSpaceInteraction(inviteeId, referral.createdAt);
  const shared = sharesDevice(await devicesOf(referral.inviterId), await devicesOf(inviteeId));
  let spaced = 0;
  if (space && !shared) {
    // Sin espacio usado no hace falta leer los hábitos; el veredicto ya sería 'wait'.
    const logs = await prisma.habitLog.findMany({
      where: { userId: inviteeId, completed: true },
      select: { date: true, loggedAt: true },
      orderBy: { loggedAt: 'asc' },
      take: 500,
    });
    spaced = pickSpacedCheckins(logs.map((log) => ({ day: log.date.toISOString().slice(0, 10), at: log.loggedAt })));
  }

  const verdict = referralVerdict({ flagged: false, sharedDevice: shared, spacedCheckins: spaced, spaceInteraction: space });
  if (verdict === 'flag') {
    await prisma.referral.updateMany({ where: { id: referral.id, status: 'PENDING' }, data: { flaggedSelfReferral: true } });
    return false;
  }
  if (verdict === 'wait') return false;

  return prisma.$transaction(async (tx) => {
    // Bloqueo en orden de id para que dos transacciones nunca esperen una a la otra en cruz.
    const [first, second] = [inviteeId, referral.inviterId].sort();
    await tx.$queryRaw`SELECT id FROM "users" WHERE id IN (${first}, ${second}) ORDER BY id FOR UPDATE`;

    const claim = await tx.referral.updateMany({
      where: { id: referral.id, status: 'PENDING', flaggedSelfReferral: false },
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
