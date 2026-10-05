import api from '../lib/api';

export const NOTIFICATION_CATEGORIES = ['HABITS', 'QUESTS', 'GYM', 'FINANCE', 'SOCIAL', 'ACHIEVEMENTS', 'SYSTEM'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface NotificationCategoryPreference {
  category: NotificationCategory;
  inAppEnabled: boolean;
  pushEnabled: boolean;
}

export interface NotificationPreferences {
  habitReminders: boolean;
  questDeadlineAlerts: boolean;
  dailySummary: boolean;
  dailySummaryTime: string;
  achievementAlerts: boolean;
  levelUpAlerts: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  categories: NotificationCategoryPreference[];
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    await navigator.serviceWorker.register('/sw.js');
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** iPhone/iPad (incluido el iPad que se presenta como Mac). */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Abierta como app instalada (pantalla de inicio), no en una pestaña del navegador. */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * ok: el dispositivo puede recibir avisos push.
 * ios-install: en iPhone los avisos web solo funcionan con Noutlife añadida a la pantalla de inicio.
 * unsupported: este navegador no tiene avisos push.
 */
export function pushSupport(): 'ok' | 'ios-install' | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported';
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'ok';
}

export type PushResult = 'ok' | 'denied' | 'unsupported' | 'ios-install' | 'no-server' | 'error';

export const PUSH_MESSAGES: Record<PushResult, string> = {
  ok: 'Avisos activados en este dispositivo',
  denied: 'El navegador bloqueó los avisos. Actívalos en los permisos del sitio.',
  unsupported: 'Este navegador no puede recibir avisos.',
  'ios-install': 'En iPhone: toca Compartir y «Añadir a pantalla de inicio», abre Noutlife desde ahí y activa los avisos.',
  'no-server': 'Los avisos push aún no están configurados en el servidor.',
  error: 'No se pudieron activar los avisos. Inténtalo de nuevo.',
};

let vapidKey: string | null | undefined;
async function getVapidKey(): Promise<string | null> {
  if (vapidKey !== undefined) return vapidKey;
  const fromEnv = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (fromEnv) return (vapidKey = fromEnv);
  try {
    const { data } = await api.get<{ key: string | null }>('/notifications/vapid-public-key');
    vapidKey = data.key ?? null;
  } catch {
    return null;
  }
  return vapidKey;
}

const sameKey = (a: ArrayBuffer | null | undefined, b: ArrayBuffer) => {
  if (!a || a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a), y = new Uint8Array(b);
  return x.every((v, i) => v === y[i]);
};

/** Suscribe este dispositivo (o renueva la suscripción) y la registra en el servidor. Sin pedir permiso. */
async function subscribeDevice(): Promise<PushResult> {
  const key = await getVapidKey();
  if (!key) return 'no-server';
  const reg = await registerServiceWorker();
  if (!reg) return 'unsupported';
  const serverKey = urlBase64ToUint8Array(key);
  let sub = await reg.pushManager.getSubscription();
  // Si el servidor cambió de clave, la suscripción vieja ya no recibe nada.
  if (sub && !sameKey(sub.options.applicationServerKey, serverKey)) {
    await sub.unsubscribe().catch(() => false);
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
  await api.post('/notifications/subscribe', sub.toJSON());
  return 'ok';
}

/** Pide permiso (debe llamarse desde un toque o clic) y activa los avisos de este dispositivo. */
export async function enablePush(): Promise<PushResult> {
  const support = pushSupport();
  if (support !== 'ok') return support;
  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';
    return await subscribeDevice();
  } catch {
    return 'error';
  }
}

export async function requestPermissionAndSubscribe(): Promise<boolean> {
  return (await enablePush()) === 'ok';
}

/**
 * Al abrir la app con el permiso ya concedido: vuelve a registrar la suscripción.
 * Las suscripciones caducan o cambian (el navegador las rota, se borran datos) y
 * sin esto los avisos dejarían de llegar en silencio.
 */
export async function syncPushSubscription(): Promise<void> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return;
  try { await subscribeDevice(); } catch { /* se reintenta en la próxima apertura */ }
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get<{ preferences: NotificationPreferences }>('/notifications/preferences');
  return data.preferences;
}

export async function updateNotificationPreferences(prefs: Partial<NotificationPreferences> & { categoryPreferences?: NotificationCategoryPreference[] }) {
  const { data } = await api.patch<{ preferences: NotificationPreferences }>('/notifications/preferences', prefs);
  return data.preferences;
}

export async function sendTestNotification(): Promise<void> {
  await api.post('/notifications/test');
}

// ─── In-app notifications ─────────────────────────────────────────────────────

export interface InAppNotification {
  id: string;
  type: string;
  category: NotificationCategory;
  dedupeKey?: string | null;
  title: string;
  body: string;
  icon?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPage {
  notifications: InAppNotification[];
  unread: number;
  nextCursor: string | null;
}

export async function listInAppNotifications(options: { limit?: number; cursor?: string; category?: NotificationCategory } = {}): Promise<NotificationPage> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.category) params.set('category', options.category);
  const { data } = await api.get<NotificationPage>(`/notifications?${params}`);
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count');
  return data.count;
}

export async function markAsRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

export async function deleteAllNotifications(): Promise<void> {
  await api.delete('/notifications');
}

// ─── Global Search ─────────────────────────────────────────────────────────────

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  link: string;
  icon: string;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`);
  return data.results;
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0)).buffer;
}
