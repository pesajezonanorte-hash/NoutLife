import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createJournalSchema,
  createLearningSchema,
  createMealSchema,
  createSleepSchema,
  createWorkoutSchema,
} from '../src/schemas/activity.schemas';

const night = { bedtime: '2026-09-30T23:00', wakeTime: '2026-10-01T07:00', quality: 4 };
const ok = (schema: { safeParse(v: unknown): { success: boolean } }, value: unknown) => schema.safeParse(value).success;

test('sleep: accepts a normal night, rejects bad quality, duration and dates', () => {
  assert.ok(ok(createSleepSchema, night));
  assert.ok(ok(createSleepSchema, { ...night, bedtime: '2026-10-01T23:30', wakeTime: '2026-10-01T06:30' }), 'wraps past midnight');
  assert.ok(!ok(createSleepSchema, { ...night, quality: 99 }));
  assert.ok(!ok(createSleepSchema, { ...night, quality: 0 }));
  assert.ok(!ok(createSleepSchema, { ...night, wakeTime: night.bedtime }), '0 hours');
  assert.ok(!ok(createSleepSchema, { ...night, wakeTime: '2026-10-01T14:00' }), '15 hours');
  assert.ok(!ok(createSleepSchema, { ...night, bedtime: 'garbage' }));
  assert.ok(!ok(createSleepSchema, {}));
});

test('meals: requires a name and rejects negative macros', () => {
  assert.ok(ok(createMealSchema, { name: 'Arepa', mealType: 'LUNCH', calories: 350 }));
  assert.ok(!ok(createMealSchema, { mealType: 'LUNCH' }));
  assert.ok(!ok(createMealSchema, { name: 'Arepa', mealType: 'LUNCH', calories: -300 }));
  assert.ok(!ok(createMealSchema, { name: 'Arepa', mealType: 'LUNCH', protein: -1 }));
});

test('journal, workouts and learning reject empty input', () => {
  assert.ok(ok(createJournalSchema, { content: 'Hoy entrené', mood: 4, tags: [] }));
  assert.ok(!ok(createJournalSchema, { content: '' }));
  assert.ok(!ok(createJournalSchema, { content: '   ' }));
  assert.ok(ok(createWorkoutSchema, { title: 'Pierna' }));
  assert.ok(!ok(createWorkoutSchema, {}));
  assert.ok(ok(createLearningSchema, { type: 'BOOK', title: 'Atomic Habits', totalProgress: 320 }));
  assert.ok(!ok(createLearningSchema, {}));
});
