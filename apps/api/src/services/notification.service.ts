import webpush from 'web-push';
import { prisma } from '../lib/prisma';

export const NOTIFICATION_CATEGORIES = [
  'HABITS',
  'QUESTS',
  'GYM',
  'FINANCE',
  'SOCIAL',
  'ACHIEVEMENTS',
  'SYSTEM',
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

type CategoryPreferenceInput = {
  category: NotificationCategory;
  inAppEnabled?: boolean;
  pushEnabled?: boolean;
};

type CreateNotificationInput = {
  type: string;
  category?: NotificationCategory;
  dedupeKey?: string;
  title: string;
  body: string;
  icon?: string;
  link?: string;
};

const HOUR_MS = 60 * 60 * 1000;
const RETENTION_LIMIT = 100;

function categoryForType(type: string): NotificationCategory {
  if (['habit_completed', 'streak', 'reminder'].includes(type)) return 'HABITS';
  if (['quest_completed', 'quest_deadline'].includes(type)) return 'QUESTS';
  if (['workout', 'gym'].includes(type)) return 'GYM';
  if (['finance', 'budget'].includes(type)) return 'FINANCE';
  if (['friend', 'guild', 'social'].includes(type)) return 'SOCIAL';
  if (['achievement', 'level_up', 'levelup'].includes(type)) return 'ACHIEVEMENTS';
  return 'SYSTEM';
}

function legacyCategoryDefaults(
  category: NotificationCategory,
  prefs: { habitReminders: boolean; questDeadlineAlerts: boolean; dailySummary: boolean; achievementAlerts: boolean; levelUpAlerts: boolean },
) {
  switch (category) {
    case 'HABITS': return { inAppEnabled: prefs.habitReminders, pushEnabled: prefs.habitReminders };
    case 'QUESTS': return { inAppEnabled: prefs.questDeadlineAlerts, pushEnabled: prefs.questDeadlineAlerts };
    case 'ACHIEVEMENTS': return { inAppEnabled: prefs.achievementAlerts, pushEnabled: prefs.achievementAlerts };
    case 'SYSTEM': return { inAppEnabled: prefs.dailySummary, pushEnabled: prefs.dailySummary };
    default: return { inAppEnabled: true, pushEnabled: true };
  }
}

async function getChannelPreference(userId: string, category: NotificationCategory) {
  const [categoryPreference, legacyPreferences] = await Promise.all([
    prisma.notificationCategoryPreference.findUnique({ where: { userId_category: { userId, category } } }),
    prisma.notificationPreferences.findUnique({ where: { userId } }),
  ]);

  if (categoryPreference) return categoryPreference;
  if (legacyPreferences) return legacyCategoryDefaults(category, legacyPreferences);
  return { inAppEnabled: true, pushEnabled: true };
}

async function enforceRetention(userId: string): Promise<void> {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    select: { id: true, isRead: true },
    orderBy: { createdAt: 'asc' },
  });
  const overflow = notifications.length - RETENTION_LIMIT;
  if (overflow <= 0) return;

  // Discard the oldest read records first. If all of those are exhausted, keep
  // the limit strict by removing the oldest unread records too.
  const readIds = notifications.filter((notification) => notification.isRead).slice(0, overflow).map((notification) => notification.id);
  const ids = readIds.length === overflow
    ? readIds
    : [
      ...readIds,
      ...notifications.filter((notification) => !notification.isRead).slice(0, overflow - readIds.length).map((notification) => notification.id),
    ];
  await prisma.notification.deleteMany({ where: { id: { in: ids } } });
}

// ─── In-app notifications and optional push delivery ──────────────────────────

export async function createNotification(userId: string, data: CreateNotificationInput) {
  const category = data.category ?? categoryForType(data.type);
  const preference = await getChannelPreference(userId, category);
  const now = new Date();
  let notification = null;

  if (preference.inAppEnabled) {
    if (data.dedupeKey) {
      const recentDuplicate = await prisma.notification.findFirst({
        where: {
          userId,
          category,
          dedupeKey: data.dedupeKey,
          createdAt: { gte: new Date(now.getTime() - HOUR_MS) },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentDuplicate) {
        notification = await prisma.notification.update({
          where: { id: recentDuplicate.id },
          data: {
            title: data.title,
            body: data.body,
            icon: data.icon,
            link: data.link,
            isRead: false,
            createdAt: now,
          },
        });
      }
    }

    if (!notification) {
      notification = await prisma.notification.create({
        data: { userId, ...data, category },
      });
    }
    await enforceRetention(userId);
  }

  // Push is a second delivery channel, not the source of truth. It is sent
  // independently so disabling the in-app inbox does not silently override a
  // user's explicit push preference.
  if (preference.pushEnabled) {
    void sendPush(userId, {
      title: data.title,
      body: data.body,
      icon: data.icon,
      tag: data.dedupeKey,
      data: data.link ? { link: data.link } : undefined,
    }, category);
  }

  return notification;
}

export async function listNotifications(
  userId: string,
  options: { limit?: number; cursor?: string; category?: NotificationCategory } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 30);
  const rows = await prisma.notification.findMany({
    where: { userId, ...(options.category ? { category: options.category } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const notifications = hasMore ? rows.slice(0, limit) : rows;
  return {
    notifications,
    nextCursor: hasMore ? notifications[notifications.length - 1]?.id ?? null : null,
  };
}

export async function countUnread(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markRead(userId: string, id: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

export async function deleteNotification(userId: string, id: string) {
  return prisma.notification.deleteMany({ where: { id, userId } });
}

export async function deleteAllNotifications(userId: string) {
  return prisma.notification.deleteMany({ where: { userId } });
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@lifequest.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

export async function sendPush(userId: string, payload: PushPayload, category: NotificationCategory = 'SYSTEM'): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const [preference, legacyPreferences, user] = await Promise.all([
    getChannelPreference(userId, category),
    prisma.notificationPreferences.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
  ]);
  if (!preference.pushEnabled) return;
  // Quiet hours intentionally apply only to push. The persistent in-app inbox
  // remains available whenever the user returns to LifeQuest.
  if (legacyPreferences && isInQuietHours(legacyPreferences.quietHoursStart, legacyPreferences.quietHoursEnd, user?.timezone)) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  const promises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
    }
  });

  await Promise.allSettled(promises);
}

export async function saveSubscription(userId: string, subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: { userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    update: { userId },
  });
}

export async function removeSubscription(endpoint: string) {
  return prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export async function getNotificationPreferences(userId: string) {
  const preferences = await prisma.notificationPreferences.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  const storedCategories = await prisma.notificationCategoryPreference.findMany({ where: { userId } });
  const byCategory = new Map(storedCategories.map((preference) => [preference.category as NotificationCategory, preference]));
  const categories = NOTIFICATION_CATEGORIES.map((category) => {
    const preference = byCategory.get(category);
    return preference ?? { category, ...legacyCategoryDefaults(category, preferences) };
  });

  return { ...preferences, categories };
}

export async function updateNotificationPreferences(userId: string, data: {
  habitReminders?: boolean;
  questDeadlineAlerts?: boolean;
  dailySummary?: boolean;
  dailySummaryTime?: string;
  achievementAlerts?: boolean;
  levelUpAlerts?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  categoryPreferences?: CategoryPreferenceInput[];
}) {
  const { categoryPreferences, ...legacyData } = data;
  await prisma.notificationPreferences.upsert({
    where: { userId },
    create: { userId, ...legacyData },
    update: legacyData,
  });

  if (categoryPreferences) {
    for (const preference of categoryPreferences) {
      if (!NOTIFICATION_CATEGORIES.includes(preference.category)) continue;
      await prisma.notificationCategoryPreference.upsert({
        where: { userId_category: { userId, category: preference.category } },
        create: {
          userId,
          category: preference.category,
          inAppEnabled: preference.inAppEnabled ?? true,
          pushEnabled: preference.pushEnabled ?? true,
        },
        update: {
          ...(preference.inAppEnabled !== undefined ? { inAppEnabled: preference.inAppEnabled } : {}),
          ...(preference.pushEnabled !== undefined ? { pushEnabled: preference.pushEnabled } : {}),
        },
      });
    }
  }

  return getNotificationPreferences(userId);
}

export function isInQuietHours(quietStart: string | null, quietEnd: string | null, timezone?: string | null): boolean {
  if (!quietStart || !quietEnd) return false;
  const now = new Date();
  let parts: Intl.DateTimeFormatPart[] | null = null;
  try {
    parts = timezone
      ? new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
      : null;
  } catch {
    parts = null;
  }
  const hour = parts ? Number(parts.find((part) => part.type === 'hour')?.value ?? 0) : now.getHours();
  const minute = parts ? Number(parts.find((part) => part.type === 'minute')?.value ?? 0) : now.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}
