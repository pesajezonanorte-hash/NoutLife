import { prisma } from '../lib/prisma';
import { generateText, hasAIProvider } from '../lib/ai';
import { reconcileHabitStreaks } from './habit.service';
import { reconcileUserActivityStreak } from './xp.service';

export async function getTodayProactiveNote(userId: string) {
  // Evita devolver un consejo ya guardado con una racha vencida.
  await Promise.all([reconcileHabitStreaks(userId), reconcileUserActivityStreak(userId)]);

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  // Return existing note if already generated today
  const existing = await prisma.sageProactiveNote.findFirst({
    where: { userId, createdAt: { gte: startOfDay, lt: endOfDay } },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return {
      id: existing.id,
      message: existing.message,
      tone: existing.tone,
      icon: existing.icon,
      isRead: existing.isRead,
      createdAt: existing.createdAt.toISOString(),
      isNew: !existing.isRead,
    };
  }

  // Generate new proactive note for today
  return generateProactiveNote(userId);
}

export async function markProactiveNoteRead(userId: string, noteId: string) {
  return prisma.sageProactiveNote.updateMany({
    where: { id: noteId, userId },
    data: { isRead: true },
  });
}

export async function generateProactiveNote(userId: string) {
  // Gather user context
  const [user, habits, recentQuests, recentLogs, checkin, streak] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { displayName: true, level: true, currentStreak: true, longestStreak: true },
    }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      select: { title: true, currentStreak: true, longestStreak: true },
      orderBy: { currentStreak: 'desc' },
      take: 5,
    }),
    prisma.questCompletion.count({
      where: {
        userId,
        completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.habitLog.count({
      where: {
        userId,
        completed: true,
        date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.dailyCheckin.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { currentStreak: true } }),
  ]);

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Check if any habit was completed today
  const todayLogs = await prisma.habitLog.count({
    where: { userId, completed: true, date: { gte: startOfDay } },
  });

  const topHabit = habits[0];
  const lastMood = checkin?.mood ?? null;
  const lastEnergy = checkin?.energy ?? null;

  // Determine tone based on data
  let tone = 'motivational';
  let icon = '🧙';

  const isNewUser = user.longestStreak === 0 && habits.length === 0;
  if (!isNewUser && streak && streak.currentStreak === 0 && user.longestStreak > 0) {
    tone = 'warning';
    icon = '⚠️';
  } else if (user.currentStreak >= 7) {
    tone = 'positive';
    icon = '🔥';
  } else if (lastEnergy !== null && lastEnergy <= 3) {
    tone = 'neutral';
    icon = '💙';
  }

  // Generate AI message or use fallback
  let message: string;

  if (hasAIProvider()) {
    const newUserNote = isNewUser ? 'IMPORTANTE: Este héroe es NUEVO, acaba de unirse. Dales la bienvenida con entusiasmo, NO menciones rachas perdidas ni puntos críticos.' : '';
    const prompt = `Eres El Sabio, el mentor de Noutlife — una app RPG de vida real.

Datos del héroe ${user.displayName} (Nivel ${user.level}):
- Racha actual: ${user.currentStreak} días
- Racha más larga: ${user.longestStreak} días
- Hábitos activos: ${habits.length}
- Mejor hábito (racha): ${topHabit ? `${topHabit.title} — ${topHabit.currentStreak} días` : 'ninguno'}
- Misiones esta semana: ${recentQuests}
- Registros de hábitos esta semana: ${recentLogs}
- Estado emocional último check-in: ${lastMood ? `${lastMood}/5` : 'sin datos'}
- Energía último check-in: ${lastEnergy ? `${lastEnergy}/10` : 'sin datos'}
- Hábitos completados hoy: ${todayLogs}
${newUserNote}

Escribe UNA sola nota proactiva en español. Máximo 2 frases. Específica a los datos. Tono: ${tone}.
Menciona datos reales (nombre del hábito, racha, etc). NO uses saludos genéricos.
Responde SOLO el mensaje, sin comillas, sin explicaciones.`;

    try {
      message = await generateText([{ role: 'user', content: prompt }], {
        temperature: 0.85,
        maxTokens: 150,
      });
      message = message.trim().replace(/^["']|["']$/g, '');
    } catch {
      message = buildFallbackMessage(user, topHabit, recentQuests, tone);
    }
  } else {
    message = buildFallbackMessage(user, topHabit, recentQuests, tone);
  }

  const note = await prisma.sageProactiveNote.create({
    data: { userId, message, tone, icon },
  });

  return {
    id: note.id,
    message: note.message,
    tone: note.tone,
    icon: note.icon,
    isRead: false,
    createdAt: note.createdAt.toISOString(),
    isNew: true,
  };
}

function buildFallbackMessage(
  user: { displayName: string; currentStreak: number; longestStreak: number },
  topHabit: { title: string; currentStreak: number } | undefined,
  recentQuests: number,
  tone: string
): string {
  if (user.longestStreak === 0 && user.currentStreak === 0) {
    return `¡Bienvenido a Noutlife, ${user.displayName}! Tu aventura comienza hoy. Crea tu primer hábito y empieza a ganar XP.`;
  }
  if (tone === 'warning' && user.currentStreak === 0) {
    return `${user.displayName}, tu racha se ha roto. Hoy es el mejor momento para empezar una nueva.`;
  }
  if (topHabit && topHabit.currentStreak >= 7) {
    return `¡${topHabit.currentStreak} días con "${topHabit.title}"! Estás construyendo algo que durará.`;
  }
  if (recentQuests >= 5) {
    return `${recentQuests} misiones esta semana. Tu disciplina está dando frutos, ${user.displayName}.`;
  }
  if (user.currentStreak > 0) {
    return `Racha de ${user.currentStreak} días y contando. Cada día suma, ${user.displayName}.`;
  }
  return `Hoy es otro día para avanzar. Pequeños pasos, grandes victorias, ${user.displayName}.`;
}
