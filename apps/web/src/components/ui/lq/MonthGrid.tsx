import { cn } from '@/lib/utils';
import { solidBg, type Tone } from './tones';

export interface MonthGridProps {
  /** Cualquier fecha del mes a mostrar. */
  month: Date;
  selected?: Date;
  onSelect: (date: Date) => void;
  /** Tonos de los puntos de cada día (máx. 3 visibles). */
  dots?: (date: Date) => Tone[];
  /** Texto para lectores de pantalla: "3 eventos". */
  describe?: (date: Date) => string;
  className?: string;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Mes en rejilla de 7 columnas (semana desde el lunes). Cada día es un botón aria-pressed; hoy con anillo primary. */
export function MonthGrid({ month, selected, onSelect, dots, describe, className }: MonthGridProps) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const offset = (new Date(year, m, 1).getDay() + 6) % 7;
  const total = new Date(year, m + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => new Date(year, m, i + 1))];
  const today = new Date();

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div aria-hidden className="grid grid-cols-7 gap-1.5 md:gap-2">
        {DOW.map((d) => <span key={d} className="text-center text-label-md text-on-surface-light">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {cells.map((day, i) => {
          if (!day) return <span key={i} aria-hidden />;
          const tones = dots?.(day) ?? [];
          const isSel = !!selected && sameDay(day, selected);
          const isToday = sameDay(day, today);
          const long = day.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
          return (
            <button
              key={i}
              type="button"
              aria-pressed={isSel}
              aria-current={isToday ? 'date' : undefined}
              aria-label={`${long}${describe ? `, ${describe(day)}` : ''}`}
              onClick={() => onSelect(day)}
              className={cn(
                'flex min-h-11 flex-col justify-between rounded-xl p-1.5 text-left transition-colors md:aspect-[1.3] md:p-2',
                isSel ? 'bg-primary/[var(--lq-soft-alpha)]' : 'bg-surface-variant hover:bg-border',
                isToday && 'ring-2 ring-primary',
              )}
            >
              <span aria-hidden className={cn('font-mono text-label-lg tabular-nums', isSel && 'text-primary-text')}>{day.getDate()}</span>
              <span aria-hidden className="flex gap-[3px]">
                {tones.slice(0, 3).map((t, k) => <span key={k} className={cn('size-1.5 rounded-full', solidBg[t])} />)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
