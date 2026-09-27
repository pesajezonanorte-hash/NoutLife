"use client";
// Adapted for LifeQuest from the composable beui.dev heat-calendar API.

import { cn } from '@/lib/utils';
import { TooltipProvider } from './tooltip';
import { HeatCalendarContext, useHeatCalendarModel } from './heat-calendar-utils/context';
import { HeatCalendarGrid } from './heat-calendar-utils/grid';
import { HeatCalendarLegend } from './heat-calendar-utils/legend';
import { HeatCalendarTooltip } from './heat-calendar-utils/tooltip';
import type { HeatCalendarProps } from './heat-calendar-utils/types';

/** Compose Grid, Tooltip and Legend, or omit children for the complete chart. */
export function HeatCalendar({ children, className, ...props }: HeatCalendarProps) {
  const model = useHeatCalendarModel(props);

  return (
    <HeatCalendarContext.Provider value={model}>
      <TooltipProvider delayDuration={120} skipDelayDuration={0}>
        <div className={cn('w-fit max-w-full', className)}>
          {children === undefined ? (
            <>
              <HeatCalendarGrid>
                <HeatCalendarTooltip />
              </HeatCalendarGrid>
              <HeatCalendarLegend />
            </>
          ) : children}
        </div>
      </TooltipProvider>
    </HeatCalendarContext.Provider>
  );
}

export { useHeatCalendar } from './heat-calendar-utils/context';
export { HeatCalendarGrid } from './heat-calendar-utils/grid';
export { HeatCalendarLegend } from './heat-calendar-utils/legend';
export { HeatCalendarTooltip } from './heat-calendar-utils/tooltip';
export type {
  HeatCalendarCell,
  HeatCalendarProps,
  HeatCalendarSelection,
} from './heat-calendar-utils/types';

export default HeatCalendar;
