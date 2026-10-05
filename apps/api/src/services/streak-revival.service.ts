// Revivir rachas con oro: la racha general y la de cada hábito se pueden
// recuperar durante 72 h después de perderse. Cuanto más larga, más cuesta.
import { prisma } from '../lib/prisma';
import { addCalendarDays, DEFAULT_TIMEZONE, getCalendarDay } from '../lib/calendar';
import { effectiveActivityStreak } from './xp.service';
import { isHabitScheduledForDay } from './habit.service';
import { reviveCost, spendGold } from './network.service';

export const REVIVE_WINDOW_MS = 72 * 60 * 60_000;

const activityCost = (days: number) => reviveCost(days, 25, 400);
const habitCost = (days: number) => reviveCost(days, 15, 300);

const recent = (at: Date | null, now: number) => Boolean(at && now - at.getTime() < REVIVE_WINDOW_MS);

export async function getStreakRevival(userId: string) {
  const now = new Date();
  const [user, habits] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { gold: true, lostStreak: true, lostStreakAt: true, currentStreak: true, lastActivityDate: true, timezone: true },
    }),
    prisma.habit.findMany({
      where: { userId, isActive: true, lostStreak: { gt: 1 }, lostStreakAt: { gte: new Date(now.getTime() - REVIVE_WINDOW_MS) } },
      select: { id: true, title: true, icon: true, color: true, lostStreak: true, lostStreakAt: true, currentStreak: true },
      orderBy: { lostStreak: 'desc' },
    }),
  ]);

  const activity = user.lostStreak > 1 && recent(user.lostStreakAt, now.getTime())
    ? {
      lost: user.lostStreak,
      current: effectiveActivityStreak(user, now),
      cost: activityCost(user.lostStreak),
      expiresAt: new Date(user.lostStreakAt!.getTime() + REVIVE_WINDOW_MS).toISOString(),
    }
    : null;

  return {
    gold: user.gold,
    activity,
    habits: habits.map((h) => ({
      id: h.id, title: h.title, icon: h.icon, color: h.color,
      lost: h.lostStreak, current: h.currentStreak, cost: habitCost(h.lostStreak),
      expiresAt: new Date(h.lostStreakAt!.getTime() + REVIVE_WINDOW_MS).toISOString(),
    })),
  };
}

export async function reviveActivityStreak(userId: string) {
  const now = new Date();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { lostStreak: true, lostStreakAt: true, currentStreak: true, longestStreak: true, lastActivityDate: true, timezone: true },
  });
  if (user.lostStreak < 2 || !recent(user.lostStreakAt, now.getTime())) throw new Error('Esta racha ya no se puede revivir');
  const cost = activityCost(user.lostStreak);
  await spendGold(userId, cost);

  // Si hoy ya hubo actividad, la racha de hoy (1) se suma a la recuperada.
  const live = effectiveActivityStreak(user, now);
  const streak = user.lostStreak + live;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak: streak,
      longestStreak: Math.max(user.longestStreak, streak),
      lostStreak: 0,
      lostStreakAt: null,
      // Sin actividad hoy: cuenta como si ayer se hubiera mantenido.
      ...(live === 0 ? { lastActivityDate: new Date(now.getTime() - 24 * 60 * 60_000) } : {}),
    },
    select: { gold: true, currentStreak: true },
  });
  return { streak: updated.currentStreak, gold: updated.gold, cost };
}

export async function reviveHabitStreak(userId: string, habitId: string) {
  const now = new Date();
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId },
    include: { user: { select: { timezone: true } } },
  });
  if (!habit || habit.lostStreak < 2 || !recent(habit.lostStreakAt, now.getTime())) throw new Error('Esta racha ya no se puede revivir');
  const cost = habitCost(habit.lostStreak);
  await spendGold(userId, cost);

  // Los días obligatorios que faltaron quedan como "saltados": no suman, pero
  // tampoco rompen la racha (la regla de siempre de la app).
  const today = getCalendarDay(habit.user.timezone ?? DEFAULT_TIMEZONE, now);
  for (let back = 1; back <= 4; back += 1) {
    const day = addCalendarDays(today, -back);
    if (!isHabitScheduledForDay(day, habit.frequency)) continue;
    const log = await prisma.habitLog.findUnique({ where: { habitId_date: { habitId, date: day } } });
    if (log?.completed) break;
    if (log?.status === 'skipped') continue;
    await prisma.habitLog.upsert({
      where: { habitId_date: { habitId, date: day } },
      create: { habitId, userId, date: day, completed: false, status: 'skipped', notes: 'Racha revivida con oro' },
      update: { completed: false, status: 'skipped', notes: 'Racha revivida con oro' },
    });
  }

  const streak = habit.lostStreak + habit.currentStreak;
  await prisma.habit.update({
    where: { id: habitId },
    data: { currentStreak: streak, longestStreak: Math.max(habit.longestStreak, streak), lostStreak: 0, lostStreakAt: null },
  });
  // El reto de recuperación ya no hace falta.
  await prisma.recoveryChallenge.deleteMany({ where: { userId, habitId, isCompleted: false } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { gold: true } });
  return { habitId, streak, gold: user.gold, cost };
}
