import test from 'node:test';
import assert from 'node:assert/strict';
import type { Habit } from '@prisma/client';
import {
  firstHabitDay, habitBlockMinutes, habitGoogleEventBody, habitRecurrenceRule, habitTimeRangeError, hhmmToMinutes,
} from '../src/lib/habit-time';

/** Primera fecha UTC (clave de calendario) desde 2026-11-02 que cae en ese día de la semana. */
function dayOfWeek(weekday: number): Date {
  const day = new Date(Date.UTC(2026, 10, 2));
  while (day.getUTCDay() !== weekday) day.setUTCDate(day.getUTCDate() + 1);
  return day;
}

const habit = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'h1', title: 'Leer 20 páginas', description: null, category: 'LEARNING',
  reminderTime: null, reminderEndTime: null, frequency: { type: 'daily', days: [] }, ...overrides,
}) as unknown as Habit;

test('hhmmToMinutes: reads zero-padded 24-hour times and rejects anything else', () => {
  assert.equal(hhmmToMinutes('16:30'), 16 * 60 + 30);
  assert.equal(hhmmToMinutes('00:00'), 0);
  assert.equal(hhmmToMinutes('23:59'), 23 * 60 + 59);
  assert.equal(hhmmToMinutes('24:00'), null);
  assert.equal(hhmmToMinutes('12:60'), null);
  assert.equal(hhmmToMinutes('9:00'), null);
  assert.equal(hhmmToMinutes(''), null);
  assert.equal(hhmmToMinutes(null), null);
});

test('habit time range: the end must come after the start, and only when both are set', () => {
  assert.equal(habitTimeRangeError('16:30', '17:00'), null);
  assert.equal(habitTimeRangeError('16:30', '16:30'), 'HABIT_END_BEFORE_START');
  assert.equal(habitTimeRangeError('17:00', '16:30'), 'HABIT_END_BEFORE_START');
  assert.equal(habitTimeRangeError('16:30', null), null);
  assert.equal(habitTimeRangeError(null, '17:00'), null);
});

test('habit block: the end time is used when set, otherwise the block lasts 30 minutes', () => {
  assert.deepEqual(habitBlockMinutes('16:30', '17:00'), { start: 990, end: 1020 });
  assert.deepEqual(habitBlockMinutes('16:30', null), { start: 990, end: 1020 });
  assert.deepEqual(habitBlockMinutes('09:00', undefined), { start: 540, end: 570 });
  assert.equal(habitBlockMinutes(null, '17:00'), null);
});

test('first habit day: a daily habit starts today', () => {
  const today = dayOfWeek(2);
  assert.equal(firstHabitDay(today, { type: 'daily', days: [] }).getTime(), today.getTime());
  assert.equal(firstHabitDay(today, null).getTime(), today.getTime());
});

test('first habit day: a weekly series starts on the next selected weekday, never on an unselected one', () => {
  const tuesday = dayOfWeek(2);
  const wednesday = new Date(tuesday.getTime() + 86_400_000);
  const first = firstHabitDay(tuesday, { type: 'days_per_week', days: [1, 3, 5] });
  assert.equal(first.getUTCDay(), 3);
  assert.equal(first.getTime(), wednesday.getTime());
});

test('first habit day: a selected weekday today stays today, and the search is bounded to one week', () => {
  const monday = dayOfWeek(1);
  assert.equal(firstHabitDay(monday, { type: 'days_per_week', days: [1] }).getTime(), monday.getTime());
  const friday = dayOfWeek(5);
  const onlySunday = firstHabitDay(friday, { type: 'days_per_week', days: [0] });
  assert.equal(onlySunday.getUTCDay(), 0);
  assert.equal((onlySunday.getTime() - friday.getTime()) / 86_400_000, 2);
});

test('first habit day: an empty or invalid selection behaves like a daily habit', () => {
  const today = dayOfWeek(4);
  assert.equal(firstHabitDay(today, { type: 'days_per_week', days: [] }).getTime(), today.getTime());
  assert.equal(firstHabitDay(today, { type: 'days_per_week', days: [9, -1, 'x'] }).getTime(), today.getTime());
});

test('recurrence: weekly days are sorted and deduplicated, invalid ones are dropped; otherwise daily', () => {
  assert.deepEqual(habitRecurrenceRule({ type: 'days_per_week', days: [5, 1, 1, 0, 9] } as unknown as Habit['frequency']), ['RRULE:FREQ=WEEKLY;BYDAY=SU,MO,FR']);
  assert.deepEqual(habitRecurrenceRule({ type: 'daily', days: [] } as unknown as Habit['frequency']), ['RRULE:FREQ=DAILY']);
});

test('google event: a timed habit exports its own start and end time in the person timezone', () => {
  const body = habitGoogleEventBody(habit({ reminderTime: '16:30', reminderEndTime: '17:00' }), 'America/Bogota');
  assert.match(body.start.dateTime, /T16:30:00$/);
  assert.match(body.end.dateTime, /T17:00:00$/);
  assert.equal(body.start.dateTime.slice(0, 10), body.end.dateTime.slice(0, 10));
  assert.equal(body.start.timeZone, 'America/Bogota');
  assert.deepEqual(body.recurrence, ['RRULE:FREQ=DAILY']);
});

test('google event: without an end time the block lasts 30 minutes, as before', () => {
  const body = habitGoogleEventBody(habit({ reminderTime: '09:15', reminderEndTime: null }), 'America/Bogota');
  assert.match(body.start.dateTime, /T09:15:00$/);
  assert.match(body.end.dateTime, /T09:45:00$/);
});

test('google event: a block that runs past midnight ends the next day', () => {
  const body = habitGoogleEventBody(habit({ reminderTime: '23:30', reminderEndTime: null }), 'America/Bogota');
  const startDay = new Date(`${body.start.dateTime.slice(0, 10)}T00:00:00Z`);
  const endDay = new Date(`${body.end.dateTime.slice(0, 10)}T00:00:00Z`);
  assert.equal((endDay.getTime() - startDay.getTime()) / 86_400_000, 1);
  assert.match(body.end.dateTime, /T00:00:00$/);
});

test('google event: a weekly habit is one series with BYDAY on its days and starts on one of them', () => {
  const body = habitGoogleEventBody(
    habit({ reminderTime: '07:00', reminderEndTime: '07:20', frequency: { type: 'days_per_week', days: [1, 3, 5] } }),
    'America/Bogota',
  );
  assert.deepEqual(body.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR']);
  const weekday = new Date(`${body.start.dateTime.slice(0, 10)}T00:00:00Z`).getUTCDay();
  assert.ok([1, 3, 5].includes(weekday), `series starts on weekday ${weekday}`);
});

test('google event: a habit without a time is an all-day event that repeats daily', () => {
  const body = habitGoogleEventBody(habit(), 'America/Bogota');
  assert.equal(body.start.dateTime, undefined);
  const startDay = new Date(`${body.start.date}T00:00:00Z`);
  const endDay = new Date(`${body.end.date}T00:00:00Z`);
  assert.equal((endDay.getTime() - startDay.getTime()) / 86_400_000, 1);
  assert.deepEqual(body.recurrence, ['RRULE:FREQ=DAILY']);
});
