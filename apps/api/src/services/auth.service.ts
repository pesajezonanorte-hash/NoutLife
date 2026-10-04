import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import type { RegisterInput, LoginInput } from '../schemas/auth.schemas';
import { checkAchievements } from './achievement.service';

const BCRYPT_ROUNDS = 12;

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
  mp: number;
  maxMp: number;
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
    mp: user.mp,
    maxMp: user.maxMp,
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

/** Reports whether the email or username is already taken, without creating anything. */
export async function checkAvailability(data: Pick<RegisterInput, 'email' | 'username'>) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const username = data.username.trim();
  const existing = await prisma.user.findMany({
    where: { OR: [{ email: normalizedEmail }, { username }] },
    select: { email: true, username: true },
  });
  return {
    emailTaken: existing.some((u) => u.email === normalizedEmail),
    usernameTaken: existing.some((u) => u.username === username),
  };
}

export async function registerUser(data: RegisterInput) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { username: data.username.trim() }] },
  });

  if (existing) {
    if (existing.email === normalizedEmail) throw new Error('EMAIL_TAKEN');
    throw new Error('USERNAME_TAKEN');
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const bodyType = data.gender ?? 'male';
  const avatarConfig = {
    bodyType,
    hairStyle: bodyType === 'female' ? 'long' : 'short',
    hairColor: '#4a3728',
    skinColor: '#c68642',
    shirtColor: '#4d96ff',
    pants: '#37474f',
    accessory: 'none',
    expression: 'normal',
    pet: null,
  };

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username: data.username.trim(),
      passwordHash,
      displayName: data.displayName ?? data.username.trim(),
      avatarConfig,
    },
  });

  const payload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash, lastLoginAt: new Date() },
  });

  // Trigger first_login achievement silently (don't block registration)
  checkAchievements(user.id, 'user_registered', { currentStreak: 0 }).catch(() => {});

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function loginUser(data: LoginInput) {
  const normalizedEmail = data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) throw new Error('INVALID_CREDENTIALS');

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  const { reconcileUserActivityStreak } = await import('./xp.service');
  const reconciledStreak = await reconcileUserActivityStreak(user.id);
  const userForResponse = reconciledStreak === user.currentStreak
    ? user
    : { ...user, currentStreak: reconciledStreak };

  const payload = { userId: user.id, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash, lastLoginAt: new Date() },
  });

  // Check login_30 achievement silently
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

  const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!valid) throw new Error('INVALID_REFRESH_TOKEN');

  const { reconcileUserActivityStreak } = await import('./xp.service');
  const reconciledStreak = await reconcileUserActivityStreak(user.id);
  const userForResponse = reconciledStreak === user.currentStreak
    ? user
    : { ...user, currentStreak: reconciledStreak };

  const newAccessToken = signAccessToken({ userId: user.id, email: user.email });
  return { accessToken: newAccessToken, user: sanitizeUser(userForResponse) };
}

export async function logoutUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null },
  });
}
