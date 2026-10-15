import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay, parseCalendarDate } from '../lib/calendar';

type Tally = { falls: number; resisted: number };
const tally = (logs: Array<{ occurred: boolean; amount: number }>): Tally => ({
  falls: logs.filter((log) => log.occurred).reduce((sum, log) => sum + log.amount, 0),
  resisted: logs.filter((log) => !log.occurred).length,
});

/**
 * Obstáculos (anti-hábitos) con sus métricas de frecuencia: hoy, esta semana
 * (lunes a domingo), este mes y la serie diaria de los últimos 30 días, además
 * de los días que llevas sin caer.
 */
export async function listAntiHabits(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const today = getCalendarDay(user?.timezone);
  const weekStart = addCalendarDays(today, -((today.getUTCDay() + 6) % 7));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const seriesStart = addCalendarDays(today, -29);
  const from = new Date(Math.min(monthStart.getTime(), seriesStart.getTime(), weekStart.getTime()));
  const tomorrow = addCalendarDays(today, 1);
  const habits = await prisma.antiHabit.findMany({
    where: { userId, isActive: true },
    include: { logs: { where: { date: { gte: from, lt: tomorrow } }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] } },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  });
  const lastFalls = await prisma.antiHabitLog.groupBy({
    by: ['antiHabitId'],
    where: { userId, occurred: true, antiHabitId: { in: habits.map((habit) => habit.id) } },
    _max: { date: true },
  });
  const lastFallOf = new Map(lastFalls.map((row) => [row.antiHabitId, row._max.date]));

  return habits.map((habit) => {
    const inRange = (start: Date) => habit.logs.filter((log) => log.date >= start && log.date < tomorrow);
    const week = tally(inRange(weekStart));
    const daily = Array.from({ length: 30 }, (_, i) => {
      const day = addCalendarDays(seriesStart, i);
      return { date: day.toISOString().slice(0, 10), ...tally(habit.logs.filter((log) => log.date.getTime() === day.getTime())) };
    });
    const lastFall = lastFallOf.get(habit.id) ?? null;
    const daysClean = lastFall ? Math.round((today.getTime() - lastFall.getTime()) / 86_400_000) : null;
    return {
      ...habit,
      logs: habit.logs.slice(0, 20),
      metrics: {
        today: tally(inRange(today)),
        week,
        month: tally(inRange(monthStart)),
        last30: tally(inRange(seriesStart)),
        daily,
        daysClean,
      },
      // Compatibilidad con clientes anteriores.
      weeklyOccurrences: week.falls,
      weeklyResisted: week.resisted,
      weekStart: weekStart.toISOString().slice(0, 10),
    };
  });
}

export async function createAntiHabit(userId: string, input: {
  title: string; category: string; cue?: string; targetPerWeek?: number;
}) {
  return prisma.antiHabit.create({
    data: {
      userId,
      title: input.title.trim(),
      category: input.category.trim().toLowerCase(),
      cue: input.cue?.trim() || null,
      targetPerWeek: input.targetPerWeek,
    },
  });
}

/** Edita un obstáculo activo. `cue` y `targetPerWeek` en null los quitan. */
export async function updateAntiHabit(userId: string, id: string, input: {
  title?: string; category?: string; cue?: string | null; targetPerWeek?: number | null;
}) {
  const result = await prisma.antiHabit.updateMany({
    where: { id, userId, isActive: true },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category.trim().toLowerCase() } : {}),
      ...(input.cue !== undefined ? { cue: input.cue?.trim() || null } : {}),
      ...(input.targetPerWeek !== undefined ? { targetPerWeek: input.targetPerWeek } : {}),
    },
  });
  if (!result.count) throw new Error('ANTI_HABIT_NOT_FOUND');
}

export async function archiveAntiHabit(userId: string, id: string) {
  const result = await prisma.antiHabit.updateMany({ where: { id, userId, isActive: true }, data: { isActive: false } });
  if (!result.count) throw new Error('ANTI_HABIT_NOT_FOUND');
}

export async function logAntiHabit(userId: string, id: string, input: {
  occurred: boolean; amount?: number; intensity?: number; note?: string; date?: string;
}) {
  const habit = await prisma.antiHabit.findFirst({
    where: { id, userId, isActive: true },
    include: { user: { select: { timezone: true } } },
  });
  if (!habit) throw new Error('ANTI_HABIT_NOT_FOUND');
  const date = input.date ? parseCalendarDate(input.date) : getCalendarDay(habit.user.timezone);
  if (!date) throw new Error('INVALID_ANTI_HABIT_DATE');
  const today = getCalendarDay(habit.user.timezone);
  if (date.getTime() > today.getTime()) throw new Error('ANTI_HABIT_FUTURE_DATE');
  return prisma.antiHabitLog.create({
    data: {
      antiHabitId: id,
      userId,
      date,
      occurred: input.occurred,
      amount: input.occurred ? (input.amount ?? 1) : 1,
      intensity: input.intensity,
      note: input.note?.trim() || null,
    },
  });
}

export async function deleteAntiHabitLog(userId: string, logId: string) {
  const result = await prisma.antiHabitLog.deleteMany({ where: { id: logId, userId } });
  if (!result.count) throw new Error('ANTI_HABIT_LOG_NOT_FOUND');
}
