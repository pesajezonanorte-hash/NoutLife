"use client";

import { cn } from '@/lib/utils';
import { useHeatCalendar } from './context';
import { STEPS, formatRange } from './utils';

export function HeatCalendarLegend({ className }: { className?: string }) {
  const { start, end, filterLevel, setFilterLevel, fill, selection, tooltip } = useHeatCalendar();
  const rangeLabel = selection?.end && tooltip
    ? `${formatRange(tooltip.startDate)} – ${formatRange(tooltip.endDate)} · ${tooltip.total} registros`
    : `${formatRange(start)} – ${formatRange(end)}`;

  return (
    <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-3', className)}>
      <span className="text-xs text-[var(--text-muted)]">{rangeLabel}</span>
      <span className="flex items-center gap-1" onPointerLeave={() => setFilterLevel(null)}>
        <span className="mr-0.5 text-xs text-[var(--text-muted)]">Menos</span>
        {STEPS.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Filtrar nivel de actividad ${index}`}
            aria-pressed={filterLevel === index}
            onPointerEnter={() => setFilterLevel(index)}
            onFocus={() => setFilterLevel(index)}
            onBlur={() => setFilterLevel(null)}
            onClick={() => setFilterLevel(filterLevel === index ? null : index)}
            className="h-3 w-3 rounded-[3px] border border-transparent transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
            style={{
              background: fill(index),
              borderColor: index === 0 ? 'var(--border)' : 'transparent',
              boxShadow: filterLevel === index ? '0 0 0 1px var(--text-primary)' : 'none',
            }}
          />
        ))}
        <span className="ml-0.5 text-xs text-[var(--text-muted)]">Más</span>
      </span>
    </div>
  );
}
