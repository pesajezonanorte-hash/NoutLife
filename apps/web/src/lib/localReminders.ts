// Recordatorios con la app abierta: además del push del servidor, la propia
// pestaña programa los avisos de hoy (hábitos con hora, eventos de la agenda con
// aviso, hábitos pendientes y pausas activas de Ajustes) y los da a su hora. Con la
// app a la vista salen como nota dentro de la app con una campana suave (no hace
// falta el permiso del navegador); en segundo plano, como aviso del sistema. Si el
// push también llega, se ve uno solo: ambos usan la misma etiqueta (tag) que el servidor.
import { useEffect } from 'react';
import { fetchHabits, type Habit } from '@/services/habit.service';
import { fetchEvents } from '@/services/agenda.service';
import { getNotificationPreferences, registerServiceWorker, type SmartReminderSettings } from '@/services/notification.service';
import { showInAppAlert, type InAppAlert } from '@/lib/systemNotifications';
import { INTL_LOCALE, getLocale, type Copy, type Locale } from '@/lib/i18n';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Replanifica cada 15 min: recoge hábitos y eventos creados o cambiados mientras tanto. */
const REPLAN_MS = 15 * 60 * 1000;

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
  habitTitle: (title: string): string => `Hora de: ${title}`,
  habitBody: 'Márcalo cuando lo hagas y tu racha sigue viva.',
  pendingTitle: (n: number): string => `${n} ${n === 1 ? 'hábito pendiente' : 'hábitos pendientes'}`,
  pendingBody: (names: string, more: number): string => `Si todavía puedes, completa ${names}${more > 0 ? ` y ${more} más` : ''} antes de cerrar el día.`,
  agendaAllDay: 'Es hoy. Revisa tu agenda.',
  agendaNow: 'Empieza ahora.',
  agendaIn: (min: number): string => `Empieza en ${min} min.`,
  agendaAt: (time: string): string => `Empieza a las ${time}.`,
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
  habitTitle: (title: string): string => `Time for: ${title}`,
  habitBody: 'Mark it when you do it and your streak stays alive.',
  pendingTitle: (n: number): string => `${n} ${n === 1 ? 'habit pending' : 'habits pending'}`,
  pendingBody: (names: string, more: number): string => `If you still can, complete ${names}${more > 0 ? ` and ${more} more` : ''} before you close the day.`,
  agendaAllDay: 'It is today. Check your agenda.',
  agendaNow: 'Starts now.',
  agendaIn: (min: number): string => `Starts in ${min} min.`,
  agendaAt: (time: string): string => `Starts at ${time}.`,
};

const COPY: Copy<typeof es> = { es, en };

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const minutesOf = (hhmm: string | null | undefined) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const atMinutes = (now: Date, minutes: number) => { const at = new Date(now); at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0); return at; };
const permitted = () => typeof Notification !== 'undefined' && Notification.permission === 'granted';

function scheduledToday(h: Habit, now: Date) {
  if (h.frequency?.type !== 'days_per_week' || !h.frequency.days?.length) return true;
  return h.frequency.days.includes(now.getDay());
}

/** A la vista: nota dentro de la app. En segundo plano: aviso del sistema (o la nota, que espera a que vuelvas). */
async function deliver(alert: InAppAlert) {
  if (document.visibilityState === 'visible' && showInAppAlert(alert)) return;
  if (!permitted()) { showInAppAlert(alert); return; }
  const reg = await registerServiceWorker();
  const options: NotificationOptions = { body: alert.body, tag: alert.tag, icon: '/icons/icon-192.png', badge: '/icons/icon-96.png', data: { link: alert.link }, silent: alert.quiet };
  if (reg) await reg.showNotification(alert.title, options);
  else new Notification(alert.title, options);
}

interface Planned { at: number; run: () => Promise<void> }

async function plan(now = new Date()): Promise<Planned[]> {
  const locale: Locale = getLocale();
  const t = COPY[locale];
  const [habits, events, settings] = await Promise.all([
    fetchHabits().catch(() => [] as Habit[]),
    fetchEvents({ from: now.toISOString(), to: new Date(now.getTime() + DAY_MS + 60 * 60 * 1000).toISOString() }).catch(() => []),
    getNotificationPreferences().then((p) => p.reminderSettings as Partial<SmartReminderSettings>).catch(() => ({} as Partial<SmartReminderSettings>)),
  ]);
  const out: Planned[] = [];
  const today = dayKey(now);

  for (const h of habits) {
    const target = minutesOf(h.reminderTime);
    if (target === null || !h.isActive || h.todayCompleted || !scheduledToday(h, now)) continue;
    const at = atMinutes(now, target);
    if (at.getTime() <= now.getTime()) continue;
    out.push({
      at: at.getTime(),
      run: async () => {
        // A la hora, comprueba que siga pendiente: si ya lo marcaste, no molesta.
        const fresh = (await fetchHabits().catch(() => [] as Habit[])).find((x) => x.id === h.id);
        if (fresh?.todayCompleted) return;
        await deliver({
          tag: `habit-reminder-${h.id}-${today}`, title: t.habitTitle(h.title), body: t.habitBody,
          link: '/habits', quick: 'habit_done', quickRef: h.id, day: today,
        });
      },
    });
  }

  for (const e of events) {
    if (e.reminder == null || e.isCompleted || e.eventType === 'habit') continue;
    const start = new Date(e.startDate).getTime();
    const at = start - e.reminder * 60 * 1000;
    if (at <= now.getTime() || at - now.getTime() > DAY_MS) continue;
    const mins = Math.round((start - at) / 60000);
    const body = e.isAllDay ? t.agendaAllDay : mins <= 1 ? t.agendaNow : mins < 90 ? t.agendaIn(mins) : t.agendaAt(new Date(start).toLocaleTimeString(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit' }));
    out.push({ at, run: () => deliver({ tag: `agenda-reminder-${e.id}-${new Date(e.startDate).toISOString()}`, title: e.title, body, link: '/agenda' }) });
  }

  // Hábitos pendientes a la hora elegida en Ajustes (21:00 de base).
  const pendingAt = settings.habits?.enabled !== false ? minutesOf(settings.habits?.time ?? '21:00') : null;
  if (pendingAt !== null && atMinutes(now, pendingAt).getTime() > now.getTime()) {
    out.push({
      at: atMinutes(now, pendingAt).getTime(),
      run: async () => {
        const fresh = await fetchHabits().catch(() => [] as Habit[]);
        const pending = fresh.filter((h) => h.isActive && scheduledToday(h, new Date()) && !h.todayCompleted && h.todayStatus !== 'skipped' && h.todayStatus !== 'failed');
        if (!pending.length) return;
        const names = pending.slice(0, 3).map((h) => `«${h.title}»`).join(', ');
        await deliver({
          tag: `zone-reminder:habitos-pendientes:${today}`,
          title: t.pendingTitle(pending.length),
          body: t.pendingBody(names, pending.length - 3),
          link: '/habits',
        });
      },
    });
  }

  // Pausas activas: la primera, un intervalo después de empezar.
  const b = settings.breaks;
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const from = minutesOf(b?.from);
  const to = minutesOf(b?.to);
  if (b?.enabled && !(b.workdays && weekend) && from !== null && to !== null) {
    const span = to >= from ? to - from : to + 1440 - from;
    for (let offset = b.everyMinutes, i = 0; offset <= span; offset += b.everyMinutes, i += 1) {
      const slot = (from + offset) % 1440;
      const at = atMinutes(now, slot).getTime();
      if (at <= now.getTime()) continue;
      out.push({ at, run: () => deliver({ tag: `break-${today}-${slot}`, title: t.breakTitle, body: t.breakTips[i % t.breakTips.length], link: '/' }) });
    }
  }
  return out;
}

/** Activo mientras haya sesión (con o sin permiso de avisos del navegador). */
export function useLocalReminders(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let timers: number[] = [];
    let cancelled = false;

    const clear = () => { timers.forEach((t) => window.clearTimeout(t)); timers = []; };
    const replan = async () => {
      const items = await plan();
      if (cancelled) return;
      clear();
      const now = Date.now();
      for (const it of items) timers.push(window.setTimeout(() => void it.run().catch(() => undefined), it.at - now));
    };

    void replan();
    const every = window.setInterval(() => void replan(), REPLAN_MS);
    // Al volver a la pestaña (los temporizadores en segundo plano se retrasan).
    const onVisible = () => { if (document.visibilityState === 'visible') void replan(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clear();
      window.clearInterval(every);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}
