import { Apple, Coffee, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { Meal } from '@lifequest/shared';
import type { NutritionGoal } from '@/services/meal.service';
import type { Tone } from '@/components/ui/lq';

export type FoodType = 'BREAKFAST' | 'LUNCH' | 'SNACK' | 'DINNER';

/** Orden del día; `at` (minutos) ubica en la línea de tiempo los huecos sin registrar. */
export const MEAL_TYPES: { value: FoodType; label: string; icon: LucideIcon; at: number }[] = [
  { value: 'BREAKFAST', label: 'Desayuno', icon: Coffee, at: 8 * 60 },
  { value: 'LUNCH', label: 'Almuerzo', icon: Sun, at: 13 * 60 },
  { value: 'SNACK', label: 'Merienda', icon: Apple, at: 17 * 60 },
  { value: 'DINNER', label: 'Cena', icon: Moon, at: 20 * 60 + 30 },
];
export const mealTypeLabel = (t: string) => MEAL_TYPES.find((m) => m.value === t)?.label ?? 'Comida';

/** Tipo sugerido según la hora (para "Añadir" una comida guardada). */
export function typeForNow(d = new Date()): FoodType {
  const h = d.getHours();
  return h < 11 ? 'BREAKFAST' : h < 16 ? 'LUNCH' : h < 19 ? 'SNACK' : 'DINNER';
}

export type MacroKey = 'protein' | 'carbs' | 'fat';
export const MACROS: { key: MacroKey; label: string; short: string; tone: Exclude<Tone, 'muted'> }[] = [
  { key: 'protein', label: 'Proteína', short: 'P', tone: 'primary' },
  { key: 'carbs', label: 'Carbohidratos', short: 'C', tone: 'warning' },
  { key: 'fat', label: 'Grasas', short: 'G', tone: 'secondary' },
];

/** Metas efectivas: las del usuario o valores de referencia mientras no defina las suyas. */
export const DEFAULT_GOAL = { calories: 2000, protein: 150, carbs: 200, fat: 70, waterMl: 2000 };
export function effectiveGoal(g: NutritionGoal | null) {
  return {
    calories: g?.calories || DEFAULT_GOAL.calories,
    protein: g?.protein || DEFAULT_GOAL.protein,
    carbs: g?.carbs || DEFAULT_GOAL.carbs,
    fat: g?.fat || DEFAULT_GOAL.fat,
    waterMl: g?.waterMl || DEFAULT_GOAL.waterMl,
  };
}

export function totals(meals: Meal[]) {
  return meals.reduce(
    (a, m) => ({
      calories: a.calories + (m.calories ?? 0),
      protein: a.protein + (m.protein ?? 0),
      carbs: a.carbs + (m.carbs ?? 0),
      fat: a.fat + (m.fat ?? 0),
      waterMl: a.waterMl + (m.waterMl ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0 },
  );
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('es-CO');

/** "P 14 · C 62 · G 12" (solo los macros registrados). */
export function macroLine(m: { protein?: number | null; carbs?: number | null; fat?: number | null }) {
  const parts = MACROS.filter(({ key }) => m[key] != null && m[key]! > 0).map(({ key, short }) => `${short} ${fmtInt(m[key]!)}`);
  return parts.join(' · ');
}
