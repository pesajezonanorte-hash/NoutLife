import api from '../lib/api';
import type { Meal } from '@noutlife/shared';

export async function fetchMeals(date?: string): Promise<Meal[]> {
  const params = date ? `?date=${date}` : '';
  const { data } = await api.get<{ meals: Meal[] }>(`/meals${params}`);
  return data.meals;
}

export async function createMeal(body: { name: string; mealType: string; calories?: number; protein?: number; carbs?: number; fat?: number; waterMl?: number; date?: string }): Promise<Meal> {
  const { data } = await api.post<{ meal: Meal }>('/meals', body);
  return data.meal;
}

export async function deleteMeal(id: string): Promise<void> {
  await api.delete(`/meals/${id}`);
}

export async function fetchMealSummary(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const { data } = await api.get(`/meals/summary?${params}`);
  return data;
}

// ─── Nutrición (/nutrition): metas, comidas guardadas y estimación con IA ─────

export interface NutritionGoal { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; waterMl: number | null }
export interface SavedMeal { id: string; name: string; calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null }
export interface ParsedMeal {
  name: string;
  estimatedCalories: number;
  estimatedProtein: number;
  estimatedCarbs: number;
  estimatedFat: number;
  aiAvailable: boolean;
  aiSucceeded: boolean;
  recognized: boolean;
  needsIngredients: boolean;
}

/** null si el usuario aún no definió metas. */
export async function fetchNutritionGoal(): Promise<NutritionGoal | null> {
  const { data } = await api.get<NutritionGoal | null>('/nutrition/goals');
  return data ?? null;
}

export async function saveNutritionGoal(body: Partial<NutritionGoal>): Promise<NutritionGoal> {
  const { data } = await api.put<NutritionGoal>('/nutrition/goals', body);
  return data;
}

export async function fetchSavedMeals(): Promise<SavedMeal[]> {
  const { data } = await api.get<SavedMeal[]>('/nutrition/saved-meals');
  return data ?? [];
}

export async function createSavedMeal(body: Omit<SavedMeal, 'id'>): Promise<SavedMeal> {
  const { data } = await api.post<SavedMeal>('/nutrition/saved-meals', body);
  return data;
}

export async function deleteSavedMeal(id: string): Promise<void> {
  await api.delete(`/nutrition/saved-meals/${id}`);
}

export async function parseMeal(description: string): Promise<ParsedMeal> {
  const { data } = await api.post<ParsedMeal>('/nutrition/ai-parse', { description });
  return data;
}
