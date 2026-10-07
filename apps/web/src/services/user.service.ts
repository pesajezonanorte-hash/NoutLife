import api from '../lib/api';
import type { User, AvatarConfig } from '@noutlife/shared';

export async function fetchCharacter(): Promise<User & { inventoryItems: unknown[]; achievements: unknown[] }> {
  const { data } = await api.get('/users/me/character');
  return data.character;
}

export async function updateAvatar(avatarConfig: Partial<AvatarConfig>): Promise<User> {
  const { data } = await api.put<{ user: User }>('/users/me/avatar', avatarConfig);
  return data.user;
}

export interface OnboardingPayload {
  displayName?: string;
  birthDate?: string;
  timezone?: string;
  avatarConfig?: Partial<AvatarConfig>;
  goalCategories?: string[];
  mainQuestTitle?: string;
  mainQuestCategory?: string;
  mainQuestDeadline?: string;
}

export async function completeOnboarding(payload: OnboardingPayload): Promise<User> {
  const { data } = await api.put<{ user: User }>('/users/me/onboarding', payload);
  return data.user;
}

export async function updateProfile(payload: { displayName?: string; timezone?: string; currency?: string; language?: string; gymPlaylistUrl?: string | null; avatarUrl?: string | null }): Promise<User> {
  const { data } = await api.patch<{ user: User }>('/users/me/profile', payload);
  return data.user;
}

export async function fetchDashboard() {
  const { data } = await api.get('/dashboard');
  return data;
}

export interface GuideCompletionResult {
  alreadyCompleted: boolean;
  day: number;
  completedDays: number[];
  guideCompleted: boolean;
  celebration?: boolean;
  achievementUnlocked?: boolean;
  rewards?: {
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
}

export async function completeGuideDay(day: number): Promise<GuideCompletionResult> {
  const { data } = await api.post('/users/me/guide/complete', { day });
  return data;
}

export async function dismissGuide(): Promise<void> {
  await api.post('/users/me/guide/dismiss');
}
