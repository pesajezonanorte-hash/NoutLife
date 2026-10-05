import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as notificationService from '../services/notification.service';

export async function subscribe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Subscription inválida.' });
      return;
    }
    await notificationService.saveSubscription(req.userId!, { endpoint, keys });
    res.status(201).json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al guardar subscription.' });
  }
}

export async function unsubscribe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { endpoint } = req.body;
    await notificationService.removeSubscription(endpoint);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al eliminar subscription.' });
  }
}

export async function getPreferences(req: AuthRequest, res: Response): Promise<void> {
  try {
    const prefs = await notificationService.getNotificationPreferences(req.userId!);
    res.json({ preferences: prefs });
  } catch {
    res.status(500).json({ error: 'Error al obtener preferencias.' });
  }
}

export async function updatePreferences(req: AuthRequest, res: Response): Promise<void> {
  try {
    const prefs = await notificationService.updateNotificationPreferences(req.userId!, req.body);
    res.json({ preferences: prefs });
  } catch {
    res.status(500).json({ error: 'Error al actualizar preferencias.' });
  }
}

export function vapidPublicKey(_req: AuthRequest, res: Response): void {
  res.json({ key: process.env.VAPID_PUBLIC_KEY ?? null });
}

export async function sendTestNotification(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!notificationService.isPushConfigured()) {
      res.status(503).json({ error: 'Los avisos push no están configurados en el servidor.' });
      return;
    }
    if ((await notificationService.countSubscriptions(req.userId!)) === 0) {
      res.status(409).json({ error: 'Este dispositivo todavía no tiene los avisos activados.' });
      return;
    }
    const delivered = await notificationService.sendPush(req.userId!, {
      title: 'Noutlife',
      body: 'Los avisos funcionan. Así te llegarán tus recordatorios.',
      tag: 'test',
    });
    res.json({ success: delivered > 0, delivered });
  } catch {
    res.status(500).json({ error: 'Error al enviar notificación de prueba.' });
  }
}

// ─── In-App Notifications ─────────────────────────────────────────────────────

export async function listInApp(req: AuthRequest, res: Response): Promise<void> {
  try {
    const limit = Math.min(Number(req.query['limit']) || 30, 30);
    const rawCategory = req.query.category as string | undefined;
    if (rawCategory && !notificationService.NOTIFICATION_CATEGORIES.includes(rawCategory as notificationService.NotificationCategory)) {
      res.status(400).json({ error: 'Categoría de notificación inválida.' });
      return;
    }
    const category = rawCategory as notificationService.NotificationCategory | undefined;
    const { notifications, nextCursor } = await notificationService.listNotifications(req.userId!, {
      limit,
      cursor: req.query.cursor as string | undefined,
      category,
    });
    const unread = await notificationService.countUnread(req.userId!);
    res.json({ notifications, unread, nextCursor });
  } catch {
    res.status(500).json({ error: 'Error al obtener notificaciones.' });
  }
}

export async function unreadCount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const count = await notificationService.countUnread(req.userId!);
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Error al contar notificaciones.' });
  }
}

export async function markOneRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    await notificationService.markRead(req.userId!, req.params['id']!);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al marcar notificación.' });
  }
}

export async function markAllReadHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    await notificationService.markAllRead(req.userId!);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al marcar todas como leídas.' });
  }
}

export async function deleteAll(req: AuthRequest, res: Response): Promise<void> {
  try {
    await notificationService.deleteAllNotifications(req.userId!);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al eliminar todas las notificaciones.' });
  }
}

export async function deleteOne(req: AuthRequest, res: Response): Promise<void> {
  try {
    await notificationService.deleteNotification(req.userId!, req.params['id']!);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Error al eliminar notificación.' });
  }
}
