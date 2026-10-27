// Metadatos visuales compartidos por Hábitos y Misiones: categoría → tono del
// sistema + etiqueta + ícono. El color hex que guarda cada hábito no se usa en
// el rediseño (regla "sin hex en componentes"); el tono sale de la categoría.
// Las funciones reciben el idioma (`locale`, español por defecto). Sin React: usa lib/locale.
import {
  BookOpen, Coins, Dumbbell, Heart, HeartPulse, Palette, Sparkles, User, Users, type LucideIcon,
} from 'lucide-react';
import type { Tone } from '@/components/ui/lq';
import type { BadgeVariant } from '@/components/ui/lq';
import type { HabitFrequency } from '@/services/habit.service';
import { INTL_LOCALE, type Locale } from './locale';

export const CATEGORIES = ['HEALTH', 'FITNESS', 'FINANCE', 'LEARNING', 'LOVE', 'SOCIAL', 'PERSONAL', 'CREATIVE', 'HYGIENE'] as const;
export type Category = (typeof CATEGORIES)[number];

interface CategoryMeta { label: string; tone: Exclude<Tone, 'muted'>; icon: LucideIcon }

const CATEGORY_LABEL: Record<Locale, Record<Category, string>> = {
  es: { HEALTH: 'Salud', FITNESS: 'Fitness', FINANCE: 'Finanzas', LEARNING: 'Aprendizaje', LOVE: 'Relaciones', SOCIAL: 'Social', PERSONAL: 'Personal', CREATIVE: 'Creativo', HYGIENE: 'Higiene personal' },
  en: { HEALTH: 'Health', FITNESS: 'Fitness', FINANCE: 'Finances', LEARNING: 'Learning', LOVE: 'Relationships', SOCIAL: 'Social', PERSONAL: 'Personal', CREATIVE: 'Creative', HYGIENE: 'Personal care' },
};

const CATEGORY_STYLE: Record<Category, Omit<CategoryMeta, 'label'>> = {
  HEALTH: { tone: 'info', icon: HeartPulse },
  FITNESS: { tone: 'success', icon: Dumbbell },
  FINANCE: { tone: 'warning', icon: Coins },
  LEARNING: { tone: 'primary', icon: BookOpen },
  LOVE: { tone: 'error', icon: Heart },
  SOCIAL: { tone: 'info', icon: Users },
  PERSONAL: { tone: 'forest', icon: User },
  CREATIVE: { tone: 'forest', icon: Palette },
  HYGIENE: { tone: 'success', icon: Sparkles },
};

export function categoryMeta(category?: string | null, locale: Locale = 'es'): CategoryMeta {
  const key = (category ?? '') in CATEGORY_STYLE ? (category as Category) : 'PERSONAL';
  return { label: CATEGORY_LABEL[locale][key], ...CATEGORY_STYLE[key] };
}

export const badgeFor = (category?: string | null): BadgeVariant => categoryMeta(category).tone;

const WEEKDAY_SHORT: Record<Locale, string[]> = {
  es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

export function frequencyLabel(f?: HabitFrequency | null, locale: Locale = 'es') {
  if (!f || f.type === 'daily' || f.days.length === 0 || f.days.length === 7) return locale === 'en' ? 'Daily' : 'Diario';
  return [...f.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_SHORT[locale][d]).join(', ');
}

/** Fecha local YYYY-MM-DD (las claves del heatmap de la API). */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function longDate(d = new Date(), locale: Locale = 'es') {
  const s = d.toLocaleDateString(INTL_LOCALE[locale], { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const GREETINGS: Record<Locale, [string, string, string]> = {
  es: ['Buenos días', 'Buenas tardes', 'Buenas noches'],
  en: ['Good morning', 'Good afternoon', 'Good evening'],
};

export function greeting(d = new Date(), locale: Locale = 'es') {
  const h = d.getHours();
  const [morning, afternoon, evening] = GREETINGS[locale];
  return h < 12 ? morning : h < 20 ? afternoon : evening;
}

/** Moneda local; `compact` abrevia (1,2 M) para tarjetas estrechas. */
export function formatMoney(n: number, currency = 'COP', compact = false, locale: Locale = 'es') {
  try {
    return new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: 'currency', currency, currencyDisplay: currency === 'COP' ? 'narrowSymbol' : 'symbol', maximumFractionDigits: compact && Math.abs(n) >= 1000 ? 1 : 0,
      ...(compact ? { notation: 'compact' as const } : {}),
    }).format(n);
  } catch {
    return new Intl.NumberFormat(INTL_LOCALE[locale]).format(n);
  }
}
