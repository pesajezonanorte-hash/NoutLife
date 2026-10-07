import { prisma } from '../lib/prisma';
import { generateText, hasAIProvider } from '../lib/ai';
import { createNotification } from './notification.service';

export async function generateWeeklySummary(userId: string): Promise<void> {
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  // Check if already generated this week
  const existing = await prisma.weeklySummary.findFirst({
    where: { userId, weekStart: { gte: weekStart } },
  });
  if (existing) return;

  // Gather weekly stats
  const [xpData, goldData, questsCount, habitLogs, habits, checkins] = await Promise.all([
    prisma.xpEvent.aggregate({
      where: { userId, createdAt: { gte: weekStart, lte: weekEnd } },
      _sum: { xpAmount: true },
    }),
    prisma.xpEvent.aggregate({
      where: { userId, createdAt: { gte: weekStart, lte: weekEnd } },
      _sum: { goldAmount: true },
    }),
    prisma.questCompletion.count({
      where: { userId, completedAt: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.habitLog.count({
      where: { userId, completed: true, date: { gte: weekStart, lte: weekEnd } },
    }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      select: { title: true, currentStreak: true },
      orderBy: { currentStreak: 'desc' },
      take: 3,
    }),
    prisma.dailyCheckin.findMany({
      where: { userId, date: { gte: weekStart, lte: weekEnd } },
      select: { mood: true, energy: true },
    }),
  ]);

  const xpTotal = xpData._sum.xpAmount ?? 0;
  const goldTotal = goldData._sum.goldAmount ?? 0;
  const topHabit = habits[0]?.title ?? null;
  const avgMood = checkins.length > 0
    ? checkins.reduce((s, c) => s + c.mood, 0) / checkins.length
    : null;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { displayName: true, level: true, currentStreak: true },
  });

  // Generate AI summary
  let summary: string;

  if (hasAIProvider()) {
    const prompt = `Eres El Sabio de Noutlife. Genera un resumen semanal inspirador en español para el héroe.

Datos de ${user.displayName} esta semana:
- XP ganado: ${xpTotal}
- Gold ganado: ${goldTotal}
- Misiones completadas: ${questsCount}
- Registros de hábitos completados: ${habitLogs}
- Mejor hábito (racha actual): ${topHabit ?? 'ninguno'}
- Ánimo promedio: ${avgMood ? `${avgMood.toFixed(1)}/5` : 'sin datos'}
- Nivel actual: ${user.level}
- Racha de actividad: ${user.currentStreak} días

Escribe 2-3 párrafos. Sé específico con los números. Destaca logros reales. Si la semana fue débil, sé motivador pero honesto.
Solo el texto del resumen, sin formato especial.`;

    try {
      summary = await generateText([{ role: 'user', content: prompt }], { temperature: 0.75, maxTokens: 300 });
      summary = summary.trim();
    } catch {
      summary = buildFallbackSummary(user, xpTotal, questsCount, habitLogs, topHabit);
    }
  } else {
    summary = buildFallbackSummary(user, xpTotal, questsCount, habitLogs, topHabit);
  }

  const ws = await prisma.weeklySummary.create({
    data: {
      userId, weekStart, weekEnd,
      summary, xpTotal, goldTotal,
      questsCount, habitsCount: habitLogs,
      topHabit, mood: avgMood,
    },
  });

  // In-app notification
  createNotification(userId, {
    type: 'weekly_summary',
    title: '📊 Tu resumen semanal está listo',
    body: `Esta semana: ${questsCount} misiones, ${xpTotal} XP, ${habitLogs} hábitos completados.`,
    icon: '📊',
    link: '/stats',
  }).catch(() => {});

  console.log(`[WeeklySummary] Generated for user ${userId}: ${ws.id}`);
}

function buildFallbackSummary(
  user: { displayName: string; level: number },
  xpTotal: number,
  questsCount: number,
  habitLogs: number,
  topHabit: string | null
): string {
  const parts = [];
  if (questsCount > 0) parts.push(`Completaste ${questsCount} misión${questsCount > 1 ? 'es' : ''} esta semana`);
  if (habitLogs > 0) parts.push(`registraste ${habitLogs} hábito${habitLogs > 1 ? 's' : ''}`);
  if (xpTotal > 0) parts.push(`ganaste ${xpTotal} XP`);
  const actions = parts.length > 0 ? parts.join(', ') + '.' : 'Fue una semana tranquila.';

  let msg = `${user.displayName}, esta semana ${actions}`;
  if (topHabit) msg += ` Tu racha con "${topHabit}" sigue en pie — no la rompas.`;
  msg += ` Sigue construyendo, nivel ${user.level} aventurero.`;
  return msg;
}

export async function getLatestWeeklySummary(userId: string) {
  return prisma.weeklySummary.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function markWeeklySummaryRead(userId: string, summaryId: string) {
  return prisma.weeklySummary.updateMany({
    where: { id: summaryId, userId },
    data: { isRead: true },
  });
}

// Called by scheduler for all active users
export async function generateWeeklySummariesForAllUsers(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { onboardingCompleted: true },
    select: { id: true },
    take: 500,
  });

  for (const user of users) {
    await generateWeeklySummary(user.id).catch(err =>
      console.error(`[WeeklySummary] Error for user ${user.id}:`, err)
    );
  }

  console.log(`[WeeklySummary] Generated summaries for ${users.length} users`);
}
