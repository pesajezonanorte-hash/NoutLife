import api from '@/lib/api';

export interface AntiHabitLog {
  id: string;
  antiHabitId: string;
  userId: string;
  date: string;
  occurred: boolean;
  amount: number;
  intensity: number | null;
  note: string | null;
  createdAt: string;
}
export interface AntiHabit {
  id: string;
  title: string;
  category: string;
  cue: string | null;
  targetPerWeek: number | null;
  isActive: boolean;
  logs: AntiHabitLog[];
  weeklyOccurrences: number;
  weeklyResisted: number;
  weekStart: string;
}
export async function listAntiHabits() {
  const { data } = await api.get<AntiHabit[]>('/anti-habits');
  return data;
}
export async function createAntiHabit(payload: { title: string; category: string; cue?: string; targetPerWeek?: number }) {
  const { data } = await api.post<AntiHabit>('/anti-habits', payload);
  return data;
}
export async function logAntiHabit(id: string, payload: { occurred: boolean; amount?: number; intensity?: number; note?: string; date?: string }) {
  const { data } = await api.post<AntiHabitLog>(`/anti-habits/${id}/logs`, payload);
  return data;
}
export async function deleteAntiHabitLog(logId: string) { await api.delete(`/anti-habits/logs/${logId}`); }
export async function archiveAntiHabit(id: string) { await api.delete(`/anti-habits/${id}`); }
