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
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export async function requestPermissionAndSubscribe(): Promise<boolean> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = await registerServiceWorker();
  if (!reg) return false;

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) return false;

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  await api.post('/notifications/subscribe', subscription.toJSON());
  return true;
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
