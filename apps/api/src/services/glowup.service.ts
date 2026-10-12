import { prisma } from '../lib/prisma';
import { generateText } from '../lib/ai';
import { canUseAI } from './billing.service';

export async function getGlowUpData(userId: string) {
  const [
    user,
    totalQuests,
    totalHabits,
    totalXp,
    totalWorkouts,
    achievements,
    firstStreak7,
    bodyWeights,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        displayName: true, level: true, xp: true, currentStreak: true,
        longestStreak: true, createdAt: true, strength: true,
        intelligence: true, charisma: true, focusMinutesTotal: true,
      },
    }),
    prisma.questCompletion.count({ where: { userId } }),
    prisma.habitLog.count({ where: { userId, completed: true } }),
    prisma.xpEvent.aggregate({ where: { userId }, _sum: { xpAmount: true } }),
    prisma.workout.count({ where: { userId } }),
    prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { unlockedAt: 'asc' },
      take: 10,
    }),
    prisma.userAchievement.findFirst({
      where: { userId, achievement: { key: 'habit_streak_7' } },
      select: { unlockedAt: true },
    }),
    prisma.bodyWeight.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      select: { weight: true, date: true },
    }),
  ]);

  // Build milestone timeline
  const milestones: { label: string; date: string; icon: string; type: string }[] = [
    { label: 'Comenzaste tu aventura', date: user.createdAt.toISOString(), icon: '🏁', type: 'level' },
  ];

  if (firstStreak7) {
    milestones.push({
      label: 'Primera racha de 7 días',
      date: firstStreak7.unlockedAt.toISOString(),
      icon: '🔥',
      type: 'streak',
    });
  }

  for (const ua of achievements) {
    milestones.push({
      label: `Logro: ${ua.achievement.title}`,
      date: ua.unlockedAt.toISOString(),
      icon: ua.achievement.icon,
      type: 'quest',
    });
  }

  milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Projection from AI
  let projection: string | null = null;
  if (user.currentStreak > 0 && (await canUseAI(userId))) {
    try {
      const prompt = `El usuario ${user.displayName} lleva ${user.currentStreak} días de racha activa, está en nivel ${user.level},
ha completado ${totalQuests} misiones y registrado ${totalHabits} hábitos.
En 2-3 oraciones, da una proyección motivadora pero realista de cómo será en 6 meses si mantiene este ritmo.
Responde en español, tono natural y humano. Sin adornos exagerados.`;
      projection = await generateText([{ role: 'user', content: prompt }], {
        temperature: 0.7,
        maxTokens: 200,
      });
    } catch {
      projection = null;
    }
  }

  return {
    user: {
      displayName: user.displayName,
      level: user.level,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      createdAt: user.createdAt.toISOString(),
      strength: user.strength,
      intelligence: user.intelligence,
      charisma: user.charisma,
    },
    stats: {
      totalQuestsCompleted: totalQuests,
      totalHabitsLogged: totalHabits,
      totalXpEarned: totalXp._sum.xpAmount ?? user.xp,
      totalWorkouts,
      totalFocusMinutes: user.focusMinutesTotal,
      startLevel: 1,
    },
    milestones,
    bodyWeights: bodyWeights.map((bw) => ({
      weight: bw.weight,
      date: bw.date.toISOString(),
    })),
    projection,
  };
}
