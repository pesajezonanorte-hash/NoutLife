// Avisos de la app de Android: los programa el propio teléfono (AlarmManager), así llegan con la app cerrada,
// sin conexión y tras reiniciar. Se replanifican al abrir la app, al volver a ella y cuando cambia algo. Solo
// se carga en la app nativa (import dinámico desde notification.service).
import { App } from '@capacitor/app';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { fetchEvents } from '@/services/agenda.service';
import { fetchDebts, fetchRecurring } from '@/services/finance2.service';
import { fetchHabits, logHabit } from '@/services/habit.service';
import { getNotificationPreferences } from '@/services/notification.service';
import axios from 'axios';
import { getLocale, type Copy } from './i18n';
import { planReminders, type PlannedReminder } from './reminderPlan';
import { requestNavigate } from './systemNotifications';

export type NativePermission = 'granted' | 'denied' | 'prompt';

/** Días por adelantado: lo suficiente para no abrir la app en una semana. */
const PLAN_DAYS = 7;
/** Android admite 500 alarmas por app. */
const MAX_SCHEDULED = 400;
const SNOOZE_MS = 10 * 60_000;
const CHANNEL = 'reminders';
const SMALL_ICON = 'ic_stat_noutlife';
const ICON_COLOR = '#2F7565';

const COPY: Copy<{ channel: string; channelBody: string; done: string; snooze: string; testTitle: string; testBody: string }> = {
  es: { channel: 'Recordatorios', channelBody: 'Hábitos, agenda, deudas y recibos.', done: 'Completar', snooze: 'Posponer 10 min', testTitle: 'NoutLife', testBody: 'Así se verán tus recordatorios.' },
  en: { channel: 'Reminders', channelBody: 'Habits, agenda, debts and bills.', done: 'Complete', snooze: 'Snooze 10 min', testTitle: 'NoutLife', testBody: 'This is how your reminders will look.' },
};

/** Un id estable por etiqueta: al replanificar, el mismo aviso se sustituye en vez de duplicarse. */
function idOf(tag: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < tag.length; i += 1) {
    hash ^= tag.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 2147483647;
}

export async function nativePermission(): Promise<NativePermission> {
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
}

let prepared = false;
async function prepare() {
  if (prepared) return;
  prepared = true;
  const t = COPY[getLocale()];
  await LocalNotifications.createChannel({ id: CHANNEL, name: t.channel, description: t.channelBody, importance: 4, visibility: 1, vibration: true });
  await LocalNotifications.registerActionTypes({
    types: [
      { id: 'lq-habit', actions: [{ id: 'habit_done', title: t.done }, { id: 'snooze', title: t.snooze }] },
      { id: 'lq-reminder', actions: [{ id: 'snooze', title: t.snooze }] },
    ],
  });
}

/** Pide el permiso del sistema (Android 13 en adelante; antes ya viene dado) y programa los avisos. */
export async function enableNativeReminders(): Promise<NativePermission> {
  const { display } = await LocalNotifications.requestPermissions();
  const permission: NativePermission = display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  // Sin esperar: la confirmación sale ya, y programar la semana va por detrás.
  if (permission === 'granted') void syncNativeReminders();
  return permission;
}

/**
 * Alarma exacta solo si el sistema ya la permite. Pedirla abre una pantalla de Ajustes de Android encima de la
 * app (el plugin lo hace solo si se le deja): sin ella, el aviso llega con el margen que dé el sistema, también
 * con el teléfono en reposo.
 */
const exactAllowed = () => LocalNotifications.checkExactNotificationSetting().then(({ exact_alarm }) => exact_alarm === 'granted', () => false);

const toNative = (r: PlannedReminder, exact: boolean): LocalNotificationSchema => ({
  id: idOf(r.tag),
  isExactNotification: exact,
  title: r.title,
  body: r.body,
  largeBody: r.body,
  schedule: { at: new Date(r.at), allowWhileIdle: true },
  channelId: CHANNEL,
  smallIcon: SMALL_ICON,
  iconColor: ICON_COLOR,
  autoCancel: true,
  actionTypeId: r.quick === 'habit_done' ? 'lq-habit' : 'lq-reminder',
  extra: { tag: r.tag, link: r.link, quickRef: r.quickRef, day: r.day },
});

/** Sin red no se sabe qué hay: mejor conservar lo programado que borrarlo. Un rechazo del servidor (Lite sin Finanzas) sí es «nada». */
const orEmpty = <T,>(request: Promise<T[]>): Promise<T[]> => request.catch((error: unknown) => {
  if (axios.isAxiosError(error) && error.response) return [];
  throw error;
});

let syncing: Promise<void> | null = null;
let again = false;

/** Ajusta lo programado a lo que toca ahora. Es idempotente y se puede llamar en cualquier momento. */
export function syncNativeReminders(): Promise<void> {
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    if ((await nativePermission()) !== 'granted') return;
    await prepare();
    const now = new Date();
    const [habits, events, prefs, debts, bills] = await Promise.all([
      fetchHabits(),
      fetchEvents({ from: now.toISOString(), to: new Date(now.getTime() + (PLAN_DAYS + 1) * 24 * 60 * 60_000).toISOString() }),
      getNotificationPreferences().catch((error: unknown) => { if (axios.isAxiosError(error) && error.response) return null; throw error; }),
      orEmpty(fetchDebts()),
      orEmpty(fetchRecurring()),
    ]);
    const plan = planReminders({ habits, events, prefs, debts, bills }, now, getLocale(), PLAN_DAYS).slice(0, MAX_SCHEDULED);
    const wanted = new Set(plan.map((r) => idOf(r.tag)));
    const { notifications: scheduled } = await LocalNotifications.getPending();
    // Lo que ya no toca (hecho, borrado, cambiado). Un aviso pospuesto sigue su curso: no lo decide el plan.
    const stale = scheduled.filter((n) => !wanted.has(n.id) && !(n.extra as { snoozed?: boolean } | undefined)?.snoozed);
    if (stale.length) await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) });
    const exact = await exactAllowed();
    if (plan.length) await LocalNotifications.schedule({ notifications: plan.map((r) => toNative(r, exact)) });
  })()
    .catch(() => undefined) // sin datos (sin red y sin copia): se conserva lo programado
    .finally(() => {
      syncing = null;
      if (again) {
        again = false;
        void syncNativeReminders();
      }
    });
  return syncing;
}

/** Un aviso ahora mismo (descanso terminado, prueba de Ajustes). */
export async function showNativeNow(title: string, body: string, tag = `now-${Date.now()}`, link?: string): Promise<void> {
  if ((await nativePermission()) !== 'granted') return;
  await prepare();
  await LocalNotifications.schedule({
    notifications: [{ id: idOf(tag), isExactNotification: false, title, body, largeBody: body, schedule: { at: new Date(Date.now() + 300), allowWhileIdle: true }, channelId: CHANNEL, smallIcon: SMALL_ICON, iconColor: ICON_COLOR, autoCancel: true, extra: { tag, link } }],
  });
}

export const sendNativeTest = () => {
  const t = COPY[getLocale()];
  return showNativeNow(t.testTitle, t.testBody, 'test');
};

let started = false;

/** Se llama una vez al abrir la app: toques en los avisos y replanificación al volver a ella. */
export function startNativeReminders() {
  if (started) return;
  started = true;

  void LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
    const extra = (notification.extra ?? {}) as { tag?: string; link?: string; quickRef?: string; day?: string };
    if (actionId === 'habit_done' && extra.quickRef) {
      // Va por el cliente normal: sin conexión entra en la cola y se envía al volver.
      void logHabit(extra.quickRef, 'completed', undefined, extra.day).catch(() => undefined);
      return;
    }
    if (actionId === 'snooze') {
      void LocalNotifications.schedule({
        notifications: [{
          id: idOf(`${extra.tag}-snooze`), isExactNotification: false, title: notification.title, body: notification.body, largeBody: notification.body,
          schedule: { at: new Date(Date.now() + SNOOZE_MS), allowWhileIdle: true }, channelId: CHANNEL, smallIcon: SMALL_ICON, iconColor: ICON_COLOR, autoCancel: true,
          actionTypeId: extra.quickRef ? 'lq-habit' : 'lq-reminder', extra: { ...extra, snoozed: true },
        }],
      });
      return;
    }
    if (extra.link) requestNavigate(extra.link);
  });

  void App.addListener('appStateChange', ({ isActive }) => { if (isActive) void syncNativeReminders(); });
  // Sale de la cuenta: nada de sus recordatorios sigue sonando.
  window.addEventListener('lq:signed-out', () => {
    void LocalNotifications.getPending().then(({ notifications }) => (notifications.length ? LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) }) : undefined));
  });
}
