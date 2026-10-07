import api from '../lib/api';
import type { LearningItem, LearningStats } from '@noutlife/shared';

export async function fetchLearning(): Promise<LearningItem[]> {
  const { data } = await api.get<{ items: LearningItem[] }>('/learning');
  return data.items;
}

export async function createLearning(body: { type: string; title: string; author?: string; platform?: string; totalProgress?: number; notes?: string }): Promise<LearningItem> {
  const { data } = await api.post<{ item: LearningItem }>('/learning', body);
  return data.item;
}

export async function updateLearning(id: string, body: Record<string, unknown>): Promise<{ item: LearningItem; rewards: unknown }> {
  const { data } = await api.patch<{ item: LearningItem; rewards: unknown }>(`/learning/${id}`, body);
  return data;
}

export async function deleteLearning(id: string): Promise<void> {
  await api.delete(`/learning/${id}`);
}

export async function fetchLearningStats(): Promise<LearningStats> {
  const { data } = await api.get<{ stats: LearningStats }>('/learning/stats');
  return data.stats;
}
