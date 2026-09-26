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
  xp: number;
}

export interface XpHistoryResponse {
  data: XpHistoryPoint[];
  avg: number;
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
  month: string;
  income: number;
  expenses: number;
  /** Net accumulated within the visible six-month window, not account balance. */
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

export const getActivityRadar = () =>
  api.get<ActivityRadarResponse>('/stats/radar').then(({ data }) => data);

export const getFinanceTrend = () =>
  api.get<FinanceTrendPoint[]>('/stats/finance-trend').then(({ data }) => data);

export const getHabitHeatmap = () =>
  api.get<HeatmapPoint[]>('/stats/heatmap').then(({ data }) => data);

export const getSleepScatter = (period = 'month') =>
  api.get<SleepTrendPoint[]>('/stats/sleep', p(period)).then(({ data }) => data);

export const getGymProgression = (period = 'month') =>
  api.get<GymProgression[]>('/stats/gym', p(period)).then(({ data }) => data);

export const getPredictions = () =>
  api.get<StatsPredictions>('/stats/predictions').then(({ data }) => data);
