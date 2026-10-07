import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import type { OAuthInput } from '../schemas/auth.schemas';
import { verifyIdToken, type OAuthIdentity } from '../lib/oauth';
import { checkAchievements } from './achievement.service';

function sanitizeUser(user: {
  id: string;
  email: string;
  username: string;
  displayName: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  gold: number;
  hp: number;
  maxHp: number;
  strength: number;
  intelligence: number;
  charisma: number;
  avatarConfig: unknown;
  avatarUrl?: string | null;
  timezone: string;
  currency: string;
  language: string;
  relationshipStatus: string;
  onboardingCompleted: boolean;
  birthDate: Date | null;
  currentStreak: number;
  longestStreak: number;
  gymPlaylistUrl?: string | null;
  equippedHat?: string | null;
  equippedAura?: string | null;
  equippedFrame?: string | null;
  equippedTheme?: string | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    level: user.level,
    xp: user.xp,
    xpToNextLevel: user.xpToNextLevel,
    gold: user.gold,
    hp: user.hp,
    maxHp: user.maxHp,
    strength: user.strength,
    intelligence: user.intelligence,
    charisma: user.charisma,
    avatarConfig: user.avatarConfig,
    avatarUrl: user.avatarUrl ?? null,
    timezone: user.timezone,
    currency: user.currency,
    language: user.language,
    relationshipStatus: user.relationshipStatus,
    onboardingCompleted: user.onboardingCompleted,
    birthDate: user.birthDate?.toISOString() ?? null,
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    gymPlaylistUrl: user.gymPlaylistUrl ?? null,
    equippedHat: user.equippedHat ?? null,
    equippedAura: user.equippedAura ?? null,
    equippedFrame: user.equippedFrame ?? null,
    equippedTheme: user.equippedTheme ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Sesiones: cada usuario tiene una «familia» (refreshTokenHash guarda su id, no
 * un hash por token). Todos sus dispositivos comparten la familia, así iniciar
 * sesión en el móvil no cierra la del ordenador. Cerrar sesión la borra y
 * revoca todos los tokens. Los tokens antiguos (hash bcrypt, sin fid) se
 * aceptan una vez y se migran.
 */
const FAMILY_PREFIX = 'fam_';
const isFamily = (v: string | null | undefined): v is string => Boolean(v?.startsWith(FAMILY_PREFIX));

async function issueSession(user: { id: string; email: string; refreshTokenHash: string | null }) {
  const fid = isFamily(user.refreshTokenHash) ? user.refreshTokenHash : FAMILY_PREFIX + randomBytes(18).toString('base64url');
  await prisma.user.update({ where: { id: user.id }, data: { refreshTokenHash: fid, lastLoginAt: new Date() } });
  const payload = { userId: user.id, email: user.email };
  return { accessToken: signAccessToken(payload), refreshToken: signRefreshToken({ ...payload, fid }) };
}

/** Usuario libre a partir del email o el nombre: 3–20 letras, números o _. */
async function uniqueUsername(seed: string) {
  const base = (seed.normalize('NFD').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 14) || 'heroe').padEnd(3, '0');
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    if (!await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } })) return candidate;
  }
  return `heroe${randomBytes(5).toString('hex')}`;
}

/**
 * Busca la cuenta por el id estable del proveedor; si no existe, la enlaza por
 * email verificado (cuentas antiguas con contraseña) o crea una nueva. Las
 * cuentas nuevas empiezan sin onboarding y la app las lleva a completarlo.
 */
async function findOrCreateUser(identity: OAuthIdentity, displayName?: string) {
  const subField = identity.provider === 'google' ? 'googleSub' : 'appleSub';
  const bySub = await prisma.user.findFirst({ where: { [subField]: identity.sub } });
  if (bySub) return bySub;

  if (!identity.email || !identity.emailVerified) throw new Error('OAUTH_EMAIL_UNVERIFIED');

  const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
  if (byEmail) {
    return prisma.user.update({ where: { id: byEmail.id }, data: { [subField]: identity.sub } });
  }

  const name = (identity.name ?? displayName ?? '').trim().slice(0, 50);
  const user = await prisma.user.create({
    data: {
      email: identity.email,
      username: await uniqueUsername(identity.email.split('@')[0]),
      displayName: name.length >= 2 ? name : 'Héroe',
      [subField]: identity.sub,
      avatarConfig: {
        bodyType: 'male', hairStyle: 'short', hairColor: '#4a3728', skinColor: '#c68642',
        shirtColor: '#4d96ff', pants: '#37474f', accessory: 'none', expression: 'normal', pet: null,
      },
    },
  });
  checkAchievements(user.id, 'user_registered', { currentStreak: 0 }).catch(() => {});
  return user;
}

/** Inicio de sesión único: Google o Apple. No hay contraseñas. */
export async function oauthSignIn(data: OAuthInput) {
  const identity = await verifyIdToken(data.provider, data.idToken);
  const user = await findOrCreateUser(identity, data.displayName);

  const { reconcileUserActivityStreak } = await import('./xp.service');
  const reconciledStreak = await reconcileUserActivityStreak(user.id);
  const userForResponse = reconciledStreak === user.currentStreak ? user : { ...user, currentStreak: reconciledStreak };

  const { accessToken, refreshToken } = await issueSession(user);
  checkAchievements(user.id, 'user_login', { currentStreak: userForResponse.currentStreak }).catch(() => {});
  return { user: sanitizeUser(userForResponse), accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string) {
  let payload: { userId: string; email: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user?.refreshTokenHash) throw new Error('INVALID_REFRESH_TOKEN');

  const valid = isFamily(user.refreshTokenHash)
    ? (payload as { fid?: string }).fid === user.refreshTokenHash
    : await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!valid) throw new Error('INVALID_REFRESH_TOKEN');

  const { reconcileUserActivityStreak } = await import('./xp.service');
  const reconciledStreak = await reconcileUserActivityStreak(user.id);
  const userForResponse = reconciledStreak === user.currentStreak
    ? user
    : { ...user, currentStreak: reconciledStreak };

  // Renovación deslizante: cada refresh entrega un token nuevo de la misma familia.
  const { accessToken, refreshToken: nextRefreshToken } = await issueSession(user);
  return { accessToken, refreshToken: nextRefreshToken, user: sanitizeUser(userForResponse) };
}

export async function logoutUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null },
  });
}
