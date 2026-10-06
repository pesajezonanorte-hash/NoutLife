import { prisma } from '../lib/prisma';
import { awardXpAndGold } from './xp.service';
import { createNotification } from './notification.service';
import { sanitizeAvatar } from './shop.service';

const USER_SELECT = {
  id: true, email: true, username: true, displayName: true,
  level: true, xp: true, xpToNextLevel: true, gold: true,
  hp: true, maxHp: true, mp: true, maxMp: true,
  strength: true, intelligence: true, charisma: true,
  avatarConfig: true, avatarUrl: true, nameColor: true, timezone: true, currency: true,
  language: true, relationshipStatus: true,
  onboardingCompleted: true, birthDate: true,
  currentStreak: true, longestStreak: true, lastActivityDate: true,
  gymPlaylistUrl: true,
  equippedHat: true, equippedAura: true, equippedFrame: true, equippedTheme: true,
  createdAt: true,
} as const;

const SEVEN_DAY_GUIDE = [
  { day: 1, title: 'Tu primera misión', zone: 'misiones', route: '/quests', xpBonus: 50 },
  { day: 2, title: 'Tu primer hábito', zone: 'habitos', route: '/habits', xpBonus: 50 },
  { day: 3, title: 'Conoce tu Bóveda', zone: 'boveda', route: '/finances', xpBonus: 50 },
  { day: 4, title: 'El Coliseo te espera', zone: 'coliseo', route: '/gym', xpBonus: 50 },
  { day: 5, title: 'Habla con el Sabio', zone: 'sabio', route: '/wisdom', xpBonus: 75 },
  { day: 6, title: 'Escribe en el Diario', zone: 'diario', route: '/journal', xpBonus: 50 },
  { day: 7, title: 'Revisa tu Life Score', zone: 'estadisticas', route: '/stats', xpBonus: 100, celebration: true },
] as const;

export async function getCharacter(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      ...USER_SELECT,
      inventoryItems: {
        where: { isEquipped: true },
        include: { shopItem: true },
      },
      achievements: {
        include: { achievement: true },
        orderBy: { unlockedAt: 'desc' },
        take: 5,
      },
    },
  });

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    lastActivityDate: user.lastActivityDate?.toISOString() ?? null,
    birthDate: user.birthDate?.toISOString() ?? null,
  };
}

export async function updateAvatar(userId: string, avatarConfig: Record<string, unknown>) {
  // Lo de pago solo lo lleva quien lo compró en la Tienda.
  const clean = await sanitizeAvatar(userId, avatarConfig);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarConfig: clean as Parameters<typeof prisma.user.update>[0]['data']['avatarConfig'] },
    select: USER_SELECT,
  });

  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    lastActivityDate: updated.lastActivityDate?.toISOString() ?? null,
    birthDate: updated.birthDate?.toISOString() ?? null,
  };
}

export interface OnboardingData {
  displayName?: string;
  birthDate?: string;
  timezone?: string;
  avatarConfig?: Record<string, unknown>;
  goalCategories?: string[];
  mainQuestTitle?: string;
  mainQuestCategory?: string;
  mainQuestDeadline?: string;
}

export async function completeOnboarding(userId: string, data: OnboardingData) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      displayName: data.displayName,
      birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      timezone: data.timezone,
      avatarConfig: data.avatarConfig as Parameters<typeof prisma.user.update>[0]['data']['avatarConfig'],
    },
  });

  // Create main quest from onboarding if provided
  if (data.mainQuestTitle) {
    await prisma.quest.create({
      data: {
        userId,
        title: data.mainQuestTitle,
        type: 'MAIN',
        difficulty: 'EPIC',
        category: (data.mainQuestCategory as never) ?? 'PERSONAL',
        xpReward: 500,
        goldReward: 200,
        deadline: data.mainQuestDeadline ? new Date(data.mainQuestDeadline) : new Date(new Date().getFullYear(), 11, 31),
        subObjectives: [],
      },
    });
  }

  const updated = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: USER_SELECT,
  });

  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    lastActivityDate: updated.lastActivityDate?.toISOString() ?? null,
    birthDate: updated.birthDate?.toISOString() ?? null,
  };
}

export async function updateProfile(userId: string, data: { displayName?: string; timezone?: string; currency?: string; language?: string; gymPlaylistUrl?: string | null; avatarUrl?: string | null }) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.language !== undefined ? { language: data.language } : {}),
      ...(data.gymPlaylistUrl !== undefined ? { gymPlaylistUrl: data.gymPlaylistUrl } : {}),
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
    },
    select: { ...USER_SELECT, gymPlaylistUrl: true },
  });
  return {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    lastActivityDate: updated.lastActivityDate?.toISOString() ?? null,
    birthDate: updated.birthDate?.toISOString() ?? null,
  };
}

// ─── Player Class ─────────────────────────────────────────────────────────────

const CLASS_COOLDOWN_DAYS = 30;
const VALID_CLASSES = ['warrior', 'mage', 'merchant', 'paladin'] as const;

export async function chooseClass(userId: string, playerClass: string) {
  if (!VALID_CLASSES.includes(playerClass as never)) throw new Error('Clase inválida');

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true, playerClass: true, classChosenAt: true } });
  if (user.level < 10) throw new Error('Necesitas nivel 10 para elegir una clase');

  if (user.classChosenAt) {
    const daysSince = (Date.now() - user.classChosenAt.getTime()) / 86400000;
    if (daysSince < CLASS_COOLDOWN_DAYS) {
      throw new Error(`Puedes cambiar de clase en ${Math.ceil(CLASS_COOLDOWN_DAYS - daysSince)} días`);
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: { playerClass, classChosenAt: new Date() },
    select: { playerClass: true, classChosenAt: true },
  });
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const FREE_THEMES = ['aurora'];
const PAID_THEMES: Record<string, number> = { cyber: 200, forest: 200, ocean: 200, sunset: 300, retro_snes: 500 };

export async function setTheme(userId: string, theme: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { gold: true } });

  if (!FREE_THEMES.includes(theme)) {
    const cost = PAID_THEMES[theme];
    if (cost === undefined) throw new Error('Tema no existe');
    // Check inventory (purchased theme)
    const owned = await prisma.inventoryItem.findFirst({
      where: { userId, shopItem: { name: { contains: theme, mode: 'insensitive' } } },
    });
    if (!owned) throw new Error(`Necesitas comprar el tema ${theme} en la tienda`);
  }

  return prisma.user.update({
    where: { id: userId },
    data: { activeTheme: theme },
    select: { activeTheme: true },
  });
}

// ─── Bedtime Goal ─────────────────────────────────────────────────────────────

export async function setBedtimeGoal(userId: string, bedtimeGoal: string | null) {
  return prisma.user.update({
    where: { id: userId },
    data: { bedtimeGoal },
    select: { bedtimeGoal: true },
  });
}

export async function equipItem(userId: string, inventoryItemId: string) {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, userId },
    include: { shopItem: true },
  });
  if (!item) throw new Error('ITEM_NOT_FOUND');

  // Unequip items of same type
  const equipped = await prisma.inventoryItem.findMany({
    where: { userId, isEquipped: true },
    include: { shopItem: true },
  });

  for (const eq of equipped) {
    if (eq.shopItem.type === item.shopItem.type) {
      await prisma.inventoryItem.update({ where: { id: eq.id }, data: { isEquipped: false } });
    }
  }

  const updated = await prisma.inventoryItem.update({
    where: { id: inventoryItemId },
    data: { isEquipped: !item.isEquipped },
    include: { shopItem: true },
  });

  return updated;
}

export async function completeGuideDay(userId: string, day: number) {
  const guideDay = SEVEN_DAY_GUIDE.find((entry) => entry.day === day);
  if (!guideDay) throw new Error('GUIDE_DAY_INVALID');

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      sevenDayGuideCompletedDays: true,
      sevenDayGuideCompletedAt: true,
    },
  });

  const completedDays = Array.isArray(user.sevenDayGuideCompletedDays)
    ? (user.sevenDayGuideCompletedDays as number[])
    : [];

  if (completedDays.includes(day)) {
    return { alreadyCompleted: true, day, completedDays, guideCompleted: Boolean(user.sevenDayGuideCompletedAt) };
  }

  const nextCompletedDays = [...completedDays, day].sort((a, b) => a - b);

  const reward = await awardXpAndGold(
    userId,
    guideDay.xpBonus,
    0,
    'seven_day_guide',
    { sourceId: `guide-day-${day}`, description: `Guía de 7 días completada: ${guideDay.title}` }
  );

  const guideCompleted = nextCompletedDays.length >= SEVEN_DAY_GUIDE.length;

  await prisma.user.update({
    where: { id: userId },
    data: {
      sevenDayGuideCompletedDays: nextCompletedDays,
      ...(guideCompleted ? { sevenDayGuideCompletedAt: new Date() } : {}),
    },
  });

  createNotification(userId, {
    type: 'guide',
    title: `🗺️ Día ${day} completado`,
    body: `${guideDay.title}: +${guideDay.xpBonus} XP.`,
    icon: '🗺️',
    link: guideDay.route,
  }).catch(() => {});

  let achievementUnlocked = false;
  if (guideCompleted) {
    const achievement = await ensureFirstWeekAchievement();
    const alreadyUnlocked = await prisma.userAchievement.findFirst({
      where: { userId, achievementId: achievement.id },
      select: { id: true },
    });

    if (!alreadyUnlocked) {
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });
      achievementUnlocked = true;
    }

    createNotification(userId, {
      type: 'achievement',
      title: '🏆 Logro desbloqueado: Primera Semana',
      body: 'Completaste la Semana del Héroe.',
      icon: '🏆',
      link: '/achievements',
    }).catch(() => {});
  }

  return {
    alreadyCompleted: false,
    day,
    completedDays: nextCompletedDays,
    guideCompleted,
    celebration: 'celebration' in guideDay ? Boolean(guideDay.celebration) : false,
    achievementUnlocked,
    rewards: {
      xpEarned: reward.xpGained,
      goldEarned: reward.goldGained,
      leveledUp: reward.leveledUp,
      newLevel: reward.leveledUp ? reward.newLevel : undefined,
      statIncreases: reward.leveledUp ? reward.statIncreases : undefined,
    },
  };
}

export async function dismissGuide(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { sevenDayGuideDismissedAt: new Date() },
  });

  return { dismissed: true };
}

async function ensureFirstWeekAchievement() {
  const existing = await prisma.achievement.findUnique({
    where: { key: 'first_week' },
  });

  if (existing) return existing;

  return prisma.achievement.create({
    data: {
      key: 'first_week',
      title: 'Primera Semana',
      description: 'Completaste la Semana del Héroe.',
      icon: '🏆',
      category: 'special',
      xpReward: 0,
    },
  });
}
