import api from '../lib/api';

export interface HabitFrequency {
  type: 'daily' | 'days_per_week';
  days: number[];
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: string;
  icon: string;
  color: string;
  xpReward: number;
  goldReward: number;
  currentStreak: number;
  longestStreak: number;
  frequency: HabitFrequency;
  resetTime: string;
  reminderTime?: string;
  isActive: boolean;
  syncToGoogleCalendar: boolean;
  googleCalendarEventId?: string | null;
  createsGymAttendance: boolean;
  createdAt: string;
  updatedAt: string;
  todayStatus?: 'completed' | 'failed' | 'skipped' | null;
  todayCompleted?: boolean | null;
}

export interface HabitLog {
  id: string;
  habitId: string;
  userId: string;
  completed: boolean;
  status: string;
  date: string;
  notes?: string;
  loggedAt: string;
}

export interface HabitLogResult {
  success: boolean;
  log: HabitLog;
  habit: Habit;
  currentStreak: number;
  longestStreak: number;
  rewards: {
    xpEarned: number;
    goldEarned: number;
    leveledUp: boolean;
    newLevel?: number;
  } | null;
  achievementsUnlocked: Array<{
    id: string;
    key: string;
    title: string;
    description: string;
    icon: string;
    xpReward: number;
  }>;
  recoveryCompleted?: {
    id: string;
    bonusXp: number;
    restoredStreak: number;
  } | null;
}

export interface CreateHabitPayload {
  title: string;
  description?: string;
  category: string;
  icon?: string;
  color?: string;
  xpReward?: number;
  goldReward?: number;
  frequency?: HabitFrequency;
  resetTime?: string;
  reminderTime?: string;
  syncToGoogleCalendar?: boolean;
  createsGymAttendance?: boolean;
}

export interface HeatmapEntry {
  date: string;
  status: string;
  completed: boolean;
}

export async function fetchHabits(): Promise<Habit[]> {
  const { data } = await api.get<{ habits: Habit[] }>('/habits');
  return data.habits;
}

export async function fetchHabit(id: string): Promise<Habit> {
  const { data } = await api.get<{ habit: Habit }>(`/habits/${id}`);
  return data.habit;
}

export async function createHabit(payload: CreateHabitPayload): Promise<Habit> {
  const { data } = await api.post<{ habit: Habit }>('/habits', payload);
  return data.habit;
}

export async function updateHabit(id: string, payload: Partial<CreateHabitPayload>): Promise<Habit> {
  const { data } = await api.patch<{ habit: Habit }>(`/habits/${id}`, payload);
  return data.habit;
}

export async function archiveHabit(id: string): Promise<void> {
  await api.delete(`/habits/${id}`);
}

export async function logHabit(
  id: string,
  status: 'completed' | 'failed' | 'skipped',
  notes?: string,
  date?: string,
): Promise<HabitLogResult> {
  const { data } = await api.post<HabitLogResult>(`/habits/${id}/log`, { status, notes, date });
  return data;
}

export async function fetchHabitHeatmap(id: string, days = 90): Promise<HeatmapEntry[]> {
  const { data } = await api.get<{ heatmap: HeatmapEntry[] }>(`/habits/${id}/heatmap?days=${days}`);
  return data.heatmap;
}
