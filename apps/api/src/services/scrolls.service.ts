import { prisma } from '../lib/prisma';
import { generateText, hasAIProvider } from '../lib/ai';

export async function getUnreadScrolls(userId: string) {
  return prisma.sageScroll.findMany({
    where: { userId, isRead: false },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
}

export async function markScrollRead(userId: string, scrollId: string) {
  await prisma.sageScroll.findFirstOrThrow({ where: { id: scrollId, userId } });
  return prisma.sageScroll.update({ where: { id: scrollId }, data: { isRead: true } });
}

export async function markAllRead(userId: string) {
  return prisma.sageScroll.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

export async function generateDailyScroll(userId: string): Promise<void> {
  // Only generate once per day
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = await prisma.sageScroll.findFirst({
    where: { userId, createdAt: { gte: today } },
  });
  if (existing) return;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [user, habits, recentMeals, financialGoals, activeQuests, checkins] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        displayName: true, level: true, currentStreak: true,
        longestStreak: true, lifeScore: true,
      },
    }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      select: { title: true, currentStreak: true },
      take: 5,
    }),
    prisma.meal.findMany({
      where: { userId, date: { gte: sevenDaysAgo } },
      select: { date: true },
    }),
    prisma.financialGoal.findMany({
      where: { userId, isCompleted: false },
      select: {
        title: true,
        targetAmount: true,
        currentAmount: true,
      },
      take: 3,
    }),
    prisma.quest.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { title: true, deadline: true },
      take: 5,
    }),
    prisma.dailyCheckin.findMany({
      where: { userId, date: { gte: sevenDaysAgo } },
      select: { mood: true, energy: true, date: true },
      orderBy: { date: 'asc' },
    }),
  ]);

  const mealDays = new Set(recentMeals.map((m) => new Date(m.date).toDateString())).size;
  const lowMoodDays = checkins.filter((c) => c.mood <= 2).length;
  const avgEnergy = checkins.length
    ? checkins.reduce((s, c) => s + c.energy, 0) / checkins.length
    : null;

  const goalProgress = financialGoals.map((g) => {
    const pct = Math.round((Number(g.currentAmount) / Number(g.targetAmount)) * 100);
    return `${g.title}: ${pct}%`;
  });

  const prompt = `Eres el asistente personal de ${user.displayName} en Noutlife.
Tienes que generar UN mensaje corto y personalizado para motivarlo hoy.
El mensaje debe ser específico, real, con datos reales. No genérico.
Máximo 2 oraciones. Tono humano, cercano, con energía positiva (pero sin ser exagerado).

DATOS:
- Nivel: ${user.level} | Racha actual: ${user.currentStreak} días | Racha récord: ${user.longestStreak} días
- Hábitos activos y rachas: ${habits.map((h) => `${h.title} (${h.currentStreak}d)`).join(', ') || 'ninguno'}
- Comidas registradas esta semana: ${mealDays}/7 días
- Días de bajo estado de ánimo esta semana: ${lowMoodDays}
- Energía promedio esta semana: ${avgEnergy ? avgEnergy.toFixed(1) : 'sin datos'}/10
- Metas financieras: ${goalProgress.join(', ') || 'ninguna'}
- Misiones activas: ${activeQuests.map((q) => q.title).join(', ') || 'ninguna'}

Genera el mensaje y clasifícalo.
Responde SOLO con JSON sin markdown:
{"message": "El mensaje aquí", "category": "praise|warning|nudge|milestone"}

Usa "praise" si algo va muy bien, "warning" si algo necesita atención, "nudge" si hay algo que empujar, "milestone" si logró algo importante.`;

  if (!hasAIProvider()) {
    // Fallback: rule-based scroll
    let message = `Llevas ${user.currentStreak} días de racha. ¡Cada día que apareces es una victoria!`;
    let category = 'praise';

    if (lowMoodDays >= 3) {
      message = 'Ha sido una semana difícil emocionalmente. Recuerda que está bien no estar bien — lo importante es seguir.';
      category = 'nudge';
    } else if (mealDays < 3) {
      message = 'Esta semana no registraste mucho de tu alimentación. Pequeños registros = grandes insights.';
      category = 'nudge';
    } else if (goalProgress.length > 0) {
      message = `Tu meta "${financialGoals[0].title}" va por buen camino. ¡Un empujón más!`;
      category = 'praise';
    }

    await prisma.sageScroll.create({ data: { userId, message, category } });
    return;
  }

  try {
    const result = await generateText([{ role: 'user', content: prompt }], {
      temperature: 0.85,
      maxTokens: 200,
    });
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as { message: string; category: string };
    await prisma.sageScroll.create({
      data: { userId, message: parsed.message, category: parsed.category },
    });
  } catch {
    // Fallback on parse error
    await prisma.sageScroll.create({
      data: {
        userId,
        message: `Llevas ${user.currentStreak} días de racha. Sigue así, ${user.displayName}.`,
        category: 'praise',
      },
    });
  }
}
