// Recordatorios con la app abierta: además del push del servidor, la propia
// pestaña programa los avisos de hoy (hábitos con hora, eventos de la agenda con
// aviso, hábitos pendientes y pausas activas de Ajustes) y los da a su hora. Con la
// app a la vista salen como nota dentro de la app con una campana suave (no hace
// falta el permiso del navegador); en segundo plano, como aviso del sistema. Si el
// push también llega, se ve uno solo: ambos usan la misma etiqueta (tag) que el servidor.
// En la app de Android no hay temporizadores: los programa el sistema (lib/nativeNotifications).
import { useEffect } from 'react';
import { fetchHabits, type Habit } from '@/services/habit.service';
import { fetchEvents } from '@/services/agenda.service';
import { getNotificationPreferences, registerServiceWorker, syncPushSubscription } from '@/services/notification.service';
import { showInAppAlert, type InAppAlert } from '@/lib/systemNotifications';
import { getLocale, type Locale } from '@/lib/i18n';
import { useLifeChange } from '@/lib/lifeSync';
import { isNativeApp } from '@/lib/native';
import { DAY_MS, pendingHabitsOn, pendingReminder, planReminders, type PlannedReminder } from '@/lib/reminderPlan';

/** Replanifica cada 15 min: recoge hábitos y eventos creados o cambiados mientras tanto. */
const REPLAN_MS = 15 * 60 * 1000;
/** En Android, tras un cambio se ajusta lo programado (agrupando ráfagas). */
const NATIVE_RESYNC_MS = 1500;

const permitted = () => typeof Notification !== 'undefined' && Notification.permission === 'granted';

/** A la vista: nota dentro de la app. En segundo plano: aviso del sistema (o la nota, que espera a que vuelvas). */
async function deliver(alert: InAppAlert) {
  if (document.visibilityState === 'visible' && showInAppAlert(alert)) return;
  if (!permitted()) { showInAppAlert(alert); return; }
  const reg = await registerServiceWorker();
  const options: NotificationOptions = { body: alert.body, tag: alert.tag, icon: '/icons/icon-192.png', badge: '/icons/icon-96.png', data: { link: alert.link }, silent: alert.quiet };
  if (reg) await reg.showNotification(alert.title, options);
  else new Notification(alert.title, options);
}

const toAlert = ({ tag, title, body, link, quick, quickRef, day }: PlannedReminder): InAppAlert => ({ tag, title, body, link, quick, quickRef, day });

/** Justo antes de darlo: lo que ya se hizo no suena, y los pendientes se cuentan como están ahora. */
async function run(reminder: PlannedReminder, locale: Locale) {
  if (reminder.kind === 'habit') {
    const fresh = (await fetchHabits().catch(() => [] as Habit[])).find((x) => x.id === reminder.quickRef);
    if (fresh?.todayCompleted) return;
  }
  if (reminder.kind === 'pending') {
    const now = new Date();
    const text = pendingReminder(pendingHabitsOn(await fetchHabits().catch(() => [] as Habit[]), now, true), locale);
    if (!text) return;
    await deliver({ ...toAlert(reminder), ...text });
    return;
  }
  await deliver(toAlert(reminder));
}

async function plan(now = new Date()): Promise<PlannedReminder[]> {
  const [habits, events, prefs] = await Promise.all([
    fetchHabits().catch(() => [] as Habit[]),
    fetchEvents({ from: now.toISOString(), to: new Date(now.getTime() + DAY_MS + 60 * 60 * 1000).toISOString() }).catch(() => []),
    getNotificationPreferences().catch(() => null),
  ]);
  return planReminders({ habits, events, prefs }, now, getLocale());
}

/** Activo mientras haya sesión (con o sin permiso de avisos del navegador). */
export function useLocalReminders(enabled: boolean) {
  const native = isNativeApp();

  useEffect(() => {
    if (!enabled || native || typeof window === 'undefined') return;
    let timers: number[] = [];
    let cancelled = false;

    const clear = () => { timers.forEach((t) => window.clearTimeout(t)); timers = []; };
    const replan = async () => {
      const items = await plan();
      if (cancelled) return;
      clear();
      const now = Date.now();
      const locale = getLocale();
      for (const it of items) timers.push(window.setTimeout(() => void run(it, locale).catch(() => undefined), it.at - now));
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
  }, [enabled, native]);

  // Android: marcar un hábito, cambiar un evento… ajusta lo que el sistema tiene programado.
  useLifeChange(() => { if (enabled && native) void syncPushSubscription(); }, NATIVE_RESYNC_MS);
}
