import { prisma } from '../lib/prisma';
import { generateFromImage, generateText, hasAIProvider, hasVisionProvider } from '../lib/ai';

// ─── Nutrition Goals ───────────────────────────────────────────────────────────

export async function getNutritionGoal(userId: string) {
  return prisma.nutritionGoal.findUnique({ where: { userId } });
}

export async function upsertNutritionGoal(
  userId: string,
  data: { calories?: number; protein?: number; carbs?: number; fat?: number; waterMl?: number }
) {
  return prisma.nutritionGoal.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

// ─── Saved Meals ───────────────────────────────────────────────────────────────

export async function getSavedMeals(userId: string) {
  return prisma.savedMeal.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
}

export async function createSavedMeal(
  userId: string,
  data: { name: string; calories?: number; protein?: number; carbs?: number; fat?: number }
) {
  return prisma.savedMeal.create({ data: { userId, ...data } });
}

export async function deleteSavedMeal(userId: string, id: string) {
  return prisma.savedMeal.deleteMany({ where: { id, userId } });
}

// ─── AI Quick Log ──────────────────────────────────────────────────────────────

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

const num = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === 'string') {
    const m = v.match(/-?\d+(?:[.,]\d+)?/);
    if (m) {
      const n = Number(m[0].replace(',', '.'));
      if (Number.isFinite(n)) return Math.max(0, Math.round(n));
    }
  }
  return fallback;
};

/** Extract first balanced {...} JSON object from a string. Handles code fences and prefixes. */
function extractJsonObject(raw: string): unknown | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const firstBrace = stripped.indexOf('{');
  if (firstBrace < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = firstBrace; i < stripped.length; i++) {
    const c = stripped[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const candidate = stripped.slice(firstBrace, i + 1);
        try { return JSON.parse(candidate); } catch { return null; }
      }
    }
  }
  return null;
}

export async function parseMealWithAI(description: string): Promise<ParsedMeal> {
  const trimmed = (description ?? '').trim();
  if (!trimmed) {
    return { name: '', estimatedCalories: 0, estimatedProtein: 0, estimatedCarbs: 0, estimatedFat: 0, aiAvailable: false, aiSucceeded: false, recognized: false, needsIngredients: false };
  }

  const fallback: ParsedMeal = {
    name: trimmed.slice(0, 80),
    estimatedCalories: 0,
    estimatedProtein: 0,
    estimatedCarbs: 0,
    estimatedFat: 0,
    aiAvailable: hasAIProvider(),
    aiSucceeded: false,
    recognized: false,
    needsIngredients: false,
  };

  if (!hasAIProvider()) return fallback;

  const prompt = `Eres un nutricionista experto. Identifica la comida y estima sus macros sin inventar ingredientes.
Responde SOLO con JSON válido, sin markdown, sin texto adicional.
Formato exacto:
{"recognized":true,"needsIngredients":false,"name":"nombre resumido","estimatedCalories":NUMBER,"estimatedProtein":NUMBER,"estimatedCarbs":NUMBER,"estimatedFat":NUMBER}

Reglas:
- Si el plato es desconocido, ambiguo o no puedes identificar sus ingredientes principales, responde recognized=false y needsIngredients=true; no adivines macros y usa 0 en los valores.
- Si es reconocible, responde recognized=true y needsIngredients=false.
- Macros en gramos, calorías en kcal.
- Si no se especifica cantidad, asume una porción típica (1 plato, 1 unidad, etc.).
- Ten en cuenta la comida colombiana y latinoamericana.
- Nunca devuelvas null o undefined.

Comida del usuario: "${trimmed}"`;

  let text = '';
  try {
    text = await generateText([{ role: 'user', content: prompt }], {
      temperature: 0.2,
      maxTokens: 220,
    });
  } catch (e) {
    console.error('[parseMealWithAI] AI provider failed:', e instanceof Error ? e.message : e);
    return fallback;
  }

  const parsed = extractJsonObject(text) as Record<string, unknown> | null;
  if (!parsed) {
    console.error('[parseMealWithAI] Could not extract JSON from AI response. Raw:', text.slice(0, 200));
    return fallback;
  }

  const name = typeof parsed.name === 'string' && parsed.name.trim().length > 0
    ? parsed.name.trim().slice(0, 80)
    : trimmed.slice(0, 80);
  const recognized = parsed.recognized === true && parsed.needsIngredients !== true;

  if (!recognized) {
    return {
      name,
      estimatedCalories: 0,
      estimatedProtein: 0,
      estimatedCarbs: 0,
      estimatedFat: 0,
      aiAvailable: true,
      aiSucceeded: true,
      recognized: false,
      needsIngredients: true,
    };
  }

  return {
    name,
    estimatedCalories: num(parsed.estimatedCalories ?? parsed.calories),
    estimatedProtein:  num(parsed.estimatedProtein  ?? parsed.protein),
    estimatedCarbs:    num(parsed.estimatedCarbs    ?? parsed.carbs),
    estimatedFat:      num(parsed.estimatedFat      ?? parsed.fat),
    aiAvailable: true,
    aiSucceeded: true,
    recognized: true,
    needsIngredients: false,
  };
}

// ─── Foto del plato ────────────────────────────────────────────────────────────

/**
 * Prompt de visión comprimido (~50 tokens): en inglés porque cuesta menos tokens, claves
 * de una letra en la respuesta y la imagen ya llega reducida desde el móvil (≤384 px).
 */
export function photoPrompt(lang: 'es' | 'en', hint?: string): string {
  return [
    'Food photo. Estimate the visible portion. Latin American dishes are common. Reply JSON only:',
    `{"ok":true,"n":"short dish name in ${lang === 'en' ? 'English' : 'Spanish'}","k":kcal,"p":protein_g,"c":carbs_g,"f":fat_g}`,
    'Not food or unclear: {"ok":false}',
    hint ? `Hint: ${hint.slice(0, 160)}` : '',
  ].filter(Boolean).join('\n');
}

/** Respuesta compacta del modelo → la misma forma que el análisis por texto. */
export function mealFromPhotoReply(text: string, fallbackName = ''): ParsedMeal {
  const parsed = extractJsonObject(text) as Record<string, unknown> | null;
  const name = typeof parsed?.n === 'string' && parsed.n.trim() ? parsed.n.trim().slice(0, 80) : fallbackName.slice(0, 80);
  const kcal = num(parsed?.k);
  if (!parsed || parsed.ok !== true || kcal <= 0) {
    return { name, estimatedCalories: 0, estimatedProtein: 0, estimatedCarbs: 0, estimatedFat: 0, aiAvailable: true, aiSucceeded: Boolean(parsed), recognized: false, needsIngredients: true };
  }
  return {
    name,
    estimatedCalories: kcal,
    estimatedProtein: num(parsed.p),
    estimatedCarbs: num(parsed.c),
    estimatedFat: num(parsed.f),
    aiAvailable: true,
    aiSucceeded: true,
    recognized: true,
    needsIngredients: false,
  };
}

/** Estima kcal y macros a partir de la foto del plato (y una pista opcional de la persona). */
export async function scanMealPhoto(input: { image: string; mimeType: string; hint?: string; lang?: 'es' | 'en' }): Promise<ParsedMeal> {
  const hint = input.hint?.trim() ?? '';
  const empty: ParsedMeal = {
    name: hint.slice(0, 80), estimatedCalories: 0, estimatedProtein: 0, estimatedCarbs: 0, estimatedFat: 0,
    aiAvailable: hasVisionProvider(), aiSucceeded: false, recognized: false, needsIngredients: false,
  };
  if (!hasVisionProvider()) return empty;
  try {
    const text = await generateFromImage(photoPrompt(input.lang ?? 'es', hint), { data: input.image, mimeType: input.mimeType }, { temperature: 0.1, maxTokens: 120 });
    return mealFromPhotoReply(text, hint);
  } catch (e) {
    console.error('[scanMealPhoto] AI provider failed:', e instanceof Error ? e.message : e);
    return empty;
  }
}

// ─── Daily Macro Summary ───────────────────────────────────────────────────────

export async function getDailyMacros(userId: string, dateParam: Date | string) {
  let start: Date;
  let end: Date;

  if (typeof dateParam === 'string' && dateParam.includes('-')) {
    const parts = dateParam.split('-').map(Number);
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      const [year, month, day] = parts;
      start = new Date(year, month - 1, day, 0, 0, 0, 0);
      end = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else {
      const d = new Date(dateParam);
      start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    }
  } else {
    const d = new Date(dateParam);
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }

  const [meals, goal] = await Promise.all([
    prisma.meal.findMany({
      where: { userId, date: { gte: start, lte: end } },
    }),
    prisma.nutritionGoal.findUnique({ where: { userId } }),
  ]);

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fat: acc.fat + (m.fat ?? 0),
      waterMl: acc.waterMl + (m.waterMl ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0 }
  );

  return { totals, goal, meals };
}
