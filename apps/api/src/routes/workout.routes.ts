import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/workout.controller';

const router = Router();
router.use(requireAuth);

router.get('/',              ctrl.listWorkouts);
router.post('/',             ctrl.createWorkout);
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
