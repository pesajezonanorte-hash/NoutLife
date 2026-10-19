// Avisos inteligentes por zona. Cada aviso tiene su hora (la que la persona eligió en
// Ajustes o una hora fija) y se envía una sola vez: la clave de deduplicación incluye
// el día (y la franja), así que dos pasadas del cron en la misma ventana no repiten nada.
// Las comprobaciones de hora van primero: la mayoría de las pasadas no consulta la base.
import { prisma } from '../lib/prisma';
import { getCalendarDay } from '../lib/calendar';
import { averages, snapshot, type PeriodRow } from '../lib/cycle';
import {
  BREAK_TIPS, CARE_COPY, CYCLE_COPY, breakSlots, focusCategory, hydrationSlots, inWindow, localMinutes, parseHHMM, pickQuote,
  sanitizeSmartSettings, type SmartReminderSettings,
} from '../lib/smart-reminders';
import { isHabitScheduledForDay } from './habit.service';
import { createNotification, wasNotified, type NotificationCategory } from './notification.service';

const DAY_MS = 86_400_000;
const WATER_GOAL_ML = 2000;
/** Registro diario de síntomas (Ciclo): 20:30. */
const CYCLE_CHECK_MIN = 20 * 60 + 30;
/** Predicción y cambio de fase (Ciclo): 09:00. */
const CYCLE_NOTICE_MIN = 9 * 60;
/** Aviso de la regla con esta antelación (días). */
const CYCLE_UPCOMING_DAYS = 2;
const QUOTE_MAX_CHARS = 180;

interface Ctx {
  now: Date;
  userId: string;
  gender: string | null;
  level: number;
  /** Minutos locales de ahora. */
  minutes: number;
  /** Inicio del día local (para «hoy» en consultas por instante). */
  since: Date;
  /** Día local AAAA-MM-DD y su medianoche UTC (para consultas por fecha de calendario). */
  day: string;
  calendarDate: Date;
  weekday: number;
  settings: SmartReminderSettings;
}

type Notice = {
  category: NotificationCategory;
  title: string;
  body: string;
  link: string;
  priority?: 'low' | 'normal';
  quick?: 'habit_done' | 'water_250';
  quickRef?: string;
  day?: string;
};

/** Envía el aviso si hoy (o esta franja) todavía no se avisó. Devuelve 1 si se envió. */
async function notifyOnce(c: Ctx, dedupeKey: string, notice: Notice): Promise<number> {
  if (await wasNotified(c.userId, dedupeKey)) return 0;
  await createNotification(c.userId, { type: 'reminder', dedupeKey, ...notice }, { awaitPush: true });
  return 1;
}

const slotDue = (c: Ctx, time: string | null | undefined) => {
  const target = parseHHMM(time);
  return target !== null && inWindow(c.minutes, target);
};

// ─── Coliseo: la rutina programada de hoy, a la hora elegida ──────────────────

async function coliseoScheduled(c: Ctx): Promise<number> {
  if (!slotDue(c, c.settings.coliseo.time)) return 0;
  const routine = await prisma.routine.findFirst({
    where: { userId: c.userId, isActive: true, days: { some: { weekday: c.weekday, isRestDay: false } } },
    select: { name: true },
  });
  if (!routine) return 0;
  const [workout, attendance] = await Promise.all([
    prisma.workout.findFirst({ where: { userId: c.userId, date: { gte: c.since } }, select: { id: true } }),
    prisma.coliseoAttendance.findFirst({ where: { userId: c.userId, date: c.calendarDate }, select: { id: true } }),
  ]);
  if (workout || attendance) return 0;
  return notifyOnce(c, `coliseo-scheduled-${c.day}`, {
    category: 'COLISEO',
    title: 'Hoy toca entrenar',
    body: `«${routine.name}» te espera. Empieza cuando quieras.`,
    link: '/coliseo',
  });
}

// ─── Hábitos y rituales: cuidado personal y rituales de mañana y de noche ─────

async function careReminders(c: Ctx): Promise<number> {
  if (!c.settings.care.enabled) return 0;
  const slots = (['morning', 'night'] as const).filter((s) => slotDue(c, c.settings.care[s]));
  if (slots.length === 0) return 0;

  const [routines, rituals] = await Promise.all([
    prisma.careRoutine.findMany({
      where: { userId: c.userId, isActive: true, timeOfDay: { in: ['morning', 'night'] } },
      select: { id: true, name: true, timeOfDay: true },
    }),
    prisma.ritual.findMany({
      where: { userId: c.userId, isActive: true, type: { in: ['morning', 'night'] } },
      select: { id: true, name: true, type: true },
    }),
  ]);

  let sent = 0;
  for (const r of routines) {
    const slot = r.timeOfDay === 'night' ? 'night' : 'morning';
    if (!slots.includes(slot)) continue;
    const done = await prisma.careLog.findFirst({ where: { routineId: r.id, userId: c.userId, date: c.calendarDate, completed: true }, select: { id: true } });
    if (done) continue;
    sent += await notifyOnce(c, `care-${r.id}-${c.day}`, { category: 'HABITS', title: r.name, body: CARE_COPY[slot].body, link: '/habits' });
  }
  for (const r of rituals) {
    const slot = r.type === 'night' ? 'night' : 'morning';
    if (!slots.includes(slot)) continue;
    const done = await prisma.ritualLog.findFirst({ where: { ritualId: r.id, userId: c.userId, date: c.calendarDate }, select: { id: true } });
    if (done) continue;
    sent += await notifyOnce(c, `ritual-${r.id}-${c.day}`, { category: 'HABITS', title: r.name, body: CARE_COPY[slot].body, link: '/habits?tab=rituales' });
  }
  return sent;
}

/** Hábitos de hoy sin marcar, a la hora elegida (antes iba fijo a las 21:00 para todos). */
async function pendingHabits(c: Ctx): Promise<number> {
  if (!c.settings.habits.enabled || !slotDue(c, c.settings.habits.time)) return 0;
  // Misma clave que el aviso fijo de antes: el día del cambio no llega dos veces.
  const dedupeKey = `zone-reminder:habitos-pendientes:${c.day}`;
  if (await wasNotified(c.userId, dedupeKey)) return 0;
  const [habits, logs] = await Promise.all([
    prisma.habit.findMany({ where: { userId: c.userId, isActive: true }, select: { id: true, title: true, frequency: true } }),
    prisma.habitLog.findMany({ where: { userId: c.userId, date: c.calendarDate }, select: { habitId: true, completed: true, status: true } }),
  ]);
  const handled = new Set(logs.filter((log) => log.completed || log.status === 'skipped' || log.status === 'failed').map((log) => log.habitId));
  const pending = habits.filter((habit) => isHabitScheduledForDay(c.calendarDate, habit.frequency) && !handled.has(habit.id));
  if (!pending.length) return 0;
  const names = pending.slice(0, 3).map((habit) => `«${habit.title}»`).join(', ');
  const extra = pending.length > 3 ? ` y ${pending.length - 3} más` : '';
  return notifyOnce(c, dedupeKey, {
    category: 'HABITS',
    title: `${pending.length} ${pending.length === 1 ? 'hábito pendiente' : 'hábitos pendientes'}`,
    body: `Si todavía puedes, completa ${names}${extra} antes de cerrar el día.`,
    link: '/habits',
  });
}

// ─── Descansos: pausas activas durante la jornada ────────────────────────────

async function breakReminders(c: Ctx): Promise<number> {
  const b = c.settings.breaks;
  if (!b.enabled || (b.workdays && (c.weekday === 0 || c.weekday === 6))) return 0;
  const slots = breakSlots(b.from, b.to, b.everyMinutes);
  const i = slots.findIndex((m) => inWindow(c.minutes, m));
  if (i < 0) return 0;
  return notifyOnce(c, `break-${c.day}-${slots[i]}`, {
    category: 'SYSTEM',
    title: 'Pausa activa',
    body: BREAK_TIPS[i % BREAK_TIPS.length],
    link: '/',
  });
}

// ─── Ciclo: solo para usuarias con Ciclo; avisos discretos (ver CYCLE_COPY) ───

async function cycleReminders(c: Ctx): Promise<number> {
  if (c.gender !== 'female' || !c.settings.cycle.enabled) return 0;
  const checkDue = inWindow(c.minutes, CYCLE_CHECK_MIN);
  const noticeDue = inWindow(c.minutes, CYCLE_NOTICE_MIN);
  if (!checkDue && !noticeDue) return 0;

  const [periods, settings] = await Promise.all([
    prisma.menstrualPeriod.findMany({ where: { userId: c.userId }, select: { startDate: true, endDate: true }, orderBy: { startDate: 'desc' }, take: 12 }),
    prisma.menstrualSettings.findUnique({ where: { userId: c.userId }, select: { cycleLength: true, periodLength: true } }),
  ]);
  // Solo a quien ya usa la zona: sin ajustes ni periodos no hay nada que registrar ni predecir.
  if (!settings && periods.length === 0) return 0;

  let sent = 0;
  if (checkDue) {
    const logged = await prisma.menstrualLog.findFirst({ where: { userId: c.userId, date: c.calendarDate }, select: { id: true } });
    if (!logged) sent += await notifyOnce(c, `cycle-check-${c.day}`, { category: 'SYSTEM', ...CYCLE_COPY.check, priority: 'low' });
  }
  if (noticeDue) {
    const avg = averages(periods as PeriodRow[], { cycleLength: settings?.cycleLength ?? 28, periodLength: settings?.periodLength ?? 5 });
    const snap = snapshot(c.calendarDate, periods as PeriodRow[], avg);
    if (snap) {
      if (snap.daysUntilNextPeriod >= 0 && snap.daysUntilNextPeriod <= CYCLE_UPCOMING_DAYS) {
        sent += await notifyOnce(c, `cycle-upcoming-${snap.nextPeriod}`, { category: 'SYSTEM', ...CYCLE_COPY.upcoming, priority: 'low' });
      }
      if (snap.phaseDay === 1) {
        sent += await notifyOnce(c, `cycle-phase-${c.day}`, { category: 'SYSTEM', ...CYCLE_COPY.phase, priority: 'low' });
      }
    }
  }
  return sent;
}

// ─── Nutrición e hidratación ─────────────────────────────────────────────────

async function hydrationReminders(c: Ctx): Promise<number> {
  const h = c.settings.hydration;
  if (!h.enabled) return 0;
  const slot = hydrationSlots(h.from, h.to, h.everyHours).find((m) => inWindow(c.minutes, m));
  if (slot === undefined) return 0;

  const [sum, goal] = await Promise.all([
    prisma.meal.aggregate({ where: { userId: c.userId, date: c.calendarDate }, _sum: { waterMl: true } }),
    prisma.nutritionGoal.findUnique({ where: { userId: c.userId }, select: { waterMl: true } }),
  ]);
  const drank = sum._sum.waterMl ?? 0;
  const target = goal?.waterMl ?? WATER_GOAL_ML;
  if (drank >= target) return 0;
  const liters = (ml: number) => (ml / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return notifyOnce(c, `hydration-${c.day}-${slot}`, {
    category: 'SYSTEM',
    title: 'Hora de hidratarte',
    body: `Llevas ${liters(drank)} de ${liters(target)} L. Un vaso ahora suma.`,
    link: '/food',
    priority: 'low',
    quick: 'water_250',
    day: c.day,
  });
}

async function mealReminders(c: Ctx): Promise<number> {
  const m = c.settings.meals;
  if (!m.enabled) return 0;
  const slot = m.times.find((t) => slotDue(c, t));
  if (slot === undefined) return 0;
  const eaten = await prisma.meal.findFirst({
    where: { userId: c.userId, date: c.calendarDate, mealType: { not: 'WATER' } },
    select: { id: true },
  });
  if (eaten) return 0;
  return notifyOnce(c, `meal-${c.day}-${slot}`, {
    category: 'SYSTEM',
    title: '¿Ya comiste?',
    body: 'Apúntala mientras la recuerdas.',
    link: '/food',
  });
}

// ─── Sabiduría: una cita del día según en qué progresa la persona ────────────

async function wisdomReminder(c: Ctx): Promise<number> {
  if (!c.settings.wisdom.enabled || !slotDue(c, c.settings.wisdom.time)) return 0;
  const dedupeKey = `wisdom-${c.day}`;
  if (await wasNotified(c.userId, dedupeKey)) return 0;

  const [cards, xp] = await Promise.all([
    prisma.wisdomCard.findMany({
      where: { levelRequired: { lte: c.level } },
      select: { id: true, quote: true, author: true, category: true },
      orderBy: { id: 'asc' },
    }),
    prisma.xpEvent.groupBy({
      by: ['source'],
      where: { userId: c.userId, createdAt: { gte: new Date(c.now.getTime() - 7 * DAY_MS) } },
      _sum: { xpAmount: true },
    }),
  ]);
  const card = pickQuote(cards, focusCategory(new Map(xp.map((row) => [row.source, row._sum.xpAmount ?? 0]))), `${c.userId}:${c.day}`);
  if (!card) return 0;
  const full = `«${card.quote}»${card.author ? ` — ${card.author}` : ''}`;
  const body = full.length > QUOTE_MAX_CHARS ? `${full.slice(0, QUOTE_MAX_CHARS - 1)}…` : full;
  return notifyOnce(c, dedupeKey, { category: 'SYSTEM', title: 'Sabiduría del día', body, link: '/wisdom', priority: 'low' });
}

/** Una pasada: revisa a cada persona con la sesión iniciada en su zona horaria. */
export async function smartReminders(now: Date): Promise<number> {
  const users = await prisma.user.findMany({
    where: { onboardingCompleted: true },
    select: { id: true, timezone: true, gender: true, level: true, notificationPreferences: { select: { reminderSettings: true } } },
  });
  const jobs = [coliseoScheduled, careReminders, pendingHabits, breakReminders, cycleReminders, hydrationReminders, mealReminders, wisdomReminder];
  let sent = 0;
  for (const user of users) {
    const minutes = localMinutes(user.timezone, now);
    const local = getCalendarDay(user.timezone, now);
    const day = local.toISOString().slice(0, 10);
    const c: Ctx = {
      now,
      userId: user.id,
      gender: user.gender,
      level: user.level,
      minutes,
      since: new Date(now.getTime() - minutes * 60_000),
      day,
      calendarDate: new Date(`${day}T00:00:00.000Z`),
      weekday: local.getUTCDay(),
      settings: sanitizeSmartSettings(user.notificationPreferences?.reminderSettings),
    };
    for (const job of jobs) {
      try {
        sent += await job(c);
      } catch (err) {
        console.error(`[SmartReminders] ${job.name}:`, err);
      }
    }
  }
  return sent;
}
