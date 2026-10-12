import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireProZone } from '../middleware/plan.middleware';
import { validate } from '../middleware/validate.middleware';
import { createMealSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/meal.controller';

const router = Router();
router.use(requireAuth);
// Zona Pro: en NoutLife Lite toda la zona responde 402 (lo guardado se conserva).
router.use(requireProZone('food'));

router.get('/',          ctrl.listMeals);
router.post('/',         validate(createMealSchema), ctrl.createMeal);
router.delete('/:id',    ctrl.deleteMeal);
router.get('/summary',   ctrl.getMealSummary);

export default router;
