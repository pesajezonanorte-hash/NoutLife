"use client";

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useHeatCalendar, type HeatCalendarTooltipData } from './context';
import { formatDay, formatRange } from './utils';

interface Props {
  /** Optional content for assistive technology announcements. */
  children?: ReactNode | ((data: HeatCalendarTooltipData) => ReactNode);
  className?: string;
}

/**
 * Cells render the visual Radix tooltip so it can follow the trigger naturally.
 * This companion keeps hover and pinned selections available to screen readers
 * and preserves the public composable API of the original component.
 */
export function HeatCalendarTooltip({ children, className }: Props) {
  const { tooltip, unit } = useHeatCalendar();

  if (!tooltip) return <span className="sr-only" aria-live="polite" />;

  const defaultCopy = tooltip.days > 1
    ? `${tooltip.total} ${unit} del ${formatRange(tooltip.startDate)} al ${formatRange(tooltip.endDate)}.`
    : `${tooltip.count} ${unit}, ${formatDay(tooltip.date)}.`;
  const content = typeof children === 'function' ? children(tooltip) : (children ?? defaultCopy);

  return (
    <span className={cn('sr-only', className)} role="status" aria-live="polite">
      {content}
    </span>
  );
}
