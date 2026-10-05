// Recordatorios: una pasada revisa qué toca avisar ahora y lo envía una sola vez.
//
// En Vercel la API es serverless y node-cron no corre, así que esta pasada se
// dispara desde fuera (POST /api/v1/cron/tick con CRON_SECRET, cada 5 min) y,
// en un servidor persistente, también desde el scheduler. Cada aviso tiene una
// clave estable (dedupeKey): si el cron llega tarde o dos veces, no se repite.
// La ventana de 30 min deja margen a un cron impuntual sin avisar a destiempo.
import { prisma } from '../lib/prisma';
import { DEFAULT_TIMEZONE, getCalendarDay } from '../lib/calendar';
import { isHabitScheduledForDay } from './habit.service';
import { createNotification, wasNotified } from './notification.service';

const WINDOW_MS = 30 * 60 * 1000;

/** Minutos desde la medianoche local del usuario. */
function localMinutes(timezone: string | null | undefined, now: Date): number {
  const fmt = (tz: string) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  let parts: Intl.DateTimeFormatPart[];
  try { parts = fmt(timezone || DEFAULT_TIMEZONE); } catch { parts = fmt(DEFAULT_TIMEZONE); }
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function parseHHMM(value: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function localTimeLabel(timezone: string | null | undefined, date: Date) {
  try {
    return new Intl.DateTimeFormat('es-ES', { timeZone: timezone || DEFAULT_TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(date);
  } catch {
    return new Intl.DateTimeFormat('es-ES', { timeZone: DEFAULT_TIMEZONE, hour: '2-digit', minute: '2-digit' }).format(date);
  }
}

/** ¿La hora objetivo (minutos locales) cayó en la ventana que termina ahora? */
function inWindow(nowMinutes: number, target: number) {
  const diff = nowMinutes - target;
  return diff >= 0 && diff * 60_000 < WINDOW_MS;
}

async function habitReminders(now: Date) {
  const habits = await prisma.habit.findMany({
    where: { isActive: true, reminderTime: { not: null } },
    select: {
      id: true, title: true, userId: true, frequency: true, reminderTime: true,
      user: { select: { timezone: true, notificationPreferences: { select: { habitReminders: true } } } },
    },
  });
  let sent = 0;
  for (const habit of habits) {
    const target = parseHHMM(habit.reminderTime);
    if (target === null) continue;
    if (habit.user.notificationPreferences && !habit.user.notificationPreferences.habitReminders) continue;
    const tz = habit.user.timezone;
    if (!inWindow(localMinutes(tz, now), target)) continue;
    const day = getCalendarDay(tz, now);
    if (!isHabitScheduledForDay(day, habit.frequency)) continue;
    const done = await prisma.habitLog.findFirst({ where: { habitId: habit.id, date: day, completed: true }, select: { id: true } });
    if (done) continue;
    const dedupeKey = `habit-reminder-${habit.id}-${day.toISOString().slice(0, 10)}`;
    if (await wasNotified(habit.userId, dedupeKey)) continue;
    await createNotification(habit.userId, {
      type: 'reminder',
      category: 'HABITS',
      dedupeKey,
      title: `Hora de: ${habit.title}`,
      body: 'Márcalo cuando lo hagas y tu racha sigue viva.',
      link: '/habits',
    }, { awaitPush: true });
    sent += 1;
  }
  return sent;
}

async function agendaReminders(now: Date) {
  // El aviso más anticipado es de un día (1440 min): basta mirar los eventos de las próximas 25 h.
  const events = await prisma.agendaEvent.findMany({
    where: {
      reminder: { not: null },
      isCompleted: false,
      eventType: { not: 'habit' },
      startDate: { gte: new Date(now.getTime() - 5 * 60_000), lte: new Date(now.getTime() + 25 * 60 * 60_000) },
    },
    select: { id: true, userId: true, title: true, startDate: true, reminder: true, isAllDay: true, user: { select: { timezone: true } } },
  });
  let sent = 0;
  for (const event of events) {
    const fireAt = event.startDate.getTime() - (event.reminder ?? 0) * 60_000;
    if (now.getTime() < fireAt || now.getTime() - fireAt >= WINDOW_MS) continue;
    const dedupeKey = `agenda-reminder-${event.id}-${event.startDate.toISOString()}`;
    if (await wasNotified(event.userId, dedupeKey)) continue;
    const mins = Math.round((event.startDate.getTime() - now.getTime()) / 60_000);
    const body = event.isAllDay
      ? 'Es hoy. Revisa tu agenda.'
      : mins <= 1 ? 'Empieza ahora.' : mins < 90 ? `Empieza en ${mins} min.` : `Empieza a las ${localTimeLabel(event.user.timezone, event.startDate)}.`;
    await createNotification(event.userId, {
      type: 'reminder',
      category: 'SYSTEM',
      dedupeKey,
      title: event.title,
      body,
      link: '/agenda',
    }, { awaitPush: true });
    sent += 1;
  }
  return sent;
}

async function questDeadlines(now: Date) {
  const quests = await prisma.quest.findMany({
    where: { status: 'ACTIVE', deadline: { gte: new Date(now.getTime() + 60 * 60_000), lte: new Date(now.getTime() + 2 * 60 * 60_000) } },
    select: { id: true, userId: true, title: true },
  });
  let sent = 0;
  for (const quest of quests) {
    const dedupeKey = `deadline-${quest.id}`;
    if (await wasNotified(quest.userId, dedupeKey)) continue;
    await createNotification(quest.userId, {
      type: 'quest_deadline',
      category: 'QUESTS',
      dedupeKey,
      title: 'Misión por vencer',
      body: `"${quest.title}" vence en menos de 2 horas.`,
      link: '/quests',
    }, { awaitPush: true });
    sent += 1;
  }
  return sent;
}

async function dailySummaries(now: Date) {
  const users = await prisma.user.findMany({
    where: { onboardingCompleted: true, notificationPreferences: { dailySummary: true } },
    select: { id: true, timezone: true, notificationPreferences: { select: { dailySummaryTime: true } } },
  });
  let sent = 0;
  for (const user of users) {
    const minutes = localMinutes(user.timezone, now);
    const target = parseHHMM(user.notificationPreferences?.dailySummaryTime ?? '21:00');
    if (target === null || !inWindow(minutes, target)) continue;
    const day = getCalendarDay(user.timezone, now).toISOString().slice(0, 10);
    const dedupeKey = `daily-summary-${day}`;
    if (await wasNotified(user.id, dedupeKey)) continue;
    // Medianoche local: ahora menos los minutos transcurridos del día.
    const since = new Date(now.getTime() - minutes * 60_000);
    const [completions, xp] = await Promise.all([
      prisma.questCompletion.count({ where: { userId: user.id, completedAt: { gte: since } } }),
      prisma.xpEvent.aggregate({ where: { userId: user.id, createdAt: { gte: since } }, _sum: { xpAmount: true } }),
    ]);
    await createNotification(user.id, {
      type: 'daily_summary',
      category: 'SYSTEM',
      dedupeKey,
      title: 'Tu día en Noutlife',
      body: `Completaste ${completions} misiones y ganaste ${xp._sum.xpAmount ?? 0} XP hoy.`,
      link: '/',
    }, { awaitPush: true });
    sent += 1;
  }
  return sent;
}

/** Una pasada completa. Cada bloque falla por separado: un error no tumba los demás avisos. */
export async function runReminderTick(now = new Date()) {
  const run = async (name: string, job: (n: Date) => Promise<number>) => {
    try { return await job(now); } catch (err) { console.error(`[Reminders] ${name}:`, err); return -1; }
  };
  const [habits, agenda, quests, summaries] = await Promise.all([
    run('habits', habitReminders),
    run('agenda', agendaReminders),
    run('quests', questDeadlines),
    run('summaries', dailySummaries),
  ]);
  return { at: now.toISOString(), habits, agenda, quests, summaries };
}
