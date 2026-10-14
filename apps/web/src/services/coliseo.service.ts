import api from '../lib/api';

export interface BodyWeight { id: string; weight: number; date: string; notes?: string; createdAt: string; }
export interface ProgressPhoto { id: string; date: string; notes?: string; photoData?: string; createdAt: string; }
export interface ExerciseHistory { exercise: { name: string; muscleGroup?: string } | null; sessions: Array<{ workoutDate: string; workoutTitle: string; sets: Array<{ weight?: number; reps?: number }>; maxWeight: number; totalVolume: number; bestSet: { weight?: number; reps?: number }; oneRepMax: number | null }>; allTimeBest: unknown; totalSessions: number; }
export interface WeeklyVolume { [muscle: string]: { sets: number; volume: number }; }

export const logBodyWeight = (weight: number, date: string, notes?: string) =>
  api.post('/coliseo/body-weight', { weight, date, notes }).then(r => r.data as BodyWeight);

export const fetchBodyWeights = (from?: string, to?: string) =>
  api.get<BodyWeight[]>('/coliseo/body-weight', { params: { from, to } }).then(r => r.data);

export const deleteBodyWeight = (id: string) => api.delete(`/coliseo/body-weight/${id}`);

export const saveProgressPhoto = (photoData: string, date: string, notes?: string) =>
  api.post('/coliseo/progress-photos', { photoData, date, notes }).then(r => r.data);

export const fetchProgressPhotos = () =>
  api.get<ProgressPhoto[]>('/coliseo/progress-photos').then(r => r.data);

export const deleteProgressPhoto = (id: string) => api.delete(`/coliseo/progress-photos/${id}`);

export const fetchExerciseHistory = (exerciseId: string) =>
  api.get<ExerciseHistory>(`/coliseo/exercises/${exerciseId}/history`).then(r => r.data);

export const fetchWeeklyVolume = () =>
  api.get<WeeklyVolume>('/coliseo/volume-weekly').then(r => r.data);

export const calculate1RM = (weight: number, reps: number) =>
  api.post<{ oneRepMax: number }>('/coliseo/1rm', { weight, reps }).then(r => r.data.oneRepMax);
