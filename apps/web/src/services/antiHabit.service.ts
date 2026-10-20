import api from '@/lib/api';

export interface Tally { falls: number; resisted: number }
export interface AntiHabitLog { id: string; date: string; occurred: boolean; amount: number; intensity: number | null; note: string | null; createdAt: string }
export interface AntiHabit {
  id: string; title: string; category: string; cue: string | null; targetPerWeek: number | null; createdAt: string;
  logs: AntiHabitLog[];
  metrics: { today: Tally; week: Tally; month: Tally; last30: Tally; daily: Array<Tally & { date: string }>; daysClean: number | null };
}

export const listAntiHabits = () => api.get<AntiHabit[]>('/anti-habits').then((r) => r.data);
export const createAntiHabit = (payload: { title: string; category?: string; cue?: string; targetPerWeek?: number }) =>
  api.post<AntiHabit>('/anti-habits', payload).then((r) => r.data);
export const logAntiHabit = (id: string, payload: { occurred: boolean; amount?: number; intensity?: number; note?: string }) =>
  api.post<AntiHabitLog>(`/anti-habits/${id}/logs`, payload).then((r) => r.data);
export const archiveAntiHabit = (id: string) => api.delete(`/anti-habits/${id}`);
export const deleteAntiHabitPermanently = (id: string) => api.delete(`/anti-habits/${id}/permanent`);
export const deleteAntiHabitLog = (logId: string) => api.delete(`/anti-habits/logs/${logId}`);
export const updateAntiHabit = (id: string, payload: { title?: string; category?: string; cue?: string | null; targetPerWeek?: number | null }) =>
  api.patch(`/anti-habits/${id}`, payload);
