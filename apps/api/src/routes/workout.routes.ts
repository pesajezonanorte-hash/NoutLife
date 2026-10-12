import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireProZone } from '../middleware/plan.middleware';
import { validate } from '../middleware/validate.middleware';
import { createWorkoutSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/workout.controller';

const router = Router();
router.use(requireAuth);
// Zona Pro: en NoutLife Lite toda la zona responde 402 (lo guardado se conserva).
router.use(requireProZone('gym'));

router.get('/',              ctrl.listWorkouts);
router.post('/',             validate(createWorkoutSchema), ctrl.createWorkout);
router.get('/attendance',    ctrl.listAttendances);
router.post('/attendance',   ctrl.recordAttendance);
router.get('/:id',           ctrl.getWorkout);
router.patch('/:id',         ctrl.updateWorkout);
router.post('/:id/finish',   ctrl.finishWorkout);
router.delete('/:id',        ctrl.deleteWorkout);

router.get('/exercises/catalog', ctrl.listExercises);
router.get('/exercises/:id/progress', ctrl.getExerciseProgress);

router.get('/routines/list',  ctrl.listRoutines);
router.post('/routines',      ctrl.createRoutine);
router.patch('/routines/:id', ctrl.updateRoutine);
router.delete('/routines/:id', ctrl.deleteRoutine);

export default router;
