import test from 'node:test';
import assert from 'node:assert/strict';
import { monthDueKey } from '../src/lib/smart-reminders';

const key = (date: Date) => date.toISOString().slice(0, 10);

test('monthDueKey: a bill day that the month does not have falls on the last day of that month', () => {
  assert.equal(key(monthDueKey(2027, 1, 31)), '2027-02-28');
  assert.equal(key(monthDueKey(2028, 1, 31)), '2028-02-29');
  assert.equal(key(monthDueKey(2027, 3, 31)), '2027-04-30');
  assert.equal(key(monthDueKey(2027, 0, 31)), '2027-01-31');
});

test('monthDueKey: an ordinary day stays on that day, at UTC midnight (a calendar key)', () => {
  const due = monthDueKey(2026, 10, 15);
  assert.equal(key(due), '2026-11-15');
  assert.equal(due.getUTCHours(), 0);
});

test('monthDueKey: next month rolls over the year end, so a day-1 bill is found from the last day of December', () => {
  // Hoy es 31 de diciembre de 2026: el recibo del día 1 vence mañana (1 de enero de 2027).
  const today = Date.UTC(2026, 11, 31);
  const next = monthDueKey(2026, 12, 1);
  assert.equal(key(next), '2027-01-01');
  assert.equal(Math.round((next.getTime() - today) / 86_400_000), 1);
});
