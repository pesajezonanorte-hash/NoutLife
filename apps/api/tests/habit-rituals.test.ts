import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import {
  cleanStepTitles, markHabitDoneFromCare, syncHabitToCare, syncRoutineToHabit, MAX_RITUAL_STEPS,
} from '../src/services/habit-rituals.service';

type Client = Record<string, unknown>;
const client = prisma as unknown as Client;

async function withMocks<T>(mocks: Client, run: () => Promise<T>): Promise<T> {
  const original = new Map<string, unknown>();
  for (const [key, value] of Object.entries(mocks)) {
    original.set(key, client[key]);
    client[key] = value;
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of original) client[key] = value;
  }
}

const day = new Date('2026-10-16T00:00:00.000Z');

test('step titles are trimmed, non-empty and capped', () => {
  assert.deepEqual(cleanStepTitles(['  Meditar ', '', '   ', 'Tomar agua']), ['Meditar', 'Tomar agua']);
  const many = Array.from({ length: MAX_RITUAL_STEPS + 5 }, (_, i) => `Paso ${i}`);
  assert.equal(cleanStepTitles(many).length, MAX_RITUAL_STEPS);
  assert.deepEqual(cleanStepTitles(undefined), []);
});

test('a Higiene Personal habit creates a linked Espejo routine with the same steps', async () => {
  const calls: { routine?: unknown; link?: unknown } = {};
  await withMocks({
    habit: {
      findFirst: async () => ({
        id: 'h1', userId: 'u1', title: 'Ritual nocturno', category: 'HYGIENE', isActive: true, careRoutineId: null,
        steps: [{ title: 'Desmaquillarse', order: 0 }, { title: 'Hidratar', order: 1 }],
      }),
      update: async (args: { data: unknown }) => { calls.link = args.data; return {}; },
    },
    careRoutine: {
      create: async (args: { data: { name: string; steps: { create: unknown[] } } }) => { calls.routine = args.data; return { id: 'r1' }; },
    },
  }, () => syncHabitToCare('u1', 'h1'));
  const routine = calls.routine as { name: string; timeOfDay: string; steps: { create: { name: string; order: number }[] } };
  assert.equal(routine.name, 'Ritual nocturno');
  assert.deepEqual(routine.steps.create.map((s) => s.name), ['Desmaquillarse', 'Hidratar']);
  assert.deepEqual(calls.link, { careRoutineId: 'r1' }, 'the habit keeps the link to its routine');
});

test('a routine created in Espejo appears in the notebook as a hygiene ritual', async () => {
  let created: { category: string; kind: string; careRoutineId: string; steps: { create: unknown[] } } | null = null;
  await withMocks({
    careRoutine: {
      findFirst: async () => ({
        id: 'r2', name: 'Piel', isActive: true,
        steps: [{ name: 'Limpiar' }, { name: 'Crema' }, { name: 'Protector' }],
      }),
    },
    habit: {
      findFirst: async () => null,
      create: async (args: { data: typeof created }) => { created = args.data; return { id: 'h2' }; },
    },
  }, () => syncRoutineToHabit('u1', 'r2'));
  assert.ok(created);
  const habit = created as unknown as { category: string; kind: string; careRoutineId: string; steps: { create: { title: string }[] } };
  assert.equal(habit.category, 'HYGIENE');
  assert.equal(habit.kind, 'ritual', 'a routine with steps becomes a ritual');
  assert.equal(habit.careRoutineId, 'r2');
  assert.deepEqual(habit.steps.create.map((s) => s.title), ['Limpiar', 'Crema', 'Protector']);
});

test('a routine with no steps becomes a plain hygiene habit', async () => {
  let kind = '';
  await withMocks({
    careRoutine: { findFirst: async () => ({ id: 'r3', name: 'Ducha', isActive: true, steps: [] }) },
    habit: {
      findFirst: async () => null,
      create: async (args: { data: { kind: string } }) => { kind = args.data.kind; return { id: 'h3' }; },
    },
  }, () => syncRoutineToHabit('u1', 'r3'));
  assert.equal(kind, 'habit');
});

test('moving a habit out of Higiene Personal unlinks it and deactivates its routine', async () => {
  const calls: { routineOff?: boolean; unlinked?: boolean } = {};
  await withMocks({
    habit: {
      findFirst: async () => ({ id: 'h4', userId: 'u1', title: 'Leer', category: 'LEARNING', isActive: true, careRoutineId: 'r4', steps: [] }),
      update: async (args: { data: { careRoutineId: null } }) => { calls.unlinked = args.data.careRoutineId === null; return {}; },
    },
    careRoutine: {
      update: async (args: { data: { isActive: boolean } }) => { calls.routineOff = args.data.isActive === false; return {}; },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  }, () => syncHabitToCare('u1', 'h4'));
  assert.equal(calls.routineOff, true);
  assert.equal(calls.unlinked, true);
});

test('a routine completed in Espejo completes its habit that day without paying rewards twice', async () => {
  const logs: Array<Record<string, unknown>> = [];
  const stepRows: Array<{ id: string }> = [{ id: 's1' }, { id: 's2' }];
  await withMocks({
    habit: {
      findFirst: async () => ({ id: 'h5', kind: 'ritual' }),
    },
    habitLog: {
      findUnique: async () => null,
      create: async (args: { data: Record<string, unknown> }) => { logs.push(args.data); return args.data; },
    },
    habitStep: { findMany: async () => stepRows },
    habitStepLog: {
      findMany: async () => [],
      createMany: async (args: { data: unknown[] }) => { logs.push({ steps: args.data.length }); return { count: args.data.length }; },
    },
  }, () => markHabitDoneFromCare('u1', 'r5', day));
  const log = logs.find((l) => 'habitId' in l) as Record<string, unknown>;
  assert.equal(log.completed, true);
  assert.equal(log.status, 'completed');
  assert.equal(log.rewardsGranted, true, 'the habit side does not pay again');
  assert.deepEqual(logs.find((l) => 'steps' in l), { steps: 2 }, 'every step of the ritual is marked done');
});
