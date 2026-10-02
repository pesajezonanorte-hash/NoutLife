import assert from 'node:assert/strict';
import test from 'node:test';
import { getCalendarDay } from '../src/lib/calendar';
import { workoutDate } from '../src/services/workout.service';

test('a calendar-key workout date keeps its day in the player timezone', () => {
  for (const tz of ['America/Bogota', 'America/Los_Angeles', 'Europe/Madrid', 'Asia/Tokyo']) {
    assert.equal(getCalendarDay(tz, workoutDate('2026-09-07')).toISOString().slice(0, 10), '2026-09-07', tz);
  }
});

test('instants are kept as given and no date means now', () => {
  assert.equal(workoutDate('2026-09-07T22:30:00.000Z').toISOString(), '2026-09-07T22:30:00.000Z');
  assert.ok(Math.abs(workoutDate().getTime() - Date.now()) < 1000);
});
