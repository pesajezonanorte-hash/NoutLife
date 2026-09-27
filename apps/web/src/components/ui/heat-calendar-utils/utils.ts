/** Five visual strengths. Zero is the neutral, no-activity cell. */
export const STEPS = [0, 24, 46, 70, 94] as const;

export const EMPTY = 'color-mix(in oklab, var(--text-primary) 5%, var(--bg-muted))';

/** Compact dimensions keep a 12-month chart useful on desktop and mobile. */
export const CELL = 12;
export const GAP = 3;
export const PITCH = CELL + GAP;
export const MONTH_ROW = 15;

export const DAYS = Array.from({ length: 7 }, (_, d) => ({ id: `day-${d}`, d }));

const dayFormat = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const monthFormat = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', month: 'short' });
const rangeFormat = new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' });

export function formatDay(date: Date) {
  return dayFormat.format(date);
}

export function formatMonth(date: Date) {
  return monthFormat.format(date).replace('.', '');
}

export function formatRange(date: Date) {
  return rangeFormat.format(date);
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Monday on or before `date`, so every column reads Monday through Sunday. */
export function mondayOf(date: Date) {
  return addDays(startOfDay(date), -((date.getUTCDay() + 6) % 7));
}
