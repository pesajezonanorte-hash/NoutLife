import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item } from '@/lib/motion';
import { CheckButton, IconChip } from '@/components/ui/lq';
import { resolveGlyph } from '@/components/ui/glyphs';
import { categoryMeta, frequencyLabel } from '@/lib/lifeMeta';
import type { HabitFrequency } from '@/services/habit.service';

export interface HabitItemData {
  id: string;
  title: string;
  icon?: string;
  category?: string;
  currentStreak: number;
  todayCompleted?: boolean | null;
  todayStatus?: string | null;
  frequency?: HabitFrequency;
  reminderTime?: string;
}

export interface HabitListItemProps {
  habit: HabitItemData;
  onComplete: () => void;
  pending?: boolean;
  /** Últimos 7 días (L→hoy) para los puntos semanales en md+. */
  week?: boolean[];
  /** 'card' = tarjeta propia (listas); 'row' = fila dentro de otra Card (Dashboard desktop). */
  variant?: 'card' | 'row';
}

/**
 * Fila de hábito (Habits.dc.html / HabitsDesktop): IconChip por categoría,
 * nombre → detalle, racha (ícono + texto), puntos de la semana y check 48 px.
 */
export function HabitListItem({ habit, onComplete, pending, week, variant = 'card' }: HabitListItemProps) {
  const meta = categoryMeta(habit.category);
  const done = Boolean(habit.todayCompleted) || habit.todayStatus === 'completed';
  const skipped = habit.todayStatus === 'skipped';
  const weekDone = week?.filter(Boolean).length ?? 0;
  const sub = [meta.label, habit.frequency ? frequencyLabel(habit.frequency).toLowerCase() : null, habit.reminderTime].filter(Boolean).join(' · ');

  return (
    <motion.li
      variants={item}
      className={cn(
        'flex items-center gap-4',
        variant === 'card' ? 'lq-lift rounded-2xl border border-border bg-surface py-3 pl-4 pr-3 shadow-sm md:gap-6 md:py-4 md:pl-6 md:pr-4' : 'py-2',
      )}
    >
      <IconChip icon={resolveGlyph(habit.icon)} tone={meta.tone} />
      <Link to={`/habits/${habit.id}`} className="flex min-h-12 min-w-0 flex-1 flex-col justify-center rounded-lg">
        <span className={cn('truncate text-on-background', variant === 'card' ? 'text-body-md font-semibold md:text-heading-sm' : 'text-body-md font-semibold')}>
          {habit.title}
        </span>
        {variant === 'card' && <span className="hidden truncate text-body-sm text-on-surface-light md:block">{sub}</span>}
        <span className={cn('flex items-center gap-1 text-body-sm text-warning-text tabular-nums', variant === 'card' && 'md:hidden')}>
          <Flame aria-hidden className="size-4" strokeWidth={1.75} />
          {habit.currentStreak} {habit.currentStreak === 1 ? 'día' : 'días'}
          {skipped && <span className="ml-1 text-on-surface-light">· omitido hoy</span>}
        </span>
      </Link>
      {variant === 'card' && (
        <div className="hidden shrink-0 flex-col items-end gap-1.5 md:flex">
          {week && (
            <span className="flex items-center gap-2">
              <span className="flex gap-1" role="img" aria-label={`${weekDone} de 7 días completados esta semana`}>
                {week.map((d, i) => (
                  <span key={i} className={cn('size-2.5 rounded-[3px]', d ? 'bg-success' : 'bg-surface-variant')} />
                ))}
              </span>
              <span aria-hidden className="text-label-md text-on-surface-light tabular-nums">{weekDone}/7</span>
            </span>
          )}
          <span className="flex items-center gap-1 text-body-sm text-warning-text tabular-nums">
            <Flame aria-hidden className="size-4" strokeWidth={1.75} />
            {habit.currentStreak} {habit.currentStreak === 1 ? 'día' : 'días'}
          </span>
        </div>
      )}
      {/* TODO(api): no hay endpoint para deshacer un registro; una vez completado el check queda bloqueado. */}
      <CheckButton name={habit.title} checked={done} locked disabled={pending} onToggle={onComplete} />
    </motion.li>
  );
}
