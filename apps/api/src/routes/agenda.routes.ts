import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { idempotent } from '../middleware/idempotency.middleware';
import * as ctrl from '../controllers/agenda.controller';

const router = Router();
router.use(requireAuth);

router.get('/upcoming', ctrl.upcomingEvents);
router.get('/',         ctrl.listEvents);
router.post('/',        idempotent, ctrl.createEvent);

// Google Calendar routes
router.get('/google/status',     ctrl.getGoogleCalendarStatus);
router.get('/google/url',        ctrl.getGoogleAuthUrl);
router.post('/google/callback',  ctrl.handleGoogleCallback);
router.post('/google/sync',      ctrl.syncGoogleCalendar);
router.delete('/google/disconnect', ctrl.disconnectGoogleCalendar);

router.get('/:id',      ctrl.getEvent);
router.patch('/:id',    ctrl.updateEvent);
router.delete('/:id',   ctrl.deleteEvent);

export default router;
