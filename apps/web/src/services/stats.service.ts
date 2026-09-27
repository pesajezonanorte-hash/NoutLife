import api from '../lib/api';

const p = (period: string) => ({ params: { period } });

export interface StatsSummary {
  xp: { value: number; change: number };
  quests: { completed: number; change: number; total: number };
  currentStreak: number;
  bestStreak: number;
  finance: { income: number; expenses: number; balance: number };
  totals: {
    xpEarned: number;
    questsCompleted: number;
    habitCompletions: number;
    workouts: number;
  };
}

export interface XpHistoryPoint {
  date: string;
  /** XP granted on this calendar day. Zeroes are kept deliberately. */
  xp: number;
  /** XP accumulated within the selected period through this day. */
  cumulativeXp: number;
}

export interface XpHistoryResponse {
  data: XpHistoryPoint[];
  avg: number;
  activeDays: number;
  daysInPeriod: number;
  totalXp: number;
}

export interface ActivityRadarPoint {
  subject: string;
  value: number;
}

export interface ActivityRadarResponse {
  current: ActivityRadarPoint[];
  previous: ActivityRadarPoint[];
}

export interface FinanceTrendPoint {
  /** `YYYY-MM-DD` for week/month views; `YYYY-MM` for longer views. */
  month: string;
  income: number;
  expenses: number;
  /** Net accumulated inside the selected period, not an account balance. */
  balance: number;
}

export interface HeatmapPoint {
  date: string;
  count: number;
}

export interface SleepTrendPoint {
  date: string;
  duration: number;
  quality: number;
}

export interface GymProgression {
  name: string;
  data: Array<{ date: string; weight: number }>;
}

export interface StatsPredictions {
  daysToNextLevel: number | null;
  avgDailyXp: number;
  goalPredictions: Array<{
    title: string;
    remaining: number;
    months: number | null;
  }>;
  habitRisks: Array<{
    title: string;
    currentStreak: number;
    completedDays: number;
    scheduledDays: number;
    completionRate: number;
    risk: 'low' | 'medium' | 'high';
  }>;
}

export const getStatsSummary = (period = 'month') =>
  api.get<StatsSummary>('/stats/summary', p(period)).then(({ data }) => data);

export const getXpHistory = (period = 'month') =>
  api.get<XpHistoryResponse>('/stats/xp-history', p(period)).then(({ data }) => data);

export const getActivityRadar = (period = 'week') =>
  api.get<ActivityRadarResponse>('/stats/radar', p(period)).then(({ data }) => data);

export const getFinanceTrend = (period = 'month') =>
  api.get<FinanceTrendPoint[]>('/stats/finance-trend', p(period)).then(({ data }) => data);

export const getHabitHeatmap = () =>
  api.get<HeatmapPoint[]>('/stats/heatmap').then(({ data }) => data);

export const getSleepScatter = (period = 'month') =>
  api.get<SleepTrendPoint[]>('/stats/sleep', p(period)).then(({ data }) => data);

export const getGymProgression = (period = 'month') =>
  api.get<GymProgression[]>('/stats/gym', p(period)).then(({ data }) => data);

export const getPredictions = () =>
  api.get<StatsPredictions>('/stats/predictions').then(({ data }) => data);
