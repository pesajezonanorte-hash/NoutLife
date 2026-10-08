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

// ─── Recordatorios de cada zona ───────────────────────────────────────────────
//
// Cada zona recuerda lo suyo a su hora (local), solo a quien la usa y solo si
// todavía no lo hizo hoy: la hora de dormir, el entrenamiento del día, apuntar
// la comida, el diario, el estudio, la revisión semanal de finanzas, las rachas
// con amigos que se apagan hoy y el enemigo del gremio. Un aviso por zona y día.

interface ReminderUser { id: string; timezone: string | null; bedtimeGoal: string | null }
type ZoneReminder = {
  zone: string;
  /** Minutos locales en los que toca (o null si hoy no toca). */
  at: (u: ReminderUser, weekday: number) => number | null;
  category: 'HABITS' | 'GYM' | 'FINANCE' | 'SOCIAL' | 'SYSTEM' | 'QUESTS';
  /** Qué avisar (null: no hace falta, ya lo hizo o no usa la zona). */
  check: (u: ReminderUser, ctx: { since: Date; weekday: number; day: string }) => Promise<{ title: string; body: string; link: string } | null>;
};

const DAY_MS = 86_400_000;

const ZONE_REMINDERS: ZoneReminder[] = [
  {
    zone: 'habitos-pendientes', category: 'HABITS', at: () => 21 * 60,
    check: async (u, { day }) => {
      const calendarDate = new Date(`${day}T00:00:00.000Z`);
      const [habits, logs] = await Promise.all([
        prisma.habit.findMany({ where: { userId: u.id, isActive: true }, select: { id: true, title: true, frequency: true } }),
        prisma.habitLog.findMany({ where: { userId: u.id, date: calendarDate }, select: { habitId: true, completed: true, status: true } }),
      ]);
      const handled = new Set(logs.filter((log) => log.completed || log.status === 'skipped' || log.status === 'failed').map((log) => log.habitId));
      const pending = habits.filter((habit) => isHabitScheduledForDay(calendarDate, habit.frequency) && !handled.has(habit.id));
      if (!pending.length) return null;
      const names = pending.slice(0, 3).map((habit) => `«${habit.title}»`).join(', ');
      const extra = pending.length > 3 ? ` y ${pending.length - 3} más` : '';
      return {
        title: `${pending.length} ${pending.length === 1 ? 'hábito pendiente' : 'hábitos pendientes'}`,
        body: `Si todavía puedes, completa ${names}${extra} antes de cerrar el día.`,
        link: '/habits',
      };
    },
  },
  {
    zone: 'metas-pendientes', category: 'QUESTS', at: () => 21 * 60,
    check: async (u) => {
      const where = { userId: u.id, status: 'ACTIVE' as const };
      const [count, goals] = await Promise.all([
        prisma.masterGoal.count({ where }),
        prisma.masterGoal.findMany({ where, select: { title: true }, orderBy: { createdAt: 'asc' }, take: 3 }),
      ]);
      if (!count) return null;
      const names = goals.map((goal) => `«${goal.title}»`).join(', ');
      const extra = count > goals.length ? ` y ${count - goals.length} más` : '';
      return {
        title: `${count} ${count === 1 ? 'meta' : 'metas'} en curso`,
        body: `Elige un paso pequeño para avanzar hoy: ${names}${extra}.`,
        link: '/goals',
      };
    },
  },
  {
    zone: 'sueno', category: 'SYSTEM',
    at: (u) => { const t = parseHHMM(u.bedtimeGoal); return t === null ? null : (t - 30 + 1440) % 1440; },
    check: async (u) => ({ title: 'En media hora, a dormir', body: `Tu meta es acostarte a las ${u.bedtimeGoal}. Ve dejando la pantalla.`, link: '/sleep' }),
  },
  {
    zone: 'gimnasio', category: 'GYM', at: () => 21 * 60,
    check: async (u, { since, weekday, day }) => {
      const routine = await prisma.routine.findFirst({
        where: { userId: u.id, isActive: true, days: { some: { weekday, isRestDay: false } } }, select: { name: true },
      });
      if (!routine) return null;
      const calendarDate = new Date(`${day}T00:00:00.000Z`);
      const [workout, attendance] = await Promise.all([
        prisma.workout.findFirst({ where: { userId: u.id, date: { gte: since } }, select: { id: true } }),
        prisma.gymAttendance.findFirst({ where: { userId: u.id, date: calendarDate }, select: { id: true } }),
      ]);
      return workout || attendance
        ? null
        : { title: 'Tu entrenamiento sigue pendiente', body: `La rutina «${routine.name}» estaba programada para hoy. Aún puedes hacer una sesión corta.`, link: '/gym' };
    },
  },
  {
    zone: 'comida', category: 'SYSTEM', at: () => 14 * 60,
    check: async (u, { since }) => {
      const uses = await prisma.meal.findFirst({ where: { userId: u.id, date: { gte: new Date(since.getTime() - 7 * DAY_MS) } }, select: { id: true } });
      if (!uses) return null;
      const today = await prisma.meal.findFirst({ where: { userId: u.id, date: { gte: since } }, select: { id: true } });
      return today ? null : { title: '¿Qué comiste hoy?', body: 'Apunta tus comidas mientras las recuerdas.', link: '/food' };
    },
  },
  {
    zone: 'aprendizaje', category: 'SYSTEM', at: () => 17 * 60 + 30,
    check: async (u, { since }) => {
      const item = await prisma.learningItem.findFirst({ where: { userId: u.id, status: 'IN_PROGRESS' }, select: { title: true } });
      if (!item) return null;
      const studied = await prisma.xpEvent.findFirst({ where: { userId: u.id, source: { in: ['pomodoro', 'learning_complete', 'focus'] }, createdAt: { gte: since } }, select: { id: true } });
      return studied ? null : { title: 'Un rato de estudio', body: `Sigue con «${item.title}»: un pomodoro de 25 min basta.`, link: '/learning' };
    },
  },
  {
    zone: 'diario', category: 'SYSTEM', at: () => 21 * 60 + 30,
    check: async (u, { since }) => {
      const uses = await prisma.journalEntry.findFirst({ where: { userId: u.id, date: { gte: new Date(since.getTime() - 14 * DAY_MS) } }, select: { id: true } });
      if (!uses) return null;
      const today = await prisma.journalEntry.findFirst({ where: { userId: u.id, date: { gte: since } }, select: { id: true } });
      return today ? null : { title: 'Tu diario te espera', body: '¿Cómo fue hoy? Dos líneas bastan.', link: '/journal' };
    },
  },
  {
    zone: 'finanzas', category: 'FINANCE', at: (_u, weekday) => (weekday === 0 ? 19 * 60 : null),
    check: async (u, { since }) => {
      const uses = await prisma.transaction.findFirst({ where: { userId: u.id, createdAt: { gte: new Date(since.getTime() - 30 * DAY_MS) } }, select: { id: true } });
      return uses ? { title: 'Revisa tu semana', body: 'Mira en qué se fue el dinero estos siete días y ajusta tus presupuestos.', link: '/finances' } : null;
    },
  },
  {
    zone: 'rachas', category: 'SOCIAL', at: () => 20 * 60 + 30,
    check: async (u, { day }) => {
      // Rachas encendidas (3 días o más) que siguen vivas pero hoy aún no escribiste.
      const rows = await prisma.friendship.findMany({
        where: { status: 'ACCEPTED', streakCount: { gte: 3 }, OR: [{ requesterId: u.id }, { receiverId: u.id }] },
        select: {
          requesterId: true, receiverId: true, streakDay: true, streakCount: true,
          requester: { select: { displayName: true, username: true } }, receiver: { select: { displayName: true, username: true } },
        },
      });
      const yesterday = new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
      const alive = rows.filter((f) => f.streakDay === yesterday);
      if (!alive.length) return null;
      const otherId = (f: { requesterId: string; receiverId: string }) => (f.requesterId === u.id ? f.receiverId : f.requesterId);
      const wrote = await prisma.directMessage.findMany({
        where: { senderId: u.id, dayKey: day, receiverId: { in: alive.map(otherId) } },
        select: { receiverId: true }, distinct: ['receiverId'],
      });
      const pending = alive.filter((f) => !wrote.some((w) => w.receiverId === otherId(f)));
      if (!pending.length) return null;
      const other = pending[0].requesterId === u.id ? pending[0].receiver : pending[0].requester;
      const first = other.displayName.split(' ')[0];
      return pending.length === 1
        ? { title: `Tu racha con ${first} se apaga hoy`, body: `Llevan ${pending[0].streakCount} días. Escríbele algo para mantenerla.`, link: `/social?tab=cartas&chat=${encodeURIComponent(other.username)}` }
        : { title: `${pending.length} rachas se apagan hoy`, body: `Escribe a ${first} y a los demás antes de que acabe el día.`, link: '/social?tab=cartas' };
    },
  },
  {
    zone: 'gremio', category: 'SOCIAL', at: () => 19 * 60,
    check: async (u, { day }) => {
      const memberships = await prisma.guildMember.findMany({ where: { userId: u.id }, select: { guildId: true, guild: { select: { name: true } } } });
      for (const m of memberships) {
        const mine = await prisma.guildMessage.findFirst({ where: { guildId: m.guildId, userId: u.id, kind: 'SNAP', dayKey: day }, select: { id: true } });
        if (!mine) return { title: `${m.guild.name} necesita tu foto`, body: 'El enemigo del día sigue en pie. Tu foto con la cámara le quita vida.', link: `/social?tab=gremios&guild=${m.guildId}` };
      }
      return null;
    },
  },
];

async function zoneReminders(now: Date) {
  const users = await prisma.user.findMany({ where: { onboardingCompleted: true }, select: { id: true, timezone: true, bedtimeGoal: true } });
  let sent = 0;
  for (const user of users) {
    const minutes = localMinutes(user.timezone, now);
    const local = getCalendarDay(user.timezone, now);
    const weekday = local.getUTCDay();
    const due = ZONE_REMINDERS.filter((r) => { const t = r.at(user, weekday); return t !== null && inWindow(minutes, t); });
    if (!due.length) continue;
    const day = local.toISOString().slice(0, 10);
    const since = new Date(now.getTime() - minutes * 60_000);
    for (const r of due) {
      const dedupeKey = `zone-reminder:${r.zone}:${day}`;
      if (await wasNotified(user.id, dedupeKey)) continue;
      const notice = await r.check(user, { since, weekday, day });
      if (!notice) continue;
      await createNotification(user.id, { type: 'reminder', category: r.category, dedupeKey, ...notice }, { awaitPush: true });
      sent += 1;
    }
  }
  return sent;
}

/** Una pasada completa. Cada bloque falla por separado: un error no tumba los demás avisos. */
export async function runReminderTick(now = new Date()) {
  const run = async (name: string, job: (n: Date) => Promise<number>) => {
    try { return await job(now); } catch (err) { console.error(`[Reminders] ${name}:`, err); return -1; }
  };
  const [habits, agenda, quests, summaries, zones] = await Promise.all([
    run('habits', habitReminders),
    run('agenda', agendaReminders),
    run('quests', questDeadlines),
    run('summaries', dailySummaries),
    run('zones', zoneReminders),
  ]);
  return { at: now.toISOString(), habits, agenda, quests, summaries, zones };
}
