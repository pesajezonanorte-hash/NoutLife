// Qué recordatorios tocan y a qué hora, a partir de los datos de la persona. Lógica pura: la usan la pestaña
// abierta (lib/localReminders, hoy) y la app de Android (lib/nativeNotifications, una semana por adelantado,
// porque el sistema los da con la app cerrada y sin conexión). Mismas reglas y etiquetas que el servidor
// (reminder.service, smart-reminder.service): si llegan los dos, se ve uno. Sin montos en los textos: se leen
// en la pantalla de bloqueo.
import type { AgendaEvent } from '@/services/agenda.service';
import type { Debt, RecurringTransaction } from '@/services/finance2.service';
import type { Habit } from '@/services/habit.service';
import type { NotificationPreferences, SmartReminderSettings } from '@/services/notification.service';
import { INTL_LOCALE, type Copy, type Locale } from './locale';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** El aviso de un bloque sale 10 min antes. */
const HABIT_LEAD_MIN = 10;
const DUE_NOTICE_MIN = 9 * 60;
const DEBT_LEAD_DAYS = [3, 1, 0];
const BILL_LEAD_DAYS = [1];

const es = {
  /** Consejos de las pausas activas (los mismos que manda el servidor, lib/smart-reminders). */
  breakTips: [
    'Levántate, estira la espalda y mira a lo lejos 20 segundos.',
    'Suelta los hombros y respira hondo tres veces. Un minuto basta.',
    'Camina un poco y bebe agua antes de seguir.',
    'Estira el cuello y las muñecas: 30 segundos por lado.',
    'Cierra los ojos un momento y relaja la mandíbula.',
  ],
  breakTitle: 'Pausa activa',
  habitTitle: (title: string): string => `En ${HABIT_LEAD_MIN} min: ${title}`,
  habitBody: (range: string): string => `Tu bloque es de ${range}. Márcalo cuando lo hagas y tu racha sigue viva.`,
  rangeJoin: 'a',
  pendingTitle: (n: number): string => `${n} ${n === 1 ? 'hábito pendiente' : 'hábitos pendientes'}`,
  pendingBody: (names: string, more: number): string => `Si todavía puedes, completa ${names}${more > 0 ? ` y ${more} más` : ''} antes de cerrar el día.`,
  agendaAllDay: 'Es hoy. Revisa tu agenda.',
  agendaNow: 'Empieza ahora.',
  agendaIn: (min: number): string => `Empieza en ${min} min.`,
  agendaAt: (time: string): string => `Empieza a las ${time}.`,
  debtTitle: (days: number): string => (days === 0 ? 'Vence hoy' : days === 1 ? 'Vence mañana' : `Vence en ${days} días`),
  debtBody: (title: string, date: string, today: boolean): string => `«${title}» tiene fecha límite el ${date}.${today ? ' Si ya la pagaste, márcala como pagada.' : ''}`,
  billTitle: 'Mañana vence un recibo',
  billBody: (title: string, date: string): string => `«${title}» se paga el ${date}.`,
};

const en: typeof es = {
  breakTips: [
    'Stand up, stretch your back and look far away for 20 seconds.',
    'Drop your shoulders and take three deep breaths. One minute is enough.',
    'Walk a little and drink some water before you carry on.',
    'Stretch your neck and wrists: 30 seconds per side.',
    'Close your eyes for a moment and relax your jaw.',
  ],
  breakTitle: 'Active break',
  habitTitle: (title: string): string => `In ${HABIT_LEAD_MIN} min: ${title}`,
  habitBody: (range: string): string => `Your block is ${range}. Mark it when you do it and your streak stays alive.`,
  rangeJoin: 'to',
  pendingTitle: (n: number): string => `${n} ${n === 1 ? 'habit pending' : 'habits pending'}`,
  pendingBody: (names: string, more: number): string => `If you still can, complete ${names}${more > 0 ? ` and ${more} more` : ''} before you close the day.`,
  agendaAllDay: 'It is today. Check your agenda.',
  agendaNow: 'Starts now.',
  agendaIn: (min: number): string => `Starts in ${min} min.`,
  agendaAt: (time: string): string => `Starts at ${time}.`,
  debtTitle: (days: number): string => (days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `Due in ${days} days`),
  debtBody: (title: string, date: string, today: boolean): string => `“${title}” is due on ${date}.${today ? ' If you already paid it, mark it as paid.' : ''}`,
  billTitle: 'A bill is due tomorrow',
  billBody: (title: string, date: string): string => `“${title}” is paid on ${date}.`,
};

const COPY: Copy<typeof es> = { es, en };

export type ReminderKind = 'habit' | 'agenda' | 'pending' | 'break' | 'debt' | 'bill';

export interface PlannedReminder {
  at: number;
  kind: ReminderKind;
  /** Misma etiqueta que el push del servidor. */
  tag: string;
  title: string;
  body: string;
  link: string;
  quick?: 'habit_done';
  quickRef?: string;
  day?: string;
}

export interface ReminderData {
  habits: Habit[];
  events: AgendaEvent[];
  prefs: Partial<NotificationPreferences> | null;
  debts?: Debt[];
  bills?: RecurringTransaction[];
}

export const dayKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const minutesOf = (hhmm: string | null | undefined) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const atMinutes = (day: Date, minutes: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60).getTime();

export function isScheduledOn(h: Habit, day: Date) {
  if (h.frequency?.type !== 'days_per_week' || !h.frequency.days?.length) return true;
  return h.frequency.days.includes(day.getDay());
}

const isSettledToday = (h: Habit) => Boolean(h.todayCompleted) || h.todayStatus === 'completed' || h.todayStatus === 'skipped' || h.todayStatus === 'failed';

/** ¿Está dentro de las horas de silencio? La franja puede cruzar la medianoche. */
function isQuiet(at: number, start?: string | null, end?: string | null) {
  const from = minutesOf(start);
  const to = minutesOf(end);
  if (from === null || to === null || from === to) return false;
  const d = new Date(at);
  const m = d.getHours() * 60 + d.getMinutes();
  return from < to ? m >= from && m < to : m >= from || m < to;
}

/** Los hábitos que siguen por hacer ese día: hoy, según lo marcado; otro día, los que tocan. */
export function pendingHabitsOn(habits: Habit[], day: Date, today: boolean) {
  return habits.filter((h) => h.isActive && isScheduledOn(h, day) && (!today || !isSettledToday(h)));
}

/** El aviso de hábitos pendientes (también lo rehace la pestaña a la hora de darlo, con la lista del momento). */
export function pendingReminder(habits: Habit[], locale: Locale): Pick<PlannedReminder, 'title' | 'body'> | null {
  if (!habits.length) return null;
  const t = COPY[locale];
  const quote = locale === 'es' ? (s: string) => `«${s}»` : (s: string) => `“${s}”`;
  return { title: t.pendingTitle(habits.length), body: t.pendingBody(habits.slice(0, 3).map((h) => quote(h.title)).join(', '), habits.length - 3) };
}

/**
 * Lo que toca desde `now` durante `days` días (1 = solo hoy). Hoy cuenta lo marcado; más adelante, lo programado.
 * Respeta los ajustes: categorías sin aviso, pendientes apagados y horas de silencio (en lo automático).
 */
export function planReminders(data: ReminderData, now: Date, locale: Locale, days = 1): PlannedReminder[] {
  const t = COPY[locale];
  const out: PlannedReminder[] = [];
  const nowMs = now.getTime();
  const today = startOfDay(now);
  const until = addDays(today, days).getTime();
  const prefs = data.prefs ?? {};
  const settings: Partial<SmartReminderSettings> = prefs.reminderSettings ?? {};
  const allows = (category: string) => prefs.categories?.find((c) => c.category === category)?.pushEnabled !== false;
  const inWindow = (at: number) => at > nowMs && at < until;
  const dateLabel = (d: Date) => d.toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'long' });

  for (let offset = 0; offset < days; offset += 1) {
    const day = addDays(today, offset);
    const key = dayKeyOf(day);
    const isToday = offset === 0;

    // Bloques de hábitos.
    if (prefs.habitReminders !== false && allows('HABITS')) {
      for (const h of pendingHabitsOn(data.habits, day, isToday)) {
        const start = minutesOf(h.reminderTime);
        if (start === null) continue;
        const at = atMinutes(day, start - HABIT_LEAD_MIN);
        if (!inWindow(at)) continue;
        const range = h.reminderEndTime ? `${h.reminderTime} ${t.rangeJoin} ${h.reminderEndTime}` : h.reminderTime ?? '';
        out.push({ at, kind: 'habit', tag: `habit-reminder-${h.id}-${key}`, title: t.habitTitle(h.title), body: t.habitBody(range), link: '/habits', quick: 'habit_done', quickRef: h.id, day: key });
      }
    }

    // Hábitos pendientes a la hora elegida en Ajustes (21:00 de base).
    if (settings.habits?.enabled !== false && allows('HABITS')) {
      const minutes = minutesOf(settings.habits?.time ?? '21:00');
      if (minutes !== null) {
        const at = atMinutes(day, minutes);
        const text = inWindow(at) && !isQuiet(at, prefs.quietHoursStart, prefs.quietHoursEnd) ? pendingReminder(pendingHabitsOn(data.habits, day, isToday), locale) : null;
        if (text) out.push({ at, kind: 'pending', tag: `zone-reminder:habitos-pendientes:${key}`, ...text, link: '/habits' });
      }
    }

    // Pausas activas: la primera, un intervalo después de empezar. Solo dos días por adelantado: son muchas.
    const b = settings.breaks;
    const weekend = day.getDay() === 0 || day.getDay() === 6;
    const from = minutesOf(b?.from);
    const to = minutesOf(b?.to);
    if (b?.enabled && offset < 2 && allows('SYSTEM') && !(b.workdays && weekend) && from !== null && to !== null) {
      const span = to >= from ? to - from : to + 1440 - from;
      for (let gap = b.everyMinutes, i = 0; gap <= span; gap += b.everyMinutes, i += 1) {
        const slot = (from + gap) % 1440;
        const at = atMinutes(day, slot);
        if (inWindow(at)) out.push({ at, kind: 'break', tag: `break-${key}-${slot}`, title: t.breakTitle, body: t.breakTips[i % t.breakTips.length], link: '/' });
      }
    }
  }

  // Eventos de la agenda con aviso.
  for (const e of data.events) {
    if (e.reminder == null || e.isCompleted || e.eventType === 'habit') continue;
    const startAt = new Date(e.startDate).getTime();
    const at = startAt - e.reminder * 60 * 1000;
    if (!inWindow(at)) continue;
    const mins = Math.round((startAt - at) / 60000);
    const body = e.isAllDay ? t.agendaAllDay : mins <= 1 ? t.agendaNow : mins < 90 ? t.agendaIn(mins) : t.agendaAt(new Date(startAt).toLocaleTimeString(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit' }));
    out.push({ at, kind: 'agenda', tag: `agenda-reminder-${e.id}-${new Date(e.startDate).toISOString()}`, title: e.title, body, link: '/agenda' });
  }

  if (allows('FINANCE')) {
    const notice = (due: Date, lead: number) => atMinutes(addDays(due, -lead), DUE_NOTICE_MIN);
    const quiet = (at: number) => isQuiet(at, prefs.quietHoursStart, prefs.quietHoursEnd);

    // Deudas: 3 días, 1 día y el mismo día.
    for (const debt of data.debts ?? []) {
      if (debt.type !== 'owe' || debt.isPaid || !debt.dueDate) continue;
      // La fecha límite es un día de calendario guardado en UTC.
      const utc = new Date(debt.dueDate);
      const due = new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
      for (const lead of DEBT_LEAD_DAYS) {
        const at = notice(due, lead);
        if (!inWindow(at) || quiet(at)) continue;
        out.push({ at, kind: 'debt', tag: `debt-due:${debt.id}:${dayKeyOf(due)}:${lead}`, title: t.debtTitle(lead), body: t.debtBody(debt.title, dateLabel(due), lead === 0), link: '/finances' });
      }
    }

    // Recibos: el día anterior (este mes y el siguiente: uno del día 1 vence mañana si hoy es el último).
    for (const bill of data.bills ?? []) {
      if (bill.type !== 'EXPENSE' || !bill.isActive) continue;
      for (const month of [today.getMonth(), today.getMonth() + 1]) {
        const last = new Date(today.getFullYear(), month + 1, 0).getDate();
        const due = new Date(today.getFullYear(), month, Math.min(bill.dayOfMonth, last));
        for (const lead of BILL_LEAD_DAYS) {
          const at = notice(due, lead);
          if (!inWindow(at) || quiet(at)) continue;
          out.push({ at, kind: 'bill', tag: `bill-due:${bill.id}:${dayKeyOf(due)}:${lead}`, title: t.billTitle, body: t.billBody(bill.description, dateLabel(due)), link: '/finances' });
        }
      }
    }
  }

  return out.sort((a, b) => a.at - b.at);
}
