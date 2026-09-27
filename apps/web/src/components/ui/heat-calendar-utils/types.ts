import type { ReactNode } from 'react';

/** Zero-based week and Monday-first weekday coordinate inside a heat calendar. */
export type HeatCalendarCell = { w: number; d: number };

export interface HeatCalendarSelection {
  start: HeatCalendarCell;
  end?: HeatCalendarCell;
}

export interface HeatCalendarProps {
  /** Noun shown beside an activity count, for example "hábitos". */
  unit?: string;
  /** Number of Monday-to-Sunday columns to render. */
  weeks?: number;
  /** Count represented by an intensity of 1. */
  maxCount?: number;
  /** `values[week][day]` intensities from 0 to 1. Missing values are zero. */
  values?: number[][];
  /** Last UTC calendar day in the grid. Defaults to today. */
  endDate?: Date;
  /** A single semantic hue. Activity magnitude changes its strength, not its color. */
  color?: string;
  className?: string;
  children?: ReactNode;
  /** Controlled date or date-range selection. */
  selection?: HeatCalendarSelection | null;
  defaultSelection?: HeatCalendarSelection | null;
  onSelectionChange?: (selection: HeatCalendarSelection | null) => void;
}
