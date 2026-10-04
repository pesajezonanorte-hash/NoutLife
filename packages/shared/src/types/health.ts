// ─── Sleep ────────────────────────────────────────────────────────────────────

export interface SleepLog {
  id: string;
  userId: string;
  bedtime: string;
  wakeTime: string;
  duration: number;
  quality: number;
  notes?: string;
  date: string;
  sleepScore?: number | null;
  /** Siesta: suma al descanso del día, pero no cuenta como noche. */
  isNap?: boolean;
  createdAt: string;
}

export interface SleepStats {
  avgDuration: number;
  avgQuality: number;
  totalLogs: number;
  weeklyAvg: number;
  trend: 'improving' | 'declining' | 'stable';
}

// ─── Meals / Food ─────────────────────────────────────────────────────────────

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK' | 'WATER';

export interface Meal {
  id: string;
  userId: string;
  name: string;
  mealType: MealType;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  waterMl?: number;
  date: string;
  createdAt: string;
}

export interface DayMealSummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalWaterMl: number;
  meals: Meal[];
}
