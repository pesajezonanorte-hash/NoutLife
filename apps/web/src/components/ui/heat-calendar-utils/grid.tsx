"use client";

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useHeatCalendar } from './context';
import { DAYS, GAP, MONTH_ROW, PITCH, formatDay } from './utils';

export function HeatCalendarGrid({ children, className }: { children?: ReactNode; className?: string }) {
  const {
    weeks,
    reduceMotion,
    selection,
    filterLevel,
    setHover,
    level,
    bucket,
    fill,
    count,
    dateOf,
    future,
    columns,
    select,
    clear,
    span,
    unit,
  } = useHeatCalendar();

  return (
    <div className="relative max-w-full" onPointerLeave={() => setHover(null)}>
      <div
        className={cn('grid', className)}
        style={{
          width: weeks * PITCH - GAP,
          gridTemplateColumns: `repeat(${weeks}, 12px)`,
          gridTemplateRows: `${MONTH_ROW}px repeat(7, 12px)`,
          gap: GAP,
        }}
        aria-label="Calendario de actividad"
      >
        {columns.map((column) => (
          column.label ? (
            <span
              key={column.id}
              className="whitespace-nowrap text-[10px] leading-none text-[var(--text-muted)]"
              style={{ gridColumn: column.w + 1, gridRow: 1 }}
            >
              {column.label}
            </span>
          ) : null
        ))}

        {columns.flatMap(({ id, w }) => DAYS.map(({ id: dayId, d }) => {
          const date = dateOf(w, d);
          if (future(w, d)) return null;

          const value = level(w, d);
          const step = bucket(value);
          const index = w * 7 + d;
          const isRangeBoundary = span !== null && (index === span.lo || index === span.hi);
          const isPinned = selection?.start.w === w && selection.start.d === d;
          const inRange = span !== null && index >= span.lo && index <= span.hi;
          const isDimmed = (filterLevel !== null && filterLevel !== step) || (span !== null && !inRange);
          const activity = count(value);
          const activityLabel = `${activity} ${unit}${activity === 1 ? '' : ''}`;

          return (
            <span
              key={`${id}-${dayId}`}
              className="relative block h-3 w-3"
              style={{
                gridColumn: w + 1,
                gridRow: d + 2,
                opacity: isDimmed ? 0.24 : 1,
                transition: 'opacity 150ms ease',
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    type="button"
                    aria-label={`${activityLabel}, ${formatDay(date)}`}
                    aria-pressed={isPinned || isRangeBoundary}
                    onPointerEnter={() => setHover({ w, d })}
                    onFocus={() => setHover({ w, d })}
                    onClick={() => select({ w, d })}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') clear();
                    }}
                    className="absolute inset-0 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-panel)]"
                    style={{
                      background: fill(step),
                      boxShadow: isRangeBoundary || isPinned
                        ? '0 0 0 1px var(--bg-panel), 0 0 0 2px var(--accent-gold)'
                        : 'none',
                    }}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.18, delay: Math.min((w + d) * 0.008, 0.2) }}
                    whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" align="center" className="text-center">
                  <p className="font-semibold tabular-nums text-[var(--text-primary)]">{activityLabel}</p>
                  <p className="mt-0.5 capitalize text-[11px] text-[var(--text-muted)]">{formatDay(date)}</p>
                </TooltipContent>
              </Tooltip>
            </span>
          );
        }))}
      </div>
      {children}
    </div>
  );
}
