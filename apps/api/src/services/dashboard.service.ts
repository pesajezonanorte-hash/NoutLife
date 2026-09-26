import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay } from '../lib/calendar';
import { isHabitScheduledForDay, reconcileHabitStreaks } from './habit.service';
import { reconcileUserActivityStreak } from './xp.service';

export async function getDashboard(userId: string) {
  // No dependemos del cron: una lectura del castillo siempre sanea rachas vencidas.
  await Promise.all([reconcileHabitStreaks(userId), reconcileUserActivityStreak(userId)]);

  const now = new Date();
  const timezoneRecord = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const habitTodayStart = getCalendarDay(timezoneRecord?.timezone, now);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const todayStart = startOfDay(now);

  const [
    user,
    activeQuests,
    recentWorkout,
    sleepLogs,
    monthTransactions,
    recentAchievements,
    todayHabits,
    todayCheckin,
    latestWeeklySummary,
    recoveryChallenge,
    journalEntryCount,
    totalQuestCount,
    totalHabitCount,
  ] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        level: true,
        xp: true,
        xpToNextLevel: true,
        gold: true,
        hp: true,
        maxHp: true,
        mp: true,
        maxMp: true,
        strength: true,
        intelligence: true,
        charisma: true,
        avatarConfig: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true,
        onboardingCompleted: true,
        onboardingCompletedAt: true,
        lastActivityDate: true,
        sevenDayGuideCompletedDays: true,
        sevenDayGuideCompletedAt: true,
        sevenDayGuideDismissedAt: true,
      },
    }),
    prisma.quest.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ type: 'asc' }, { deadline: 'asc' }],
      take: 5,
    }),
    prisma.workout.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    }),
    prisma.sleepLog.findMany({
      where: { userId, date: { gte: sevenDaysAgo } },
      orderBy: { date: 'desc' },
    }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: startOfMonth } },
      select: { type: true, amount: true },
    }),
    prisma.userAchievement.findMany({
      where: { userId, unlockedAt: { gte: sevenDaysAgo } },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
      take: 3,
    }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      include: {
        logs: {
          where: { date: habitTodayStart },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 30,
    }),
    prisma.dailyCheckin.findUnique({
      where: { userId_date: { userId, date: todayStart } },
    }),
    prisma.weeklySummary.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.recoveryChallenge.findFirst({
      where: {
        userId,
        isCompleted: false,
        expiresAt: { gt: now },
      },
      include: {
        habit: {
          select: { title: true, icon: true, currentStreak: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.journalEntry.count({
      where: { userId },
    }),
    prisma.quest.count({
      where: { userId },
    }),
    prisma.habit.count({
      where: { userId },
    }),
  ]);

  const sleepAvg7d = sleepLogs.length > 0
    ? sleepLogs.reduce((sum, sleepLog) => sum + sleepLog.duration, 0) / sleepLogs.length
    : 0;

  let monthIncome = 0;
  let monthExpenses = 0;
  for (const transaction of monthTransactions) {
    const amount = Number(transaction.amount);
    if (transaction.type === 'INCOME') monthIncome += amount;
    else monthExpenses += amount;
  }

  const daysSinceJoin = Math.floor(
    (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysAway = user.lastActivityDate
    ? Math.max(0, Math.floor((todayStart.getTime() - startOfDay(user.lastActivityDate).getTime()) / 86400000))
    : daysSinceJoin;

  const visualHpPercent = getVisualHpPercent(daysAway);

  return {
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
      lastActivityDate: user.lastActivityDate?.toISOString() ?? null,
    },
    todayQuests: activeQuests,
    recentWorkout: recentWorkout ? { ...recentWorkout, date: recentWorkout.date.toISOString() } : null,
    sleepAvg7d: Math.round(sleepAvg7d * 10) / 10,
    monthIncome,
    monthExpenses,
    monthBalance: monthIncome - monthExpenses,
    daysSinceJoin,
    recentAchievements: recentAchievements.map((userAchievement) => ({
      ...userAchievement.achievement,
      unlockedAt: userAchievement.unlockedAt.toISOString(),
    })),
    todayHabits: todayHabits
      .filter((habit) => isHabitScheduledForDay(habitTodayStart, habit.frequency))
      .slice(0, 6)
      .map((habit) => ({
      id: habit.id,
      title: habit.title,
      icon: habit.icon,
      color: habit.color,
      currentStreak: habit.currentStreak,
      xpReward: habit.xpReward,
      todayStatus: habit.logs[0]?.status ?? null,
      todayCompleted: habit.logs[0]?.completed ?? null,
    })),
    visualState: {
      mood: todayCheckin?.mood ?? 3,
      daysAway,
      hpPercent: visualHpPercent,
      hpLabel: `${Math.round(visualHpPercent)}%`,
      hpLow: visualHpPercent <= 25,
      hpRecovery: daysAway === 0 && Boolean(user.lastActivityDate),
    },
    latestWeeklySummary: latestWeeklySummary
      ? {
          id: latestWeeklySummary.id,
          summary: latestWeeklySummary.summary,
          lifeScore: latestWeeklySummary.lifeScore,
          weekStart: latestWeeklySummary.weekStart.toISOString(),
          weekEnd: latestWeeklySummary.weekEnd.toISOString(),
        }
      : null,
    recoveryChallenge: recoveryChallenge
      ? {
          id: recoveryChallenge.id,
          habitId: recoveryChallenge.habitId,
          habitTitle: recoveryChallenge.habit.title,
          habitIcon: recoveryChallenge.habit.icon,
          lostStreak: recoveryChallenge.lostStreak,
          requiredDays: recoveryChallenge.requiredDays,
          currentDays: recoveryChallenge.currentDays,
          bonusXp: recoveryChallenge.bonusXp,
          expiresAt: recoveryChallenge.expiresAt.toISOString(),
        }
      : null,
    firstSteps: {
      questCount: totalQuestCount,
      habitCount: totalHabitCount,
      hasJournalEntry: journalEntryCount > 0,
    },
  };
}

function getVisualHpPercent(daysAway: number) {
  if (daysAway >= 5) return 25;
  if (daysAway >= 3) return 50;
  if (daysAway >= 1) return 75;
  return 100;
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export async function getTodayQuests(userId: string) {
  const now = new Date();

  const quests = await prisma.quest.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: [{ type: 'asc' }, { deadline: 'asc' }],
    take: 10,
  });

  const sorted = quests.sort((a, b) => {
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return sorted.slice(0, 5).map((quest) => ({
    ...quest,
    deadline: quest.deadline?.toISOString() ?? null,
    completedAt: quest.completedAt?.toISOString() ?? null,
    lastResetAt: quest.lastResetAt?.toISOString() ?? null,
    createdAt: quest.createdAt.toISOString(),
    updatedAt: quest.updatedAt.toISOString(),
    daysUntilDeadline: quest.deadline
      ? Math.ceil((new Date(quest.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null,
  }));
}

export interface Priority {
  id: string;
  type: 'habit' | 'quest' | 'event';
  title: string;
  icon: string;
  xp: number;
  urgent: boolean;
  detail?: string;
}

/**
 * Priorities are intentionally grouped. A recurring habit is never returned as
 * a mission, and Agenda events retain their own lane in the dashboard UI.
 */
export interface TodayPriorities {
  quests: Priority[];
  habits: Priority[];
  events: Priority[];
}

const QUEST_TYPE_LABELS: Record<string, string> = {
  MAIN: 'Proyecto',
  SIDE: 'Tarea',
  META: 'Meta',
  // Legacy recurring quests can still be completed, but new routines belong
  // in Habits rather than being presented as the same kind of work.
  DAILY: 'Misión recurrente',
  WEEKLY: 'Misión recurrente',
};

function questDeadlineDetail(deadline: Date | null, now: Date, type: string): string {
  const label = QUEST_TYPE_LABELS[type] ?? 'Misión';
  if (!deadline) return label;

  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return `${label} · vencida`;
  if (daysLeft === 0) return `${label} · vence hoy`;
  if (daysLeft === 1) return `${label} · vence mañana`;
  return `${label} · ${daysLeft} días`;
}

export async function getTodayPriorities(userId: string): Promise<TodayPriorities> {
  await reconcileHabitStreaks(userId);

  const now = new Date();
  const timezoneRecord = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const habitTodayStart = getCalendarDay(timezoneRecord?.timezone, now);
  const habitTomorrowStart = new Date(habitTodayStart);
  habitTomorrowStart.setUTCDate(habitTomorrowStart.getUTCDate() + 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

  const [habits, quests, events] = await Promise.all([
    prisma.habit.findMany({
      where: {
        userId,
        isActive: true,
        NOT: {
          logs: { some: { date: { gte: habitTodayStart, lt: habitTomorrowStart }, completed: true } },
        },
      },
      orderBy: { currentStreak: 'desc' },
      take: 100,
    }),
    prisma.quest.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: [{ deadline: 'asc' }, { createdAt: 'asc' }],
      take: 6,
    }),
    prisma.agendaEvent.findMany({
      where: {
        userId,
        startDate: { gte: todayStart, lt: tomorrowEnd },
        eventType: { not: 'habit' },
      },
      orderBy: { startDate: 'asc' },
      take: 4,
    }),
  ]);

  const habitPriorities = habits
    .filter((habit) => isHabitScheduledForDay(habitTodayStart, habit.frequency))
    .slice(0, 4)
    .map<Priority>((habit) => ({
      id: habit.id,
      type: 'habit',
      title: habit.title,
      icon: habit.icon ?? 'habit',
      xp: habit.xpReward,
      urgent: habit.currentStreak > 0,
      detail: habit.currentStreak > 0 ? `Racha: ${habit.currentStreak} días` : 'Por completar hoy',
    }));

  const questPriorities = quests
    .slice()
    .sort((a, b) => {
      if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime();
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .slice(0, 4)
    .map<Priority>((quest) => {
      const daysLeft = quest.deadline
        ? Math.ceil((quest.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: quest.id,
        type: 'quest',
        title: quest.title,
        icon: 'quest',
        xp: quest.xpReward,
        urgent: daysLeft !== null && daysLeft <= 1,
        detail: questDeadlineDetail(quest.deadline, now, quest.type),
      };
    });

  const eventPriorities = events.map<Priority>((event) => {
    const isToday = event.startDate < new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const time = event.isAllDay
      ? 'Todo el día'
      : event.startDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    return {
      id: event.id,
      type: 'event',
      title: event.title,
      icon: 'calendar',
      xp: 0,
      urgent: isToday,
      detail: isToday ? time : `Mañana · ${time}`,
    };
  });

  return {
    quests: questPriorities,
    habits: habitPriorities,
    events: eventPriorities,
  };
}

// ─── Plan de hoy ───────────────────────────────────────────────────────────────

export type TodayPlanPriorityType = 'habit' | 'quest' | 'event';
export type TodayPlanUrgency = 'critical' | 'soon' | 'normal';

export interface TodayPlanPriority {
  id: string;
  type: TodayPlanPriorityType;
  title: string;
  detail: string;
  xp: number;
  urgency: TodayPlanUrgency;
  route: '/habits' | '/quests' | '/agenda';
  scheduledAt?: string;
}

interface RankedTodayPlanPriority extends TodayPlanPriority {
  score: number;
}

function calendarKeyInTimezone(date: Date, timezone: string, isAllDay = false): string {
  // Google all-day events are persisted as their UTC calendar key. Formatting
  // them in America/Bogota would incorrectly move them to the previous day.
  if (isAllDay) return date.toISOString().slice(0, 10);

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function timeInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
}

function localMinutesNow(timezone: string, now: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const values = Object.fromEntries(parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]));
    return Number(values.hour) * 60 + Number(values.minute);
  } catch {
    return null;
  }
}

function calendarDayDistance(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00.000Z`).getTime();
  const to = new Date(`${toKey}T00:00:00.000Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function deadlineUrgency(deadline: Date | null, todayKey: string, timezone: string): TodayPlanUrgency {
  if (!deadline) return 'normal';
  const days = calendarDayDistance(todayKey, calendarKeyInTimezone(deadline, timezone));
  if (days <= 0) return 'critical';
  if (days <= 2) return 'soon';
  return 'normal';
}

function formatQuestPlanDetail(deadline: Date | null, type: string, todayKey: string, timezone: string): string {
  const typeLabel = QUEST_TYPE_LABELS[type] ?? 'Misión';
  if (!deadline) return typeLabel;

  const days = calendarDayDistance(todayKey, calendarKeyInTimezone(deadline, timezone));
  if (days < 0) return `${typeLabel} · vencida`;
  if (days === 0) return `${typeLabel} · vence hoy`;
  if (days === 1) return `${typeLabel} · vence mañana`;
  return `${typeLabel} · vence en ${days} días`;
}

function rankHabitForToday(
  habit: { id: string; title: string; xpReward: number; currentStreak: number; reminderTime: string | null },
  nowMinutes: number | null,
): RankedTodayPlanPriority {
  let score = 40 + Math.min(habit.currentStreak, 20);
  let detail = habit.currentStreak > 0 ? `Racha: ${habit.currentStreak} días` : 'Hábito de hoy';

  if (habit.reminderTime && nowMinutes !== null) {
    const [hours, minutes] = habit.reminderTime.split(':').map(Number);
    const reminderMinutes = hours * 60 + minutes;
    if (nowMinutes >= reminderMinutes) {
      score += 16;
      detail = `Programado para ${habit.reminderTime}`;
    }
  }

  return {
    id: habit.id,
    type: 'habit',
    title: habit.title,
    detail,
    xp: habit.xpReward,
    urgency: habit.currentStreak >= 7 ? 'soon' : 'normal',
    route: '/habits',
    score,
  };
}

function rankQuestForToday(
  quest: { id: string; title: string; xpReward: number; deadline: Date | null; type: string; difficulty: string },
  todayKey: string,
  timezone: string,
): RankedTodayPlanPriority {
  const urgency = deadlineUrgency(quest.deadline, todayKey, timezone);
  let score = urgency === 'critical' ? 112 : urgency === 'soon' ? 86 : 48;
  if (quest.type === 'MAIN') score += 12;
  if (quest.type === 'META') score += 7;
  if (quest.difficulty === 'EPIC') score += 8;
  if (quest.difficulty === 'HARD') score += 4;

  return {
    id: quest.id,
    type: 'quest',
    title: quest.title,
    detail: formatQuestPlanDetail(quest.deadline, quest.type, todayKey, timezone),
    xp: quest.xpReward,
    urgency,
    route: '/quests',
    score,
  };
}

function rankEventForToday(
  event: { id: string; title: string; startDate: Date; isAllDay: boolean },
  now: Date,
  timezone: string,
): RankedTodayPlanPriority {
  const minutesUntil = Math.round((event.startDate.getTime() - now.getTime()) / 60_000);
  let score = event.isAllDay ? 58 : 70;
  let urgency: TodayPlanUrgency = 'normal';

  if (!event.isAllDay && minutesUntil <= 0) {
    score = 118;
    urgency = 'critical';
  } else if (!event.isAllDay && minutesUntil <= 120) {
    score = 106;
    urgency = 'critical';
  } else if (!event.isAllDay && minutesUntil <= 360) {
    score = 90;
    urgency = 'soon';
  } else if (event.isAllDay) {
    urgency = 'soon';
  }

  return {
    id: event.id,
    type: 'event',
    title: event.title,
    detail: event.isAllDay ? 'Todo el día' : `Agenda · ${timeInTimezone(event.startDate, timezone)}`,
    xp: 0,
    urgency,
    route: '/agenda',
    scheduledAt: event.startDate.toISOString(),
    score,
  };
}

function buildTodayPlanAdvice(input: {
  primary: TodayPlanPriority | null;
  checkin: { energy: number } | null;
  lastSleep: { duration: number } | null;
  pendingHabits: number;
}): { message: string; tone: 'neutral' | 'calm' | 'warning' | 'momentum' } {
  if (!input.checkin) {
    return {
      message: 'Haz tu check-in de energía y ajustaremos el plan a cómo llegas hoy.',
      tone: 'neutral',
    };
  }

  if (input.checkin.energy <= 3) {
    return {
      message: input.primary
        ? `Hoy ve a lo esencial: avanza primero en “${input.primary.title}” y deja margen para descansar.`
        : 'Tu energía está baja: elige una acción pequeña y cuida tu ritmo.',
      tone: 'calm',
    };
  }

  if (input.lastSleep && input.lastSleep.duration < 6) {
    return {
      message: 'Dormiste poco. Mantén el plan corto y evita convertir la urgencia en sobrecarga.',
      tone: 'calm',
    };
  }

  if (input.primary?.urgency === 'critical') {
    return {
      message: `Hay una prioridad crítica: atiende “${input.primary.title}” antes de abrir más frentes.`,
      tone: 'warning',
    };
  }

  if (input.pendingHabits > 0) {
    return {
      message: `Vas con buen ritmo: completa ${input.pendingHabits === 1 ? 'tu hábito pendiente' : `${input.pendingHabits} hábitos pendientes`} y protege tu constancia.`,
      tone: 'momentum',
    };
  }

  return {
    message: input.primary
      ? `Tu siguiente mejor paso es “${input.primary.title}”. Una acción clara a la vez.`
      : 'Tu día está despejado. Puedes crear una misión o disfrutar el espacio que ganaste.',
    tone: 'neutral',
  };
}

/**
 * One focused, explainable daily snapshot for the Castle. It does not merge
 * habits with missions: each item keeps its own route and completion contract.
 */
export async function getTodayPlan(userId: string) {
  await reconcileHabitStreaks(userId);

  const now = new Date();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      timezone: true,
      googleCalendarSyncEnabled: true,
    },
  });
  const timezone = user.timezone || 'America/Bogota';
  const today = getCalendarDay(timezone, now);
  const tomorrow = addCalendarDays(today, 1);
  const todayKey = today.toISOString().slice(0, 10);
  const queryStart = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  const queryEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const [habits, quests, agendaEvents, recentCheckins, xpEvents, lastSleep, lastWorkout] = await Promise.all([
    prisma.habit.findMany({
      where: { userId, isActive: true },
      include: {
        logs: {
          where: { date: { gte: today, lt: tomorrow } },
          select: { completed: true },
          take: 1,
        },
      },
      orderBy: { currentStreak: 'desc' },
      take: 100,
    }),
    prisma.quest.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.agendaEvent.findMany({
      where: {
        userId,
        isCompleted: false,
        eventType: { not: 'habit' },
        startDate: { gte: queryStart, lte: queryEnd },
      },
      orderBy: { startDate: 'asc' },
      take: 30,
    }),
    prisma.dailyCheckin.findMany({
      where: { userId, createdAt: { gte: queryStart } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { energy: true, mood: true, createdAt: true },
    }),
    prisma.xpEvent.findMany({
      where: { userId, createdAt: { gte: queryStart } },
      select: { xpAmount: true, createdAt: true },
    }),
    prisma.sleepLog.findFirst({
      where: { userId, date: { lte: now } },
      orderBy: { date: 'desc' },
      select: { duration: true, sleepScore: true, quality: true, date: true },
    }),
    prisma.workout.findFirst({
      where: { userId, xpEarned: { gt: 0 }, date: { lte: now } },
      orderBy: { date: 'desc' },
      select: { date: true, title: true },
    }),
  ]);

  // DailyCheckin was historically keyed with the API host's local midnight.
  // Resolve it by the user's actual calendar day so the plan remains correct
  // near midnight in America/Bogota and for users in other timezones.
  const checkin = recentCheckins.find((entry) => calendarKeyInTimezone(entry.createdAt, timezone) === todayKey) ?? null;
  const scheduledHabits = habits.filter((habit) => isHabitScheduledForDay(today, habit.frequency));
  const completedHabitCount = scheduledHabits.filter((habit) => habit.logs[0]?.completed).length;
  const pendingHabits = scheduledHabits.filter((habit) => !habit.logs[0]?.completed);
  const todayEvents = agendaEvents.filter((event) => calendarKeyInTimezone(event.startDate, timezone, event.isAllDay) === todayKey);
  const nowMinutes = localMinutesNow(timezone, now);

  const candidates: RankedTodayPlanPriority[] = [
    ...pendingHabits.map((habit) => rankHabitForToday(habit, nowMinutes)),
    ...quests.map((quest) => rankQuestForToday(quest, todayKey, timezone)),
    ...todayEvents.map((event) => rankEventForToday(event, now, timezone)),
  ].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'es-CO'));

  const primary = candidates[0] ? stripPriorityScore(candidates[0]) : null;
  const secondary = candidates.slice(1, 3).map(stripPriorityScore);
  const todayXp = xpEvents
    .filter((event) => calendarKeyInTimezone(event.createdAt, timezone) === todayKey)
    .reduce((sum, event) => sum + event.xpAmount, 0);
  const nextEvent = todayEvents
    .filter((event) => event.isAllDay || event.startDate >= now)
    .map((event) => rankEventForToday(event, now, timezone))
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))[0];
  const lastWorkoutKey = lastWorkout ? calendarKeyInTimezone(lastWorkout.date, timezone) : null;
  const workoutDaysAgo = lastWorkoutKey ? Math.max(0, calendarDayDistance(lastWorkoutKey, todayKey)) : null;
  const advice = buildTodayPlanAdvice({
    primary,
    checkin,
    lastSleep: lastSleep ? { duration: lastSleep.duration } : null,
    pendingHabits: pendingHabits.length,
  });

  return {
    date: todayKey,
    generatedAt: now.toISOString(),
    priorities: {
      primary,
      secondary,
      totalOpen: candidates.length,
    },
    habits: {
      total: scheduledHabits.length,
      completed: completedHabitCount,
      pending: pendingHabits.length,
    },
    calendar: {
      connected: user.googleCalendarSyncEnabled,
      eventCount: todayEvents.length,
      nextEvent: nextEvent ? stripPriorityScore(nextEvent) : null,
    },
    wellbeing: {
      energy: checkin?.energy ?? null,
      mood: checkin?.mood ?? null,
      sleep: lastSleep
        ? {
            duration: Math.round(lastSleep.duration * 10) / 10,
            score: lastSleep.sleepScore ?? null,
            quality: lastSleep.quality,
            date: lastSleep.date.toISOString(),
          }
        : null,
      workout: lastWorkout
        ? {
            title: lastWorkout.title,
            daysAgo: workoutDaysAgo,
            completedToday: workoutDaysAgo === 0,
          }
        : null,
    },
    xp: { earned: todayXp },
    advice,
  };
}

function stripPriorityScore(priority: RankedTodayPlanPriority): TodayPlanPriority {
  const { score: _score, ...value } = priority;
  return value;
}
