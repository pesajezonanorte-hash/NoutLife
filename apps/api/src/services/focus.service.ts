import { prisma } from '../lib/prisma';
import { settleLevel } from './xp.service';

export async function logFocusSession(
  userId: string,
  durationMin: number,
  questId?: string,
  taskLabel?: string
) {
  const xpEarned = Math.round(durationMin * 2); // 2 XP per minute
  await prisma.$transaction([
    prisma.focusSession.create({
      data: { userId, durationMin, questId, taskLabel, xpEarned },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        xp: { increment: xpEarned },
        gold: { increment: Math.round(durationMin * 0.5) },
        focusMinutesTotal: { increment: durationMin },
      },
    }),
    prisma.xpEvent.create({
      data: {
        userId,
        xpAmount: xpEarned,
        goldAmount: Math.round(durationMin * 0.5),
        source: 'focus',
        description: `Sesión de enfoque: ${durationMin} minutos`,
      },
    }),
  ]);
  await settleLevel(userId);

  return { xpEarned, message: `+${xpEarned} XP por ${durationMin} min de enfoque` };
}

export async function getFocusStats(userId: string) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [totalMinutes, weekSessions, user] = await Promise.all([
    prisma.focusSession.aggregate({
      where: { userId },
      _sum: { durationMin: true },
    }),
    prisma.focusSession.findMany({
      where: { userId, completedAt: { gte: startOfWeek } },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { focusMinutesTotal: true },
    }),
  ]);

  const weekMinutes = weekSessions.reduce((s, sess) => s + sess.durationMin, 0);

  return {
    totalMinutes: totalMinutes._sum.durationMin ?? user.focusMinutesTotal,
    weekMinutes,
    weekSessions: weekSessions.length,
    recentSessions: weekSessions.slice(0, 5),
  };
}
