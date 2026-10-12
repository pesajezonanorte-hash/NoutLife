import { prisma } from '../lib/prisma';
import { addCalendarDays, DEFAULT_TIMEZONE, getCalendarDay } from '../lib/calendar';

const DAY_MS = 86_400_000;

async function userTimezone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return user?.timezone ?? DEFAULT_TIMEZONE;
}

export async function listAntiHabits(userId: string) {
  const timezone = await userTimezone(userId);
  const now = new Date();
  const today = getCalendarDay(timezone, now);
  const since = new Date(now.getTime() - 31 * DAY_MS);

  const antiHabits = await prisma.antiHabit.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      slips: { where: { occurredAt: { gte: since } }, orderBy: { occurredAt: 'desc' } },
    },
  });
  const lastSlips = await prisma.antiHabitSlip.groupBy({
    by: ['antiHabitId'],
    where: { userId },
    _max: { occurredAt: true },
  });
  const lastByHabit = new Map(lastSlips.map((row) => [row.antiHabitId, row._max.occurredAt]));

  return antiHabits.map((habit) => {
    const dayKeys = habit.slips.map((slip) => getCalendarDay(timezone, slip.occurredAt).getTime());
    const daily = Array.from({ length: 7 }, (_, index) => {
      const day = addCalendarDays(today, index - 6);
      return { date: day.toISOString().slice(0, 10), count: dayKeys.filter((key) => key === day.getTime()).length };
    });
    const last30Start = addCalendarDays(today, -29).getTime();
    const last7Start = addCalendarDays(today, -6).getTime();
    const lastSlip = lastByHabit.get(habit.id) ?? null;
    const reference = lastSlip ?? habit.createdAt;
    return {
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      createdAt: habit.createdAt,
      lastSlipAt: lastSlip,
      metrics: {
        today: dayKeys.filter((key) => key === today.getTime()).length,
        last7Days: dayKeys.filter((key) => key >= last7Start).length,
        last30Days: dayKeys.filter((key) => key >= last30Start).length,
        cleanStreakDays: Math.max(0, Math.floor((now.getTime() - reference.getTime()) / DAY_MS)),
        daily,
      },
    };
  });
}

export async function createAntiHabit(userId: string, input: { name: string; icon?: string }) {
  return prisma.antiHabit.create({ data: { userId, name: input.name, icon: input.icon } });
}

export async function deleteAntiHabit(userId: string, id: string) {
  const result = await prisma.antiHabit.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new Error('ANTI_HABIT_NOT_FOUND');
}

export async function logSlip(userId: string, id: string, note?: string) {
  const antiHabit = await prisma.antiHabit.findFirst({ where: { id, userId }, select: { id: true } });
  if (!antiHabit) throw new Error('ANTI_HABIT_NOT_FOUND');
  return prisma.antiHabitSlip.create({ data: { antiHabitId: id, userId, note } });
}
