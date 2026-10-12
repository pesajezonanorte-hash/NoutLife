import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createAntiHabitSchema, logSlipSchema } from '../schemas/anti-habit.schemas';
import * as ctrl from '../controllers/anti-habit.controller';

const router = Router();
router.use(requireAuth);

router.get('/',            ctrl.listAntiHabits);
router.post('/',           validate(createAntiHabitSchema), ctrl.createAntiHabit);
router.delete('/:id',      ctrl.deleteAntiHabit);
router.post('/:id/slips',  validate(logSlipSchema), ctrl.logSlip);

export default router;
