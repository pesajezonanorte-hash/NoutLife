// Planes de NoutLife: lo que el cliente necesita saber para mostrar precios,
// límites de Lite y el estado de la suscripción. La regla real vive en la API
// (apps/api/src/lib/plans.ts y lib/pricing.ts); estos valores solo sirven para los textos.
// Los textos que dependen del precio (cobro de hoy, precio por día, plan anual) viven en lib/offer.
import type { Market, PriceCurrency, PriceList, Subscription } from '@noutlife/shared';
import { INTL_LOCALE, type Copy, type Locale } from './locale';

export type { Market, PriceCurrency, PriceList };

export const PRO_PRICE_COP = 9900;
/** Pro Anual: 12 meses de una vez (plan v3, Rev7). Igual que en la API (PRO_ANNUAL_PRICE_COP). */
export const PRO_ANNUAL_PRICE_COP = 89900;
/** Pro fuera de Colombia, en dólares: $4,99 al mes o $39,99 al año. Igual que en la API (lib/pricing). */
export const PRO_PRICE_USD_CENTS = 499;
export const PRO_ANNUAL_PRICE_USD_CENTS = 3999;
export const TRIAL_DAYS = 7;
/** NoutLife Lite. La IA es solo de Pro. */
export const LITE_LIMITS = { activeHabits: 3, activeRoutines: 3, historyDays: 5, notebooks: 2, notebookPages: 10 } as const;

/**
 * Listas de precios por mercado, en centavos de su moneda (COP: pesos × 100). Wompi cobra siempre en COP:
 * un precio en dólares se convierte con la TRM del día del cobro.
 */
export const PRICE_LISTS: Record<Market, PriceList> = {
  CO: { market: 'CO', currency: 'COP', monthInCents: PRO_PRICE_COP * 100, yearInCents: PRO_ANNUAL_PRICE_COP * 100 },
  INTL: { market: 'INTL', currency: 'USD', monthInCents: PRO_PRICE_USD_CENTS, yearInCents: PRO_ANNUAL_PRICE_USD_CENTS },
};

/** Colombia tiene una sola zona horaria; cualquier otra ve la lista en dólares (la misma regla que la API al crear la cuenta). */
export const COLOMBIA_TIMEZONE = 'America/Bogota';
export function marketForTimezone(timezone: string | null | undefined): Market {
  return !timezone || timezone === COLOMBIA_TIMEZONE ? 'CO' : 'INTL';
}

/** Zona horaria IANA de este dispositivo. */
export function deviceTimezone(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
}

/** Lista de la cuenta (la decide la API) o, sin sesión, la de este dispositivo. Una API sin mercados cobra en pesos. */
export function priceListFor(subscription: Subscription | null | undefined, timezone = deviceTimezone()): PriceList {
  if (subscription) return subscription.pricing ?? PRICE_LISTS.CO;
  return PRICE_LISTS[marketForTimezone(timezone)];
}

/**
 * Un monto de una lista: «$9.900» (pesos, sin centavos), «$4.99» en inglés y «US$4.99» en español
 * (el «US» evita confundirlo con pesos).
 */
export function formatMoney(cents: number, currency: PriceCurrency, locale: Locale): string {
  if (currency === 'COP') return `$${Math.round(cents / 100).toLocaleString(INTL_LOCALE[locale])}`;
  const dollars = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return locale === 'es' ? `US$${dollars}` : `$${dollars}`;
}

/** «$9.900» con separador de miles colombiano (pesos enteros). */
export const formatCop = (value: number) => `$${value.toLocaleString('es-CO')}`;

/** Funciones que Lite limita (la API responde 402 con `feature`). */
export type ProFeature = 'habits' | 'history' | 'ai';

/** Zonas solo de Pro. En Lite se ven con candado (la API responde 402 con `lock`). */
export type ProZone = 'finances' | 'coliseo' | 'recreation' | 'food' | 'sleep' | 'journal' | 'learning' | 'love' | 'mirror' | 'wisdom' | 'custom-zones';
/** Candados de la Libreta en Lite (la API responde 402 con `lock`). */
export type NotebookLock = 'notebooks' | 'notebook-pages' | 'notebook-draw' | 'notebook-images' | 'notebook-stickies';
/** Candados de Lite: una zona Pro, el límite de rutinas activas o lo que es de Pro en la Libreta. */
export type ProLock = ProZone | 'routines' | NotebookLock;

export interface ProZoneInfo {
  label: string;
  /** Qué desbloquea, en una frase. */
  pitch: string;
}

export const PRO_ZONE_LIST: readonly ProZone[] = ['finances', 'coliseo', 'recreation', 'food', 'sleep', 'journal', 'learning', 'love', 'mirror', 'wisdom', 'custom-zones'];
export const isProZone = (value: string): value is ProZone => (PRO_ZONE_LIST as readonly string[]).includes(value);

/**
 * Nombre y frase de cada zona Pro. El inglés es también el glosario de la traducción de la app:
 * Coliseo → Coliseum, Espejo → Mirror, el Sabio → the Sage, misiones → goals.
 */
export const PRO_ZONES: Copy<Record<ProZone, ProZoneInfo>> = {
  es: {
    finances: { label: 'Finanzas', pitch: 'Presupuestos, metas de ahorro y cada gasto bajo control.' },
    coliseo: { label: 'Coliseo', pitch: 'Cualquier entrenamiento: rutinas, cardio, caminatas, récords y fotos de progreso.' },
    recreation: { label: 'Recreación', pitch: 'Tu sala de cine: películas, series, juegos y salidas que también suman XP.' },
    food: { label: 'Comida', pitch: 'Comidas, macros y tus platos guardados en un solo lugar.' },
    sleep: { label: 'Sueño', pitch: 'Tus horas de descanso, su calidad y cómo evoluciona noche a noche.' },
    journal: { label: 'Diario', pitch: 'Tu diario privado, con tu ánimo y lo que vives cada día.' },
    learning: { label: 'Aprendizaje', pitch: 'Tus libros y cursos, con el progreso de cada uno.' },
    love: { label: 'Relaciones', pitch: 'Fechas importantes, ideas de regalo y las personas que te importan.' },
    mirror: { label: 'Espejo', pitch: 'Tu armario, outfits y rutinas de cuidado personal.' },
    wisdom: { label: 'Sabiduría', pitch: 'Citas de filósofos, estrategas y atletas históricos. Subir de nivel abre más.' },
    'custom-zones': { label: 'Mis zonas', pitch: 'Zonas a tu medida, con sus propios hábitos, misiones y métricas.' },
  },
  en: {
    finances: { label: 'Finances', pitch: 'Budgets, savings goals and every expense under control.' },
    coliseo: { label: 'Coliseum', pitch: 'Any workout: routines, cardio, walks, personal records and progress photos.' },
    recreation: { label: 'Recreation', pitch: 'Your own screening room: movies, shows, games and the outings worth remembering.' },
    food: { label: 'Food', pitch: 'Meals, macros and your saved dishes, all in one place.' },
    sleep: { label: 'Sleep', pitch: 'Your hours of rest, how well you slept and how it changes night after night.' },
    journal: { label: 'Journal', pitch: 'Your private journal, with your mood and the moments of each day.' },
    learning: { label: 'Learning', pitch: 'Your books and courses, with the progress of each one.' },
    love: { label: 'Relationships', pitch: 'Important dates, gift ideas and the people who matter to you.' },
    mirror: { label: 'Mirror', pitch: 'Your wardrobe, outfits and self-care routines.' },
    wisdom: { label: 'Wisdom', pitch: 'Quotes from philosophers, strategists and great athletes, unlocked as you progress.' },
    'custom-zones': { label: 'My zones', pitch: 'Zones made to measure, with their own habits, goals and metrics.' },
  },
};

/** Ruta de cada zona Pro. Las zonas personalizadas (/zonas/:id) cuentan como «Mis zonas». */
const PRO_ZONE_PATHS: Record<string, ProZone> = {
  '/finances': 'finances', '/coliseo': 'coliseo', '/gym': 'coliseo', '/recreacion': 'recreation', '/food': 'food', '/sleep': 'sleep', '/journal': 'journal',
  '/learning': 'learning', '/love': 'love', '/espejo': 'mirror', '/wisdom': 'wisdom', '/custom-zones': 'custom-zones',
};

/** Zona Pro de una ruta (o null si la ruta es de Lite). */
export function proZoneOf(pathname: string): ProZone | null {
  if (pathname.startsWith('/zonas/')) return 'custom-zones';
  const base = `/${pathname.split('/')[1] ?? ''}`;
  return PRO_ZONE_PATHS[base] ?? null;
}

/**
 * En Lite, las zonas principales de la barra son las primeras que sí se pueden usar
 * y no están ocultas (el orden elegido se respeta dentro de cada grupo).
 */
export function usableOrder(order: string[], lite: boolean, hidden: string[] = []): string[] {
  if (!lite) return order;
  const shown = order.filter((to) => !hidden.includes(to));
  return [...shown.filter((to) => !proZoneOf(to)), ...shown.filter((to) => proZoneOf(to))];
}

const DAY_MS = 24 * 60 * 60_000;

/** Días que faltan hasta `iso` (0 si ya pasó). */
export function daysUntil(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY_MS));
}

/** «19 de octubre» · «October 19». */
export function longDay(iso: string | null | undefined, locale: Locale = 'es'): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'long' });
}

/** «19 de octubre» si es este año; «19 de octubre de 2027» si no (renovaciones anuales). */
export function longDate(iso: string | null | undefined, now = new Date(), locale: Locale = 'es'): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (date.getFullYear() === now.getFullYear()) return longDay(iso, locale);
  return date.toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'long', year: 'numeric' });
}

export const isLite = (subscription?: Subscription | null) => subscription?.plan === 'lite';

/** Error de axios con el 402 de un límite de Lite. */
export function isProRequired(error: unknown): boolean {
  const res = (error as { response?: { status?: number; data?: { code?: string } } })?.response;
  return res?.status === 402 && res.data?.code === 'PRO_REQUIRED';
}

export interface PlanRow {
  label: string;
  lite: string | boolean;
  pro: string | boolean;
}

/** El plan anual solo se ofrece si la API ya lo cobra (devuelve `interval`); una API anterior cobraría mensual. */
export const annualAvailable = (subscription?: Subscription | null) => subscription?.interval !== undefined;

/** Cuántas zonas desbloquea Pro (para los textos). */
export const PRO_ZONE_COUNT = PRO_ZONE_LIST.length;
