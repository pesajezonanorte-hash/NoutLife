"use client";

import { useReducedMotionConfig } from 'framer-motion';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { HeatCalendarCell, HeatCalendarProps, HeatCalendarSelection } from './types';
import { addDays, EMPTY, formatMonth, mondayOf, startOfDay, STEPS } from './utils';

export interface HeatCalendarTooltipData {
  date: Date;
  count: number;
  total: number;
  startDate: Date;
  endDate: Date;
  days: number;
}

interface HeatCalendarColumn {
  id: string;
  w: number;
  month: number;
  label: string | null;
}

interface HeatCalendarModel {
  unit: string;
  weeks: number;
  reduceMotion: boolean;
  hover: HeatCalendarCell | null;
  setHover: (cell: HeatCalendarCell | null) => void;
  selection: HeatCalendarSelection | null;
  setSelection: (selection: HeatCalendarSelection | null) => void;
  filterLevel: number | null;
  setFilterLevel: (level: number | null) => void;
  start: Date;
  end: Date;
  columns: HeatCalendarColumn[];
  level: (week: number, day: number) => number;
  bucket: (value: number) => number;
  fill: (bucket: number) => string;
  count: (value: number) => number;
  dateOf: (week: number, day: number) => Date;
  future: (week: number, day: number) => boolean;
  select: (cell: HeatCalendarCell) => void;
  clear: () => void;
  span: { lo: number; hi: number } | null;
  active: HeatCalendarCell | null;
  tooltip: HeatCalendarTooltipData | null;
}

/**
 * Shared behaviour for the composable calendar. The component accepts a
 * controlled selection but also works on its own: one click pins a day,
 * another click closes a range, and a final click clears it.
 */
export function useHeatCalendarModel({
  unit = 'registros',
  weeks = 53,
  maxCount = 1,
  values,
  endDate,
  color = 'var(--accent-gold)',
  selection: controlledSelection,
  defaultSelection = null,
  onSelectionChange,
}: HeatCalendarProps): HeatCalendarModel {
  const reduced = useReducedMotionConfig() ?? false;
  const [hover, setHover] = useState<HeatCalendarCell | null>(null);
  const [internalSelection, setInternalSelection] = useState<HeatCalendarSelection | null>(defaultSelection);
  const [filterLevel, setFilterLevel] = useState<number | null>(null);

  const end = useMemo(() => startOfDay(endDate ?? new Date()), [endDate]);
  const start = useMemo(() => addDays(mondayOf(end), -(weeks - 1) * 7), [end, weeks]);
  const requestedSelection = controlledSelection === undefined ? internalSelection : controlledSelection;

  const level = useCallback((week: number, day: number) => {
    const value = values?.[week]?.[day] ?? 0;
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  }, [values]);

  const bucket = useCallback((value: number) => {
    if (value <= 0) return 0;
    return Math.min(4, Math.ceil(value * 4));
  }, []);

  const fill = useCallback((step: number) => {
    if (step === 0) return EMPTY;
    return `color-mix(in oklab, ${color} ${STEPS[step]}%, var(--bg-muted))`;
  }, [color]);

  const count = useCallback((value: number) => Math.round(value * Math.max(1, maxCount)), [maxCount]);
  const dateOf = useCallback((week: number, day: number) => addDays(start, week * 7 + day), [start]);
  const future = useCallback((week: number, day: number) => dateOf(week, day) > end, [dateOf, end]);

  const validCell = useCallback((cell: HeatCalendarCell) => (
    Number.isInteger(cell.w)
    && Number.isInteger(cell.d)
    && cell.w >= 0
    && cell.w < weeks
    && cell.d >= 0
    && cell.d < 7
    && !future(cell.w, cell.d)
  ), [future, weeks]);

  const selection = useMemo(() => {
    if (!requestedSelection || !validCell(requestedSelection.start)) return null;
    if (requestedSelection.end && !validCell(requestedSelection.end)) return null;
    return requestedSelection;
  }, [requestedSelection, validCell]);

  const setSelection = useCallback((next: HeatCalendarSelection | null) => {
    if (controlledSelection === undefined) setInternalSelection(next);
    onSelectionChange?.(next);
  }, [controlledSelection, onSelectionChange]);

  const cellIndex = useCallback((cell: HeatCalendarCell) => cell.w * 7 + cell.d, []);
  const anchor = selection?.start ?? null;
  const rangeEnd = selection?.end ?? (anchor ? (hover ?? anchor) : null);
  const span = anchor && rangeEnd
    ? { lo: Math.min(cellIndex(anchor), cellIndex(rangeEnd)), hi: Math.max(cellIndex(anchor), cellIndex(rangeEnd)) }
    : null;

  const selectedTotal = useMemo(() => {
    if (!span) return 0;
    let total = 0;
    for (let index = span.lo; index <= span.hi; index += 1) {
      const week = Math.floor(index / 7);
      const day = index % 7;
      if (future(week, day)) break;
      total += count(level(week, day));
    }
    return total;
  }, [count, future, level, span]);

  const active = hover ?? selection?.end ?? anchor;
  const tooltip = active
    ? {
      date: dateOf(active.w, active.d),
      count: count(level(active.w, active.d)),
      total: selectedTotal,
      startDate: span ? dateOf(Math.floor(span.lo / 7), span.lo % 7) : dateOf(active.w, active.d),
      endDate: span ? dateOf(Math.floor(span.hi / 7), span.hi % 7) : dateOf(active.w, active.d),
      days: span ? span.hi - span.lo + 1 : 1,
    }
    : null;

  const clear = useCallback(() => setSelection(null), [setSelection]);
  const select = useCallback((cell: HeatCalendarCell) => {
    if (!validCell(cell)) return;
    if (selection?.end) {
      clear();
      return;
    }
    if (anchor && cellIndex(anchor) === cellIndex(cell)) {
      clear();
      return;
    }
    if (anchor) {
      setSelection({ start: anchor, end: cell });
      return;
    }
    setSelection({ start: cell });
  }, [anchor, cellIndex, clear, selection?.end, setSelection, validCell]);

  const columns = useMemo<HeatCalendarColumn[]>(() => Array.from({ length: weeks }, (_, w) => {
    const date = dateOf(w, 0);
    const previous = w > 0 ? dateOf(w - 1, 0) : null;
    const label = !previous || previous.getUTCMonth() !== date.getUTCMonth() ? formatMonth(date) : null;
    return { id: `week-${w}`, w, month: date.getUTCMonth(), label };
  }), [dateOf, weeks]);

  return {
    unit,
    weeks,
    reduceMotion: reduced,
    hover,
    setHover,
    selection,
    setSelection,
    filterLevel,
    setFilterLevel,
    start,
    end,
    columns,
    level,
    bucket,
    fill,
    count,
    dateOf,
    future,
    select,
    clear,
    span,
    active,
    tooltip,
  };
}

export const HeatCalendarContext = createContext<HeatCalendarModel | null>(null);

/** Access the model from one of HeatCalendar's composable descendants. */
export function useHeatCalendar() {
  const context = useContext(HeatCalendarContext);
  if (!context) throw new Error('HeatCalendar parts must be rendered inside HeatCalendar.');
  return context;
}
