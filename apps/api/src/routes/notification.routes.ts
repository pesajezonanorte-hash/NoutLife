import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as notificationController from '../controllers/notification.controller';

const router = Router();

// Pública: el navegador la necesita para suscribirse (no es secreta).
router.get('/vapid-public-key', notificationController.vapidPublicKey);

router.use(requireAuth);

router.post('/subscribe',       notificationController.subscribe);
router.delete('/unsubscribe',   notificationController.unsubscribe);
router.get('/preferences',      notificationController.getPreferences);
router.patch('/preferences',    notificationController.updatePreferences);
router.post('/test',            notificationController.sendTestNotification);

// In-app notifications
router.get('/',                 notificationController.listInApp);
router.get('/unread-count',     notificationController.unreadCount);
router.patch('/read-all',       notificationController.markAllReadHandler);
router.delete('/',              notificationController.deleteAll);
router.patch('/:id/read',       notificationController.markOneRead);
router.delete('/:id',           notificationController.deleteOne);

export default router;
