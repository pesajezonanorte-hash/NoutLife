import {
  BusFront, Clapperboard, CreditCard, GraduationCap, HeartPulse, Home, Lightbulb, Package, PiggyBank, Shirt, TrendingUp, Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { TransactionCategory } from '@lifequest/shared';
import type { Tone } from '@/components/ui/lq';

type ChartTone = Exclude<Tone, 'muted'>;

export const TX_CATEGORIES: { value: TransactionCategory; label: string; icon: LucideIcon; tone: ChartTone }[] = [
  { value: 'FOOD', label: 'Comida', icon: Utensils, tone: 'warning' },
  { value: 'TRANSPORT', label: 'Transporte', icon: BusFront, tone: 'info' },
  { value: 'HOUSING', label: 'Vivienda', icon: Home, tone: 'forest' },
  { value: 'UTILITIES', label: 'Servicios', icon: Lightbulb, tone: 'forest' },
  { value: 'HEALTH', label: 'Salud', icon: HeartPulse, tone: 'error' },
  { value: 'EDUCATION', label: 'Educación', icon: GraduationCap, tone: 'primary' },
  { value: 'ENTERTAINMENT', label: 'Ocio', icon: Clapperboard, tone: 'primary' },
  { value: 'CLOTHING', label: 'Ropa', icon: Shirt, tone: 'info' },
  { value: 'SUBSCRIPTIONS', label: 'Suscripciones', icon: CreditCard, tone: 'forest' },
  { value: 'SAVINGS', label: 'Ahorro', icon: PiggyBank, tone: 'success' },
  { value: 'INVESTMENT', label: 'Inversión', icon: TrendingUp, tone: 'success' },
  { value: 'OTHER', label: 'Otros', icon: Package, tone: 'info' },
];

export function txCategory(c?: string | null) {
  return TX_CATEGORIES.find((x) => x.value === c) ?? TX_CATEGORIES[TX_CATEGORIES.length - 1];
}

/** Colores del reparto por categoría: se asignan por posición para que dos categorías vecinas no repitan tono. */
export const SHARE_TONES: ChartTone[] = ['primary', 'warning', 'info', 'forest', 'success', 'error'];

/** Rango [primer día, último día] del mes (offset 0 = actual) como YYYY-MM-DD. */
export function monthRange(offset = 0) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const label = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return { first, last, from: k(first), to: k(last), label: label.charAt(0).toUpperCase() + label.slice(1), month: first.getMonth() + 1, year: first.getFullYear() };
}

export function pctChange(curr: number, prev: number) {
  if (!prev) return null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}
