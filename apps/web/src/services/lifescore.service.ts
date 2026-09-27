import api from '../lib/api';

export interface LifeScore { total: number; breakdown: Record<string, number>; }
export interface MorningBriefing { briefing: string; cached: boolean; }
export interface YearInReview { year: number; totalXp: number; totalGold: number; totalWorkouts: number; totalQuestsCompleted: number; totalJournalEntries: number; totalBooksCompleted: number; avgSleepHours: number; avgMood: number; bestMonth: { month: string; xp: number } | null; xpByMonth: Record<string, number>; }

export type DynamicZoneStatus = 'active' | 'empty' | 'not_configured';

export interface DynamicZoneScore {
  id: string;
  name: string;
  icon: string;
  color: string;
  score: number;
  scoreAvailable: boolean;
  hasData: boolean;
  isTracking: boolean;
  status: DynamicZoneStatus;
  activityCount: number;
  activityLabel: string;
}
export interface DynamicLifeScoreData { totalScore: number; zones: DynamicZoneScore[]; trend: string; }

export const fetchLifeScore = () => api.get<LifeScore>('/life/score').then(r => r.data);
export const fetchDynamicLifeScore = (period = 'month') => api.get<DynamicLifeScoreData>('/life/dynamic', { params: { period } }).then(r => r.data);
export const fetchCorrelations = () => api.get<string[]>('/life/correlations').then(r => r.data);
export const fetchMorningBriefing = () => api.get<MorningBriefing>('/life/morning-briefing').then(r => r.data);
export const fetchYearInReview = (year?: number) => api.get<YearInReview>(`/life/year-review${year ? `?year=${year}` : ''}`).then(r => r.data);
