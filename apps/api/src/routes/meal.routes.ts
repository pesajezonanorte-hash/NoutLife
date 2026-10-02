import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createMealSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/meal.controller';

const router = Router();
router.use(requireAuth);

router.get('/',          ctrl.listMeals);
router.post('/',         validate(createMealSchema), ctrl.createMeal);
router.delete('/:id',    ctrl.deleteMeal);
router.get('/summary',   ctrl.getMealSummary);

export default router;
