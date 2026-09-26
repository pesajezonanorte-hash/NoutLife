import { prisma } from '../lib/prisma';
import { generateText, hasAIProvider } from '../lib/ai';

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
    prisma.sleepLog.findMany({ where: { userId, date: { gte: weekAgo, lt: now } } }),
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

// ─── Dynamic Life Score (all active zones) ────────────────────────────────────

export interface ZoneScore {
  id: string;
  name: string;
  icon: string;
  color: string;
  score: number;
  hasData: boolean;
}

export async function calculateDynamicLifeScore(userId: string): Promise<{
  totalScore: number;
  zones: ZoneScore[];
  trend: string;
}> {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const lastWeekAgo = new Date(now.getTime() - 7 * 86400000);
  const prevWeekStart = new Date(now.getTime() - 14 * 86400000);
  const prevWeekEnd = new Date(now.getTime() - 7 * 86400000);

  const [
    habits, habitLogs, workouts, sleepLogs, transactions, questCompletions,
    learningItems, journalEntries, customZones, careRoutines, careLogs,
  ] = await Promise.all([
    prisma.habit.findMany({ where: { userId, isActive: true } }),
    prisma.habitLog.findMany({ where: { userId, date: { gte: twoWeeksAgo, lt: now }, completed: true } }),
    prisma.workout.findMany({ where: { userId, date: { gte: twoWeeksAgo, lt: now }, xpEarned: { gt: 0 } } }),
    prisma.sleepLog.findMany({ where: { userId, date: { gte: twoWeeksAgo, lt: now } } }),
    prisma.transaction.findMany({ where: { userId, date: { gte: twoWeeksAgo, lt: now } } }),
    prisma.questCompletion.findMany({ where: { userId, completedAt: { gte: twoWeeksAgo, lt: now } } }),
    prisma.learningItem.findMany({ where: { userId, status: { not: 'NOT_STARTED' } } }),
    prisma.journalEntry.findMany({ where: { userId, date: { gte: twoWeeksAgo, lt: now } } }),
    prisma.customZone.findMany({ where: { userId, isActive: true, isMeasurable: true } }),
    prisma.careRoutine.findMany({ where: { userId, isActive: true } }),
    prisma.careLog.findMany({ where: { userId, date: { gte: twoWeeksAgo, lt: now } } }),
  ]);

  const zones: ZoneScore[] = [];

  // Misiones
  if (questCompletions.length > 0) {
    const score = Math.min(100, questCompletions.length * 8);
    zones.push({ id: 'quests', name: 'Misiones', icon: '⚔️', color: '#8b5cf6', score, hasData: true });
  }

  // Hábitos
  if (habits.length > 0 && habitLogs.length > 0) {
    const possible = habits.length * 14;
    const score = Math.min(100, Math.round((habitLogs.length / possible) * 100));
    zones.push({ id: 'habits', name: 'Hábitos', icon: '🔥', color: '#f59e0b', score, hasData: true });
  }

  // Coliseo (Fitness)
  if (workouts.length > 0) {
    const score = Math.min(100, Math.round((workouts.length / 6) * 100));
    zones.push({ id: 'gym', name: 'Coliseo', icon: '💪', color: '#ef4444', score, hasData: true });
  }

  // Bóveda (Finanzas)
  if (transactions.length > 0) {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
    const savings = income > 0 ? Math.max(0, (income - expense) / income) : 0.5;
    const score = Math.min(100, Math.round(savings * 100));
    zones.push({ id: 'finances', name: 'Bóveda', icon: '💰', color: '#10b981', score, hasData: true });
  }

  // Torre (Sueño)
  if (sleepLogs.length > 0) {
    const avgDuration = sleepLogs.reduce((s, l) => s + l.duration, 0) / sleepLogs.length;
    const score = avgDuration >= 7 ? 100 : Math.round((avgDuration / 9) * 100);
    zones.push({ id: 'sleep', name: 'Torre', icon: '🌙', color: '#6366f1', score, hasData: true });
  }

  // Biblioteca (Aprendizaje)
  const activeLearn = learningItems.filter(l => l.status === 'IN_PROGRESS').length;
  if (activeLearn > 0) {
    const score = Math.min(100, activeLearn * 35 + 10);
    zones.push({ id: 'learning', name: 'Biblioteca', icon: '📚', color: '#06b6d4', score, hasData: true });
  }

  // Diario
  if (journalEntries.length > 0) {
    const score = Math.min(100, journalEntries.length * 8);
    zones.push({ id: 'journal', name: 'Diario', icon: '📓', color: '#ec4899', score, hasData: true });
  }

  // El Espejo (rutinas de cuidado)
  if (careRoutines.length > 0 && careLogs.length > 0) {
    const possible = careRoutines.length * 14;
    const score = Math.min(100, Math.round((careLogs.length / possible) * 100));
    zones.push({ id: 'mirror', name: 'El Espejo', icon: '✨', color: '#a78bfa', score, hasData: true });
  }

  // Custom measurable zones. XP belongs to a zone only when its source is a
  // quest or habit actually linked to that zone. The old implementation used
  // the user's *entire* XP total for every custom zone, which made multiple
  // zones show the same misleading progress.
  const customZoneIds = customZones.map((zone) => zone.id);
  if (customZoneIds.length > 0) {
    const [zoneQuests, zoneHabits] = await Promise.all([
      prisma.quest.findMany({
        where: { userId, customZoneId: { in: customZoneIds } },
        select: { id: true, customZoneId: true },
      }),
      prisma.habit.findMany({
        where: { userId, customZoneId: { in: customZoneIds } },
        select: { id: true, customZoneId: true },
      }),
    ]);

    const sourceZoneById = new Map<string, string>();
    for (const quest of zoneQuests) {
      if (quest.customZoneId) sourceZoneById.set(quest.id, quest.customZoneId);
    }
    for (const habit of zoneHabits) {
      if (habit.customZoneId) sourceZoneById.set(habit.id, habit.customZoneId);
    }

    const sourceIds = [...sourceZoneById.keys()];
    const zoneEvents = sourceIds.length
      ? await prisma.xpEvent.findMany({
        where: {
          userId,
          sourceId: { in: sourceIds },
          createdAt: { gte: twoWeeksAgo, lt: now },
        },
        select: { sourceId: true, xpAmount: true },
      })
      : [];

    const xpByZone = new Map<string, number>();
    for (const event of zoneEvents) {
      const zoneId = event.sourceId ? sourceZoneById.get(event.sourceId) : undefined;
      if (zoneId) xpByZone.set(zoneId, (xpByZone.get(zoneId) ?? 0) + event.xpAmount);
    }

    for (const zone of customZones) {
      const earned = xpByZone.get(zone.id) ?? 0;
      const target = zone.weeklyXpGoal ? zone.weeklyXpGoal * 2 : 0;
      const score = target > 0 ? Math.min(100, Math.round((earned / target) * 100)) : 0;
      if (score > 0) {
        zones.push({ id: zone.id, name: zone.name, icon: zone.icon, color: zone.accentColor, score, hasData: true });
      }
    }
  }

  const filtered = zones.filter(z => z.hasData);
  const totalScore = filtered.length > 0
    ? Math.round(filtered.reduce((sum, z) => sum + z.score, 0) / filtered.length)
    : 0;

  // Trend vs previous week
  const prevQuestCompletions = await prisma.questCompletion.count({
    where: { userId, completedAt: { gte: prevWeekStart, lt: prevWeekEnd } },
  });
  const prevHabitLogs = await prisma.habitLog.count({
    where: { userId, date: { gte: prevWeekStart, lt: prevWeekEnd }, completed: true },
  });
  const prevScore = prevQuestCompletions * 5 + prevHabitLogs * 3;
  const currentScore = questCompletions.filter(q => new Date(q.completedAt) >= lastWeekAgo).length * 5
    + habitLogs.filter(h => new Date(h.date) >= lastWeekAgo).length * 3;
  const diff = currentScore - prevScore;
  const trend = diff === 0 ? '→ igual que la semana pasada'
    : diff > 0 ? `+${Math.min(diff, 15)} vs semana pasada`
    : `${Math.max(diff, -15)} vs semana pasada`;

  return { totalScore, zones: filtered, trend };
}

// ─── Smart Correlations (SQL-based) ───────────────────────────────────────────

export async function getCorrelations(userId: string): Promise<string[]> {
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86400000);

  const [sleepLogs, workouts, questCompletions, journalEntries] = await Promise.all([
    prisma.sleepLog.findMany({ where: { userId, date: { gte: monthAgo, lt: now } }, orderBy: { date: 'asc' } }),
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
    prisma.sleepLog.findMany({ where: { userId, date: { gte: sevenDaysAgo } }, orderBy: { date: 'desc' }, take: 1 }),
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

  const prompt = `Eres el Sabio de LifeQuest RPG. Genera un briefing diario ULTRA MINIMALISTA de máximo 50 palabras para ${user.displayName}.

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
    prisma.sleepLog.findMany({ where: { userId, date: { gte: start, lte: end } } }),
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
