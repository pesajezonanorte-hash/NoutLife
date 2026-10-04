import { FolderKanban, ListTodo, Repeat, Target, type LucideIcon } from 'lucide-react';
import type { Quest } from '@lifequest/shared';
import type { BadgeVariant } from '@/components/ui/lq';

export const QUEST_TYPES: { value: 'SIDE' | 'MAIN' | 'META'; label: string; icon: LucideIcon; description: string }[] = [
  { value: 'SIDE', label: 'Tarea', icon: ListTodo, description: 'Un pendiente concreto' },
  { value: 'MAIN', label: 'Proyecto', icon: FolderKanban, description: 'Objetivo importante con etapas' },
  { value: 'META', label: 'Meta', icon: Target, description: 'A largo plazo, por pasos' },
];

export function typeMeta(type: Quest['type']) {
  return QUEST_TYPES.find((t) => t.value === type)
    ?? { value: type, label: type === 'DAILY' ? 'Diaria' : 'Semanal', icon: Repeat, description: '' };
}

export const DIFFICULTIES: { value: Quest['difficulty']; label: string; variant: BadgeVariant }[] = [
  { value: 'EASY', label: 'Fácil', variant: 'neutral' },
  { value: 'NORMAL', label: 'Normal', variant: 'info' },
  { value: 'HARD', label: 'Difícil', variant: 'warning' },
  { value: 'EPIC', label: 'Épica', variant: 'forest' },
];

export const difficultyMeta = (d: Quest['difficulty']) => DIFFICULTIES.find((x) => x.value === d) ?? DIFFICULTIES[1];

/** Progreso por subobjetivos. Sin pasos: 0 % activa, 100 % completada. */
export function questProgress(q: Quest) {
  const total = q.subObjectives?.length ?? 0;
  const done = q.subObjectives?.filter((s) => s.completed).length ?? 0;
  if (q.status === 'COMPLETED') return { done: total, total, pct: 100, text: total ? `${total} de ${total} pasos` : 'Completada' };
  if (!total) return { done: 0, total: 0, pct: 0, text: 'Sin pasos definidos' };
  return { done, total, pct: Math.round((done / total) * 100), text: `${done} de ${total} pasos` };
}

/** Lista para completar: todos los pasos hechos (o no tiene pasos). */
export const isReady = (q: Quest) => q.status === 'ACTIVE' && (q.subObjectives?.length ?? 0) > 0 && questProgress(q).pct >= 100;

export function deadlineInfo(deadline?: string) {
  if (!deadline) return null;
  const d = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - today.getTime()) / 86_400_000);
  const date = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  if (days < 0) return { text: `Venció el ${date}`, variant: 'error' as const };
  if (days === 0) return { text: 'Vence hoy', variant: 'warning' as const };
  if (days === 1) return { text: 'Vence mañana', variant: 'warning' as const };
  if (days <= 7) return { text: `Vence en ${days} días`, variant: 'info' as const };
  return { text: `Vence el ${date}`, variant: 'neutral' as const };
}

export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
