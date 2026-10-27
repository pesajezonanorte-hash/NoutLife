import { Apple, Coffee, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { Meal } from '@noutlife/shared';
import type { NutritionGoal } from '@/services/meal.service';
import type { Tone } from '@/components/ui/lq';
import { getLocale, INTL_LOCALE } from '@/lib/i18n';

export type FoodType = 'BREAKFAST' | 'LUNCH' | 'SNACK' | 'DINNER';

/** Orden del día; `at` (minutos) ubica en la línea de tiempo los huecos sin registrar. */
export const MEAL_TYPES: { value: FoodType; label: string; icon: LucideIcon; at: number }[] = [
  { value: 'BREAKFAST', label: 'Desayuno', icon: Coffee, at: 8 * 60 },
  { value: 'LUNCH', label: 'Almuerzo', icon: Sun, at: 13 * 60 },
  { value: 'SNACK', label: 'Merienda', icon: Apple, at: 17 * 60 },
  { value: 'DINNER', label: 'Cena', icon: Moon, at: 20 * 60 + 30 },
];
export const mealTypeLabel = (t: string | null | undefined) => MEAL_TYPES.find((m) => m.value === t)?.label ?? 'Comida';

export type MacroKey = 'protein' | 'carbs' | 'fat';
export const MACROS: { key: MacroKey; label: string; short: string; tone: Exclude<Tone, 'muted'> }[] = [
  { key: 'protein', label: 'Proteína', short: 'P', tone: 'primary' },
  { key: 'carbs', label: 'Carbohidratos', short: 'C', tone: 'warning' },
  { key: 'fat', label: 'Grasas', short: 'G', tone: 'forest' },
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

export const fmtInt = (n: number) => Math.round(n).toLocaleString(INTL_LOCALE[getLocale()]);

/** "P 14 · C 62 · G 12" (solo los macros registrados). */
export function macroLine(m: { protein?: number | null; carbs?: number | null; fat?: number | null }) {
  const parts = MACROS.filter(({ key }) => m[key] != null && m[key]! > 0).map(({ key, short }) => `${short} ${fmtInt(m[key]!)}`);
  return parts.join(' · ');
}

const MEAL_LABEL: Record<'es' | 'en', Record<FoodType, string>> = {
  es: { BREAKFAST: 'Desayuno', LUNCH: 'Almuerzo', SNACK: 'Merienda', DINNER: 'Cena' },
  en: { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', SNACK: 'Snack', DINNER: 'Dinner' },
};
const MACRO_LABEL: Record<'es' | 'en', Record<MacroKey, string>> = {
  es: { protein: 'Proteína', carbs: 'Carbohidratos', fat: 'Grasas' },
  en: { protein: 'Protein', carbs: 'Carbs', fat: 'Fat' },
};

/** Momentos del día con su nombre en el idioma indicado. */
export function mealTypesFor(locale: 'es' | 'en') {
  return MEAL_TYPES.map((m) => ({ ...m, label: MEAL_LABEL[locale][m.value] }));
}
/** Nombre de un momento; `Comida` si no se reconoce. */
export function mealTypeLabelFor(t: string | null | undefined, locale: 'es' | 'en') {
  return MEAL_LABEL[locale][t as FoodType] ?? (locale === 'en' ? 'Meal' : 'Comida');
}
/** Macros con su nombre en el idioma indicado. */
export function macrosFor(locale: 'es' | 'en') {
  return MACROS.map((m) => ({ ...m, label: MACRO_LABEL[locale][m.key] }));
}
/** Número entero con separadores del idioma. */
export const fmtIntFor = (n: number, locale: 'es' | 'en') => Math.round(n).toLocaleString(INTL_LOCALE[locale]);
