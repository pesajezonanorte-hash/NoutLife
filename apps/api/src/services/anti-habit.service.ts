import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay, parseCalendarDate } from '../lib/calendar';

export async function listAntiHabits(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const today = getCalendarDay(user?.timezone);
  const from = addCalendarDays(today, -((today.getUTCDay() + 6) % 7));
  const until = addCalendarDays(from, 7);
  const habits = await prisma.antiHabit.findMany({
    where: { userId, isActive: true },
    include: { logs: { where: { date: { gte: from, lt: until } }, orderBy: { createdAt: 'desc' } } },
    orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
  });
  return habits.map((habit) => {
    const weeklyOccurrences = habit.logs.filter((log) => log.occurred).reduce((sum, log) => sum + log.amount, 0);
    const weeklyResisted = habit.logs.filter((log) => !log.occurred).length;
    return { ...habit, weeklyOccurrences, weeklyResisted, weekStart: from.toISOString().slice(0, 10) };
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
