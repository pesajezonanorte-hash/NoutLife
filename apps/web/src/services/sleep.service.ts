import api from '../lib/api';
import type { SleepLog, SleepStats } from '@noutlife/shared';

export async function fetchSleep(month?: string): Promise<SleepLog[]> {
  const params = month ? `?month=${month}` : '';
  const { data } = await api.get<{ logs: SleepLog[] }>(`/sleep${params}`);
  return data.logs;
}

export async function createSleep(body: { bedtime: string; wakeTime: string; quality: number; notes?: string; date?: string; caffeineLate?: boolean; screensBeforeBed?: boolean; exercisedToday?: boolean; isNap?: boolean }): Promise<SleepLog> {
  const { data } = await api.post<{ log: SleepLog }>('/sleep', body);
  return data.log;
}

export async function updateSleep(id: string, body: Partial<{ bedtime: string; wakeTime: string; quality: number; notes: string }>): Promise<SleepLog> {
  const { data } = await api.patch<{ log: SleepLog }>(`/sleep/${id}`, body);
  return data.log;
}

export async function deleteSleep(id: string): Promise<void> {
  await api.delete(`/sleep/${id}`);
}

export async function fetchSleepStats(): Promise<SleepStats> {
  const { data } = await api.get<{ stats: SleepStats }>('/sleep/stats');
  return data.stats;
}

export interface SleepSuggestion { bedtime: string; wake: string; hours: number }

/** Pausa nocturna detectada por la actividad en la app (null si no hay ninguna reciente). */
export async function fetchSleepSuggestion(): Promise<SleepSuggestion | null> {
  const { data } = await api.get<{ suggestion: SleepSuggestion | null }>('/sleep/suggestion');
  return data.suggestion;
}
