import { FolderKanban, ListTodo, Repeat, Target, type LucideIcon } from 'lucide-react';
import type { Quest } from '@noutlife/shared';
import type { BadgeVariant } from '@/components/ui/lq';
import { INTL_LOCALE, type Locale } from '@/lib/locale';

const TYPE_TEXT: Record<Locale, Record<'SIDE' | 'MAIN' | 'META', { label: string; description: string }>> = {
  es: {
    SIDE: { label: 'Tarea', description: 'Un pendiente concreto' },
    MAIN: { label: 'Proyecto', description: 'Objetivo importante con etapas' },
    META: { label: 'Meta', description: 'A largo plazo, por pasos' },
  },
  en: {
    SIDE: { label: 'Task', description: 'One specific to-do' },
    MAIN: { label: 'Project', description: 'Important goal with stages' },
    META: { label: 'Goal', description: 'Long term, step by step' },
  },
};

const TYPE_ICON = { SIDE: ListTodo, MAIN: FolderKanban, META: Target } as const;

/** Tipos de misión (tarea, proyecto, meta) en el idioma indicado. */
export function questTypesFor(locale: Locale): { value: 'SIDE' | 'MAIN' | 'META'; label: string; icon: LucideIcon; description: string }[] {
  return (['SIDE', 'MAIN', 'META'] as const).map((value) => ({ value, icon: TYPE_ICON[value], ...TYPE_TEXT[locale][value] }));
}

export function typeMeta(type: Quest['type'], locale: Locale = 'es') {
  const known = questTypesFor(locale).find((t) => t.value === type);
  if (known) return known;
  const repeat = type === 'DAILY' ? (locale === 'en' ? 'Daily' : 'Diaria') : (locale === 'en' ? 'Weekly' : 'Semanal');
  return { value: type, label: repeat, icon: Repeat, description: '' };
}

const DIFFICULTY_LABEL: Record<Locale, Record<Quest['difficulty'], string>> = {
  es: { EASY: 'Fácil', NORMAL: 'Normal', HARD: 'Difícil', EPIC: 'Épica' },
  en: { EASY: 'Easy', NORMAL: 'Normal', HARD: 'Hard', EPIC: 'Epic' },
};
const DIFFICULTY_VARIANT: Record<Quest['difficulty'], BadgeVariant> = { EASY: 'neutral', NORMAL: 'info', HARD: 'warning', EPIC: 'forest' };
const DIFFICULTY_ORDER: Quest['difficulty'][] = ['EASY', 'NORMAL', 'HARD', 'EPIC'];

/** Dificultades (fácil, normal, difícil, épica) en el idioma indicado. */
export function difficultiesFor(locale: Locale): { value: Quest['difficulty']; label: string; variant: BadgeVariant }[] {
  return DIFFICULTY_ORDER.map((value) => ({ value, label: DIFFICULTY_LABEL[locale][value], variant: DIFFICULTY_VARIANT[value] }));
}

export const difficultyMeta = (d: Quest['difficulty'], locale: Locale = 'es') => difficultiesFor(locale).find((x) => x.value === d) ?? difficultiesFor(locale)[1];

/** Progreso por subobjetivos. Sin pasos: 0 % activa, 100 % completada. */
export function questProgress(q: Quest, locale: Locale = 'es') {
  const en = locale === 'en';
  const total = q.subObjectives?.length ?? 0;
  const done = q.subObjectives?.filter((s) => s.completed).length ?? 0;
  if (q.status === 'COMPLETED') return { done: total, total, pct: 100, text: total ? (en ? `${total} of ${total} steps` : `${total} de ${total} pasos`) : (en ? 'Completed' : 'Completada') };
  if (!total) return { done: 0, total: 0, pct: 0, text: en ? 'No steps defined' : 'Sin pasos definidos' };
  return { done, total, pct: Math.round((done / total) * 100), text: en ? `${done} of ${total} steps` : `${done} de ${total} pasos` };
}

/** Lista para completar: todos los pasos hechos (o no tiene pasos). */
export const isReady = (q: Quest) => q.status === 'ACTIVE' && (q.subObjectives?.length ?? 0) > 0 && questProgress(q).pct >= 100;

export function deadlineInfo(deadline?: string, locale: Locale = 'es') {
  if (!deadline) return null;
  const en = locale === 'en';
  const d = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86_400_000);
  const date = d.toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'short' });
  if (days < 0) return { text: en ? `Overdue since ${date}` : `Venció el ${date}`, variant: 'error' as const };
  if (days === 0) return { text: en ? 'Due today' : 'Vence hoy', variant: 'warning' as const };
  if (days === 1) return { text: en ? 'Due tomorrow' : 'Vence mañana', variant: 'warning' as const };
  if (days <= 7) return { text: en ? `Due in ${days} days` : `Vence en ${days} días`, variant: 'info' as const };
  return { text: en ? `Due ${date}` : `Vence el ${date}`, variant: 'neutral' as const };
}

export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
