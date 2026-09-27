import { prisma } from '../lib/prisma';
import { addCalendarDays, DEFAULT_TIMEZONE, getCalendarDay, parseCalendarDate } from '../lib/calendar';
import { awardXpAndGold } from './xp.service';
import { checkAchievements } from './achievement.service';
import { createNotification } from './notification.service';
import { removeHabitFromGoogleCalendar, syncHabitWithGoogleCalendar } from './agenda.service';
import type { QuestCategory } from '@prisma/client';

export interface CreateHabitInput {
  title: string;
  description?: string;
  category: QuestCategory;
  icon?: string;
  color?: string;
  xpReward?: number;
  goldReward?: number;
  frequency?: { type: 'daily' | 'days_per_week'; days: number[] };
  resetTime?: string;
  reminderTime?: string;
  syncToGoogleCalendar?: boolean;
  isRitual?: boolean;
}

export interface UpdateHabitInput {
  title?: string;
  description?: string;
  category?: QuestCategory;
  icon?: string;
  color?: string;
  xpReward?: number;
  goldReward?: number;
  frequency?: { type: 'daily' | 'days_per_week'; days: number[] };
  resetTime?: string;
  reminderTime?: string | null;
  syncToGoogleCalendar?: boolean;
  isRitual?: boolean;
}

/**
 * Una racha no puede depender exclusivamente del cron: en serverless o después
 * de una pausa del proceso el cron puede no correr. Esta reconciliación se
 * invoca al leer hábitos/dashboard y deja la BD en el estado real.
 *
 * `HabitLog.date` se usa como fecha-calendario (medianoche), igual que el
 * resto de este servicio. Un log "skipped" mantiene la regla histórica de la
 * aplicación: no suma, pero tampoco rompe la racha.
 */
export async function reconcileHabitStreaks(userId?: string, now = new Date()): Promise<number> {
  // Las fechas de HabitLog se guardan como llaves de calendario. El rango
  // amplio cubre cualquier huso horario; el filtro definitivo se hace por usuario.
  const queryDay = getCalendarDay(undefined, now);
  // Siete días alcanzan para hallar el último día obligatorio incluso para una
  // frecuencia semanal. Para hábitos diarios basta con ayer.
  const lookbackStart = addCalendarDays(queryDay, -8);
  const lookaheadEnd = addCalendarDays(queryDay, 2);

  const habits = await prisma.habit.findMany({
    where: {
      ...(userId ? { userId } : {}),
      isActive: true,
      currentStreak: { gt: 0 },
    },
    include: {
      user: { select: { timezone: true } },
      logs: {
        where: { date: { gte: lookbackStart, lt: lookaheadEnd } },
        select: { date: true, completed: true, status: true },
      },
    },
  });

  const stale = habits.filter((habit) => {
    const today = getCalendarDay(habit.user.timezone ?? DEFAULT_TIMEZONE, now);
    const todayLog = habit.logs.find((log) => log.date.getTime() === today.getTime());

    // A same-day retry reaches reconciliation before logHabit reads the
    // existing log. A valid entry for today must therefore protect the streak
    // from being reset merely because yesterday has no entry yet.
    if (todayLog?.completed || todayLog?.status === 'skipped') return false;

    const lastRequiredDay = getLastRequiredDay(today, habit.frequency);
    const lastLog = habit.logs.find((log) => log.date.getTime() === lastRequiredDay.getTime());
    return !lastLog || (!lastLog.completed && lastLog.status !== 'skipped');
  });

  if (stale.length === 0) return 0;

  const resetUserIds = new Set<string>();
  let resetCount = 0;

  for (const habit of stale) {
    // El guard evita borrar una racha que se haya actualizado concurrentemente.
    const result = await prisma.habit.updateMany({
      where: { id: habit.id, currentStreak: habit.currentStreak },
      data: { currentStreak: 0 },
    });

    if (result.count === 0) continue;

    resetCount += 1;
    resetUserIds.add(habit.userId);
    await createHabitRecoveryChallengeIfEligible(
      habit.userId,
      habit.id,
      habit.title,
      habit.currentStreak,
      now,
    );
  }

  // Un consejo proactivo creado con la racha anterior no debe quedarse visible.
  // La siguiente consulta del Sabio se genera usando los datos ya reconciliados.
  if (resetUserIds.size > 0) {
    await prisma.sageProactiveNote.deleteMany({
      where: {
        userId: { in: [...resetUserIds] },
        createdAt: { gte: queryDay },
      },
    });
  }

  return resetCount;
}

function getLastRequiredDay(today: Date, rawFrequency: unknown): Date {
  for (let daysAgo = 1; daysAgo <= 7; daysAgo += 1) {
    const candidate = addCalendarDays(today, -daysAgo);
    if (isHabitScheduledForDay(candidate, rawFrequency)) return candidate;
  }
  // Una frecuencia inválida o sin días se considera diaria, por lo que esta
  // línea solo es una defensa adicional.
  return addCalendarDays(today, -1);
}

export function isHabitScheduledForDay(date: Date, rawFrequency: unknown): boolean {
  if (!rawFrequency || typeof rawFrequency !== 'object' || Array.isArray(rawFrequency)) return true;

  const frequency = rawFrequency as { type?: string; days?: unknown };
  if (frequency.type !== 'days_per_week') return true;
  if (!Array.isArray(frequency.days) || frequency.days.length === 0) return true;

  // La Date es una llave UTC que representa el día local del usuario.
  return frequency.days.some((day) => typeof day === 'number' && day === date.getUTCDay());
}

async function createHabitRecoveryChallengeIfEligible(
  userId: string,
  habitId: string,
  habitTitle: string,
  lostStreak: number,
  now = new Date(),
): Promise<void> {
  if (lostStreak <= 7) return;

  const existing = await prisma.recoveryChallenge.findFirst({
    where: { userId, habitId, isCompleted: false, expiresAt: { gt: now } },
    select: { id: true },
  });
  if (existing) return;

  const bonusXp = Math.floor(lostStreak * 1.5);
  const expiresAt = addCalendarDays(now, 7);

  await prisma.recoveryChallenge.create({
    data: { userId, habitId, lostStreak, requiredDays: 3, bonusXp, expiresAt },
  });

  createNotification(userId, {
    type: 'streak',
    title: 'Reto de recuperación disponible',
    body: `"${habitTitle}" puede volver a encenderse: 3 días seguidos por +${bonusXp} XP.`,
    icon: 'habit',
    link: '/habits',
  }).catch(() => {});
}

export async function createHabit(userId: string, input: CreateHabitInput) {
  const habit = await prisma.habit.create({
    data: {
      userId,
      title: input.title,
      description: input.description,
      category: input.category,
      icon: input.icon ?? '⭐',
      color: input.color ?? '#ffd23f',
      xpReward: input.xpReward ?? 20,
      goldReward: input.goldReward ?? 5,
      frequency: input.frequency ?? { type: 'daily', days: [] },
      resetTime: input.resetTime ?? '04:00',
      reminderTime: input.reminderTime,
      syncToGoogleCalendar: input.syncToGoogleCalendar ?? false,
      isRitual: input.isRitual ?? false,
    },
  });

  if (habit.syncToGoogleCalendar) {
    try {
      await syncHabitWithGoogleCalendar(userId, habit);
    } catch (error) {
      // Keep the opt-in persisted. Agenda's manual sync can retry a transient
      // Google failure without losing the user's choice.
      console.error('[HABIT_GOOGLE_CALENDAR_CREATE_SYNC_ERROR]', habit.id, error);
    }
  }

  await checkAchievements(userId, 'habit_created', {});

  return prisma.habit.findUnique({ where: { id: habit.id } }) ?? habit;
}

export async function listHabits(userId: string) {
  await reconcileHabitStreaks(userId);

  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  // Attach today's log using the user's calendar, not the server's UTC date.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const today = getCalendarDay(user?.timezone);
  const logs = await prisma.habitLog.findMany({
    where: { userId, date: today },
  });

  const logMap = new Map(logs.map((l) => [l.habitId, l]));

  return habits.map((h) => {
    const todayLog = logMap.get(h.id);
    return {
      ...h,
      frequency: h.frequency as { type: string; days: number[] },
      todayStatus: todayLog?.status ?? null,
      todayCompleted: todayLog?.completed ?? null,
    };
  });
}

export async function getHabitById(userId: string, habitId: string) {
  await reconcileHabitStreaks(userId);

  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId } });
  if (!habit) return null;

  const logs = await prisma.habitLog.findMany({
    where: { habitId },
    orderBy: { date: 'desc' },
    take: 30,
  });

  return { ...habit, logs };
}

export async function updateHabit(userId: string, habitId: string, input: UpdateHabitInput) {
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId } });
  if (!habit) throw new Error('HABIT_NOT_FOUND');

  const updatedHabit = await prisma.habit.update({
    where: { id: habitId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.xpReward !== undefined && { xpReward: input.xpReward }),
      ...(input.goldReward !== undefined && { goldReward: input.goldReward }),
      ...(input.frequency !== undefined && { frequency: input.frequency }),
      ...(input.resetTime !== undefined && { resetTime: input.resetTime }),
      ...(input.reminderTime !== undefined && { reminderTime: input.reminderTime }),
      ...(input.syncToGoogleCalendar !== undefined && { syncToGoogleCalendar: input.syncToGoogleCalendar }),
      ...(input.isRitual !== undefined && { isRitual: input.isRitual }),
    },
  });

  if (input.syncToGoogleCalendar === false && habit.googleCalendarEventId) {
    try {
      const removal = await removeHabitFromGoogleCalendar(userId, habit);
      if (removal.removed) {
        return prisma.habit.update({
          where: { id: habitId },
          data: { syncToGoogleCalendar: false, googleCalendarEventId: null },
        });
      }
    } catch (error) {
      console.error('[HABIT_GOOGLE_CALENDAR_REMOVE_ERROR]', habit.id, error);
    }

    return prisma.habit.findUnique({ where: { id: habitId } }) ?? updatedHabit;
  }

  if (updatedHabit.syncToGoogleCalendar) {
    try {
      await syncHabitWithGoogleCalendar(userId, updatedHabit);
    } catch (error) {
      console.error('[HABIT_GOOGLE_CALENDAR_UPDATE_SYNC_ERROR]', updatedHabit.id, error);
    }
  }

  return prisma.habit.findUnique({ where: { id: habitId } }) ?? updatedHabit;
}

export async function archiveHabit(userId: string, habitId: string) {
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId } });
  if (!habit) throw new Error('HABIT_NOT_FOUND');

  let remoteRemoved = !habit.googleCalendarEventId;
  if (habit.googleCalendarEventId) {
    try {
      const removal = await removeHabitFromGoogleCalendar(userId, habit);
      remoteRemoved = removal.removed;
    } catch (error) {
      console.error('[HABIT_GOOGLE_CALENDAR_ARCHIVE_REMOVE_ERROR]', habit.id, error);
    }
  }

  return prisma.habit.update({
    where: { id: habitId },
    data: {
      isActive: false,
      ...(remoteRemoved && { syncToGoogleCalendar: false, googleCalendarEventId: null }),
    },
  });
}

export type HabitLogStatus = 'completed' | 'failed' | 'skipped';

export async function logHabit(
  userId: string,
  habitId: string,
  status: HabitLogStatus,
  notes?: string,
  requestedDate?: string,
) {
  // Si el servidor estuvo inactivo al cambiar el día, corregir antes de usar
  // currentStreak para que un nuevo registro empiece exactamente en 1.
  await reconcileHabitStreaks(userId);

  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId, isActive: true },
    include: { user: { select: { timezone: true } } },
  });
  if (!habit) throw new Error('HABIT_NOT_FOUND');

  const timezone = habit.user.timezone ?? DEFAULT_TIMEZONE;
  const today = getCalendarDay(timezone);
  const date = requestedDate !== undefined ? parseCalendarDate(requestedDate) : today;
  if (!date) throw new Error('INVALID_HABIT_LOG_DATE');
  if (date.getTime() > today.getTime()) throw new Error('HABIT_LOG_FUTURE_DATE');

  const isLoggingToday = date.getTime() === today.getTime();
  const completed = status === 'completed';
  let existingLog = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId, date } },
  });
  let log: Awaited<ReturnType<typeof prisma.habitLog.create>>;
  let createdLog = false;

  if (!existingLog) {
    try {
      log = await prisma.habitLog.create({
        data: { habitId, userId, completed, status, date, notes },
      });
      createdLog = true;
    } catch (error) {
      // The database's habitId+date key is the idempotency boundary. In a
      // concurrent retry, only the request that inserted the log may earn XP.
      if (!isUniqueConstraintError(error)) throw error;
      existingLog = await prisma.habitLog.findUnique({
        where: { habitId_date: { habitId, date } },
      });
      if (!existingLog) throw error;
      log = existingLog;
    }
  } else {
    log = existingLog;
  }

  // A completed log has already granted rewards. Allowing it to become failed
  // or skipped would leave the XP ledger and the habit timeline disagreeing.
  if (existingLog?.completed && !completed) {
    throw new Error('HABIT_ALREADY_COMPLETED');
  }

  const isNewCompletion = completed && (createdLog || !existingLog?.completed);

  if (!createdLog && existingLog && (existingLog.status !== status || existingLog.completed !== completed || notes !== undefined)) {
    log = await prisma.habitLog.update({
      where: { id: existingLog.id },
      data: { completed, status, ...(notes !== undefined && { notes }) },
    });
  }

  // Update a streak only for a real state change. Repeated taps/retries on a
  // completed habit must be idempotent: no extra day, no duplicate XP.
  let { currentStreak, longestStreak } = habit;

  if (isLoggingToday && isNewCompletion) {
    // Continúa desde el último día en que este hábito realmente era exigible.
    // Para un hábito diario es ayer; para frecuencias semanales, el día marcado
    // más reciente. Así una fecha libre no corta la racha.
    const previousRequiredDay = getLastRequiredDay(today, habit.frequency);
    const previousLog = await prisma.habitLog.findUnique({
      where: { habitId_date: { habitId, date: previousRequiredDay } },
    });

    if (previousLog && (previousLog.completed || previousLog.status === 'skipped')) {
      currentStreak += 1;
    } else {
      currentStreak = 1;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  } else if (isLoggingToday && status === 'failed' && existingLog?.status !== 'failed') {
    currentStreak = 0;
  }
  // 'skipped' doesn't change the streak

  if (isLoggingToday && (isNewCompletion || (status === 'failed' && existingLog?.status !== 'failed'))) {
    await prisma.habit.update({
      where: { id: habitId },
      data: { currentStreak, longestStreak },
    });
  }

  let recoveryCompleted: {
    id: string;
    bonusXp: number;
    restoredStreak: number;
  } | null = null;

  const activeRecovery = await prisma.recoveryChallenge.findFirst({
    where: {
      userId,
      habitId,
      isCompleted: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (isLoggingToday && activeRecovery) {
    if (isNewCompletion) {
      const nextCurrentDays = activeRecovery.currentDays + 1;
      if (nextCurrentDays >= activeRecovery.requiredDays) {
        const restoredStreak = Math.max(currentStreak, Math.ceil(activeRecovery.lostStreak / 2));
        await prisma.recoveryChallenge.update({
          where: { id: activeRecovery.id },
          data: { currentDays: nextCurrentDays, isCompleted: true },
        });
        await prisma.habit.update({
          where: { id: habitId },
          data: {
            currentStreak: restoredStreak,
            longestStreak: Math.max(longestStreak, restoredStreak),
          },
        });
        currentStreak = restoredStreak;
        longestStreak = Math.max(longestStreak, restoredStreak);

        const bonusResult = await awardXpAndGold(userId, activeRecovery.bonusXp, 0, 'streak_recovery', {
          sourceId: activeRecovery.id,
          description: `Reto de recuperación completado: ${habit.title}`,
          category: habit.category,
        });

        recoveryCompleted = {
          id: activeRecovery.id,
          bonusXp: bonusResult.xpGained,
          restoredStreak,
        };

        createNotification(userId, {
          type: 'streak',
          title: '🔥 ¡Racha recuperada!',
          body: `"${habit.title}" volvió a encenderse. +${bonusResult.xpGained} XP bonus.`,
          icon: '🔥',
          link: '/habits',
        }).catch(() => {});
      } else {
        await prisma.recoveryChallenge.update({
          where: { id: activeRecovery.id },
          data: { currentDays: nextCurrentDays },
        });
      }
    } else if (status === 'failed' && existingLog?.status !== 'failed') {
      await prisma.recoveryChallenge.update({
        where: { id: activeRecovery.id },
        data: { currentDays: 0 },
      });
    }
  }

  let rewards = null;
  let achievementsUnlocked: Awaited<ReturnType<typeof checkAchievements>> = [];

  if (isNewCompletion) {
    const result = await awardXpAndGold(userId, habit.xpReward, habit.goldReward, 'habit_completed', {
      sourceId: habitId,
      description: `Hábito completado: ${habit.title}`,
      category: habit.category,
    });

    achievementsUnlocked = await checkAchievements(userId, 'habit_logged', {
      habitStreak: currentStreak,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
    });

    rewards = { xpEarned: result.xpGained, goldEarned: result.goldGained, leveledUp: result.leveledUp, newLevel: result.newLevel };

    // Personalized notification with real data
    const streakMsg = currentStreak >= 2 ? ` 🔥 Racha: ${currentStreak} días` : '';
    createNotification(userId, {
      type: 'habit_completed',
      title: `${habit.icon ?? '✅'} "${habit.title}" completado`,
      body: `+${result.xpGained} XP.${streakMsg}`,
      icon: habit.icon ?? '✅',
      link: '/habits',
    }).catch(() => {});

    for (const ach of achievementsUnlocked) {
      createNotification(userId, {
        type: 'achievement',
        title: `${ach.icon} Logro: ${ach.title}`,
        body: ach.description,
        icon: ach.icon,
        link: '/achievements',
      }).catch(() => {});
    }
  }

  const updatedHabit = await prisma.habit.findUnique({ where: { id: habitId } });

  return {
    log,
    habit: updatedHabit,
    currentStreak,
    longestStreak,
    rewards,
    achievementsUnlocked,
    recoveryCompleted,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002',
  );
}

export async function getHabitHeatmap(userId: string, habitId: string, days = 90) {
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId } });
  if (!habit) throw new Error('HABIT_NOT_FOUND');

  const from = new Date();
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);

  const logs = await prisma.habitLog.findMany({
    where: { habitId, date: { gte: from } },
    orderBy: { date: 'asc' },
  });

  return logs.map((l) => ({
    date: l.date.toISOString().split('T')[0],
    status: l.status,
    completed: l.completed,
  }));
}
