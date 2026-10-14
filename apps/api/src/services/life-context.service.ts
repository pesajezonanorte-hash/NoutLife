// Contexto de vida para el Sabio: todas las zonas de la cuenta en pocas líneas.
//
// Cada zona aporta una sección de líneas cortas (texto compacto, sin JSON:
// ahorra llaves y comillas, que son tokens) con una prioridad. packSections
// las mete en un presupuesto fijo de caracteres: entran primero las más
// importantes y lo que no cabe se corta, así el prompt nunca crece con el
// historial de la persona. Solo se envían títulos y cifras: nada de texto
// libre del diario ni notas (privacidad y tokens).
import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay, DEFAULT_TIMEZONE } from '../lib/calendar';
import { isHabitScheduledForDay } from './habit.service';

/** ≈3,5 caracteres por token en español: 2.800 caracteres ≈ 800 tokens. */
export const CONTEXT_BUDGET_CHARS = 2800;

export type SectionKey =
  | 'profile' | 'today' | 'links' | 'habits' | 'quests' | 'coliseo' | 'nutrition' | 'sleep'
  | 'recreation' | 'finances' | 'mind' | 'focus' | 'obstacles' | 'mirror' | 'mood' | 'relationships';

export interface LifeSection {
  key: SectionKey;
  title: string;
  priority: number;
  lines: string[];
}

/**
 * Empaqueta las secciones dentro de `budget` caracteres. Entran por prioridad
 * (enteras si caben; si no, sus primeras líneas) y salen en su orden original.
 * La salida nunca supera el presupuesto.
 */
export function packSections(sections: LifeSection[], budget = CONTEXT_BUDGET_CHARS): string {
  const kept = new Map<SectionKey, string[]>();
  let used = 0;
  for (const section of [...sections].sort((a, b) => b.priority - a.priority)) {
    // Coste exacto: «TÍTULO:\n» + cada línea con su salto (el salto sobrante paga el separador).
    let cost = section.title.length + 2;
    const lines: string[] = [];
    for (const line of section.lines) {
      if (used + cost + line.length + 1 > budget) break;
      lines.push(line);
      cost += line.length + 1;
    }
    if (!lines.length) continue;
    kept.set(section.key, lines);
    used += cost;
  }
  return sections
    .filter((section) => kept.has(section.key))
    .map((section) => `${section.title}:\n${kept.get(section.key)!.join('\n')}`)
    .join('\n');
}

const DAY_MS = 86_400_000;
const clip = (text: string, max = 40) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const round = (value: number, digits = 0) => Number(value.toFixed(digits));
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const money = (value: number) => new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const daysAgo = (date: Date, now: Date) => Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
const STARS = (rating: number | null) => (rating ? ` ${rating}★` : '');

const RECREATION_KIND: Record<string, string> = {
  MOVIE: 'película', SERIES: 'serie', GAME: 'videojuego', OUTING: 'salida', HOBBY: 'hobby', MUSIC: 'música', OTHER: 'otro',
};
const WORKOUT_KIND: Record<string, string> = { STRENGTH: 'fuerza', WALK: 'caminata', CARDIO: 'cardio' };

/** Instante de la medianoche local de hoy (para registros con hora: comidas, foco, agenda). */
function localDayStart(timezone: string, now: Date): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return new Date(now.getTime() - ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 - now.getMilliseconds());
  } catch {
    return new Date(now.getTime() - DAY_MS);
  }
}

/** Próxima ocurrencia de una fecha importante (las recurrentes vuelven cada año). */
function nextOccurrence(iso: string, recurring: boolean, today: Date): Date | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  if (!recurring) return date;
  const next = new Date(Date.UTC(today.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (next.getTime() < today.getTime()) next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

export interface LifeSnapshot {
  name: string;
  dateLabel: string;
  sections: LifeSection[];
}

/**
 * Lee todas las zonas en una sola tanda de consultas agregadas. `focus` sube la
 * prioridad de una sección (análisis de hábitos, finanzas o plan del Coliseo).
 */
export async function buildLifeSnapshot(userId: string, focus?: SectionKey, now = new Date()): Promise<LifeSnapshot> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      displayName: true, timezone: true, level: true, xp: true, xpToNextLevel: true, gold: true,
      currentStreak: true, longestStreak: true, strength: true, intelligence: true, charisma: true,
    },
  });
  const timezone = user.timezone || DEFAULT_TIMEZONE;
  const today = getCalendarDay(timezone, now);
  const todayStart = localDayStart(timezone, now);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  const twoMonthsAgo = new Date(now.getTime() - 60 * DAY_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const habitStart = addCalendarDays(today, -29);

  const [
    habits, habitLogs, activeQuests, questsDone7, failedQuests,
    workouts, attendanceWeek, meals, nutritionGoal, sleepLogs,
    recreationDone, recreationPlanned, transactions, learning, journal,
    focusSessions, antiHabits, careDone, careRoutines, checkin, relationships, agendaToday,
  ] = await Promise.all([
    prisma.habit.findMany({
      where: { userId, isActive: true }, take: 20, orderBy: [{ currentStreak: 'desc' }, { title: 'asc' }],
      select: { id: true, title: true, frequency: true, currentStreak: true, longestStreak: true },
    }),
    prisma.habitLog.findMany({
      where: { userId, completed: true, date: { gte: habitStart, lt: addCalendarDays(today, 1) } },
      select: { habitId: true, date: true },
    }),
    prisma.quest.findMany({
      where: { userId, status: 'ACTIVE' }, take: 6, orderBy: { deadline: 'asc' },
      select: { title: true, type: true, deadline: true },
    }),
    prisma.questCompletion.count({ where: { userId, completedAt: { gte: weekAgo } } }),
    prisma.quest.findMany({
      where: { userId, status: 'FAILED', updatedAt: { gte: monthAgo } }, take: 3, orderBy: { updatedAt: 'desc' },
      select: { title: true },
    }),
    prisma.workout.findMany({
      where: { userId, date: { gte: twoMonthsAgo, lte: now }, xpEarned: { gt: 0 } }, orderBy: { date: 'desc' },
      select: { date: true, kind: true, duration: true, distanceKm: true, exercises: { select: { sets: true, exercise: { select: { name: true, muscleGroup: true } } } } },
    }),
    prisma.coliseoAttendance.count({ where: { userId, date: { gte: addCalendarDays(today, -6) } } }),
    prisma.meal.findMany({ where: { userId, date: { gte: weekAgo } }, select: { date: true, mealType: true, calories: true, protein: true, waterMl: true } }),
    prisma.nutritionGoal.findUnique({ where: { userId }, select: { calories: true, protein: true, waterMl: true } }),
    prisma.sleepLog.findMany({ where: { userId, isNap: false, date: { gte: weekAgo } }, orderBy: { date: 'desc' }, select: { duration: true, quality: true } }),
    prisma.recreationEntry.findMany({
      where: { userId, status: 'DONE', date: { gte: new Date(now.getTime() - 14 * DAY_MS) } }, orderBy: { date: 'desc' }, take: 12,
      select: { title: true, kind: true, rating: true, minutes: true, date: true },
    }),
    prisma.recreationEntry.findMany({ where: { userId, status: 'PLANNED' }, orderBy: { date: 'asc' }, take: 3, select: { title: true, kind: true } }),
    prisma.transaction.findMany({ where: { userId, date: { gte: monthStart } }, select: { type: true, amount: true, category: true } }),
    prisma.learningItem.findMany({
      where: { userId, status: { not: 'COMPLETED' } }, take: 3, orderBy: { updatedAt: 'desc' },
      select: { title: true, currentProgress: true, totalProgress: true },
    }),
    prisma.journalEntry.findMany({ where: { userId, date: { gte: weekAgo } }, select: { mood: true } }),
    prisma.focusSession.findMany({ where: { userId, completedAt: { gte: weekAgo } }, select: { durationMin: true, completedAt: true } }),
    prisma.antiHabit.findMany({
      where: { userId, isActive: true }, take: 4,
      select: { title: true, targetPerWeek: true, logs: { where: { date: { gte: addCalendarDays(today, -6) } }, select: { occurred: true, amount: true } } },
    }).catch(() => []),
    prisma.careLog.count({ where: { userId, completed: true, date: { gte: weekAgo } } }),
    prisma.careRoutine.count({ where: { userId, isActive: true } }),
    prisma.dailyCheckin.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { mood: true, energy: true, date: true } }),
    prisma.relationship.findMany({ where: { userId }, take: 10, select: { name: true, importantDates: true } }),
    // Los eventos importados de Google solo se cuentan: sus títulos no salen de NoutLife (uso limitado de datos de Google).
    prisma.agendaEvent.findMany({
      where: { userId, startDate: { gte: todayStart, lt: new Date(todayStart.getTime() + DAY_MS) } }, take: 20, orderBy: { startDate: 'asc' },
      select: { title: true, googleEventId: true, isCompleted: true },
    }),
  ]);

  const sections: LifeSection[] = [];
  const add = (key: SectionKey, title: string, priority: number, lines: Array<string | null | false | undefined>) => {
    const kept = lines.filter((line): line is string => Boolean(line));
    if (kept.length) sections.push({ key, title, priority: key === focus ? 200 : priority, lines: kept });
  };

  // ─── Perfil ──────────────────────────────────────────────────────────────
  add('profile', 'PERFIL', 100, [
    `Nivel ${user.level} (${user.xp}/${user.xpToNextLevel} XP), oro ${user.gold}, racha ${user.currentStreak} días (récord ${user.longestStreak}).`,
    `Atributos: fuerza ${user.strength}, intelecto ${user.intelligence}, carisma ${user.charisma}.`,
  ]);

  // ─── Hábitos ─────────────────────────────────────────────────────────────
  const doneByHabit = new Map<string, Set<number>>();
  for (const log of habitLogs) {
    const set = doneByHabit.get(log.habitId) ?? new Set<number>();
    set.add(log.date.getTime());
    doneByHabit.set(log.habitId, set);
  }
  const habitRows = habits.map((habit) => {
    let scheduled = 0;
    let completed = 0;
    const done = doneByHabit.get(habit.id) ?? new Set<number>();
    for (let offset = 0; offset < 30; offset += 1) {
      const date = addCalendarDays(habitStart, offset);
      if (date.getTime() > today.getTime() || !isHabitScheduledForDay(date, habit.frequency)) continue;
      scheduled += 1;
      if (done.has(date.getTime())) completed += 1;
    }
    const dueToday = isHabitScheduledForDay(today, habit.frequency) && !done.has(today.getTime());
    return { habit, scheduled, completed, rate: pct(completed, scheduled), dueToday };
  });
  // Primero los que más se caen: es lo que el Sabio debe ver aunque el resto no quepa.
  const sortedHabits = [...habitRows].sort((a, b) => (a.scheduled >= 4 ? a.rate : 101) - (b.scheduled >= 4 ? b.rate : 101));
  add('habits', 'HÁBITOS (30 días)', 90, sortedHabits.slice(0, 8).map((row) =>
    `${clip(row.habit.title)}: ${row.completed}/${row.scheduled} (${row.rate}%), racha ${row.habit.currentStreak}, récord ${row.habit.longestStreak}`));

  // ─── Hoy ─────────────────────────────────────────────────────────────────
  const pendingToday = habitRows.filter((row) => row.dueToday).map((row) => clip(row.habit.title, 28));
  const soon = activeQuests.filter((quest) => quest.deadline && quest.deadline.getTime() - now.getTime() < 3 * DAY_MS);
  const ownEvents = agendaToday.filter((event) => !event.googleEventId && !event.isCompleted);
  add('today', 'HOY', 95, [
    pendingToday.length ? `Hábitos pendientes: ${pendingToday.slice(0, 5).join(', ')}${pendingToday.length > 5 ? ` y ${pendingToday.length - 5} más` : ''}.` : habits.length ? 'Todos los hábitos de hoy están hechos.' : null,
    soon.length ? `Misiones que vencen en ≤3 días: ${soon.map((quest) => clip(quest.title, 32)).join(', ')}.` : null,
    agendaToday.length ? `Agenda: ${agendaToday.length} evento(s) hoy${ownEvents[0] ? `; siguiente propio: ${clip(ownEvents[0].title, 32)}` : ''}.` : null,
  ]);

  // ─── Misiones ────────────────────────────────────────────────────────────
  add('quests', 'MISIONES', 80, [
    `${activeQuests.length} activas, ${questsDone7} completadas en 7 días.`,
    ...activeQuests.slice(0, 4).map((quest) => `- ${clip(quest.title)} (${quest.type}${quest.deadline ? `, vence ${quest.deadline.toISOString().slice(5, 10)}` : ''})`),
    failedQuests.length ? `Fallidas (30 días): ${failedQuests.map((quest) => clip(quest.title, 30)).join(', ')}.` : null,
  ]);

  // ─── Coliseo ─────────────────────────────────────────────────────────────
  const recent = workouts.filter((workout) => workout.date >= monthAgo);
  const previous = workouts.length - recent.length;
  const kinds = new Map<string, number>();
  const muscles = new Map<string, number>();
  const lifts = new Map<string, { recent: number; before: number; sessions: number }>();
  const best = (sets: unknown) => (Array.isArray(sets) ? sets.reduce((max: number, set) => Math.max(max, Number((set as { weight?: unknown })?.weight) || 0), 0) : 0);
  for (const workout of workouts) {
    if (workout.date >= monthAgo) kinds.set(workout.kind, (kinds.get(workout.kind) ?? 0) + 1);
    for (const row of workout.exercises) {
      const group = row.exercise.muscleGroup?.trim();
      if (group && workout.date >= monthAgo) muscles.set(group, (muscles.get(group) ?? 0) + 1);
      const weight = best(row.sets);
      if (weight <= 0) continue;
      const lift = lifts.get(row.exercise.name) ?? { recent: 0, before: 0, sessions: 0 };
      lift.sessions += 1;
      if (workout.date >= monthAgo) lift.recent = Math.max(lift.recent, weight);
      else lift.before = Math.max(lift.before, weight);
      lifts.set(row.exercise.name, lift);
    }
  }
  const lastWorkout = workouts[0];
  const cardioKm = recent.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
  add('coliseo', 'COLISEO (entrenamiento)', 85, [
    `${recent.length} sesiones en 30 días (antes ${previous}); asistencia esta semana ${attendanceWeek}/7.`,
    lastWorkout ? `Última sesión hace ${daysAgo(lastWorkout.date, now)} días (${WORKOUT_KIND[lastWorkout.kind] ?? lastWorkout.kind}).` : 'Sin sesiones en 60 días.',
    kinds.size ? `Tipos: ${[...kinds].map(([kind, count]) => `${WORKOUT_KIND[kind] ?? kind} ${count}`).join(', ')}${cardioKm ? `; ${round(cardioKm, 1)} km` : ''}.` : null,
    muscles.size ? `Grupos más trabajados: ${[...muscles].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([group, count]) => `${group} ${count}`).join(', ')}.` : null,
    ...[...lifts].sort((a, b) => b[1].sessions - a[1].sessions).slice(0, 3).map(([name, lift]) => (lift.before && lift.recent
      ? `${clip(name, 28)}: ${lift.before}→${lift.recent} kg`
      : `${clip(name, 28)}: mejor ${Math.max(lift.recent, lift.before)} kg`)),
  ]);

  // ─── Nutrición ───────────────────────────────────────────────────────────
  const food = meals.filter((meal) => meal.mealType !== 'WATER');
  const todayMeals = meals.filter((meal) => meal.date >= todayStart);
  const sum = (list: typeof meals, key: 'calories' | 'protein' | 'waterMl') => list.reduce((total, meal) => total + (meal[key] ?? 0), 0);
  const loggedDays = new Set(food.map((meal) => meal.date.toISOString().slice(0, 10))).size;
  const kcalGoal = nutritionGoal?.calories || 2000;
  const proteinGoal = nutritionGoal?.protein || 150;
  const avgProtein = loggedDays ? sum(food, 'protein') / loggedDays : 0;
  add('nutrition', 'NUTRICIÓN', 75, [
    `Hoy: ${Math.round(sum(todayMeals, 'calories'))}/${kcalGoal} kcal, proteína ${Math.round(sum(todayMeals, 'protein'))}/${proteinGoal} g, agua ${round(sum(todayMeals, 'waterMl') / 1000, 1)}/${round((nutritionGoal?.waterMl || 2000) / 1000, 1)} L.`,
    loggedDays ? `7 días: ${loggedDays} días registrados, media ${Math.round(sum(food, 'calories') / loggedDays)} kcal y ${Math.round(avgProtein)} g de proteína al día.` : 'Sin comidas registradas en 7 días.',
  ]);

  // ─── Sueño ───────────────────────────────────────────────────────────────
  const avgSleep = sleepLogs.length ? sleepLogs.reduce((total, log) => total + log.duration, 0) / sleepLogs.length : 0;
  add('sleep', 'SUEÑO', 75, [
    sleepLogs.length
      ? `Media ${round(avgSleep, 1)} h y calidad ${round(sleepLogs.reduce((total, log) => total + log.quality, 0) / sleepLogs.length, 1)}/5 en ${sleepLogs.length} noches; última ${round(sleepLogs[0].duration, 1)} h.`
      : 'Sin noches registradas en 7 días.',
  ]);

  // ─── Recreación ──────────────────────────────────────────────────────────
  const recreationWeek = recreationDone.filter((entry) => entry.date >= weekAgo);
  add('recreation', 'RECREACIÓN (ocio)', 70, [
    `${recreationWeek.length} funciones esta semana (${recreationWeek.reduce((total, entry) => total + (entry.minutes ?? 0), 0)} min).`,
    recreationDone.length ? `Recientes: ${recreationDone.slice(0, 3).map((entry) => `${clip(entry.title, 26)} (${RECREATION_KIND[entry.kind] ?? entry.kind}${STARS(entry.rating)})`).join(', ')}.` : null,
    recreationPlanned.length ? `Por ver: ${recreationPlanned.map((entry) => clip(entry.title, 26)).join(', ')}.` : null,
  ]);

  // ─── Finanzas ────────────────────────────────────────────────────────────
  let income = 0;
  let expenses = 0;
  const byCategory = new Map<string, number>();
  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    if (transaction.type === 'INCOME') income += amount;
    else {
      expenses += amount;
      byCategory.set(transaction.category, (byCategory.get(transaction.category) ?? 0) + amount);
    }
  }
  const topSpend = [...byCategory].sort((a, b) => b[1] - a[1]).slice(0, 2);
  add('finances', 'FINANZAS (este mes, COP)', 65, transactions.length ? [
    `Ingresos ${money(income)}, gastos ${money(expenses)}, balance ${money(income - expenses)}.`,
    topSpend.length ? `Más gasto: ${topSpend.map(([category, amount]) => `${category.toLowerCase()} ${money(amount)}`).join(', ')}.` : null,
  ] : ['Sin movimientos este mes.']);

  // ─── Mente (aprendizaje y diario) ────────────────────────────────────────
  const moods = journal.map((entry) => entry.mood).filter((mood): mood is number => mood != null);
  add('mind', 'MENTE (aprendizaje y diario)', 60, [
    ...learning.map((item) => `${clip(item.title, 32)}: ${item.totalProgress ? `${pct(item.currentProgress, item.totalProgress)}%` : 'en curso'}`),
    `Diario: ${journal.length} entradas en 7 días${moods.length ? `, ánimo medio ${round(moods.reduce((a, b) => a + b, 0) / moods.length, 1)}/5` : ''}.`,
  ]);

  // ─── Enfoque ─────────────────────────────────────────────────────────────
  const focusToday = focusSessions.filter((session) => session.completedAt >= todayStart).reduce((total, session) => total + session.durationMin, 0);
  const focusWeek = focusSessions.reduce((total, session) => total + session.durationMin, 0);
  add('focus', 'ENFOQUE', 55, [`${focusToday} min hoy, ${focusWeek} min en 7 días (${focusSessions.length} sesiones).`]);

  // ─── Obstáculos (anti-hábitos) ───────────────────────────────────────────
  add('obstacles', 'OBSTÁCULOS (esta semana)', 60, antiHabits.map((anti) => {
    const falls = anti.logs.filter((log) => log.occurred).reduce((total, log) => total + log.amount, 0);
    const resisted = anti.logs.filter((log) => !log.occurred).length;
    return `${clip(anti.title, 32)}: ${falls} caídas${anti.targetPerWeek != null ? ` (límite ${anti.targetPerWeek})` : ''}, ${resisted} resistidas`;
  }));

  // ─── Espejo y ánimo ──────────────────────────────────────────────────────
  if (careRoutines) add('mirror', 'ESPEJO (cuidado)', 40, [`${careDone} rutinas de cuidado hechas en 7 días (${careRoutines} activas).`]);
  if (checkin) add('mood', 'CHECK-IN', 50, [`Último: ánimo ${checkin.mood}/5, energía ${checkin.energy}/10, hace ${daysAgo(checkin.date, now)} días.`]);

  // ─── Relaciones: fechas importantes próximas ─────────────────────────────
  const upcoming = relationships.flatMap((relationship) => {
    const dates = Array.isArray(relationship.importantDates) ? relationship.importantDates as Array<{ label?: string; date?: string; isRecurring?: boolean }> : [];
    return dates.flatMap((entry) => {
      const next = entry.date ? nextOccurrence(entry.date, Boolean(entry.isRecurring), today) : null;
      const inDays = next ? Math.round((next.getTime() - today.getTime()) / DAY_MS) : -1;
      return inDays >= 0 && inDays <= 14 ? [{ text: `${clip(entry.label ?? 'Fecha', 24)} de ${clip(relationship.name, 20)} en ${inDays} días`, inDays }] : [];
    });
  }).sort((a, b) => a.inDays - b.inDays).slice(0, 2);
  if (upcoming.length) add('relationships', 'RELACIONES', 45, [`Próximas fechas: ${upcoming.map((entry) => entry.text).join('; ')}.`]);

  // ─── Conexiones entre zonas ──────────────────────────────────────────────
  // Señales ya calculadas: le dan al modelo la visión de conjunto con muy pocos tokens.
  const trainedLast3 = workouts.filter((workout) => now.getTime() - workout.date.getTime() < 3 * DAY_MS).length;
  const struggling = habitRows.filter((row) => row.scheduled >= 4 && row.rate < 60).length;
  const lowMood = (moods.length && moods.reduce((a, b) => a + b, 0) / moods.length < 3) || (checkin && checkin.mood <= 2);
  add('links', 'CONEXIONES ENTRE ZONAS', 88, [
    sleepLogs.length && avgSleep < 6.5 && trainedLast3 >= 2 ? 'Duerme menos de 6,5 h con entrenos seguidos: la recuperación es el cuello de botella.' : null,
    loggedDays >= 3 && recent.length >= 6 && avgProtein < proteinGoal * 0.7 ? 'Entrena seguido pero come poca proteína para su meta.' : null,
    recreationWeek.length === 0 && (struggling >= 2 || lowMood) ? 'Sin ocio esta semana y con ánimo o hábitos a la baja: le vendría bien una pausa planeada.' : null,
    recent.length === 0 && habits.length > 0 ? 'Sus hábitos siguen, pero el Coliseo lleva un mes sin sesiones.' : null,
    focusWeek >= 150 && sleepLogs.length && avgSleep < 6.5 ? 'Mucho enfoque con poco sueño: riesgo de agotamiento.' : null,
  ]);

  return {
    name: clip(user.displayName || 'Héroe', 30),
    dateLabel: today.toISOString().slice(0, 10),
    sections,
  };
}
