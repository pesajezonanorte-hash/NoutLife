import { settleLevel } from './xp.service';
import { prisma } from '../lib/prisma';
import type { QuestCategory, QuestDifficulty } from '@prisma/client';

export interface AchievementCheckEvent {
  questDifficulty?: QuestDifficulty;
  questCategory?: QuestCategory;
  completedHour?: number;
  habitStreak?: number;
  leveledUp?: boolean;
  newLevel?: number;
  currentStreak?: number;
  userBirthDate?: Date | null;
}

export interface UnlockedAchievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

/** A workout counts once it is finished, which is when it earns XP. */
const countFinishedWorkouts = (userId: string) => prisma.workout.count({ where: { userId, xpEarned: { gt: 0 } } });

export async function checkAchievements(
  userId: string,
  event: string,
  context: AchievementCheckEvent = {}
): Promise<UnlockedAchievement[]> {
  const newly: UnlockedAchievement[] = [];

  // Get all achievements + already unlocked by user
  const [allAchievements, userAchievements] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);

  const unlockedIds = new Set(userAchievements.map((ua) => ua.achievementId));

  const totalQuests = await prisma.questCompletion.count({ where: { userId } });
  const totalHabits = await prisma.habit.count({ where: { userId, isActive: true } });
  let totalWorkouts: number | undefined;

  for (const achievement of allAchievements) {
    if (unlockedIds.has(achievement.id)) continue;

    let shouldUnlock = false;

    switch (achievement.key) {
      case 'first_quest':
        shouldUnlock = event === 'quest_completed' && totalQuests >= 1;
        break;
      case 'quests_10':
        shouldUnlock = event === 'quest_completed' && totalQuests >= 10;
        break;
      case 'quests_50':
        shouldUnlock = event === 'quest_completed' && totalQuests >= 50;
        break;
      case 'quests_100':
        shouldUnlock = event === 'quest_completed' && totalQuests >= 100;
        break;
      case 'quests_500':
        shouldUnlock = event === 'quest_completed' && totalQuests >= 500;
        break;
      case 'epic_quest':
        shouldUnlock = event === 'quest_completed' && context.questDifficulty === 'EPIC';
        break;
      case 'early_bird':
        shouldUnlock = event === 'quest_completed' &&
          (context.completedHour ?? 12) >= 3 && (context.completedHour ?? 12) < 7;
        break;
      case 'night_owl':
        shouldUnlock = event === 'quest_completed' && (context.completedHour ?? 12) >= 23;
        break;
      case 'fitness_25': {
        const fitnessCount = await prisma.questCompletion.count({ where: { userId, quest: { category: 'FITNESS' } } });
        shouldUnlock = fitnessCount >= 25;
        break;
      }
      case 'learning_10': {
        const learningCount = await prisma.questCompletion.count({ where: { userId, quest: { category: 'LEARNING' } } });
        shouldUnlock = learningCount >= 10;
        break;
      }
      case 'love_10': {
        const loveCount = await prisma.questCompletion.count({ where: { userId, quest: { category: 'LOVE' } } });
        shouldUnlock = loveCount >= 10;
        break;
      }
      case 'health_20': {
        const healthCount = await prisma.questCompletion.count({ where: { userId, quest: { category: 'HEALTH' } } });
        shouldUnlock = healthCount >= 20;
        break;
      }
      case 'social_butterfly': {
        const socialCount = await prisma.questCompletion.count({ where: { userId, quest: { category: 'SOCIAL' } } });
        shouldUnlock = socialCount >= 10;
        break;
      }
      case 'creative_mind': {
        const creativeCount = await prisma.questCompletion.count({ where: { userId, quest: { category: 'CREATIVE' } } });
        shouldUnlock = creativeCount >= 10;
        break;
      }
      case 'streak_7':
        shouldUnlock = (event === 'habit_logged' || event === 'quest_completed') && (context.habitStreak ?? 0) >= 7;
        break;
      case 'streak_30':
        shouldUnlock = (event === 'habit_logged' || event === 'quest_completed') && (context.habitStreak ?? 0) >= 30;
        break;
      case 'streak_100':
        shouldUnlock = (event === 'habit_logged' || event === 'quest_completed') && (context.habitStreak ?? 0) >= 100;
        break;
      case 'first_habit':
        shouldUnlock = event === 'habit_created' && totalHabits >= 1;
        break;
      case 'habits_5':
        shouldUnlock = event === 'habit_created' && totalHabits >= 5;
        break;
      case 'level_5':
        shouldUnlock = context.leveledUp === true && (context.newLevel ?? 0) >= 5;
        break;
      case 'level_10':
        shouldUnlock = context.leveledUp === true && (context.newLevel ?? 0) >= 10;
        break;
      case 'level_25':
        shouldUnlock = context.leveledUp === true && (context.newLevel ?? 0) >= 25;
        break;
      case 'level_50':
        shouldUnlock = context.leveledUp === true && (context.newLevel ?? 0) >= 50;
        break;
      case 'level_100':
        shouldUnlock = context.leveledUp === true && (context.newLevel ?? 0) >= 100;
        break;
      case 'first_login':
        // Login too: accounts created before this catalog existed never got it.
        shouldUnlock = event === 'user_registered' || event === 'user_login';
        break;
      case 'first_workout':
      case 'workouts_10':
      case 'workouts_50':
        if (event === 'workout_finished') {
          totalWorkouts ??= await countFinishedWorkouts(userId);
          shouldUnlock = totalWorkouts >= (achievement.progressTarget ?? Infinity);
        }
        break;
      case 'login_30':
        shouldUnlock = (event === 'user_login' || event === 'user_registered') && (context.currentStreak ?? 0) >= 30;
        break;
      case 'finance_goal':
        shouldUnlock = event === 'finance_goal_completed';
        break;
      case 'speed_run': {
        if (event === 'quest_completed') {
          const today = new Date();
          const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
          const todayCount = await prisma.questCompletion.count({
            where: { userId, completedAt: { gte: startOfDay, lt: endOfDay } },
          });
          shouldUnlock = todayCount >= 5;
        }
        break;
      }
      case 'birthday': {
        if (event === 'quest_completed' && context.userBirthDate) {
          const now = new Date();
          const bd = context.userBirthDate;
          shouldUnlock = bd.getMonth() === now.getMonth() && bd.getDate() === now.getDate();
        }
        break;
      }
      case 'perfect_week': {
        if (event === 'habit_logged') {
          const now = new Date();
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          const activeHabits = await prisma.habit.findMany({
            where: { userId, isActive: true },
            select: { id: true },
          });
          if (activeHabits.length > 0) {
            const days: boolean[] = [];
            for (let i = 0; i < 7; i++) {
              const day = new Date(weekAgo.getTime() + i * 24 * 60 * 60 * 1000);
              const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
              const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
              const logsCount = await prisma.habitLog.count({
                where: { userId, completed: true, date: { gte: dayStart, lt: dayEnd } },
              });
              days.push(logsCount >= activeHabits.length);
            }
            shouldUnlock = days.every(Boolean);
          }
        }
        break;
      }
    }

    if (shouldUnlock) {
      await prisma.userAchievement.create({
        data: { userId, achievementId: achievement.id },
      });

      // Award XP for achievement
      if (achievement.xpReward > 0) {
        await prisma.xpEvent.create({
          data: {
            userId,
            xpAmount: achievement.xpReward,
            goldAmount: 0,
            source: 'achievement_unlocked',
            sourceId: achievement.id,
            description: `Logro desbloqueado: ${achievement.title}`,
          },
        });
        await prisma.user.update({
          where: { id: userId },
          data: { xp: { increment: achievement.xpReward } },
        });
        await settleLevel(userId);
      }

      newly.push({
        id: achievement.id,
        key: achievement.key,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        xpReward: achievement.xpReward,
      });
    }
  }

  return newly;
}

export async function getUserAchievements(userId: string) {
  const [all, userAchievements] = await Promise.all([
    prisma.achievement.findMany({ orderBy: [{ category: 'asc' }, { xpReward: 'asc' }] }),
    prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    }),
  ]);

  const unlockedMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt]));

  const totalQuests = await prisma.questCompletion.count({ where: { userId } });
  const maxHabitStreak = await prisma.habit.aggregate({ where: { userId }, _max: { longestStreak: true } });
  const totalWorkouts = await countFinishedWorkouts(userId);

  return all.map((ach) => {
    const unlockedAt = unlockedMap.get(ach.id);
    let progress: number | null = null;
    let target = ach.progressTarget;

    if (target && !unlockedAt) {
      switch (ach.progressType) {
        case 'quest_count':
          progress = Math.min(totalQuests, target);
          break;
        case 'habit_streak':
          progress = Math.min(maxHabitStreak._max.longestStreak ?? 0, target);
          break;
        case 'workout_count':
          progress = Math.min(totalWorkouts, target);
          break;
      }
    }

    return {
      ...ach,
      unlocked: !!unlockedAt,
      unlockedAt: unlockedAt?.toISOString() ?? null,
      progress,
      target,
    };
  });
}

export async function getRecentAchievements(userId: string, limit = 5) {
  return prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { unlockedAt: 'desc' },
    take: limit,
  });
}
