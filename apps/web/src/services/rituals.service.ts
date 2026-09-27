import api from '../lib/api';

export interface RitualStep {
  id: string;
  ritualId: string;
  title: string;
  durationMin: number | null;
  order: number;
}

export interface Ritual {
  id: string;
  name: string;
  type: 'morning' | 'night' | 'custom';
  icon: string;
  isActive: boolean;
  steps: RitualStep[];
}

export interface RitualStats {
  totalLogs: number;
  thisMonth: number;
  streak: number;
}

export async function listRituals(): Promise<Ritual[]> {
  const { data } = await api.get('/rituals');
  return data;
}

export async function seedPresets(): Promise<Ritual[]> {
  const { data } = await api.post('/rituals/seed-presets');
  return data;
}

export async function createRitual(payload: {
  name: string;
  type: string;
  icon?: string;
  steps?: { title: string; durationMin?: number; order: number }[];
}): Promise<Ritual> {
  const { data } = await api.post('/rituals', payload);
  return data;
}

export async function updateRitual(id: string, payload: Partial<Ritual>): Promise<Ritual> {
  const { data } = await api.patch(`/rituals/${id}`, payload);
  return data;
}

export async function deleteRitual(id: string): Promise<void> {
  await api.delete(`/rituals/${id}`);
}

export interface CompleteRitualResult {
  alreadyDone: boolean;
  xpEarned: number;
  goldEarned: number;
  message: string;
}

export async function completeRitual(id: string): Promise<CompleteRitualResult> {
  const { data } = await api.post<CompleteRitualResult>(`/rituals/${id}/complete`);
  return data;
}

export async function getRitualStats(id: string): Promise<RitualStats> {
  const { data } = await api.get(`/rituals/${id}/stats`);
  return data;
}
