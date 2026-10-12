import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createSleepSchema, updateSleepSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/sleep.controller';

const router = Router();
router.use(requireAuth);

router.get('/',          ctrl.listSleep);
router.post('/',         validate(createSleepSchema), ctrl.createSleep);
router.get('/stats',     ctrl.getSleepStats);
// Detección automática: latido de actividad y descanso sugerido por la brecha nocturna.
router.post('/activity',   ctrl.recordActivity);
router.get('/suggestion',  ctrl.getSleepSuggestion);
router.delete('/suggestion', ctrl.dismissSleepSuggestion);
router.patch('/:id',     validate(updateSleepSchema), ctrl.updateSleep);
router.delete('/:id',    ctrl.deleteSleep);

export default router;
