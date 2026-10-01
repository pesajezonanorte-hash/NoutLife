import api from '../lib/api';
import type { Workout, Exercise, Routine } from '@lifequest/shared';

export async function fetchWorkouts(limit = 20): Promise<Workout[]> {
  const { data } = await api.get<{ workouts: Workout[] }>(`/workouts?limit=${limit}`);
  return data.workouts;
}

export async function fetchGymAttendances(from?: string, to?: string): Promise<GymAttendance[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const { data } = await api.get<{ attendances: GymAttendance[] }>(`/workouts/attendance?${params}`);
  return data.attendances;
}

export async function recordGymAttendance(date?: string): Promise<GymAttendance> {
  const { data } = await api.post<{ attendance: GymAttendance }>('/workouts/attendance', date ? { date } : {});
  return data.attendance;
}

export async function fetchWorkout(id: string): Promise<Workout> {
  const { data } = await api.get<{ workout: Workout }>(`/workouts/${id}`);
  return data.workout;
}

export interface GymAttendance {
  id: string;
  userId: string;
  date: string;
  source: 'HABIT' | 'MANUAL';
  habitId?: string | null;
  habit?: { id: string; title: string; icon: string } | null;
  createdAt: string;
  updatedAt: string;
}

export async function createWorkout(body: { title: string; date?: string; notes?: string; routineDayId?: string }): Promise<Workout> {
  const { data } = await api.post<{ workout: Workout }>('/workouts', body);
  return data.workout;
}

export async function updateWorkout(id: string, body: Record<string, unknown>): Promise<Workout> {
  const { data } = await api.patch<{ workout: Workout }>(`/workouts/${id}`, body);
  return data.workout;
}

export async function finishWorkout(id: string, body: { duration?: number; notes?: string; exercises?: unknown[] }): Promise<{ workout: Workout; rewards: unknown; user: unknown }> {
  const { data } = await api.post(`/workouts/${id}/finish`, body);
  return data;
}

export async function deleteWorkout(id: string): Promise<void> {
  await api.delete(`/workouts/${id}`);
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
