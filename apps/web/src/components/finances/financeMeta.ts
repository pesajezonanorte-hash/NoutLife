import {
  Briefcase, BusFront, Clapperboard, Gift, Key, Laptop, Store, Wallet, CreditCard, GraduationCap, HeartPulse, Home, Lightbulb, Package, PiggyBank, Shirt, Sparkles, TrendingUp, Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { TransactionCategory } from '@noutlife/shared';
import type { Tone } from '@/components/ui/lq';
import { INTL_LOCALE, type Copy, type Locale } from '@/lib/locale';

type ChartTone = Exclude<Tone, 'muted'>;

interface TxCategoryMeta { value: TransactionCategory; icon: LucideIcon; tone: ChartTone }

const TX_STYLE: TxCategoryMeta[] = [
  { value: 'FOOD', icon: Utensils, tone: 'warning' },
  { value: 'TRANSPORT', icon: BusFront, tone: 'info' },
  { value: 'HOUSING', icon: Home, tone: 'forest' },
  { value: 'UTILITIES', icon: Lightbulb, tone: 'forest' },
  { value: 'HEALTH', icon: HeartPulse, tone: 'error' },
  { value: 'EDUCATION', icon: GraduationCap, tone: 'primary' },
  { value: 'ENTERTAINMENT', icon: Clapperboard, tone: 'primary' },
  { value: 'CLOTHING', icon: Shirt, tone: 'info' },
  { value: 'CLOTHING_FOR_ME', icon: Sparkles, tone: 'primary' },
  { value: 'SUBSCRIPTIONS', icon: CreditCard, tone: 'forest' },
  { value: 'SAVINGS', icon: PiggyBank, tone: 'success' },
  { value: 'INVESTMENT', icon: TrendingUp, tone: 'success' },
  { value: 'SALARY', icon: Wallet, tone: 'success' },
  { value: 'FREELANCE', icon: Laptop, tone: 'info' },
  { value: 'BUSINESS', icon: Briefcase, tone: 'forest' },
  { value: 'SALES', icon: Store, tone: 'warning' },
  { value: 'GIFT', icon: Gift, tone: 'primary' },
  { value: 'RENTAL', icon: Key, tone: 'forest' },
  { value: 'OTHER', icon: Package, tone: 'info' },
];

/** Nombre de cada categoría de movimiento en cada idioma (el valor guardado no cambia). */
const TX_LABEL: Copy<Record<TransactionCategory, string>> = {
  es: {
    FOOD: 'Comida', TRANSPORT: 'Transporte', HOUSING: 'Vivienda', UTILITIES: 'Servicios', HEALTH: 'Salud', EDUCATION: 'Educación',
    ENTERTAINMENT: 'Ocio', CLOTHING: 'Ropa', CLOTHING_FOR_ME: 'Ropa para mí', SUBSCRIPTIONS: 'Suscripciones', SAVINGS: 'Ahorro',
    INVESTMENT: 'Inversión', SALARY: 'Salario', FREELANCE: 'Freelance', BUSINESS: 'Negocio', SALES: 'Ventas', GIFT: 'Regalo',
    RENTAL: 'Alquiler', OTHER: 'Otros',
  } as Record<TransactionCategory, string>,
  en: {
    FOOD: 'Food', TRANSPORT: 'Transport', HOUSING: 'Housing', UTILITIES: 'Utilities', HEALTH: 'Health', EDUCATION: 'Education',
    ENTERTAINMENT: 'Entertainment', CLOTHING: 'Clothing', CLOTHING_FOR_ME: 'Clothing for me', SUBSCRIPTIONS: 'Subscriptions', SAVINGS: 'Savings',
    INVESTMENT: 'Investment', SALARY: 'Salary', FREELANCE: 'Freelance', BUSINESS: 'Business', SALES: 'Sales', GIFT: 'Gift',
    RENTAL: 'Rental income', OTHER: 'Other',
  } as Record<TransactionCategory, string>,
};

export type TxCategoryOption = TxCategoryMeta & { label: string };

/** Todas las categorías de movimiento con su nombre en el idioma indicado. */
export function txCategoriesFor(locale: Locale): TxCategoryOption[] {
  return TX_STYLE.map((c) => ({ ...c, label: TX_LABEL[locale][c.value] }));
}

const INCOME_VALUES = new Set<string>(['SALARY', 'FREELANCE', 'BUSINESS', 'SALES', 'GIFT', 'RENTAL', 'INVESTMENT', 'OTHER']);
const EXPENSE_EXCLUDED = new Set<string>(['SALARY', 'FREELANCE', 'BUSINESS', 'SALES', 'GIFT', 'RENTAL']);

/** Categorías disponibles según el tipo: el ingreso y el gasto no comparten lista. */
export const categoriesFor = (type: 'INCOME' | 'EXPENSE', locale: Locale = 'es') => txCategoriesFor(locale).filter((c) =>
  (type === 'INCOME' ? INCOME_VALUES.has(c.value) : !EXPENSE_EXCLUDED.has(c.value)));

export function txCategory(c?: string | null, locale: Locale = 'es') {
  const all = txCategoriesFor(locale);
  return all.find((x) => x.value === c) ?? all[all.length - 1];
}

/** Colores del reparto por categoría: se asignan por posición para que dos categorías vecinas no repitan tono. */
export const SHARE_TONES: ChartTone[] = ['primary', 'warning', 'info', 'forest', 'success', 'error'];

/** Rango [primer día, último día] del mes (offset 0 = actual) como YYYY-MM-DD. */
export function monthRange(offset = 0, locale: Locale = 'es') {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const label = first.toLocaleDateString(INTL_LOCALE[locale], { month: 'long', year: 'numeric' });
  return { first, last, from: k(first), to: k(last), label: label.charAt(0).toUpperCase() + label.slice(1), month: first.getMonth() + 1, year: first.getFullYear() };
}

export function pctChange(curr: number, prev: number) {
  if (!prev) return null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 100);
}
