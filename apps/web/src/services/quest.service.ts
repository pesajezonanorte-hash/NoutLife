import api from '../lib/api';
import type { Quest, CreateQuestPayload } from '@lifequest/shared';

export interface QuestFilters {
  type?: string;
  status?: string;
  category?: string;
  difficulty?: string;
  search?: string;
  sortBy?: string;
}

export interface SubObjective {
  id: string;
  title: string;
  completed: boolean;
}

export interface UnlockedAchievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

export interface CompleteQuestResult {
  success: boolean;
  rewards: {
    xpEarned: number;
    goldEarned: number;
    leveledUp: boolean;
    newLevel?: number;
    statIncreases?: {
      strength?: number;
      intelligence?: number;
      charisma?: number;
      hp?: number;
    };
  };
  achievementsUnlocked: UnlockedAchievement[];
  user: import('@lifequest/shared').User;
}

export async function fetchQuests(filters: QuestFilters = {}): Promise<Quest[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const { data } = await api.get<{ quests: Quest[] }>(`/quests?${params}`);
  return data.quests;
}

export async function fetchQuest(id: string): Promise<Quest> {
  const { data } = await api.get<{ quest: Quest }>(`/quests/${id}`);
  return data.quest;
}

export async function createQuest(payload: CreateQuestPayload): Promise<Quest> {
  const { data } = await api.post<{ quest: Quest }>('/quests', payload);
  return data.quest;
}

export async function updateQuest(id: string, payload: Partial<CreateQuestPayload>): Promise<Quest> {
  const { data } = await api.patch<{ quest: Quest }>(`/quests/${id}`, payload);
  return data.quest;
}

export async function archiveQuest(id: string): Promise<void> {
  await api.delete(`/quests/${id}`);
}

export async function failQuest(id: string): Promise<Quest> {
  const { data } = await api.post<{ quest: Quest }>(`/quests/${id}/fail`);
  return data.quest;
}

export async function completeQuest(questId: string): Promise<CompleteQuestResult> {
  const { data } = await api.post<CompleteQuestResult>(`/quests/${questId}/complete`);
  return data;
}

export async function toggleSubObjective(questId: string, subObjectiveId: string, completed: boolean): Promise<Quest> {
  const { data } = await api.patch<{ quest: Quest }>(`/quests/${questId}/subobjective`, { subObjectiveId, completed });
  return data.quest;
}

export async function fetchTodayQuests(): Promise<Quest[]> {
  const { data } = await api.get<{ quests: Quest[] }>('/dashboard/today-quests');
  return data.quests;
}
