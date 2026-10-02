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

test('profile and important dates reject empty names', async () => {
  const { updateProfileSchema, importantDateSchema } = await import('../src/schemas/activity.schemas');
  const { createQuestSchema } = await import('../src/schemas/quest.schemas');
  assert.ok(ok(updateProfileSchema, { displayName: 'Miguel', avatarUrl: null }));
  assert.ok(!ok(updateProfileSchema, { displayName: '  ' }));
  assert.ok(ok(importantDateSchema, { label: 'Aniversario', date: '2026-11-14' }));
  assert.ok(!ok(importantDateSchema, { date: '2026-11-14' }));
  const quest = { title: 'Q', type: 'SIDE', difficulty: 'EASY', category: 'PERSONAL' };
  assert.ok(ok(createQuestSchema, { ...quest, deadline: '' }));
  assert.ok(ok(createQuestSchema, { ...quest, deadline: '2026-10-10' }));
  assert.ok(!ok(createQuestSchema, { ...quest, deadline: 'mañana' }));
});

test('default validation messages are in Spanish', async () => {
  await import('../src/middleware/validate.middleware');
  const { createHabitSchema } = await import('../src/schemas/habit.schemas');
  const { createWorkoutSchema: workout } = await import('../src/schemas/activity.schemas');
  const messages = (r: { success: boolean; error?: { errors: { message: string }[] } }) => r.error?.errors.map((e) => e.message) ?? [];
  assert.deepEqual(messages(workout.safeParse({})), ['Este campo es obligatorio.']);
  assert.deepEqual(messages(createHabitSchema.safeParse({ title: '', category: 'HEALTH' })), ['Este campo no puede estar vacío.']);
  assert.match(messages(createHabitSchema.safeParse({ title: 'x', category: 'NOPE' }))[0], /^Valor no válido\. Opciones: HEALTH/);
  assert.deepEqual(messages(createHabitSchema.safeParse({ title: 'x', category: 'HEALTH', color: 'red' })), ['El formato no es válido.']);
});
