import api from '../lib/api';

export type RecreationKind = 'MOVIE' | 'SERIES' | 'GAME' | 'OUTING' | 'HOBBY' | 'MUSIC' | 'OTHER';
/** DONE = ya la viviste · PLANNED = en cartelera, por ver. */
export type RecreationStatus = 'DONE' | 'PLANNED';

export interface RecreationEntry {
  id: string;
  title: string;
  kind: RecreationKind;
  status: RecreationStatus;
  rating: number | null;
  minutes: number | null;
  notes: string | null;
  date: string;
  xpEarned: number;
  createdAt: string;
}

/** Recompensa de una función vivida (null si ya cobró o pasó el tope del día). */
export interface RecreationRewards {
  xpGained: number;
  goldGained: number;
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
}

export interface RecreationInput {
  title?: string;
  kind?: RecreationKind;
  status?: RecreationStatus;
  rating?: number | null;
  minutes?: number | null;
  notes?: string | null;
  /** YYYY-MM-DD */
  date?: string;
}

export interface RecreationResult { entry: RecreationEntry; rewards: RecreationRewards | null }

export async function fetchRecreation(): Promise<RecreationEntry[]> {
  const { data } = await api.get<{ entries: RecreationEntry[] }>('/recreation');
  return data.entries;
}

export async function createRecreation(body: RecreationInput & { title: string; kind: RecreationKind }): Promise<RecreationResult> {
  const { data } = await api.post<RecreationResult>('/recreation', body);
  return data;
}

export async function updateRecreation(id: string, body: RecreationInput): Promise<RecreationResult> {
  const { data } = await api.patch<RecreationResult>(`/recreation/${id}`, body);
  return data;
}

export async function deleteRecreation(id: string): Promise<void> {
  await api.delete(`/recreation/${id}`);
}
