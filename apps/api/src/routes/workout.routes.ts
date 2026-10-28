import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireProZone } from '../middleware/plan.middleware';
import { validate } from '../middleware/validate.middleware';
import { createExerciseSchema, createWorkoutSchema, finishWorkoutSchema, routineSchema, updateRoutineSchema, updateWorkoutSchema } from '../schemas/activity.schemas';
import * as ctrl from '../controllers/workout.controller';

const router = Router();
router.use(requireAuth);
// Zona Pro: en NoutLife Lite toda la zona responde 402 (lo guardado se conserva).
router.use(requireProZone('coliseo'));

router.get('/',              ctrl.listWorkouts);
router.post('/',             validate(createWorkoutSchema), ctrl.createWorkout);
router.get('/attendance',    ctrl.listAttendances);
router.post('/attendance',   ctrl.recordAttendance);
// Ejercicio propio: queda guardado en la cuenta para las próximas sesiones.
router.post('/exercises',    validate(createExerciseSchema), ctrl.createExercise);
router.get('/:id',           ctrl.getWorkout);
router.patch('/:id',         validate(updateWorkoutSchema), ctrl.updateWorkout);
router.post('/:id/finish',   validate(finishWorkoutSchema), ctrl.finishWorkout);
router.delete('/:id',        ctrl.deleteWorkout);

router.get('/exercises/catalog', ctrl.listExercises);
router.get('/exercises/:id/progress', ctrl.getExerciseProgress);

router.get('/routines/list',  ctrl.listRoutines);
router.post('/routines',      validate(routineSchema), ctrl.createRoutine);
router.patch('/routines/:id', validate(updateRoutineSchema), ctrl.updateRoutine);
router.delete('/routines/:id', ctrl.deleteRoutine);

export default router;
