// Clic en un aviso web push, desde el service worker (sw.js): la categoría y la clave
// del aviso (para darlo por leído). Nada del contenido.
import { z } from 'zod';
import { NOTIFICATION_CATEGORIES } from '../services/notification.service';
import { ZONE_PREFIXES } from '../lib/smart-reminders';

export const pushClickSchema = z.object({
  event: z.literal('clicked'),
  category: z.enum(NOTIFICATION_CATEGORIES),
  tag: z.string().min(1).max(200).optional(),
});

/** Reanudar los avisos de una zona que se había pausado sola. */
export const resumeZoneSchema = z.object({
  zone: z.enum(Object.keys(ZONE_PREFIXES) as [keyof typeof ZONE_PREFIXES, ...Array<keyof typeof ZONE_PREFIXES>]),
});
