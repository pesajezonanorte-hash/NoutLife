// Enlaces de recompensa de un solo uso (los envía el equipo por Instagram). Cada enlace, al
// canjearse, da 7 días de Pro (prueba de regalo desde hoy si no tenía Pro; si ya lo tenía, se suman
// al final de su fecha) y desbloquea y pone el tema exclusivo Calma. El canje es atómico: reclamar
// el token, sumar los días y poner el tema pasan juntos o no pasa nada, y un token reclamado no se
// puede volver a usar, ni por otra cuenta ni por la misma.
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  REWARD_DEFAULT_EXPIRY_DAYS, REWARD_PRO_DAYS, REWARD_THEME_KEY,
  generateRewardToken, hashRewardToken, isRewardToken, rewardLinkStatus,
  type RewardLinkStatus, type RewardOutcome,
} from '../lib/reward-links';
import { addDays } from '../lib/plans';
import { extendProAccessTx, getSubscription } from './billing.service';

export class RewardLinkError extends Error {
  constructor(readonly code: 'invalid' | 'claimed' | 'expired' | 'unavailable', message: string, readonly status: number) {
    super(message);
    this.name = 'RewardLinkError';
  }
}

const UNAVAILABLE: Record<Exclude<RewardLinkStatus, 'available'>, RewardLinkError> = {
  claimed: new RewardLinkError('claimed', 'Este enlace ya se usó.', 410),
  expired: new RewardLinkError('expired', 'Este enlace ya expiró.', 410),
};
const invalid = () => new RewardLinkError('invalid', 'Este enlace no es válido.', 404);

async function findByToken(token: unknown) {
  if (!isRewardToken(token)) return null;
  return prisma.rewardLink.findUnique({ where: { tokenHash: hashRewardToken(token) } });
}

/**
 * Portada pública del enlace (sin sesión): si se puede canjear y qué da. Nunca dice quién lo
 * canjeó ni a quién se envió.
 */
export async function previewRewardLink(token: unknown, now = new Date()) {
  const link = await findByToken(token);
  if (!link) return { status: 'invalid' as const };
  return { status: rewardLinkStatus(link, now), proDays: link.proDays, theme: link.themeKey };
}

/** Desbloquea el tema (inventario) y lo pone en la cuenta: users.equippedTheme es la fuente de verdad. */
async function unlockTheme(tx: Prisma.TransactionClient, userId: string, themeKey: string): Promise<boolean> {
  const item = await tx.shopItem.findFirst({ where: { imageKey: themeKey, type: 'THEME' }, select: { id: true } });
  // El catálogo se siembra en cada build: si falta, se anula todo el canje y el enlace sigue libre.
  if (!item) throw new Error(`[REWARD_THEME_MISSING] ${themeKey}`);
  const owned = await tx.inventoryItem.findFirst({ where: { userId, shopItemId: item.id }, select: { id: true } });
  await tx.inventoryItem.updateMany({ where: { userId, isEquipped: true, shopItem: { type: 'THEME' }, NOT: { shopItemId: item.id } }, data: { isEquipped: false } });
  if (owned) await tx.inventoryItem.update({ where: { id: owned.id }, data: { isEquipped: true } });
  else await tx.inventoryItem.create({ data: { userId, shopItemId: item.id, isEquipped: true } });
  await tx.user.update({ where: { id: userId }, data: { equippedTheme: themeKey } });
  return !owned;
}

export interface RewardClaim {
  outcome: RewardOutcome;
  proDays: number;
  /** Hasta cuándo queda Pro (null con Pro de cortesía). */
  accessEndsAt: string | null;
  theme: string;
  /** false si la cuenta ya tenía el tema (de otro enlace): solo se vuelve a poner. */
  themeUnlocked: boolean;
}

/**
 * Canjea el enlace para la cuenta. La reclamación es un UPDATE condicionado a claimedAt IS NULL y a
 * la vigencia: si dos canjes llegan a la vez, Postgres deja pasar a uno solo. La fila del usuario
 * se bloquea para que la suma de días no se cruce con un cobro o con otra recompensa.
 */
export async function claimRewardLink(userId: string, token: unknown, now = new Date()) {
  if (!isRewardToken(token)) throw invalid();
  const tokenHash = hashRewardToken(token);

  const claim = await prisma.$transaction(async (tx): Promise<RewardClaim> => {
    await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`;
    const took = await tx.rewardLink.updateMany({
      where: { tokenHash, claimedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      data: { claimedAt: now, claimedById: userId },
    });
    if (took.count !== 1) {
      const link = await tx.rewardLink.findUnique({ where: { tokenHash }, select: { claimedAt: true, expiresAt: true } });
      if (!link) throw invalid();
      const status = rewardLinkStatus(link, now);
      throw status === 'available' ? new RewardLinkError('unavailable', 'No pudimos canjear el enlace. Inténtalo de nuevo.', 409) : UNAVAILABLE[status];
    }
    const link = await tx.rewardLink.findUniqueOrThrow({ where: { tokenHash }, select: { id: true, proDays: true, themeKey: true } });

    const grant = await extendProAccessTx(tx, userId, link.proDays, now);
    if (!grant) throw new Error(`[REWARD_GRANT_FAILED] ${userId}`);
    const themeUnlocked = await unlockTheme(tx, userId, link.themeKey);
    await tx.rewardLink.update({ where: { id: link.id }, data: { outcome: grant.outcome } });

    return {
      outcome: grant.outcome,
      proDays: link.proDays,
      accessEndsAt: grant.accessEndsAt?.toISOString() ?? null,
      theme: link.themeKey,
      themeUnlocked,
    };
  });

  console.log('[REWARD_CLAIMED]', userId, claim.outcome);
  return { claim, subscription: await getSubscription(userId), equippedTheme: claim.theme };
}

// ─── Administración ──────────────────────────────────────────────────────────

/**
 * Crea enlaces nuevos. Devuelve el token completo una sola vez: la base solo guarda su huella.
 * expiresInDays null = no vence.
 */
export async function createRewardLinks(input: { count: number; note?: string | null; expiresInDays?: number | null }, createdById: string, now = new Date()) {
  const days = input.expiresInDays === undefined ? REWARD_DEFAULT_EXPIRY_DAYS : input.expiresInDays;
  const expiresAt = days === null ? null : addDays(now, days);
  const note = input.note?.trim() || null;
  const made = Array.from({ length: input.count }, () => ({ token: generateRewardToken() }));
  const rows = await prisma.$transaction(made.map(({ token }) => prisma.rewardLink.create({
    data: { tokenHash: hashRewardToken(token), note, proDays: REWARD_PRO_DAYS, themeKey: REWARD_THEME_KEY, expiresAt, createdById },
    select: { id: true, note: true, expiresAt: true, createdAt: true },
  })));
  return rows.map((row, i) => ({ ...row, token: made[i].token }));
}

/** Últimos enlaces con su estado y, si se canjearon, quién y con qué resultado. */
export async function listRewardLinks(now = new Date()) {
  const links = await prisma.rewardLink.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
  const ids = [...new Set(links.map((link) => link.claimedById).filter((id): id is string => Boolean(id)))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, username: true, displayName: true } })
    : [];
  const byId = new Map(users.map((user) => [user.id, user]));
  return links.map((link) => ({
    id: link.id,
    note: link.note,
    proDays: link.proDays,
    theme: link.themeKey,
    status: rewardLinkStatus(link, now),
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    claimedAt: link.claimedAt,
    outcome: link.outcome,
    // Cuenta borrada después del canje: queda el registro sin nombre.
    claimedBy: link.claimedById ? byId.get(link.claimedById) ?? { id: link.claimedById, username: null, displayName: null } : null,
  }));
}

/** Anula un enlace sin canjear (por ejemplo, si se envió a quien no era): vence ahora. */
export async function revokeRewardLink(id: string, now = new Date()) {
  const done = await prisma.rewardLink.updateMany({ where: { id, claimedAt: null }, data: { expiresAt: now } });
  if (!done.count) throw new RewardLinkError('unavailable', 'Ese enlace ya se canjeó o no existe.', 409);
}
