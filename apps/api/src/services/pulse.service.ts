// Pronóstico de carga: reúne lo que la app sabe de los próximos 7 días y lo pasa a lib/pulse. En NoutLife
// Lite solo entran los hábitos y la agenda (el resto son zonas de Pro).
import { prisma } from '../lib/prisma';
import { addCalendarDays, getCalendarDay } from '../lib/calendar';
import { PULSE_DAYS, addDays, buildPulse, habitRateByWeekday, type PulseInput } from '../lib/pulse';
import { getPlan } from './billing.service';

const keyOf = (date: Date) => date.toISOString().slice(0, 10);
const HISTORY_WEEKS = 4;

/** Días de la semana de un hábito (null: todos). */
function habitDays(frequency: unknown): number[] | null {
  const f = frequency as { type?: string; days?: number[] } | null;
  return f?.type === 'days_per_week' && Array.isArray(f.days) && f.days.length ? f.days : null;
}

export async function getPulse(userId: string, now = new Date()) {
  const [user, plan] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
    getPlan(userId),
  ]);
  const pro = plan === 'pro';
  const today = getCalendarDay(user.timezone, now);
  const end = addCalendarDays(today, PULSE_DAYS);
  const todayKey = keyOf(today);
  const window = new Set(Array.from({ length: PULSE_DAYS }, (_, i) => addDays(todayKey, i)));
  const none = Promise.resolve([] as never[]);

  const [habits, logs, events, grades, tasks, nights, debts, bills, cards] = await Promise.all([
    prisma.habit.findMany({ where: { userId, isActive: true }, select: { frequency: true } }),
    prisma.habitLog.findMany({ where: { userId, completed: true, date: { gte: addCalendarDays(today, -7 * HISTORY_WEEKS), lt: today } }, select: { date: true } }),
    // Los eventos son instantes reales: se piden con un día de margen y se filtran por el día de la persona.
    prisma.agendaEvent.findMany({ where: { userId, isCompleted: false, eventType: { not: 'habit' }, startDate: { gte: addCalendarDays(today, -1), lt: addCalendarDays(end, 1) } }, select: { startDate: true, isAllDay: true } }),
    pro ? prisma.academicGrade.findMany({
      where: { archivedAt: null, score: null, date: { gte: today, lt: end }, course: { userId, archivedAt: null } },
      select: { id: true, title: true, weight: true, date: true, course: { select: { name: true, topics: { where: { archivedAt: null, mastery: { lt: 2 } }, select: { gradeId: true } } } } },
    }) : none,
    pro ? prisma.academicTask.findMany({ where: { userId, done: false, archivedAt: null, dueAt: { gte: today, lt: end } }, select: { title: true, dueAt: true } }) : none,
    pro ? prisma.sleepLog.findMany({ where: { userId, isNap: false, date: { gte: addCalendarDays(today, -4) } }, orderBy: { date: 'desc' }, take: 3, select: { duration: true } }) : none,
    pro ? prisma.debt.findMany({ where: { userId, type: 'owe', isPaid: false, dueDate: { gte: today, lt: end } }, select: { title: true, dueDate: true } }) : none,
    pro ? prisma.recurringTransaction.findMany({ where: { userId, isActive: true, type: 'EXPENSE' }, select: { description: true, dayOfMonth: true } }) : none,
    pro ? prisma.financeAccount.findMany({ where: { userId, archivedAt: null, kind: 'CREDIT_CARD', dueDay: { not: null } }, select: { name: true, dueDay: true } }) : none,
  ]);

  /** Un pago de día fijo cae en los días de la ventana que tengan ese número (el 31 cae en el último del mes). */
  const monthly = (dayOfMonth: number, title: string) => [...window].filter((day) => {
    const [y, m, d] = day.split('-').map(Number);
    return d === Math.min(dayOfMonth, new Date(Date.UTC(y, m, 0)).getUTCDate());
  }).map((day) => ({ day, title }));

  const schedule = habits.map((h) => ({ days: habitDays(h.frequency) }));
  const input: PulseInput = {
    today: todayKey,
    exams: grades.map((g) => ({
      day: keyOf(g.date!), title: g.title, course: g.course.name, weight: g.weight,
      // Temas sin practicar de esta evaluación; los temas sin evaluación asignada cuentan para la más cercana.
      pendingTopics: g.course.topics.filter((t) => t.gradeId === g.id || t.gradeId === null).length,
    })),
    tasks: tasks.map((t) => ({ day: keyOf(t.dueAt), title: t.title })),
    events: events
      .map((e) => ({ day: e.isAllDay ? keyOf(e.startDate) : keyOf(getCalendarDay(user.timezone, e.startDate)) }))
      .filter((e) => window.has(e.day)),
    habits: schedule,
    habitRate: habitRateByWeekday(schedule, logs.map((l) => keyOf(l.date)), HISTORY_WEEKS),
    nights: nights.map((n) => n.duration),
    dues: [
      ...debts.map((d) => ({ day: keyOf(d.dueDate!), title: d.title })),
      ...bills.flatMap((b) => monthly(b.dayOfMonth, b.description)),
      ...cards.flatMap((c) => monthly(c.dueDay!, c.name)),
    ],
  };
  return buildPulse(input);
}
