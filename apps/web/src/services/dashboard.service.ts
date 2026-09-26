import api from '../lib/api';

export type TodayPlanItemType = 'habit' | 'quest' | 'event';
export type TodayPlanUrgency = 'critical' | 'soon' | 'normal';

export interface TodayPlanItem {
  id: string;
  type: TodayPlanItemType;
  title: string;
  detail: string;
  xp: number;
  urgency: TodayPlanUrgency;
  route: '/habits' | '/quests' | '/agenda';
  scheduledAt?: string;
}

export interface TodayPlan {
  date: string;
  generatedAt: string;
  priorities: {
    primary: TodayPlanItem | null;
    secondary: TodayPlanItem[];
    totalOpen: number;
  };
  habits: {
    total: number;
    completed: number;
    pending: number;
  };
  calendar: {
    connected: boolean;
    eventCount: number;
    nextEvent: TodayPlanItem | null;
  };
  wellbeing: {
    energy: number | null;
    mood: number | null;
    sleep: {
      duration: number;
      score: number | null;
      quality: number;
      date: string;
    } | null;
    workout: {
      title: string;
      daysAgo: number | null;
      completedToday: boolean;
    } | null;
  };
  xp: {
    earned: number;
  };
  advice: {
    message: string;
    tone: 'neutral' | 'calm' | 'warning' | 'momentum';
  };
}

export async function fetchTodayPlan(): Promise<TodayPlan> {
  const { data } = await api.get<TodayPlan>('/dashboard/today-plan');
  return data;
}
