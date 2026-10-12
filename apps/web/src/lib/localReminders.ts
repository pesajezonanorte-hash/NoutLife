// Recordatorios con la app abierta: además del push del servidor, la propia
// pestaña programa los avisos de hoy (hábitos con hora y eventos de la agenda con
// aviso) y los muestra a su hora. Si el push también llega, el sistema muestra uno
// solo: ambos usan la misma etiqueta (tag) que el servidor.
import { useEffect } from 'react';
import { fetchHabits, type Habit } from '@/services/habit.service';
import { fetchEvents } from '@/services/agenda.service';
import { registerServiceWorker } from '@/services/notification.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Replanifica cada 15 min: recoge hábitos y eventos creados o cambiados mientras tanto. */
const REPLAN_MS = 15 * 60 * 1000;

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function scheduledToday(h: Habit, now: Date) {
  if (h.frequency?.type !== 'days_per_week' || !h.frequency.days?.length) return true;
  return h.frequency.days.includes(now.getDay());
}

async function show(title: string, body: string, tag: string, link: string) {
  if (Notification.permission !== 'granted') return;
  const reg = await registerServiceWorker();
  const options: NotificationOptions = { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-96.png', data: { link } };
  if (reg) await reg.showNotification(title, options);
  else new Notification(title, options);
}

interface Planned { at: number; run: () => Promise<void> }

async function plan(now = new Date()): Promise<Planned[]> {
  const [habits, events] = await Promise.all([
    fetchHabits().catch(() => [] as Habit[]),
    fetchEvents({ from: now.toISOString(), to: new Date(now.getTime() + DAY_MS + 60 * 60 * 1000).toISOString() }).catch(() => []),
  ]);
  const out: Planned[] = [];

  for (const h of habits) {
    const m = /^(\d{2}):(\d{2})$/.exec(h.reminderTime ?? '');
    if (!m || !h.isActive || h.todayCompleted || !scheduledToday(h, now)) continue;
    const at = new Date(now); at.setHours(Number(m[1]), Number(m[2]), 0, 0);
    if (at.getTime() <= now.getTime()) continue;
    const tag = `habit-reminder-${h.id}-${dayKey(at)}`;
    out.push({
      at: at.getTime(),
      run: async () => {
        // A la hora, comprueba que siga pendiente: si ya lo marcaste, no molesta.
        const fresh = (await fetchHabits().catch(() => [] as Habit[])).find((x) => x.id === h.id);
        if (fresh?.todayCompleted) return;
        await show(`Hora de: ${h.title}`, 'Márcalo cuando lo hagas y tu racha sigue viva.', tag, '/habits');
      },
    });
  }

  for (const e of events) {
    if (e.reminder == null || e.isCompleted || e.eventType === 'habit') continue;
    const start = new Date(e.startDate).getTime();
    const at = start - e.reminder * 60 * 1000;
    if (at <= now.getTime() || at - now.getTime() > DAY_MS) continue;
    const mins = Math.round((start - at) / 60000);
    const body = e.isAllDay ? 'Es hoy. Revisa tu agenda.' : mins <= 1 ? 'Empieza ahora.' : mins < 90 ? `Empieza en ${mins} min.` : `Empieza a las ${new Date(start).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`;
    out.push({ at, run: () => show(e.title, body, `agenda-reminder-${e.id}-${new Date(e.startDate).toISOString()}`, '/agenda') });
  }
  return out;
}

/** Activo mientras haya sesión y permiso de notificaciones. */
export function useLocalReminders(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('Notification' in window)) return;
    let timers: number[] = [];
    let cancelled = false;

    const clear = () => { timers.forEach((t) => window.clearTimeout(t)); timers = []; };
    const replan = async () => {
      if (Notification.permission !== 'granted') return;
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
