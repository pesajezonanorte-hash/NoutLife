import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createHabitSchema, updateHabitSchema, habitLogSchema, habitStepSchema } from '../schemas/habit.schemas';
import * as habitController from '../controllers/habit.controller';
import { limitActiveHabits, liteHistoryWindow } from '../middleware/plan.middleware';

const router = Router();

router.use(requireAuth);

router.get('/',                 habitController.listHabits);
router.post('/', validate(createHabitSchema), limitActiveHabits, habitController.createHabit);
router.get('/:id',              habitController.getHabit);
router.patch('/:id', validate(updateHabitSchema), habitController.updateHabit);
router.delete('/:id',           habitController.archiveHabit);
router.post('/:id/log', validate(habitLogSchema), habitController.logHabit);
router.post('/:id/log/undo',    habitController.undoHabitLog);
router.post('/:id/steps/:stepId', validate(habitStepSchema), habitController.toggleStep);
router.get('/:id/heatmap',      liteHistoryWindow, habitController.getHabitHeatmap);

export default router;
