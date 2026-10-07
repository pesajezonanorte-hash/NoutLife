import { prisma } from '../lib/prisma';
import { awardXpAndGold } from './xp.service';
import { checkAchievements } from './achievement.service';
import { createNotification } from './notification.service';
import type { QuestCategory, QuestDifficulty, QuestStatus, QuestType } from '@prisma/client';

export interface CreateQuestInput {
  title: string;
  description?: string;
  type: QuestType;
  difficulty: QuestDifficulty;
  category: QuestCategory;
  xpReward?: number;
  goldReward?: number;
  deadline?: string;
  isRecurring?: boolean;
  subObjectives?: Array<{ title: string; completed?: boolean }>;
  parentQuestId?: string;
}

export interface UpdateQuestInput {
  title?: string;
  description?: string;
  difficulty?: QuestDifficulty;
  category?: QuestCategory;
  xpReward?: number;
  goldReward?: number;
  deadline?: string | null;
  subObjectives?: Array<{ id?: string; title: string; completed?: boolean }>;
  notes?: string;
}

export interface QuestFilters {
  type?: QuestType;
  status?: QuestStatus;
  category?: QuestCategory;
  difficulty?: QuestDifficulty;
  search?: string;
  sortBy?: 'deadline' | 'xp' | 'created' | 'difficulty';
}

const XP_BASE: Record<QuestDifficulty, number> = { EASY: 25, NORMAL: 50, HARD: 100, EPIC: 250 };
const XP_TYPE_MULTIPLIER: Record<QuestType, number> = { DAILY: 1, WEEKLY: 2.5, SIDE: 4, MAIN: 10, META: 8 };
const DIFFICULTY_ORDER: Record<QuestDifficulty, number> = { EASY: 1, NORMAL: 2, HARD: 3, EPIC: 4 };

export function calculateXpReward(difficulty: QuestDifficulty, type: QuestType): number {
  return Math.floor(XP_BASE[difficulty] * XP_TYPE_MULTIPLIER[type]);
}

export function calculateGoldReward(xp: number): number {
  return Math.floor(xp * 0.2);
}

export async function createQuest(userId: string, input: CreateQuestInput) {
  const xpReward = input.xpReward ?? calculateXpReward(input.difficulty, input.type);
  const goldReward = input.goldReward ?? calculateGoldReward(xpReward);

  const subObjectives = (input.subObjectives ?? []).map((obj, i) => ({
    id: String(i + 1),
    title: obj.title,
    completed: obj.completed ?? false,
  }));

  return prisma.quest.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      type: input.type,
      difficulty: input.difficulty,
      category: input.category,
      xpReward,
      goldReward,
      deadline: input.deadline ? new Date(input.deadline) : null,
      isRecurring: input.isRecurring ?? (input.type === 'DAILY' || input.type === 'WEEKLY'),
      subObjectives,
      parentQuestId: input.parentQuestId,
    },
  });
}

export async function listQuests(userId: string, filters: QuestFilters = {}) {
  const where: Record<string, unknown> = { userId };

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = filters.category;
  if (filters.difficulty) where.difficulty = filters.difficulty;
  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' };
  }

  const orderBy: Array<Record<string, string>> = [];
  switch (filters.sortBy) {
    case 'deadline':
      orderBy.push({ deadline: 'asc' });
      break;
    case 'xp':
      orderBy.push({ xpReward: 'desc' });
      break;
    case 'difficulty':
      orderBy.push({ difficulty: 'desc' });
      break;
    default:
      orderBy.push({ status: 'asc' }, { createdAt: 'desc' });
  }

  const quests = await prisma.quest.findMany({ where, orderBy });

  // Sort EPIC quests first within active status
  return quests.sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    if (filters.sortBy === 'difficulty') {
      return DIFFICULTY_ORDER[b.difficulty] - DIFFICULTY_ORDER[a.difficulty];
    }
    return 0;
  });
}

export async function getQuestById(userId: string, questId: string) {
  return prisma.quest.findFirst({
    where: { id: questId, userId },
    include: { completions: { orderBy: { completedAt: 'desc' }, take: 5 } },
  });
}

export async function updateQuest(userId: string, questId: string, input: UpdateQuestInput) {
  const quest = await prisma.quest.findFirst({ where: { id: questId, userId } });
  if (!quest) throw new Error('QUEST_NOT_FOUND');

  const subObjectives = input.subObjectives
    ? input.subObjectives.map((obj, i) => ({
        id: obj.id ?? String(i + 1),
        title: obj.title,
        completed: obj.completed ?? false,
      }))
    : undefined;

  return prisma.quest.update({
    where: { id: questId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.xpReward !== undefined && { xpReward: input.xpReward }),
      ...(input.goldReward !== undefined && { goldReward: input.goldReward }),
      ...(input.deadline !== undefined && { deadline: input.deadline ? new Date(input.deadline) : null }),
      ...(subObjectives !== undefined && { subObjectives }),
    },
  });
}

export async function archiveQuest(userId: string, questId: string) {
  const quest = await prisma.quest.findFirst({ where: { id: questId, userId } });
  if (!quest) throw new Error('QUEST_NOT_FOUND');

  return prisma.quest.update({
    where: { id: questId },
    data: { status: 'ARCHIVED' },
  });
}

export async function failQuest(userId: string, questId: string) {
  const quest = await prisma.quest.findFirst({
    where: { id: questId, userId, status: 'ACTIVE' },
  });
  if (!quest) throw new Error('QUEST_NOT_FOUND');

  return prisma.quest.update({
    where: { id: questId },
    data: { status: 'FAILED' },
  });
}

export async function toggleSubObjective(userId: string, questId: string, subObjectiveId: string, completed: boolean) {
  const quest = await prisma.quest.findFirst({ where: { id: questId, userId } });
  if (!quest) throw new Error('QUEST_NOT_FOUND');

  const subObjectives = quest.subObjectives as Array<{ id: string; title: string; completed: boolean }>;
  const updated = subObjectives.map((obj) =>
    obj.id === subObjectiveId ? { ...obj, completed } : obj
  );

  return prisma.quest.update({
    where: { id: questId },
    data: { subObjectives: updated },
  });
}

export async function completeQuest(userId: string, questId: string) {
  const quest = await prisma.quest.findFirst({
    where: { id: questId, userId, status: 'ACTIVE' },
  });
  if (!quest) throw new Error('QUEST_NOT_FOUND');

  const now = new Date();

  await prisma.quest.update({
    where: { id: questId },
    data: { status: 'COMPLETED', completedAt: now },
  });

  await prisma.questCompletion.create({
    data: { questId, userId, xpEarned: quest.xpReward, goldEarned: quest.goldReward },
  });

  const result = await awardXpAndGold(userId, quest.xpReward, quest.goldReward, 'quest_completed', {
    sourceId: questId,
    description: `Misión completada: ${quest.title}`,
    category: quest.category,
  });

  // Get user metadata for achievement checks
  const userMeta = await prisma.user.findUnique({ where: { id: userId }, select: { birthDate: true, timezone: true } });

  // Calculate local hour using user's timezone (falls back to UTC)
  let completedHour = now.getUTCHours();
  if (userMeta?.timezone) {
    try {
      const localHour = parseInt(
        new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: userMeta.timezone }).format(now),
        10
      );
      if (!isNaN(localHour)) completedHour = localHour % 24;
    } catch { /* invalid timezone string — keep UTC */ }
  }

  // Check achievements after completing quest
  const achievements = await checkAchievements(userId, 'quest_completed', {
    questDifficulty: quest.difficulty,
    questCategory: quest.category,
    completedHour,
    leveledUp: result.leveledUp,
    newLevel: result.newLevel,
    userBirthDate: userMeta?.birthDate ?? null,
  });

  // Personalized in-app notifications
  createNotification(userId, {
    type: 'quest_completed',
    title: `⚔️ "${quest.title}" completada`,
    body: `+${result.xpGained} XP y +${result.goldGained} gold. ${result.leveledUp ? `¡Subiste al nivel ${result.newLevel}! 🎉` : ''}`.trim(),
    icon: '⚔️',
    link: '/quests',
  }).catch(() => {});

  if (result.leveledUp) {
    createNotification(userId, {
      type: 'level_up',
      title: `🌟 ¡Nivel ${result.newLevel} alcanzado!`,
      body: `Tu perseverancia te ha llevado al nivel ${result.newLevel}. Nuevas aventuras te esperan.`,
      icon: '🌟',
      link: '/character',
    }).catch(() => {});
  }

  for (const ach of achievements) {
    createNotification(userId, {
      type: 'achievement',
      title: `${ach.icon} Logro desbloqueado: ${ach.title}`,
      body: ach.description,
      icon: ach.icon,
      link: '/achievements',
    }).catch(() => {});
  }

  const updatedUser = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true, email: true, username: true, displayName: true,
      level: true, xp: true, xpToNextLevel: true, gold: true,
      hp: true, maxHp: true,
      strength: true, intelligence: true, charisma: true,
      avatarConfig: true, timezone: true, currency: true,
      language: true, relationshipStatus: true,
      onboardingCompleted: true, birthDate: true,
      currentStreak: true, longestStreak: true, createdAt: true,
    },
  });

  return {
    rewards: {
      xpEarned: result.xpGained,
      goldEarned: result.goldGained,
      leveledUp: result.leveledUp,
      newLevel: result.leveledUp ? result.newLevel : undefined,
      statIncreases: result.leveledUp ? result.statIncreases : undefined,
    },
    achievementsUnlocked: achievements,
    user: { ...updatedUser, createdAt: updatedUser.createdAt.toISOString() },
  };
}
