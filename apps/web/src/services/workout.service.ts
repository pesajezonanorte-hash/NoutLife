import api from '../lib/api';
import type { AchievementToast } from '../store/uiStore';
import type { Workout, Exercise, Routine } from '@noutlife/shared';

export async function fetchWorkouts(limit = 20): Promise<Workout[]> {
  const { data } = await api.get<{ workouts: Workout[] }>(`/workouts?limit=${limit}`);
  return data.workouts;
}

export async function fetchColiseoAttendances(from?: string, to?: string): Promise<ColiseoAttendance[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const { data } = await api.get<{ attendances: ColiseoAttendance[] }>(`/workouts/attendance?${params}`);
  return data.attendances;
}

export async function recordColiseoAttendance(date?: string): Promise<ColiseoAttendance> {
  const { data } = await api.post<{ attendance: ColiseoAttendance }>('/workouts/attendance', date ? { date } : {});
  return data.attendance;
}

export async function fetchWorkout(id: string): Promise<Workout> {
  const { data } = await api.get<{ workout: Workout }>(`/workouts/${id}`);
  return data.workout;
}

export interface ColiseoAttendance {
  id: string;
  userId: string;
  date: string;
  source: 'HABIT' | 'MANUAL';
  habitId?: string | null;
  habit?: { id: string; title: string; icon: string } | null;
  createdAt: string;
  updatedAt: string;
}

export async function createWorkout(body: { title: string; kind?: 'STRENGTH' | 'WALK' | 'CARDIO'; date?: string; notes?: string; routineDayId?: string }): Promise<Workout> {
  const { data } = await api.post<{ workout: Workout }>('/workouts', body);
  return data.workout;
}

export async function updateWorkout(id: string, body: Record<string, unknown>): Promise<Workout> {
  const { data } = await api.patch<{ workout: Workout }>(`/workouts/${id}`, body);
  return data.workout;
}

export async function finishWorkout(id: string, body: { duration?: number; distanceKm?: number; notes?: string; exercises?: unknown[] }): Promise<{ workout: Workout; rewards: unknown; user: unknown; achievementsUnlocked?: AchievementToast[] }> {
  const { data } = await api.post(`/workouts/${id}/finish`, body);
  return data;
}

/** Borra una sesión; si ya había dado recompensa, devuelve el XP y el oro que se descontaron. */
export async function deleteWorkout(id: string): Promise<{ xpRemoved: number; goldRemoved: number }> {
  const { data } = await api.delete<{ xpRemoved?: number; goldRemoved?: number }>(`/workouts/${id}`);
  return { xpRemoved: data?.xpRemoved ?? 0, goldRemoved: data?.goldRemoved ?? 0 };
}

/** Ejercicio propio, guardado en la cuenta. Si ya existía con ese nombre, devuelve ese (`created: false`). */
export async function createExercise(body: { name: string; muscleGroup: string; equipment?: string }): Promise<{ exercise: Exercise; created: boolean }> {
  const { data } = await api.post<{ exercise: Exercise; created: boolean }>('/workouts/exercises', body);
  return data;
}

export async function fetchExercises(search?: string, muscleGroup?: string): Promise<Exercise[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (muscleGroup) params.set('muscleGroup', muscleGroup);
  const { data } = await api.get<{ exercises: Exercise[] }>(`/workouts/exercises/catalog?${params}`);
  return data.exercises;
}

export async function fetchExerciseProgress(exerciseId: string) {
  const { data } = await api.get(`/workouts/exercises/${exerciseId}/progress`);
  return data.progress;
}

export async function fetchRoutines(): Promise<Routine[]> {
  const { data } = await api.get<{ routines: Routine[] }>('/workouts/routines/list');
  return data.routines;
}

export async function createRoutine(body: Record<string, unknown>): Promise<Routine> {
  const { data } = await api.post<{ routine: Routine }>('/workouts/routines', body);
  return data.routine;
}

export async function updateRoutine(id: string, body: Record<string, unknown>): Promise<Routine> {
  const { data } = await api.patch<{ routine: Routine }>(`/workouts/routines/${id}`, body);
  return data.routine;
}

export async function deleteRoutine(id: string): Promise<void> {
  await api.delete(`/workouts/routines/${id}`);
}
