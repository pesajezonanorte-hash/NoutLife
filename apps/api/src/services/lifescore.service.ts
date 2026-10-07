import { prisma } from '../lib/prisma';
import { generateText, hasAIProvider } from '../lib/ai';
import { addCalendarDays, getCalendarDay } from '../lib/calendar';
import { isHabitScheduledForDay } from './habit.service';
import { periodRange } from './stats.service';

// ─── Sleep Score ───────────────────────────────────────────────────────────────

export function calculateSleepScore(duration: number, quality: number, bedtime: Date): number {
  let score = 0;

  if (duration >= 7 && duration <= 9) score += 40;
  else if (duration >= 6) score += 30;
  else score += Math.max(0, Math.round(duration * 5));

  score += quality * 6;

  const bedHour = bedtime.getHours() + bedtime.getMinutes() / 60;
  if (bedHour >= 22 && bedHour <= 23.5) score += 30;
  else if (bedHour >= 21 || bedHour <= 0.5) score += 20;
  else score += 10;

  return Math.min(100, Math.round(score));
}

// ─── Life Score ────────────────────────────────────────────────────────────────

export async function calculateLifeScore(userId: string): Promise<{
  total: number;
  breakdown: Record<string, number>;
}> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const [
    habits,
    habitLogs,
    workouts,
    sleepLogs,
    transactions,
    budgets,
    quests,
    questCompletions,
    learningItems,
    journalEntries,
    relationships,
  ] = await Promise.all([
    prisma.habit.findMany({ where: { userId, isActive: true } }),
    prisma.habitLog.findMany({ where: { userId, date: { gte: weekAgo, lt: now }, completed: true } }),
    prisma.workout.findMany({ where: { userId, date: { gte: weekAgo, lt: now }, xpEarned: { gt: 0 } } }),
    prisma.sleepLog.findMany({ where: { userId, isNap: false, date: { gte: weekAgo, lt: now } } }),
    prisma.transaction.findMany({ where: { userId, date: { gte: monthAgo, lt: now } } }),
    prisma.budget.findMany({ where: { userId, month: now.getMonth() + 1, year: now.getFullYear() } }),
    prisma.quest.findMany({ where: { userId } }),
    prisma.questCompletion.findMany({ where: { userId, completedAt: { gte: monthAgo, lt: now } } }),
    prisma.learningItem.findMany({ where: { userId, status: { not: 'NOT_STARTED' } } }),
    prisma.journalEntry.findMany({ where: { userId, date: { gte: weekAgo, lt: now } } }),
    prisma.relationship.findMany({ where: { userId } }),
  ]);

  // Habits score (0-100)
  const totalPossibleLogs = habits.length * 7;
  const habitsScore = totalPossibleLogs > 0
    ? Math.min(100, Math.round((habitLogs.length / totalPossibleLogs) * 100))
    : 50;

  // Fitness score (0-100)
  const gymSessionsThisWeek = workouts.length;
  const sleepScoreAvg = sleepLogs.length
    ? sleepLogs.reduce((sum, s) => sum + (s.sleepScore ?? calculateSleepScore(s.duration, s.quality, s.bedtime)), 0) / sleepLogs.length
    : 50;
  const fitnessScore = Math.min(100, Math.round(
    (Math.min(gymSessionsThisWeek / 3, 1) * 50) + (sleepScoreAvg * 0.5)
  ));

  // Finances score (0-100)
  const monthExpenses = transactions.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
  const monthIncome = transactions.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
  const savingsRate = monthIncome > 0 ? Math.max(0, (monthIncome - monthExpenses) / monthIncome) : 0;
  let budgetScore = 100;
  for (const b of budgets) {
    const spent = transactions
      .filter((t) => t.type === 'EXPENSE' && t.category === b.category)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    if (spent > Number(b.amount)) budgetScore -= 15;
  }
  const financesScore = Math.min(100, Math.round((savingsRate * 50) + (Math.max(0, budgetScore) * 0.5)));

  // Quests score (0-100)
  const activeQuests = quests.filter((q) => q.status === 'ACTIVE').length;
  const completedThisMonth = questCompletions.length;
  const questsScore = Math.min(100, Math.round(
    completedThisMonth * 5 + (activeQuests > 0 ? 50 : 30)
  ));

  // Learning score (0-100)
  const inProgressLearning = learningItems.filter((l) => l.status === 'IN_PROGRESS').length;
  const completedLearning = learningItems.filter((l) => l.status === 'COMPLETED').length;
  const learningScore = Math.min(100, inProgressLearning * 30 + completedLearning * 15 + 10);

  // Relationships score (0-100)
  const partnerRelationship = relationships.find((r) => r.isPartner);
  const relationshipsScore = partnerRelationship ? 65 : 40;

  // Journal score (0-100)
  const journalScore = Math.min(100, journalEntries.length * 20);

  const weights = {
    habits: 0.25,
    fitness: 0.15,
    finances: 0.20,
    quests: 0.15,
    learning: 0.10,
    relationships: 0.10,
    journal: 0.05,
  };

  const breakdown = {
    habits: habitsScore,
    fitness: fitnessScore,
    finances: financesScore,
    quests: questsScore,
    learning: learningScore,
    relationships: relationshipsScore,
    journal: journalScore,
  };

  const total = Math.round(
    breakdown.habits * weights.habits +
    breakdown.fitness * weights.fitness +
    breakdown.finances * weights.finances +
    breakdown.quests * weights.quests +
    breakdown.learning * weights.learning +
    breakdown.relationships * weights.relationships +
    breakdown.journal * weights.journal
  );

  return { total, breakdown };
}

// ─── Dynamic Life Score (all visible life zones) ──────────────────────────────

/**
 * A zone is always returned to the client. `status` differentiates a genuine
 * zero during the selected period from a zone that has not been configured
 * yet, so a missing record is never silently presented as progress.
 */
export type ZoneStatus = 'active' | 'empty' | 'not_configured';

export interface ZoneScore {
  id: string;
  name: string;
  /** Legacy icon key. The client resolves it to a Lucide icon. */
  icon: string;
  color: string;
  /** A normalised 0–100 rhythm/goal score when one can be calculated. */
  score: number;
  /** Whether the score comes from a meaningful denominator or configured goal. */
  scoreAvailable: boolean;
  /** There is at least one real record in the selected interval. */
  hasData: boolean;
  /** The user has configured this area or has historical records for it. */
  isTracking: boolean;
  /** `active` = records, `empty` = configured but none this period. */
  status: ZoneStatus;
  /** Count of real records represented by `activityLabel`. */
  activityCount: number;
  activityLabel: string;
}

const DAY_MS = 86400000;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ratioPercent(value: number, total: number): number {
  return total > 0 ? clampPercent((value / total) * 100) : 0;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function calendarDays(start: Date, end: Date): Date[] {
  // Life-zone queries use the same UTC date-key convention as HabitLog and
  // other calendar records. Keeping the visible denominator on those exact
  // keys avoids adding a phantom day at a period boundary.
  const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const finalInstant = new Date(Math.max(start.getTime(), end.getTime() - 1));
  const last = new Date(Date.UTC(finalInstant.getUTCFullYear(), finalInstant.getUTCMonth(), finalInstant.getUTCDate()));
  const days: Date[] = [];
  for (let cursor = first; cursor.getTime() <= last.getTime(); cursor = addCalendarDays(cursor, 1)) {
    days.push(cursor);
  }
  return days.length ? days : [first];
}

function makeZone(input: Omit<ZoneScore, 'status'>): ZoneScore {
  return {
    ...input,
    status: input.hasData ? 'active' : input.isTracking ? 'empty' : 'not_configured',
  };
}

function xpTrend(current: number, previous: number): string {
  if (previous === 0 && current === 0) return 'Sin XP registrada en este periodo';
  if (previous === 0) return `+${current} XP registradas`;
  const difference = current - previous;
  if (difference === 0) return 'Misma XP que el periodo anterior';
  return `${difference > 0 ? '+' : ''}${difference} XP vs. periodo anterior`;
}

/**
 * Calculates every core Noutlife area from records inside one selected period.
 * Scores are only a compact rhythm indicator; the response always includes the
 * underlying count and state so the UI never invents activity for empty zones.
 */
export async function calculateDynamicLifeScore(userId: string, period = 'month', now = new Date()): Promise<{
  totalScore: number;
  zones: ZoneScore[];
  trend: string;
}> {
  const { start, end, prevStart, prevEnd } = periodRange(period, now);
  const currentRange = { gte: start, lt: end };
  const previousRange = { gte: prevStart, lt: prevEnd };

  const [
    quests,
    questCompletions,
    habits,
    habitLogs,
    workouts,
    historicalWorkoutCount,
    transactions,
    historicalTransactionCount,
    budgets,
    financialGoals,
    sleepLogs,
    historicalSleepCount,
    learningItems,
    journalEntries,
    historicalJournalCount,
    customZones,
    careRoutines,
    careLogs,
    historicalCareLogCount,
    clothingItems,
    outfits,
    presenceCheckins,
    meals,
    historicalMealCount,
    nutritionGoal,
    relationships,
    giftIdeas,
    zoneXpEvents,
    xpCurrent,
    xpPrevious,
  ] = await Promise.all([
    prisma.quest.findMany({
      where: { userId },
      select: { id: true, status: true, customZoneId: true },
    }),
    prisma.questCompletion.findMany({
      where: { userId, completedAt: currentRange },
      select: { questId: true, completedAt: true },
    }),
    prisma.habit.findMany({
      where: { userId },
      select: { id: true, isActive: true, frequency: true, customZoneId: true },
    }),
    prisma.habitLog.findMany({
      where: { userId, date: currentRange },
      select: { habitId: true, completed: true, date: true },
    }),
    prisma.workout.findMany({
      where: { userId, date: currentRange, xpEarned: { gt: 0 } },
      select: { id: true, date: true },
    }),
    prisma.workout.count({ where: { userId, xpEarned: { gt: 0 } } }),
    prisma.transaction.findMany({
      where: { userId, date: currentRange },
      select: { type: true, amount: true, date: true },
    }),
    prisma.transaction.count({ where: { userId } }),
    prisma.budget.findMany({ where: { userId }, select: { id: true } }),
    prisma.financialGoal.findMany({ where: { userId }, select: { id: true } }),
    prisma.sleepLog.findMany({
      where: { userId, isNap: false, date: currentRange },
      select: { duration: true, quality: true, sleepScore: true, bedtime: true, date: true },
    }),
    prisma.sleepLog.count({ where: { userId } }),
    prisma.learningItem.findMany({
      where: { userId },
      select: { id: true, status: true, currentProgress: true, totalProgress: true, updatedAt: true, completedAt: true },
    }),
    prisma.journalEntry.findMany({ where: { userId, date: currentRange }, select: { date: true } }),
    prisma.journalEntry.count({ where: { userId } }),
    prisma.customZone.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, icon: true, accentColor: true, isMeasurable: true, measureMetric: true, weeklyXpGoal: true, order: true },
    }),
    prisma.careRoutine.findMany({ where: { userId, isActive: true }, select: { id: true, timeOfDay: true } }),
    prisma.careLog.findMany({ where: { userId, date: currentRange }, select: { routineId: true, completed: true, date: true } }),
    prisma.careLog.count({ where: { userId, completed: true } }),
    prisma.clothingItem.findMany({ where: { userId }, select: { lastWornAt: true } }),
    prisma.outfit.findMany({ where: { userId }, select: { lastWornAt: true } }),
    prisma.presenceCheckin.findMany({ where: { userId, week: currentRange }, select: { week: true } }),
    prisma.meal.findMany({ where: { userId, date: currentRange }, select: { date: true } }),
    prisma.meal.count({ where: { userId } }),
    prisma.nutritionGoal.findUnique({ where: { userId }, select: { userId: true } }),
    prisma.relationship.findMany({ where: { userId }, select: { id: true, createdAt: true, updatedAt: true } }),
    prisma.giftIdea.findMany({ where: { userId, createdAt: currentRange }, select: { id: true, createdAt: true, isPurchased: true } }),
    prisma.xpEvent.findMany({ where: { userId, createdAt: currentRange }, select: { sourceId: true, xpAmount: true } }),
    prisma.xpEvent.aggregate({ where: { userId, createdAt: currentRange }, _sum: { xpAmount: true } }),
    prisma.xpEvent.aggregate({ where: { userId, createdAt: previousRange }, _sum: { xpAmount: true } }),
  ]);

  const days = calendarDays(start, end);
  const daysInPeriod = days.length;
  const weeksInPeriod = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * DAY_MS)));
  const activeHabits = habits.filter((habit) => habit.isActive);
  const activeQuests = quests.filter((quest) => quest.status === 'ACTIVE');
  const completedHabitLogs = habitLogs.filter((log) => log.completed);
  const completedCareLogs = careLogs.filter((log) => log.completed);

  const zones: ZoneScore[] = [];

  // Misiones — completions are the authoritative action record.
  const questTarget = Math.max(1, Math.min(Math.max(activeQuests.length, 1), weeksInPeriod * 3));
  const completedQuestCount = questCompletions.length;
  zones.push(makeZone({
    id: 'quests',
    name: 'Misiones',
    icon: 'quest',
    color: '#8b5cf6',
    score: ratioPercent(completedQuestCount, questTarget),
    scoreAvailable: activeQuests.length > 0 || completedQuestCount > 0,
    hasData: completedQuestCount > 0,
    isTracking: quests.length > 0,
    activityCount: completedQuestCount,
    activityLabel: completedQuestCount
      ? `${plural(completedQuestCount, 'misión', 'misiones')} completada${completedQuestCount === 1 ? '' : 's'}`
      : 'Sin misiones completadas',
  }));

  // Hábitos — denominator comes from each habit's configured schedule.
  const scheduledHabitSlots = activeHabits.reduce((total, habit) => (
    total + days.filter((day) => isHabitScheduledForDay(day, habit.frequency)).length
  ), 0);
  zones.push(makeZone({
    id: 'habits',
    name: 'Hábitos',
    icon: 'habit',
    color: '#d6a21e',
    score: ratioPercent(completedHabitLogs.length, scheduledHabitSlots),
    scoreAvailable: scheduledHabitSlots > 0,
    hasData: habitLogs.length > 0,
    isTracking: habits.length > 0,
    activityCount: completedHabitLogs.length,
    activityLabel: scheduledHabitSlots
      ? `${completedHabitLogs.length} de ${scheduledHabitSlots} completados`
      : 'Sin hábitos activos',
  }));

  // Coliseo — a completed workout is an entry with awarded XP.
  const gymTarget = weeksInPeriod * 3;
  zones.push(makeZone({
    id: 'gym',
    name: 'Coliseo',
    icon: 'gym',
    color: '#c85a50',
    score: ratioPercent(workouts.length, gymTarget),
    scoreAvailable: historicalWorkoutCount > 0,
    hasData: workouts.length > 0,
    isTracking: historicalWorkoutCount > 0,
    activityCount: workouts.length,
    activityLabel: workouts.length ? `${plural(workouts.length, 'entrenamiento')} terminado${workouts.length === 1 ? '' : 's'}` : 'Sin entrenamientos registrados',
  }));

  // Bóveda — percentage reflects actual net saving rate; expenses without any
  // income are not treated as a fictitious 50% score.
  const income = transactions.filter((transaction) => transaction.type === 'INCOME')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expenses = transactions.filter((transaction) => transaction.type === 'EXPENSE')
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const financeScore = income > 0 ? ratioPercent(Math.max(0, income - expenses), income) : 0;
  const financeTracking = historicalTransactionCount > 0 || budgets.length > 0 || financialGoals.length > 0;
  zones.push(makeZone({
    id: 'finances',
    name: 'Bóveda',
    icon: 'money',
    color: '#419872',
    score: financeScore,
    scoreAvailable: financeTracking,
    hasData: transactions.length > 0,
    isTracking: financeTracking,
    activityCount: transactions.length,
    activityLabel: transactions.length
      ? `${plural(transactions.length, 'transacción', 'transacciones')} · balance ${income - expenses >= 0 ? '+' : ''}${Math.round(income - expenses)}`
      : 'Sin transacciones registradas',
  }));

  // Torre — use a persisted sleep score when available, otherwise calculate it
  // from the actual duration, quality and bedtime values.
  const sleepAverage = sleepLogs.length
    ? sleepLogs.reduce((sum, log) => sum + (log.sleepScore ?? calculateSleepScore(log.duration, log.quality, log.bedtime)), 0) / sleepLogs.length
    : 0;
  zones.push(makeZone({
    id: 'sleep',
    name: 'Torre',
    icon: 'moon',
    color: '#6570c8',
    score: clampPercent(sleepAverage),
    scoreAvailable: historicalSleepCount > 0,
    hasData: sleepLogs.length > 0,
    isTracking: historicalSleepCount > 0,
    activityCount: sleepLogs.length,
    activityLabel: sleepLogs.length ? `${plural(sleepLogs.length, 'noche')} registrada${sleepLogs.length === 1 ? '' : 's'}` : 'Sin noches registradas',
  }));

  // Biblioteca — progress is only calculated for records edited/completed in
  // this interval. Existing items still remain visible with an honest empty state.
  const touchedLearning = learningItems.filter((item) => (
    (item.updatedAt >= start && item.updatedAt < end) ||
    (item.completedAt !== null && item.completedAt >= start && item.completedAt < end)
  ));
  const measurableLearning = touchedLearning
    .map((item) => item.status === 'COMPLETED'
      ? 100
      : item.totalProgress > 0 ? ratioPercent(item.currentProgress, item.totalProgress) : null)
    .filter((score): score is number => score !== null);
  const learningScore = measurableLearning.length
    ? measurableLearning.reduce((sum, score) => sum + score, 0) / measurableLearning.length
    : 0;
  zones.push(makeZone({
    id: 'learning',
    name: 'Biblioteca',
    icon: 'book',
    color: '#378fa0',
    score: clampPercent(learningScore),
    scoreAvailable: measurableLearning.length > 0,
    hasData: touchedLearning.length > 0,
    isTracking: learningItems.length > 0,
    activityCount: touchedLearning.length,
    activityLabel: touchedLearning.length ? `${plural(touchedLearning.length, 'elemento')} actualizado${touchedLearning.length === 1 ? '' : 's'}` : 'Sin avance registrado',
  }));

  // Diario — coverage is based on distinct calendar days, never duplicate rows.
  const journalDays = new Set(journalEntries.map((entry) => dayKey(entry.date))).size;
  zones.push(makeZone({
    id: 'journal',
    name: 'Diario',
    icon: 'journal',
    color: '#bc628c',
    score: ratioPercent(journalDays, daysInPeriod),
    scoreAvailable: historicalJournalCount > 0,
    hasData: journalEntries.length > 0,
    isTracking: historicalJournalCount > 0,
    activityCount: journalEntries.length,
    activityLabel: journalEntries.length ? `${plural(journalEntries.length, 'entrada')} registrada${journalEntries.length === 1 ? '' : 's'}` : 'Sin entradas registradas',
  }));

  // El Espejo — care routines form the measurable denominator; wardrobe,
  // outfits and presence check-ins are genuine supplementary records but do not
  // get converted into invented completion percentages.
  const expectedCareSlots = careRoutines.reduce((total, routine) => (
    total + (routine.timeOfDay === 'weekly' ? weeksInPeriod : daysInPeriod)
  ), 0);
  const wornItems = clothingItems.filter((item) => item.lastWornAt && item.lastWornAt >= start && item.lastWornAt < end).length;
  const wornOutfits = outfits.filter((outfit) => outfit.lastWornAt && outfit.lastWornAt >= start && outfit.lastWornAt < end).length;
  const mirrorActivity = completedCareLogs.length + wornItems + wornOutfits + presenceCheckins.length;
  const mirrorTracking = careRoutines.length > 0 || historicalCareLogCount > 0 || clothingItems.length > 0 || outfits.length > 0;
  zones.push(makeZone({
    id: 'mirror',
    name: 'El Espejo',
    icon: 'sparkles',
    color: '#9274c9',
    score: ratioPercent(completedCareLogs.length, expectedCareSlots),
    scoreAvailable: expectedCareSlots > 0,
    hasData: mirrorActivity > 0,
    isTracking: mirrorTracking,
    activityCount: mirrorActivity,
    activityLabel: mirrorActivity ? `${plural(mirrorActivity, 'registro')} de cuidado o presencia` : 'Sin registros de cuidado',
  }));

  // Nutrición — daily coverage is measured from meal records, not from a
  // guessed calorie target.
  const mealDays = new Set(meals.map((meal) => dayKey(meal.date))).size;
  const nutritionTracking = historicalMealCount > 0 || Boolean(nutritionGoal);
  zones.push(makeZone({
    id: 'nutrition',
    name: 'Nutrición',
    icon: 'salad',
    color: '#73965b',
    score: ratioPercent(mealDays, daysInPeriod),
    scoreAvailable: nutritionTracking,
    hasData: meals.length > 0,
    isTracking: nutritionTracking,
    activityCount: meals.length,
    activityLabel: meals.length ? `${plural(meals.length, 'comida')} registrada${meals.length === 1 ? '' : 's'}` : 'Sin comidas registradas',
  }));

  // Relationships have setup records but no interaction-log model yet. Keep the
  // zone visible and explicitly avoid manufacturing a percentage from metadata.
  const relationshipUpdates = relationships.filter((relationship) => (
    relationship.createdAt >= start && relationship.createdAt < end ||
    relationship.updatedAt >= start && relationship.updatedAt < end
  )).length;
  const relationshipActivity = relationshipUpdates + giftIdeas.length;
  zones.push(makeZone({
    id: 'relationships',
    name: 'Relaciones',
    icon: 'heart',
    color: '#bb6676',
    score: 0,
    scoreAvailable: false,
    hasData: relationshipActivity > 0,
    isTracking: relationships.length > 0,
    activityCount: relationshipActivity,
    activityLabel: relationships.length
      ? relationshipActivity ? `${plural(relationshipActivity, 'actualización')} de relación o regalo` : 'Sin interacción registrable en este periodo'
      : 'Aún sin relaciones configuradas',
  }));

  // Custom zones derive their records only from linked habits, quests and XP
  // sources. This avoids the old bug where all user XP was credited to every
  // custom zone at once.
  const questZoneById = new Map(quests.filter((quest) => quest.customZoneId).map((quest) => [quest.id, quest.customZoneId!]));
  const habitZoneById = new Map(habits.filter((habit) => habit.customZoneId).map((habit) => [habit.id, habit.customZoneId!]));
  const customQuestCompletions = new Map<string, number>();
  const customHabitCompletions = new Map<string, number>();
  const customXp = new Map<string, number>();

  for (const completion of questCompletions) {
    const zoneId = questZoneById.get(completion.questId);
    if (zoneId) customQuestCompletions.set(zoneId, (customQuestCompletions.get(zoneId) ?? 0) + 1);
  }
  for (const log of completedHabitLogs) {
    const zoneId = habitZoneById.get(log.habitId);
    if (zoneId) customHabitCompletions.set(zoneId, (customHabitCompletions.get(zoneId) ?? 0) + 1);
  }
  for (const event of zoneXpEvents) {
    const zoneId = event.sourceId ? questZoneById.get(event.sourceId) ?? habitZoneById.get(event.sourceId) : undefined;
    if (zoneId) customXp.set(zoneId, (customXp.get(zoneId) ?? 0) + event.xpAmount);
  }

  for (const zone of [...customZones].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))) {
    const linkedQuests = quests.filter((quest) => quest.customZoneId === zone.id);
    const linkedActiveHabits = activeHabits.filter((habit) => habit.customZoneId === zone.id);
    const questCount = customQuestCompletions.get(zone.id) ?? 0;
    const habitCount = customHabitCompletions.get(zone.id) ?? 0;
    const earnedXp = customXp.get(zone.id) ?? 0;
    const expectedHabitSlots = linkedActiveHabits.reduce((total, habit) => (
      total + days.filter((day) => isHabitScheduledForDay(day, habit.frequency)).length
    ), 0);

    let score = 0;
    let scoreAvailable = false;
    if (zone.measureMetric === 'habits_streak' && expectedHabitSlots > 0) {
      score = ratioPercent(habitCount, expectedHabitSlots);
      scoreAvailable = true;
    } else if (zone.measureMetric === 'quests_completed' && linkedQuests.length > 0) {
      score = ratioPercent(questCount, Math.max(1, Math.min(linkedQuests.length, weeksInPeriod * 3)));
      scoreAvailable = true;
    } else if ((zone.measureMetric === 'xp_gained' || zone.weeklyXpGoal) && zone.weeklyXpGoal) {
      score = ratioPercent(earnedXp, zone.weeklyXpGoal * weeksInPeriod);
      scoreAvailable = true;
    }

    const activityCount = questCount + habitCount;
    const hasData = activityCount > 0 || earnedXp > 0;
    const isTracking = zone.isMeasurable || linkedQuests.length > 0 || linkedActiveHabits.length > 0;
    const activityLabel = scoreAvailable && zone.weeklyXpGoal
      ? `${earnedXp} XP de ${zone.weeklyXpGoal * weeksInPeriod} objetivo`
      : activityCount
        ? `${activityCount} acción${activityCount === 1 ? '' : 'es'} vinculada${activityCount === 1 ? '' : 's'}`
        : isTracking ? 'Sin registros vinculados' : 'Métrica pendiente de definir';

    zones.push(makeZone({
      id: zone.id,
      name: zone.name,
      icon: zone.icon,
      color: zone.accentColor,
      score,
      scoreAvailable,
      hasData,
      isTracking,
      activityCount,
      activityLabel,
    }));
  }

  const scoreableZones = zones.filter((zone) => zone.isTracking && zone.scoreAvailable);
  const totalScore = scoreableZones.length
    ? Math.round(scoreableZones.reduce((sum, zone) => sum + zone.score, 0) / scoreableZones.length)
    : 0;

  return {
    totalScore,
    zones,
    trend: xpTrend(xpCurrent._sum.xpAmount ?? 0, xpPrevious._sum.xpAmount ?? 0),
  };
}

// ─── Smart Correlations (SQL-based) ───────────────────────────────────────────

export async function getCorrelations(userId: string): Promise<string[]> {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const [sleepLogs, workouts, questCompletions, journalEntries] = await Promise.all([
    prisma.sleepLog.findMany({ where: { userId, isNap: false, date: { gte: monthAgo, lt: now } }, orderBy: { date: 'asc' } }),
    prisma.workout.findMany({ where: { userId, date: { gte: monthAgo, lt: now }, xpEarned: { gt: 0 } }, select: { date: true } }),
    prisma.questCompletion.findMany({ where: { userId, completedAt: { gte: monthAgo, lt: now } } }),
    prisma.journalEntry.findMany({ where: { userId, date: { gte: monthAgo, lt: now } }, select: { date: true, mood: true } }),
  ]);

  const correlations: string[] = [];
  const workoutDates = new Set(workouts.map((w) => w.date.toISOString().slice(0, 10)));

  // Sleep > 7h correlation with quests
  const goodSleepDays = sleepLogs.filter((s) => s.duration >= 7).map((s) => s.date.toISOString().slice(0, 10));
  const questsByDay: Record<string, number> = {};
  for (const qc of questCompletions) {
    const day = qc.completedAt.toISOString().slice(0, 10);
    questsByDay[day] = (questsByDay[day] ?? 0) + 1;
  }

  if (goodSleepDays.length >= 5) {
    const avgQuestsGoodSleep = goodSleepDays.reduce((sum, d) => sum + (questsByDay[d] ?? 0), 0) / goodSleepDays.length;
    const allDaysAvg = questCompletions.length / 30;
    if (avgQuestsGoodSleep > allDaysAvg * 1.2) {
      correlations.push(`Cuando duermes 7+ horas, completas ${Math.round((avgQuestsGoodSleep / allDaysAvg - 1) * 100)}% más quests al día siguiente.`);
    }
  }

  // Gym days and mood correlation
  if (workouts.length >= 8 && journalEntries.some((j) => j.mood !== null)) {
    const moodGymDays = journalEntries
      .filter((j) => j.mood !== null && workoutDates.has(j.date.toISOString().slice(0, 10)))
      .map((j) => j.mood as number);
    const moodNoGymDays = journalEntries
      .filter((j) => j.mood !== null && !workoutDates.has(j.date.toISOString().slice(0, 10)))
      .map((j) => j.mood as number);

    if (moodGymDays.length >= 4 && moodNoGymDays.length >= 4) {
      const avgGym = moodGymDays.reduce((sum, m) => sum + m, 0) / moodGymDays.length;
      const avgNoGym = moodNoGymDays.reduce((sum, m) => sum + m, 0) / moodNoGymDays.length;
      if (avgGym > avgNoGym + 0.5) {
        correlations.push(`En días de gym, tu mood promedio es ${(avgGym - avgNoGym).toFixed(1)} puntos más alto.`);
      }
    }
  }

  // Day of week productivity
  const dayQuestCounts: Record<number, number[]> = {};
  for (const qc of questCompletions) {
    const day = qc.completedAt.getDay();
    if (!dayQuestCounts[day]) dayQuestCounts[day] = [];
    dayQuestCounts[day].push(1);
  }
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayAvgs = Object.entries(dayQuestCounts)
    .map(([day, counts]) => ({ day: Number(day), avg: counts.length / 4 }))
    .sort((a, b) => b.avg - a.avg);

  if (dayAvgs.length >= 3) {
    correlations.push(`${dayNames[dayAvgs[0].day]} es tu día más productivo. ${dayNames[dayAvgs[dayAvgs.length - 1].day]} el menos.`);
  }

  return correlations;
}

// ─── Morning Briefing ─────────────────────────────────────────────────────────

export async function getMorningBriefing(userId: string): Promise<{
  briefing: string;
  cached: boolean;
}> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (user.morningBriefingLastSeen && user.morningBriefingLastSeen >= today) {
    const cached = await prisma.sageMemory.findFirst({
      where: { userId, role: 'sage', topic: 'morning_briefing' },
      orderBy: { createdAt: 'desc' },
    });
    if (cached) return { briefing: cached.content, cached: true };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const [habits, agendaToday, transactions, budgets, sleepLogs, streakRisk] = await Promise.all([
    prisma.habit.findMany({
      where: { userId, isActive: true },
      include: { logs: { where: { date: todayStart }, take: 1 } },
    }),
    prisma.agendaEvent.findMany({
      where: { userId, startDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) } },
      orderBy: { startDate: 'asc' },
    }),
    prisma.transaction.findMany({ where: { userId, date: { gte: startOfMonth } }, select: { type: true, amount: true, category: true } }),
    prisma.budget.findMany({ where: { userId, month: now.getMonth() + 1, year: now.getFullYear() } }),
    prisma.sleepLog.findMany({ where: { userId, isNap: false, date: { gte: sevenDaysAgo } }, orderBy: { date: 'desc' }, take: 1 }),
    prisma.habit.findMany({ where: { userId, isActive: true, currentStreak: { gte: 5 } }, orderBy: { currentStreak: 'desc' }, take: 3 }),
  ]);

  const monthIncome = transactions.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
  const monthExpenses = transactions.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();

  const budgetAlerts: string[] = [];
  for (const b of budgets) {
    const spent = transactions
      .filter((t) => t.type === 'EXPENSE' && t.category === b.category)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const pct = Math.round((spent / Number(b.amount)) * 100);
    if (pct >= 70) {
      budgetAlerts.push(`${b.category}: ${pct}% gastado`);
    }
  }

  const pendingHabits = habits.filter((h) => !h.logs[0]?.completed).length;
  const lastSleep = sleepLogs[0];

  const context = {
    userName: user.displayName,
    todayEvents: agendaToday.map((e) => `${e.title} a las ${new Date(e.startDate).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`),
    monthBalance: monthIncome - monthExpenses,
    daysLeft,
    budgetAlerts,
    streakAtRisk: streakRisk.map((h) => `"${h.title}" lleva ${h.currentStreak} días`),
    pendingHabits,
    sleepLastNight: lastSleep ? `${lastSleep.duration.toFixed(1)}h de sueño, calidad ${lastSleep.quality}/5` : null,
    userLevel: user.level,
    playerClass: user.playerClass,
  };

  if (!hasAIProvider()) {
    const fallback = `⚡ **Eventos hoy:** ${agendaToday.length} · **Hábitos pendientes:** ${pendingHabits}\n💡 ¡Avanza paso a paso y conquista tu día!`;
    await prisma.user.update({ where: { id: userId }, data: { morningBriefingLastSeen: now } });
    return { briefing: fallback, cached: false };
  }

  const prompt = `Eres el Sabio de Noutlife RPG. Genera un briefing diario ULTRA MINIMALISTA de máximo 50 palabras para ${user.displayName}.

DATOS:
- Nivel ${context.userLevel}, Eventos hoy: ${context.todayEvents.length}, Hábitos pendientes: ${context.pendingHabits}
- Sueño: ${context.sleepLastNight ?? 'normal'}, Rachas riesgo: ${context.streakAtRisk.length > 0 ? context.streakAtRisk.join(', ') : 'ninguna'}

FORMATO ESTRICTO (3 líneas muy breves, sin texto de relleno):
🎯 **Enfoque hoy:** [1 frase corta]
🔥 **Rachas & Hábitos:** [1 frase corta]
💡 **Consejo del Sabio:** [1 consejo directo de 1 frase]`;

  try {
    const briefing = await generateText([{ role: 'user', content: prompt }], {
      temperature: 0.7,
      maxTokens: 150,
    });

    await Promise.all([
      prisma.user.update({ where: { id: userId }, data: { morningBriefingLastSeen: now } }),
      prisma.sageMemory.create({
        data: { userId, role: 'sage', content: briefing, topic: 'morning_briefing' },
      }),
    ]);

    return { briefing, cached: false };
  } catch {
    const fallback = `¡Buenos días, ${user.displayName}! Tienes ${agendaToday.length} eventos hoy y ${pendingHabits} hábitos pendientes. El Sabio te desea un día épico.`;
    return { briefing: fallback, cached: false };
  }
}

// ─── Year in Review ────────────────────────────────────────────────────────────

export async function getYearInReview(userId: string, year?: number) {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const start = new Date(targetYear, 0, 1);
  const end = targetYear >= now.getFullYear()
    ? now
    : new Date(targetYear, 11, 31, 23, 59, 59);

  const [xpEvents, workouts, sleepLogs, questCompletions, journalEntries, learningItems] = await Promise.all([
    prisma.xpEvent.findMany({ where: { userId, createdAt: { gte: start, lte: end } } }),
    prisma.workout.findMany({ where: { userId, date: { gte: start, lte: end }, xpEarned: { gt: 0 } } }),
    prisma.sleepLog.findMany({ where: { userId, isNap: false, date: { gte: start, lte: end } } }),
    prisma.questCompletion.findMany({ where: { userId, completedAt: { gte: start, lte: end } } }),
    prisma.journalEntry.findMany({ where: { userId, date: { gte: start, lte: end } } }),
    prisma.learningItem.findMany({ where: { userId, completedAt: { gte: start, lte: end } } }),
  ]);

  const totalXp = xpEvents.reduce((sum, e) => sum + e.xpAmount, 0);
  const totalGold = xpEvents.reduce((sum, e) => sum + e.goldAmount, 0);
  const totalWorkouts = workouts.length;
  const avgSleep = sleepLogs.length
    ? sleepLogs.reduce((sum, s) => sum + s.duration, 0) / sleepLogs.length
    : 0;
  const avgMood = journalEntries.filter((j) => j.mood !== null).length
    ? journalEntries.filter((j) => j.mood !== null).reduce((sum, j) => sum + (j.mood ?? 0), 0) /
      journalEntries.filter((j) => j.mood !== null).length
    : 0;

  // Month-by-month XP
  const xpByMonth: Record<string, number> = {};
  for (const e of xpEvents) {
    const month = e.createdAt.toISOString().slice(0, 7);
    xpByMonth[month] = (xpByMonth[month] ?? 0) + e.xpAmount;
  }

  const bestMonth = Object.entries(xpByMonth).sort((a, b) => b[1] - a[1])[0];

  return {
    year: targetYear,
    totalXp,
    totalGold,
    totalWorkouts,
    totalQuestsCompleted: questCompletions.length,
    totalJournalEntries: journalEntries.length,
    totalBooksCompleted: learningItems.filter((l) => l.type === 'BOOK').length,
    avgSleepHours: Math.round(avgSleep * 10) / 10,
    avgMood: Math.round(avgMood * 10) / 10,
    bestMonth: bestMonth ? { month: bestMonth[0], xp: bestMonth[1] } : null,
    xpByMonth,
  };
}
