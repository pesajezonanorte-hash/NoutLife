import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireProZone } from '../middleware/plan.middleware';
import { validate } from '../middleware/validate.middleware';
import { createSleepSchema, updateSleepSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/sleep.controller';

const router = Router();
router.use(requireAuth);

// Detección automática: latido de actividad y descanso sugerido por la brecha nocturna.
// Van antes del candado: la app manda el latido en segundo plano, también en Lite.
router.post('/activity',   ctrl.recordActivity);
router.get('/suggestion',  ctrl.getSleepSuggestion);
router.delete('/suggestion', ctrl.dismissSleepSuggestion);

// Zona Pro: en NoutLife Lite toda la zona responde 402 (lo guardado se conserva).
router.use(requireProZone('sleep'));

router.get('/',          ctrl.listSleep);
router.post('/',         validate(createSleepSchema), ctrl.createSleep);
router.get('/stats',     ctrl.getSleepStats);
router.patch('/:id',     validate(updateSleepSchema), ctrl.updateSleep);
router.delete('/:id',    ctrl.deleteSleep);

export default router;
