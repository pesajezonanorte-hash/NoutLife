import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createHabitSchema, updateHabitSchema, habitLogSchema } from '../schemas/habit.schemas';
import * as habitController from '../controllers/habit.controller';

const router = Router();

router.use(requireAuth);

router.get('/',                 habitController.listHabits);
router.post('/', validate(createHabitSchema), habitController.createHabit);
router.get('/:id',              habitController.getHabit);
router.patch('/:id', validate(updateHabitSchema), habitController.updateHabit);
router.delete('/:id',           habitController.archiveHabit);
router.post('/:id/log', validate(habitLogSchema), habitController.logHabit);
router.post('/:id/log/undo',    habitController.undoHabitLog);
router.get('/:id/heatmap',      habitController.getHabitHeatmap);

export default router;
