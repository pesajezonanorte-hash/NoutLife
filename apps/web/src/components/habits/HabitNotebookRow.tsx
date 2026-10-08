// Hábito como una línea anotada en la libreta: el ícono vive en el margen, el
// texto aparece como escrito, la racha se lleva con marcas de conteo y el check
// se traza con tinta. Al entrar, la línea de la hoja se dibuja y el texto se
// escribe; al pasar el cursor, un marcador subraya el nombre; al presionar, la
// línea se inclina un poco, como el papel bajo el lápiz.
import { useState, type CSSProperties } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { IconChip } from '@/components/ui/lq';
import { resolveGlyph } from '@/components/ui/glyphs';
import { TallyMarks } from '@/components/ambience';
import { categoryMeta, frequencyLabel } from '@/lib/lifeMeta';
import type { HabitItemData } from './HabitListItem';
import { InkCheckButton } from './InkCheckButton';

const row: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};
const rule: Variants = {
  initial: { scaleX: 0 },
  animate: { scaleX: 1, transition: { ...springs.gentle, mass: 0.8 } },
};

export interface HabitNotebookRowProps {
  habit: HabitItemData;
  onComplete: () => void;
  pending?: boolean;
  /** Últimos 7 días (L→hoy). */
  week?: boolean[];
  /** Posición en la lista: escalona la escritura. */
  index: number;
}

export function HabitNotebookRow({ habit, onComplete, pending, week, index }: HabitNotebookRowProps) {
  const meta = categoryMeta(habit.category);
  const done = Boolean(habit.todayCompleted) || habit.todayStatus === 'completed';
  const skipped = habit.todayStatus === 'skipped';
  const weekDone = week?.filter(Boolean).length ?? 0;
  const sub = [meta.label, habit.frequency ? frequencyLabel(habit.frequency).toLowerCase() : null, habit.reminderTime].filter(Boolean).join(' · ');
  // La escritura se quita al terminar: una máscara residual recortaría el anillo de foco.
  const [written, setWritten] = useState(false);
  const days = `${habit.currentStreak} ${habit.currentStreak === 1 ? 'día' : 'días'}`;

  return (
    <motion.li
      variants={row}
      // Presionar inclina un poco la línea (CSS :active; whileTap haría enfocable el <li>).
      className="group relative grid transition-transform duration-[325ms] ease-[var(--lq-ease-snappy)] active:-rotate-[0.45deg] active:scale-[.997] [.reduce-motion_&]:active:transform-none min-h-[calc(var(--lq-rule)*2)] grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-x-3 pr-2 md:grid-cols-[5rem_minmax(0,1fr)_auto_auto] md:gap-x-5 md:pr-4"
    >
      {/* Línea de la hoja bajo el hábito */}
      <motion.span aria-hidden="true" variants={rule} className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-info/25" />
      <span className="flex justify-center">
        <IconChip icon={resolveGlyph(habit.icon)} tone={meta.tone} size="sm" />
      </span>
      <div
        className={cn('flex min-w-0 flex-col gap-0.5 py-3', !written && 'lq-write')}
        style={{ '--delay': `${280 + index * 70}ms`, '--d': '560ms' } as CSSProperties}
        onAnimationEnd={(e) => { if (e.animationName === 'lq-write') setWritten(true); }}
      >
        <Link to={`/habits/${habit.id}`} className="relative flex min-h-11 min-w-0 items-center self-start rounded-md">
          {/* Marcador: subraya el nombre al pasar el cursor o al enfocar */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-[-4px] bottom-1.5 top-[45%] origin-left scale-x-0 rounded-[3px] bg-warning/25 transition-transform duration-[560ms] ease-[var(--lq-ease-natural)] group-hover:scale-x-100 group-focus-within:scale-x-100 [.reduce-motion_&]:transition-none" />
          <span className={cn('relative truncate text-body-md font-semibold md:text-heading-sm', done ? 'text-on-surface' : 'text-on-background')}>
            {habit.title}
          </span>
        </Link>
        <span className="hidden truncate text-body-sm text-on-surface-light md:block">{sub}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm">
          <span className="flex items-center gap-1 font-mono tabular-nums text-warning-text">
            <Flame aria-hidden className="size-4" strokeWidth={1.75} />
            {days}
          </span>
          {habit.currentStreak > 0 && <TallyMarks count={habit.currentStreak} />}
          {skipped && <span className="text-on-surface-light">· omitido hoy</span>}
        </span>
      </div>
      {week && (
        <span className="hidden items-center gap-2 md:flex">
          <span className="flex gap-1" role="img" aria-label={`${weekDone} de 7 días completados esta semana`}>
            {week.map((d, i) => (
              <span key={i} className={cn('size-2.5 rounded-[3px] border', d ? 'border-success bg-success' : 'border-border-strong/40 bg-transparent')} />
            ))}
          </span>
          <span aria-hidden className="text-label-md text-on-surface-light font-mono tabular-nums">{weekDone}/7</span>
        </span>
      )}
      <InkCheckButton name={habit.title} checked={done} pending={pending} onToggle={onComplete} />
    </motion.li>
  );
}
