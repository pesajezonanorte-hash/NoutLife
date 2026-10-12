import api from '../lib/api';

export interface AntiHabit {
  id: string;
  name: string;
  icon: string | null;
  createdAt: string;
  lastSlipAt: string | null;
  metrics: {
    today: number;
    last7Days: number;
    last30Days: number;
    cleanStreakDays: number;
    daily: { date: string; count: number }[];
  };
}

export async function fetchAntiHabits(): Promise<AntiHabit[]> {
  const { data } = await api.get<{ antiHabits: AntiHabit[] }>('/anti-habits');
  return data.antiHabits;
}

export async function createAntiHabit(body: { name: string; icon?: string }): Promise<void> {
  await api.post('/anti-habits', body);
}

export async function deleteAntiHabit(id: string): Promise<void> {
  await api.delete(`/anti-habits/${id}`);
}

export async function logSlip(id: string, note?: string): Promise<AntiHabit | null> {
  const { data } = await api.post<{ antiHabit: AntiHabit | null }>(`/anti-habits/${id}/slips`, { note });
  return data.antiHabit;
}
