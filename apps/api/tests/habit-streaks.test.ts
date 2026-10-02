import assert from 'node:assert/strict';
import test from 'node:test';
import { addCalendarDays } from '../src/lib/calendar';
import { computeHabitStreaks } from '../src/services/habit.service';

const today = new Date(Date.UTC(2026, 9, 2)); // Friday
const daily = { type: 'daily', days: [] };
const monWedFri = { type: 'days_per_week', days: [1, 3, 5] };
const log = (daysAgo: number, status: 'completed' | 'failed' | 'skipped' = 'completed') =>
  ({ date: addCalendarDays(today, -daysAgo), completed: status === 'completed', status });
const range = (from: number, to: number) => Array.from({ length: from - to + 1 }, (_, i) => from - i);

test('30 backfilled days give a 30-day streak', () => {
  assert.deepEqual(computeHabitStreaks(range(29, 0).map((d) => log(d)), daily, today), { current: 30, longest: 30 });
});

test('a missed day splits the run', () => {
  const logs = range(29, 0).filter((d) => d !== 10).map((d) => log(d));
  assert.deepEqual(computeHabitStreaks(logs, daily, today), { current: 10, longest: 19 });
});

test('today still pending keeps the streak; skipped keeps it; failed breaks it', () => {
  const logs = range(29, 1).map((d) => log(d, d === 3 ? 'failed' : d === 5 ? 'skipped' : 'completed'));
  assert.deepEqual(computeHabitStreaks(logs, daily, today), { current: 2, longest: 25 });
});

test('weekly habits ignore unscheduled days', () => {
  // Mon/Wed/Fri of the last two weeks: 2026-09-21 .. 2026-10-02 → 6 sessions.
  const logs = [11, 9, 7, 4, 2, 0].map((d) => log(d));
  assert.deepEqual(computeHabitStreaks(logs, monWedFri, today), { current: 6, longest: 6 });
  // Missing Wednesday 2026-09-30 breaks it.
  assert.equal(computeHabitStreaks([11, 9, 7, 4, 0].map((d) => log(d)), monWedFri, today).current, 1);
});

test('no logs means no streak', () => {
  assert.deepEqual(computeHabitStreaks([], daily, today), { current: 0, longest: 0 });
});
