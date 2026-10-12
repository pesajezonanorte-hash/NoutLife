import { prisma } from '../lib/prisma';
import { addCalendarDays, DEFAULT_TIMEZONE, getCalendarDay } from '../lib/calendar';
import { isHabitScheduledForDay } from './habit.service';

const DAY_MS = 86_400_000;

function bestWeight(sets: unknown): number {
  if (!Array.isArray(sets)) return 0;
  let best = 0;
  for (const set of sets as Array<{ weight?: unknown }>) {
    const weight = Number(set?.weight);
    if (Number.isFinite(weight) && weight > best) best = weight;
  }
  return best;
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/**
 * Historial compacto (últimos 30 días) para que el Sabio sea proactivo: hábitos que
 * más fallan, rachas rotas, ritmo y récords del gimnasio, sueño, ánimo y obstáculos.
 * Solo datos del propio usuario; devuelve '' si aún no hay nada que contar.
 */
export async function buildSageHistory(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const timezone = user?.timezone ?? DEFAULT_TIMEZONE;
  const today = getCalendarDay(timezone);
  const from30 = addCalendarDays(today, -30);
  const now = Date.now();
  const since28 = new Date(now - 28 * DAY_MS);

  const [habits, workouts, nights, checkins, slips] = await Promise.all([
    prisma.habit.findMany({
      where: { userId, isActive: true },
      select: {
        title: true, frequency: true, currentStreak: true, longestStreak: true, createdAt: true,
        logs: { where: { date: { gte: from30 } }, select: { date: true, completed: true, status: true } },
      },
    }),
    prisma.workout.findMany({
      where: { userId, date: { gte: since28 } },
      select: { date: true, exercises: { select: { sets: true, exercise: { select: { name: true } } } } },
    }),
    prisma.sleepLog.findMany({ where: { userId, isNap: false, date: { gte: from30 } }, select: { duration: true, date: true } }),
    prisma.dailyCheckin.findMany({ where: { userId, date: { gte: addCalendarDays(today, -13) } }, select: { mood: true, date: true } }),
    prisma.antiHabitSlip.findMany({ where: { userId, occurredAt: { gte: new Date(now - 7 * DAY_MS) } }, select: { antiHabit: { select: { name: true } } } }),
  ]);

  const lines: string[] = [];

  // Hábitos: cumplimiento de los días exigidos hasta ayer (hoy aún puede completarse).
  const rates = habits.flatMap((habit) => {
    const firstDay = getCalendarDay(timezone, habit.createdAt);
    const byDay = new Map(habit.logs.map((log) => [log.date.getTime(), log]));
    let required = 0;
    let done = 0;
    for (let day = from30; day.getTime() < today.getTime(); day = addCalendarDays(day, 1)) {
      if (day.getTime() < firstDay.getTime() || !isHabitScheduledForDay(day, habit.frequency)) continue;
      const log = byDay.get(day.getTime());
      if (log?.status === 'skipped') continue;
      required += 1;
      if (log?.completed) done += 1;
    }
    return required >= 5 ? [{ title: habit.title, done, required, rate: done / required }] : [];
  });
  const failing = rates.filter((r) => r.rate < 0.7).sort((a, b) => a.rate - b.rate).slice(0, 3);
  if (failing.length) {
    lines.push(`- Hábitos que más fallan: ${failing.map((r) => `${r.title} ${r.done}/${r.required} días (${Math.round(r.rate * 100)} %)`).join('; ')}`);
  }
  const solid = rates.filter((r) => r.rate >= 0.9).sort((a, b) => b.rate - a.rate).slice(0, 2);
  if (solid.length) lines.push(`- Hábitos más sólidos: ${solid.map((r) => `${r.title} (${Math.round(r.rate * 100)} %)`).join('; ')}`);
  const broken = habits.filter((h) => h.currentStreak === 0 && h.longestStreak >= 5).sort((a, b) => b.longestStreak - a.longestStreak).slice(0, 2);
  if (broken.length) lines.push(`- Rachas rotas: ${broken.map((h) => `${h.title} (récord ${h.longestStreak} días, ahora 0)`).join('; ')}`);

  // Gimnasio: entrenos por semana (de la más antigua a esta) y récords de peso recientes.
  if (workouts.length) {
    const weeks = [0, 0, 0, 0];
    for (const workout of workouts) {
      const ago = Math.floor((now - workout.date.getTime()) / (7 * DAY_MS));
      if (ago >= 0 && ago < 4) weeks[3 - ago] += 1;
    }
    const recent = weeks[2] + weeks[3];
    const before = weeks[0] + weeks[1];
    const trend = recent > before ? 'subiendo' : recent < before ? 'bajando' : 'estable';
    lines.push(`- Gimnasio, entrenos por semana (hace 4 semanas → esta): ${weeks.join(', ')} (${trend})`);

    const half = now - 14 * DAY_MS;
    const best = new Map<string, { early: number; late: number }>();
    for (const workout of workouts) {
      for (const entry of workout.exercises) {
        const weight = bestWeight(entry.sets);
        if (!weight) continue;
        const row = best.get(entry.exercise.name) ?? { early: 0, late: 0 };
        if (workout.date.getTime() >= half) row.late = Math.max(row.late, weight);
        else row.early = Math.max(row.early, weight);
        best.set(entry.exercise.name, row);
      }
    }
    const progress = [...best.entries()].filter(([, r]) => r.early > 0 && r.late > r.early).slice(0, 3);
    if (progress.length) lines.push(`- Progreso de peso (2 semanas): ${progress.map(([name, r]) => `${name} ${r.early}→${r.late} kg`).join('; ')}`);
  } else {
    lines.push('- Gimnasio: sin entrenos registrados en 4 semanas');
  }

  // Sueño: media del mes frente a la última semana.
  const weekAgo = addCalendarDays(today, -7).getTime();
  const month = avg(nights.map((n) => n.duration));
  const week = avg(nights.filter((n) => n.date.getTime() >= weekAgo).map((n) => n.duration));
  if (month !== null && week !== null) lines.push(`- Sueño: ${week.toFixed(1)} h de media esta semana frente a ${month.toFixed(1)} h en el mes`);

  // Ánimo: esta semana frente a la anterior (check-ins de 1 a 5).
  const moodNow = avg(checkins.filter((c) => c.date.getTime() >= weekAgo).map((c) => c.mood));
  const moodBefore = avg(checkins.filter((c) => c.date.getTime() < weekAgo).map((c) => c.mood));
  if (moodNow !== null) lines.push(`- Ánimo: ${moodNow.toFixed(1)}/5 esta semana${moodBefore !== null ? ` (antes ${moodBefore.toFixed(1)}/5)` : ''}`);

  // Obstáculos (anti-hábitos): caídas de los últimos 7 días.
  if (slips.length) {
    const counts = new Map<string, number>();
    for (const slip of slips) counts.set(slip.antiHabit.name, (counts.get(slip.antiHabit.name) ?? 0) + 1);
    lines.push(`- Obstáculos esta semana: ${[...counts.entries()].map(([name, n]) => `${name} ${n} ${n === 1 ? 'caída' : 'caídas'}`).join('; ')}`);
  }

  return lines.join('\n');
}
