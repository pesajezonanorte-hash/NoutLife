import api from '../lib/api';
import type { JournalEntry, JournalStreak } from '@noutlife/shared';

export async function fetchJournal(filters: { month?: string; tag?: string; search?: string } = {}): Promise<JournalEntry[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const { data } = await api.get<{ entries: JournalEntry[] }>(`/journal?${params}`);
  return data.entries;
}

export async function fetchJournalEntry(id: string): Promise<JournalEntry> {
  const { data } = await api.get<{ entry: JournalEntry }>(`/journal/${id}`);
  return data.entry;
}

export async function createJournalEntry(body: { title?: string; content: string; mood?: number; date?: string; tags?: string[] }): Promise<JournalEntry> {
  const { data } = await api.post<{ entry: JournalEntry }>('/journal', body);
  return data.entry;
}

export async function updateJournalEntry(id: string, body: Record<string, unknown>): Promise<JournalEntry> {
  const { data } = await api.patch<{ entry: JournalEntry }>(`/journal/${id}`, body);
  return data.entry;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await api.delete(`/journal/${id}`);
}

export async function fetchJournalStreak(): Promise<JournalStreak> {
  const { data } = await api.get<{ streak: JournalStreak }>('/journal/streak');
  return data.streak;
}
