// Clic en un aviso web push, desde el service worker (sw.js). Solo la categoría: nada del contenido.
import { z } from 'zod';
import { NOTIFICATION_CATEGORIES } from '../services/notification.service';

export const pushClickSchema = z.object({
  event: z.literal('clicked'),
  category: z.enum(NOTIFICATION_CATEGORIES),
});
