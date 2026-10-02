// Metadatos visuales compartidos por Hábitos y Misiones: categoría → tono del
// sistema + etiqueta + ícono. El color hex que guarda cada hábito no se usa en
// el rediseño (regla "sin hex en componentes"); el tono sale de la categoría.
import {
  BookOpen, Coins, Dumbbell, Heart, HeartPulse, Palette, User, Users, type LucideIcon,
} from 'lucide-react';
import type { Tone } from '@/components/ui/lq';
import type { BadgeVariant } from '@/components/ui/lq';
import type { HabitFrequency } from '@/services/habit.service';

export const CATEGORIES = ['HEALTH', 'FITNESS', 'FINANCE', 'LEARNING', 'LOVE', 'SOCIAL', 'PERSONAL', 'CREATIVE'] as const;
export type Category = (typeof CATEGORIES)[number];

interface CategoryMeta { label: string; tone: Exclude<Tone, 'muted'>; icon: LucideIcon }

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  HEALTH: { label: 'Salud', tone: 'info', icon: HeartPulse },
  FITNESS: { label: 'Fitness', tone: 'success', icon: Dumbbell },
  FINANCE: { label: 'Finanzas', tone: 'warning', icon: Coins },
  LEARNING: { label: 'Aprendizaje', tone: 'primary', icon: BookOpen },
  LOVE: { label: 'Relaciones', tone: 'error', icon: Heart },
  SOCIAL: { label: 'Social', tone: 'info', icon: Users },
  PERSONAL: { label: 'Personal', tone: 'secondary', icon: User },
  CREATIVE: { label: 'Creativo', tone: 'secondary', icon: Palette },
};

export function categoryMeta(category?: string | null): CategoryMeta {
  return CATEGORY_META[(category ?? '') as Category] ?? CATEGORY_META.PERSONAL;
}

export const badgeFor = (category?: string | null): BadgeVariant => categoryMeta(category).tone;

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export function frequencyLabel(f?: HabitFrequency | null) {
  if (!f || f.type === 'daily' || f.days.length === 0 || f.days.length === 7) return 'Diario';
  return [...f.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_SHORT[d]).join(', ');
}

/** Fecha local YYYY-MM-DD (las claves del heatmap de la API). */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function longDate(d = new Date()) {
  const s = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

/** Moneda local; `compact` abrevia (1,2 M) para tarjetas estrechas. */
export function formatMoney(n: number, currency = 'COP', compact = false) {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency, maximumFractionDigits: compact && Math.abs(n) >= 1000 ? 1 : 0,
      ...(compact ? { notation: 'compact' as const } : {}),
    }).format(n);
  } catch {
    return new Intl.NumberFormat('es-CO').format(n);
  }
}
