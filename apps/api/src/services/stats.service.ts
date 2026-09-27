import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay } from '../lib/calendar';
import { isHabitScheduledForDay, reconcileHabitStreaks } from './habit.service';
import { reconcileUserActivityStreak } from './xp.service';

export type StatsPeriod = 'week' | 'month' | '3months' | 'year' | 'all';

interface PeriodRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

/**
 * Keeps every analytics query on the same inclusive/exclusive interval. The
 * upper bound is now, so future-dated records never leak into current stats.
 */
export function periodRange(period: string, now = new Date()): PeriodRange {
  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;

  switch (period as StatsPeriod) {
    case 'week': {
      start = new Date(now.getTime() - 7 * 86400000);
      prevStart = new Date(now.getTime() - 14 * 86400000);
      prevEnd = start;
      break;
    }
    case '3months': {
      start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      prevStart = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      prevEnd = start;
      break;
    }
    case 'year': {
      start = new Date(now.getFullYear(), 0, 1);
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = start;
      break;
    }
    case 'all': {
      start = new Date(2000, 0, 1);
      prevStart = start;
      prevEnd = start;
      break;
    }
    default: {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = start;
    }
  }

  return { start, end: now, prevStart, prevEnd };
}

function isCompletedWorkoutFilter() {
  // `xpEarned` is set only by finishWorkout (minimum reward is 20 XP), making
  // it the backwards-compatible completion marker for the current schema.
  return { xpEarned: { gt: 0 } };
}

function percentChange(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

function ratioPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export async function getStatsSummary(userId: string, period = 'month') {
  // A stats read must not display a stale streak merely because the scheduled
  // job has not run yet (for example after a serverless cold start).
  await Promise.all([reconcileHabitStreaks(userId), reconcileUserActivityStreak(userId)]);

  const { start, end, prevStart, prevEnd } = periodRange(period);
  const currentRange = { gte: start, lt: end };
  const previousRange = { gte: prevStart, lt: prevEnd };

  const [
    xpCurrent,
    xpPrevious,
    questsCurrent,
    questsPrevious,
    user,
    habitStreaks,
    transactions,
    totalXp,
    totalQuestCompletions,
    totalHabitCompletions,
    totalWorkouts,
    questsCreatedInPeriod,
  ] = await Promise.all([
    prisma.xpEvent.aggregate({ where: { userId, createdAt: currentRange }, _sum: { xpAmount: true } }),
    prisma.xpEvent.aggregate({ where: { userId, createdAt: previousRange }, _sum: { xpAmount: true } }),
    prisma.questCompletion.count({ where: { userId, completedAt: currentRange } }),
    prisma.questCompletion.count({ where: { userId, completedAt: previousRange } }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { longestStreak: true, currentStreak: true },
    }),
    // Archived habits still count toward a historical personal best.
    prisma.habit.findMany({ where: { userId }, select: { longestStreak: true } }),
    prisma.transaction.findMany({
      where: { userId, date: currentRange },
      select: { type: true, amount: true },
    }),
    prisma.xpEvent.aggregate({ where: { userId }, _sum: { xpAmount: true } }),
    prisma.questCompletion.count({ where: { userId } }),
    prisma.habitLog.count({ where: { userId, completed: true } }),
    prisma.workout.count({ where: { userId, ...isCompletedWorkoutFilter() } }),
    prisma.quest.count({ where: { userId, createdAt: currentRange } }),
  ]);

  let income = 0;
  let expenses = 0;
  for (const transaction of transactions) {
    if (transaction.type === 'INCOME') income += Number(transaction.amount);
    else expenses += Number(transaction.amount);
  }

  const xpNow = xpCurrent._sum.xpAmount ?? 0;
  const xpBefore = xpPrevious._sum.xpAmount ?? 0;
  const bestStreak = Math.max(user.longestStreak, ...habitStreaks.map((habit) => habit.longestStreak));

  return {
    xp: { value: xpNow, change: percentChange(xpNow, xpBefore) },
    quests: {
      completed: questsCurrent,
      change: percentChange(questsCurrent, questsPrevious),
      total: questsCreatedInPeriod,
    },
    currentStreak: user.currentStreak,
    bestStreak,
    finance: { income, expenses, balance: income - expenses },
    totals: {
      xpEarned: totalXp._sum.xpAmount ?? 0,
      questsCompleted: totalQuestCompletions,
      habitCompletions: totalHabitCompletions,
      workouts: totalWorkouts,
    },
  };
}

// ─── XP history ─────────────────────────────────────────────────────────────

/**
 * Returns every calendar day in the selected interval, including honest zeroes.
 * `cumulativeXp` makes sparse activity readable as retained progress rather than
 * a line that appears to leap across unrecorded dates.
 */
export async function getXpHistory(userId: string, period = 'month', now = new Date()) {
  const { start, end } = periodRange(period, now);
  const events = await prisma.xpEvent.findMany({
    where: { userId, createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: 'asc' },
    select: { xpAmount: true, createdAt: true },
  });

  // The query interval and its buckets intentionally share the same UTC
  // calendar keys. This prevents a local-time conversion from adding a blank
  // day before the start of a month while the database query still starts at
  // that UTC boundary.
  const byDate = new Map<string, number>();
  for (const event of events) {
    const date = event.createdAt.toISOString().slice(0, 10);
    byDate.set(date, (byDate.get(date) ?? 0) + event.xpAmount);
  }

  const firstDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const endDay = new Date(Math.max(start.getTime(), end.getTime() - 1));
  const lastDay = new Date(Date.UTC(endDay.getUTCFullYear(), endDay.getUTCMonth(), endDay.getUTCDate()));
  const data: Array<{ date: string; xp: number; cumulativeXp: number }> = [];
  let cumulativeXp = 0;
  for (let day = firstDay; day.getTime() <= lastDay.getTime(); day = addCalendarDays(day, 1)) {
    const date = day.toISOString().slice(0, 10);
    const xp = byDate.get(date) ?? 0;
    cumulativeXp += xp;
    data.push({ date, xp, cumulativeXp });
  }

  const activeDays = data.filter((entry) => entry.xp !== 0).length;
  const totalXp = cumulativeXp;
  const avg = data.length ? Math.round(totalXp / data.length) : 0;

  return { data, avg, activeDays, daysInPeriod: data.length, totalXp };
}

// ─── Activity radar ─────────────────────────────────────────────────────────

/**
 * Compares the selected interval with its immediately preceding interval. The
 * radar is intentionally limited to the core tracked areas; custom zones stay
 * individually visible in the zone ledger instead of being merged into a vague
 * catch-all value.
 */
export async function getActivityRadar(userId: string, period = 'week', now = new Date()) {
  const { start, end, prevStart, prevEnd } = periodRange(period, now);
  const currentRange = { gte: start, lt: end };
  const previousRange = { gte: prevStart, lt: prevEnd };
  const intervalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const weeks = Math.max(1, Math.ceil(intervalDays / 7));

  const score = async (range: { gte: Date; lt: Date }) => {
    const [gym, finance, habits, quests, sleep, learning, journal, mirror] = await Promise.all([
      prisma.workout.count({ where: { userId, date: range, ...isCompletedWorkoutFilter() } }),
      prisma.transaction.count({ where: { userId, date: range } }),
      prisma.habitLog.count({ where: { userId, date: range, completed: true } }),
      prisma.questCompletion.count({ where: { userId, completedAt: range } }),
      prisma.sleepLog.count({ where: { userId, date: range } }),
      prisma.learningItem.count({ where: { userId, updatedAt: range } }),
      prisma.journalEntry.count({ where: { userId, date: range } }),
      prisma.careLog.count({ where: { userId, date: range, completed: true } }),
    ]);
    return { gym, finance, habits, quests, sleep, learning, journal, mirror };
  };

  const [current, previous] = await Promise.all([
    score(currentRange),
    score(previousRange),
  ]);

  const normalise = (values: Awaited<ReturnType<typeof score>>) => [
    { subject: 'Misiones', value: ratioPercent(values.quests, weeks * 3) },
    { subject: 'Hábitos', value: ratioPercent(values.habits, intervalDays) },
    { subject: 'Coliseo', value: ratioPercent(values.gym, weeks * 3) },
    { subject: 'Bóveda', value: ratioPercent(values.finance, weeks * 2) },
    { subject: 'Torre', value: ratioPercent(values.sleep, intervalDays) },
    { subject: 'Biblioteca', value: ratioPercent(values.learning, weeks * 2) },
    { subject: 'Diario', value: ratioPercent(values.journal, intervalDays) },
    { subject: 'Espejo', value: ratioPercent(values.mirror, intervalDays) },
  ];

  return { current: normalise(current), previous: normalise(previous) };
}

// ─── Finance trend ────────────────────────────────────────────────────────────

/**
 * Buckets real transactions in the same interval chosen by the user. Weeks are
 * displayed day-by-day; longer ranges stay month-by-month for readability.
 */
export async function getFinanceTrend(userId: string, period = 'month', now = new Date()) {
  const { start, end } = periodRange(period, now);
  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: start, lt: end } },
    select: { type: true, amount: true, date: true },
    orderBy: { date: 'asc' },
  });

  const daily = period === 'week';
  const buckets = new Map<string, { income: number; expenses: number }>();
  const keys: string[] = [];

  if (daily) {
    const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    for (let day = first; day.getTime() <= last.getTime(); day.setDate(day.getDate() + 1)) {
      const key = day.toISOString().slice(0, 10);
      keys.push(key);
      buckets.set(key, { income: 0, expenses: 0 });
    }
  } else {
    const first = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    for (let month = first; month.getTime() <= last.getTime(); month.setMonth(month.getMonth() + 1)) {
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      keys.push(key);
      buckets.set(key, { income: 0, expenses: 0 });
    }
  }

  for (const transaction of transactions) {
    const key = daily
      ? transaction.date.toISOString().slice(0, 10)
      : `${transaction.date.getFullYear()}-${String(transaction.date.getMonth() + 1).padStart(2, '0')}`;
    const entry = buckets.get(key);
    if (!entry) continue;
    if (transaction.type === 'INCOME') entry.income += Number(transaction.amount);
    else entry.expenses += Number(transaction.amount);
  }

  let balance = 0;
  return keys.map((month) => {
    const values = buckets.get(month)!;
    balance += values.income - values.expenses;
    return { month, income: values.income, expenses: values.expenses, balance };
  });
}

// ─── Habit heatmap ────────────────────────────────────────────────────────────

export async function getHabitHeatmap(userId: string) {
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);

  const logs = await prisma.habitLog.findMany({
    where: { userId, date: { gte: yearAgo, lte: now }, completed: true },
    select: { date: true },
  });

  const byDate = new Map<string, number>();
  for (const log of logs) {
    const date = log.date.toISOString().split('T')[0];
    byDate.set(date, (byDate.get(date) ?? 0) + 1);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

// ─── Sleep series ─────────────────────────────────────────────────────────────

export async function getSleepScatter(userId: string, period = 'month') {
  const { start, end } = periodRange(period);
  const logs = await prisma.sleepLog.findMany({
    where: { userId, date: { gte: start, lt: end } },
    select: { duration: true, quality: true, date: true },
    orderBy: { date: 'asc' },
  });

  return logs.map((log) => ({
    date: log.date.toISOString().split('T')[0],
    duration: log.duration,
    quality: log.quality,
  }));
}

// ─── Gym progression ─────────────────────────────────────────────────────────

export async function getGymProgression(userId: string, period = 'month') {
  const { start, end } = periodRange(period);
  const exercises = await prisma.workoutExercise.findMany({
    where: {
      workout: {
        userId,
        date: { gte: start, lt: end },
        ...isCompletedWorkoutFilter(),
      },
    },
    include: {
      exercise: { select: { name: true } },
      workout: { select: { date: true } },
    },
    orderBy: { workout: { date: 'asc' } },
  });

  const byExercise = new Map<string, Map<string, number>>();
  for (const workoutExercise of exercises) {
    const date = workoutExercise.workout.date.toISOString().split('T')[0];
    const sets = workoutExercise.sets as Array<{ weight?: number; completed?: boolean }>;
    const maxWeight = sets
      .filter((set) => set.completed !== false)
      .reduce((max, set) => Math.max(max, Number(set.weight ?? 0)), 0);

    if (!byExercise.has(workoutExercise.exercise.name)) {
      byExercise.set(workoutExercise.exercise.name, new Map());
    }
    const dataByDate = byExercise.get(workoutExercise.exercise.name)!;
    dataByDate.set(date, Math.max(dataByDate.get(date) ?? 0, maxWeight));
  }

  return Array.from(byExercise.entries())
    .map(([name, dataByDate]) => ({
      name,
      data: Array.from(dataByDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, weight]) => ({ date, weight })),
    }))
    .sort((a, b) => b.data.length - a.data.length || a.name.localeCompare(b.name))
    .slice(0, 5);
}

// ─── Predictions ─────────────────────────────────────────────────────────────

export async function getPredictions(userId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const [user, recentXp, recentSavings, goals, habits] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { level: true, xp: true, xpToNextLevel: true, timezone: true },
    }),
    prisma.xpEvent.aggregate({ where: { userId, createdAt: { gte: thirtyDaysAgo, lt: now } }, _sum: { xpAmount: true } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: now } },
      select: { type: true, amount: true },
    }),
    prisma.financialGoal.findMany({
      where: { userId, isCompleted: false },
      select: { title: true, targetAmount: true, currentAmount: true },
      take: 3,
    }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      include: {
        logs: {
          where: { date: { gte: sevenDaysAgo, lte: now } },
          orderBy: { date: 'asc' },
        },
      },
      take: 5,
    }),
  ]);

  const averageDailyXp = (recentXp._sum.xpAmount ?? 0) / 30;
  const xpNeeded = Math.max(0, user.xpToNextLevel - user.xp);
  const daysToNextLevel = averageDailyXp > 0 ? Math.ceil(xpNeeded / averageDailyXp) : null;

  let income = 0;
  let expenses = 0;
  for (const transaction of recentSavings) {
    if (transaction.type === 'INCOME') income += Number(transaction.amount);
    else expenses += Number(transaction.amount);
  }
  const monthlyAverageSaving = income - expenses;

  const goalPredictions = goals.map((goal) => {
    const remaining = Math.max(0, Number(goal.targetAmount) - Number(goal.currentAmount));
    const months = monthlyAverageSaving > 0 ? Math.ceil(remaining / monthlyAverageSaving) : null;
    return { title: goal.title, remaining, months };
  });

  const localToday = getCalendarDay(user.timezone, now);
  const habitRisks = habits.map((habit) => {
    const logsByDay = new Map(habit.logs.map((log) => [log.date.getTime(), log]));
    let scheduledDays = 0;
    let completedDays = 0;

    for (let daysAgo = 0; daysAgo < 7; daysAgo += 1) {
      const day = addCalendarDays(localToday, -daysAgo);
      if (!isHabitScheduledForDay(day, habit.frequency)) continue;
      scheduledDays += 1;
      if (logsByDay.get(day.getTime())?.completed) completedDays += 1;
    }

    const completionRate = scheduledDays ? Math.round((completedDays / scheduledDays) * 100) : 0;
    const risk: 'low' | 'medium' | 'high' =
      completionRate >= 86 ? 'low' : completionRate >= 60 ? 'medium' : 'high';

    return {
      title: habit.title,
      currentStreak: habit.currentStreak,
      completedDays,
      scheduledDays,
      completionRate,
      risk,
    };
  });

  return {
    daysToNextLevel,
    avgDailyXp: Math.round(averageDailyXp),
    goalPredictions,
    habitRisks,
  };
}
