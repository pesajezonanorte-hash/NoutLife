import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import * as svc from '../services/workout.service';

const s = (obj: { createdAt: Date; updatedAt?: Date; date?: Date; [k: string]: unknown }) => ({
  ...obj,
  createdAt: obj.createdAt.toISOString(),
  updatedAt: obj.updatedAt?.toISOString(),
  date: obj.date instanceof Date ? obj.date.toISOString() : obj.date,
});

export async function listWorkouts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const workouts = await svc.listWorkouts(req.userId!, Number(req.query.limit) || 20);
    res.json({ workouts: workouts.map(w => ({ ...s(w), exercises: w.exercises.map(e => ({ ...e, workout: undefined })) })) });
  } catch { res.status(500).json({ error: 'Error al obtener entrenamientos.' }); }
}

export async function getWorkout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const workout = await svc.getWorkout(req.userId!, req.params.id);
    if (!workout) { res.status(404).json({ error: 'No encontrado.' }); return; }
    res.json({ workout: { ...s(workout), exercises: workout.exercises.map(e => ({ ...e, workout: undefined })) } });
  } catch { res.status(500).json({ error: 'Error al obtener entrenamiento.' }); }
}

export async function createWorkout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const workout = await svc.createWorkout(req.userId!, req.body);
    res.status(201).json({ workout: s(workout) });
  } catch { res.status(500).json({ error: 'Error al crear entrenamiento.' }); }
}

export async function updateWorkout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const workout = await svc.updateWorkout(req.userId!, req.params.id, req.body);
    if (!workout) { res.status(404).json({ error: 'No encontrado.' }); return; }
    res.json({ workout: { ...s(workout), exercises: workout.exercises.map(e => ({ ...e, workout: undefined })) } });
  } catch { res.status(500).json({ error: 'Error al actualizar entrenamiento.' }); }
}

export async function finishWorkout(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await svc.finishWorkout(req.userId!, req.params.id, req.body);
    res.json({ workout: s(result.workout), rewards: result.rewards, user: result.user });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'WORKOUT_NOT_FOUND') { res.status(404).json({ error: 'Entrenamiento no encontrado.' }); return; }
    if (code === 'WORKOUT_ALREADY_FINISHED') { res.status(409).json({ error: 'Este entrenamiento ya fue finalizado y premiado.' }); return; }
    res.status(500).json({ error: 'Error al finalizar entrenamiento.' });
  }
}

export async function deleteWorkout(req: AuthRequest, res: Response): Promise<void> {
  try {
    await svc.deleteWorkout(req.userId!, req.params.id);
    res.json({ success: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'WORKOUT_NOT_FOUND') { res.status(404).json({ error: 'Entrenamiento no encontrado.' }); return; }
    if (code === 'WORKOUT_COMPLETED_CANNOT_DELETE') {
      res.status(409).json({ error: 'No se puede eliminar un entrenamiento que ya otorgó XP. Puedes editarlo para corregirlo.' });
      return;
    }
    res.status(500).json({ error: 'Error al eliminar entrenamiento.' });
  }
}

export async function listAttendances(req: AuthRequest, res: Response): Promise<void> {
  try {
    const attendances = await svc.listAttendances(req.userId!, req.query.from as string | undefined, req.query.to as string | undefined);
    res.json({ attendances: attendances.map((attendance) => ({
      ...attendance,
      date: attendance.date.toISOString(),
      createdAt: attendance.createdAt.toISOString(),
      updatedAt: attendance.updatedAt.toISOString(),
    })) });
  } catch {
    res.status(500).json({ error: 'Error al obtener asistencia de gimnasio.' });
  }
}

export async function recordAttendance(req: AuthRequest, res: Response): Promise<void> {
  try {
    const attendance = await svc.recordAttendance(req.userId!, req.body.date);
    res.status(201).json({ attendance: {
      ...attendance,
      date: attendance.date.toISOString(),
      createdAt: attendance.createdAt.toISOString(),
      updatedAt: attendance.updatedAt.toISOString(),
    } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'INVALID_ATTENDANCE_DATE' || code === 'ATTENDANCE_FUTURE_DATE') {
      res.status(400).json({ error: 'La asistencia debe corresponder a una fecha válida que no sea futura.' });
      return;
    }
    res.status(500).json({ error: 'Error al registrar asistencia de gimnasio.' });
  }
}

export async function listExercises(req: AuthRequest, res: Response): Promise<void> {
  try {
    const exercises = await svc.listExercises(req.query.search as string, req.query.muscleGroup as string);
    res.json({ exercises });
  } catch { res.status(500).json({ error: 'Error al obtener ejercicios.' }); }
}

export async function getExerciseProgress(req: AuthRequest, res: Response): Promise<void> {
  try {
    const progress = await svc.getExerciseProgress(req.userId!, req.params.id);
    res.json({ progress });
  } catch { res.status(500).json({ error: 'Error al obtener progresión.' }); }
}

export async function listRoutines(req: AuthRequest, res: Response): Promise<void> {
  try {
    const routines = await svc.listRoutines(req.userId!);
    res.json({ routines: routines.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() })) });
  } catch { res.status(500).json({ error: 'Error al obtener rutinas.' }); }
}

export async function createRoutine(req: AuthRequest, res: Response): Promise<void> {
  try {
    const routine = await svc.createRoutine(req.userId!, req.body);
    res.status(201).json({ routine: { ...routine, createdAt: routine.createdAt.toISOString(), updatedAt: routine.updatedAt.toISOString() } });
  } catch { res.status(500).json({ error: 'Error al crear rutina.' }); }
}

export async function updateRoutine(req: AuthRequest, res: Response): Promise<void> {
  try {
    const routine = await svc.updateRoutine(req.userId!, req.params.id, req.body);
    res.json({ routine: { ...routine, createdAt: routine.createdAt.toISOString(), updatedAt: routine.updatedAt.toISOString() } });
  } catch { res.status(500).json({ error: 'Error al actualizar rutina.' }); }
}

export async function deleteRoutine(req: AuthRequest, res: Response): Promise<void> {
  try {
    await svc.deleteRoutine(req.userId!, req.params.id);
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Error al eliminar rutina.' }); }
}
