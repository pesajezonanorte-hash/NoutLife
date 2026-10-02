import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createSleepSchema, updateSleepSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/sleep.controller';

const router = Router();
router.use(requireAuth);

router.get('/',          ctrl.listSleep);
router.post('/',         validate(createSleepSchema), ctrl.createSleep);
router.patch('/:id',     validate(updateSleepSchema), ctrl.updateSleep);
router.delete('/:id',    ctrl.deleteSleep);
router.get('/stats',     ctrl.getSleepStats);

export default router;
