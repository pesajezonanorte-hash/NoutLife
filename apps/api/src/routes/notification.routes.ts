import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as notificationController from '../controllers/notification.controller';
import { validate } from '../middleware/validate.middleware';
import { snoozeSchema } from '../schemas/snooze.schemas';
import { pushClickSchema } from '../schemas/push-event.schemas';

const router = Router();

// Pública: el navegador la necesita para suscribirse (no es secreta).
router.get('/vapid-public-key', notificationController.vapidPublicKey);

router.use(requireAuth);

router.post('/subscribe',       notificationController.subscribe);
router.delete('/unsubscribe',   notificationController.unsubscribe);
router.get('/preferences',      notificationController.getPreferences);
router.patch('/preferences',    notificationController.updatePreferences);
router.post('/test',            notificationController.sendTestNotification);
// Posponer un aviso 10 min: el cron lo envía a su hora, también con la app cerrada.
router.post('/snooze',          validate(snoozeSchema), notificationController.snooze);
// Medición de avisos: clic desde el service worker (T8).
router.post('/event',           validate(pushClickSchema), notificationController.pushClick);

// In-app notifications
router.get('/',                 notificationController.listInApp);
router.get('/unread-count',     notificationController.unreadCount);
router.patch('/read-all',       notificationController.markAllReadHandler);
router.delete('/',              notificationController.deleteAll);
router.patch('/:id/read',       notificationController.markOneRead);
router.delete('/:id',           notificationController.deleteOne);

export default router;
