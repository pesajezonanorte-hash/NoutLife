import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../src/lib/prisma';
import { addCalendarDays, getCalendarDay } from '../src/lib/calendar';
import { validate } from '../src/middleware/validate.middleware';
import { createTransactionSchema } from '../src/schemas/finance.schemas';
import { completeFocusSchema } from '../src/schemas/focus.schemas';
import { habitLogSchema } from '../src/schemas/habit.schemas';
import {
  createHabit,
  isHabitScheduledForDay,
  listHabits,
  logHabit,
  reconcileHabitStreaks,
} from '../src/services/habit.service';
import { completeRitual, getRitualStats } from '../src/services/rituals.service';

type DelegateMocks = Record<string, unknown>;
const client = prisma as unknown as Record<string, unknown>;

async function withMocks<T>(mocks: DelegateMocks, run: () => Promise<T>): Promise<T> {
  const originals = new Map<string, unknown>();
  for (const [key, mock] of Object.entries(mocks)) {
    originals.set(key, client[key]);
    client[key] = mock;
  }

  try {
    return await run();
  } finally {
    for (const [key, original] of originals) client[key] = original;
  }
}

function makeResponse() {
  let statusCode = 200;
  let payload: unknown;
  return {
    res: {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
        return this;
      },
    },
    state: () => ({ statusCode, payload }),
  };
}

void test('remediaciones de auditoría', async (suite) => {
  await suite.test('P1 persiste isRitual y lo devuelve en la lista de hábitos', async () => {
    let createData: Record<string, unknown> | null = null;
    const ritual = {
      id: 'habit-ritual', userId: 'u-1', title: 'Inicio consciente', category: 'HEALTH',
      icon: 'star', color: '#a8871e', xpReward: 20, goldReward: 5,
      frequency: { type: 'daily', days: [] }, resetTime: '04:00', isActive: true,
      isRitual: true, syncToGoogleCalendar: false,
    };

    await withMocks({
      habit: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createData = data;
          return ritual;
        },
        findUnique: async () => ritual,
        count: async () => 1,
        findMany: async (args: { where?: { currentStreak?: unknown } }) => (
          args.where?.currentStreak ? [] : [ritual]
        ),
      },
      achievement: { findMany: async () => [] },
      userAchievement: { findMany: async () => [] },
      questCompletion: { count: async () => 0 },
      user: { findUnique: async () => ({ timezone: 'America/Bogota' }) },
      habitLog: { findMany: async () => [] },
    }, async () => {
      const created = await createHabit('u-1', {
        title: 'Inicio consciente', category: 'HEALTH', isRitual: true,
      });
      assert.equal(createData?.isRitual, true);
      assert.equal(created?.isRitual, true);

      const listed = await listHabits('u-1');
      assert.equal(listed.length, 1);
      assert.equal(listed[0].isRitual, true);
      assert.equal(listed[0].todayCompleted, null);
    });
  });

  await suite.test('P2 completa un ritual una sola vez y conserva la recompensa atómica', async () => {
    const logs: Array<{ ritualId: string; userId: string; date: Date }> = [];
    let xp = 0;
    let gold = 0;
    let userUpdates = 0;

    const tx = {
      ritual: { findFirst: async () => ({ id: 'ritual-1' }) },
      ritualLog: {
        findUnique: async ({ where }: { where: { ritualId_date: { ritualId: string; date: Date } } }) => (
          logs.find((log) => log.ritualId === where.ritualId_date.ritualId && log.date.getTime() === where.ritualId_date.date.getTime()) ?? null
        ),
        create: async ({ data }: { data: { ritualId: string; userId: string; date: Date } }) => {
          logs.push(data);
          return { id: `log-${logs.length}`, ...data };
        },
      },
      user: {
        update: async ({ data }: { data: { xp: { increment: number }; gold: { increment: number } } }) => {
          xp += data.xp.increment;
          gold += data.gold.increment;
          userUpdates += 1;
          return {};
        },
      },
    };

    await withMocks({
      ritual: { findFirst: async () => ({ id: 'ritual-1', user: { timezone: 'America/Bogota' } }) },
      ritualLog: {
        findFirst: async () => logs[0] ?? null,
        findMany: async () => logs.map((log) => ({ ...log, completedAt: log.date })),
      },
      $transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
    }, async () => {
      const first = await completeRitual('u-1', 'ritual-1');
      const second = await completeRitual('u-1', 'ritual-1');

      assert.equal(first.alreadyDone, false);
      assert.equal(first.xpEarned, 30);
      assert.equal(second.alreadyDone, true);
      assert.equal(second.xpEarned, 0);
      const stats = await getRitualStats('u-1', 'ritual-1');
      assert.equal(stats.totalLogs, 1);
      assert.equal(logs.length, 1);
      assert.equal(userUpdates, 1);
      assert.equal(xp, 30);
      assert.equal(gold, 5);
    });
  });

  await suite.test('P3 una lectura no resetea una racha con log válido hoy y la frecuencia semanal respeta Bogotá', async () => {
    const now = new Date('2026-09-27T04:30:00.000Z'); // 23:30 del 26-sep en Bogotá
    const bogotaToday = getCalendarDay('America/Bogota', now);
    let resets = 0;
    const activeHabit = {
      id: 'habit-1', userId: 'u-1', title: 'Leer', currentStreak: 1,
      frequency: { type: 'daily', days: [] },
      user: { timezone: 'America/Bogota' },
      logs: [{ date: bogotaToday, completed: true, status: 'completed' }],
    };

    await withMocks({
      habit: {
        findMany: async () => [activeHabit],
        updateMany: async () => { resets += 1; return { count: 1 }; },
      },
    }, async () => {
      assert.equal(await reconcileHabitStreaks('u-1', now), 0);
      assert.equal(resets, 0);
    });

    assert.equal(isHabitScheduledForDay(new Date('2026-09-28T00:00:00.000Z'), { type: 'days_per_week', days: [1] }), true);
    assert.equal(isHabitScheduledForDay(new Date('2026-09-29T00:00:00.000Z'), { type: 'days_per_week', days: [1] }), false);
  });

  await suite.test('P3/P5 log nuevo inicia en 1, el reintento conserva racha y el backfill es idempotente por fecha', async () => {
    const logs = new Map<string, { id: string; habitId: string; date: Date; completed: boolean; status: string }>();
    const habit = {
      id: 'habit-1', userId: 'u-1', title: 'Leer', category: 'LEARNING' as const,
      currentStreak: 0, longestStreak: 0, frequency: { type: 'daily', days: [] },
      xpReward: 20, goldReward: 5, icon: 'book', user: { timezone: 'America/Bogota' },
    };
    const user = {
      playerClass: null, xp: 0, level: 1, xpToNextLevel: 100, gold: 0,
      lastActivityDate: null as Date | null, currentStreak: 0, longestStreak: 0,
      timezone: 'America/Bogota', maxHp: 100, maxMp: 100,
    };
    let xpEvents = 0;
    const key = (date: Date) => date.toISOString().slice(0, 10);

    await withMocks({
      habit: {
        findMany: async (args: { where?: { currentStreak?: unknown } }) => {
          if (!args.where?.currentStreak || habit.currentStreak === 0) return [];
          return [{
            ...habit,
            logs: [...logs.values()].map((log) => ({ date: log.date, completed: log.completed, status: log.status })),
          }];
        },
        findFirst: async () => habit,
        findUnique: async () => habit,
        update: async ({ data }: { data: Partial<{ currentStreak: number; longestStreak: number }> }) => {
          Object.assign(habit, data);
          return habit;
        },
        count: async () => 1,
      },
      habitLog: {
        findUnique: async ({ where }: { where: { habitId_date: { date: Date } } }) => logs.get(key(where.habitId_date.date)) ?? null,
        create: async ({ data }: { data: { habitId: string; date: Date; completed: boolean; status: string } }) => {
          const log = { id: `log-${logs.size + 1}`, ...data };
          logs.set(key(data.date), log);
          return log;
        },
        update: async ({ where, data }: { where: { id: string }; data: { completed: boolean; status: string } }) => {
          const log = [...logs.values()].find((entry) => entry.id === where.id)!;
          Object.assign(log, data);
          return log;
        },
      },
      recoveryChallenge: { findFirst: async () => null },
      user: {
        findUniqueOrThrow: async () => user,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          if (typeof data.xp === 'number') user.xp = data.xp;
          if (typeof data.level === 'number') user.level = data.level;
          if (typeof data.xpToNextLevel === 'number') user.xpToNextLevel = data.xpToNextLevel;
          if (data.gold && typeof data.gold === 'object' && 'increment' in data.gold) user.gold += Number(data.gold.increment);
          if (data.lastActivityDate instanceof Date) user.lastActivityDate = data.lastActivityDate;
          if (typeof data.currentStreak === 'number') user.currentStreak = data.currentStreak;
          if (typeof data.longestStreak === 'number') user.longestStreak = data.longestStreak;
          return user;
        },
      },
      xpEvent: { create: async () => { xpEvents += 1; return {}; } },
      achievement: { findMany: async () => [] },
      userAchievement: { findMany: async () => [] },
      questCompletion: { count: async () => 0 },
      notification: { create: async () => ({}) },
      season: { findFirst: async () => null },
    }, async () => {
      const first = await logHabit('u-1', 'habit-1', 'completed');
      const retry = await logHabit('u-1', 'habit-1', 'completed');
      assert.equal(first.currentStreak, 1);
      assert.equal(retry.currentStreak, 1);
      assert.equal(retry.rewards, null);
      assert.equal(xpEvents, 1);

      const yesterday = addCalendarDays(getCalendarDay('America/Bogota'), -1).toISOString().slice(0, 10);
      const backfill = await logHabit('u-1', 'habit-1', 'completed', undefined, yesterday);
      const repeatBackfill = await logHabit('u-1', 'habit-1', 'completed', undefined, yesterday);
      assert.equal(backfill.log.date.toISOString().slice(0, 10), yesterday);
      assert.equal(repeatBackfill.rewards, null);
      assert.equal(logs.size, 2);
      assert.equal(habit.currentStreak, 1);
      assert.equal(xpEvents, 2);

      const tomorrow = addCalendarDays(getCalendarDay('America/Bogota'), 1).toISOString().slice(0, 10);
      await assert.rejects(() => logHabit('u-1', 'habit-1', 'completed', undefined, tomorrow), /HABIT_LOG_FUTURE_DATE/);
      await assert.rejects(() => logHabit('u-1', 'habit-1', 'completed', undefined, ''), /INVALID_HABIT_LOG_DATE/);
      assert.equal(habitLogSchema.safeParse({ status: 'completed', date: '2026-02-30' }).success, false);
      assert.equal(habitLogSchema.safeParse({ status: 'completed', date: yesterday }).success, true);
    });
  });

  await suite.test('P4 rechaza datos inválidos de finanzas y foco con 400 detallado antes de persistir', () => {
    assert.equal(createTransactionSchema.safeParse({
      type: 'EXPENSE', amount: -1, category: 'OTHER', date: '2026-09-27',
    }).success, false);
    assert.equal(createTransactionSchema.safeParse({
      type: 'LOSS', amount: 100, category: 'Otros', date: '2026-02-30',
    }).success, false);
    assert.equal(completeFocusSchema.safeParse({ durationMin: -15 }).success, false);
    assert.equal(completeFocusSchema.safeParse({ durationMin: 480 }).success, true);
    assert.equal(completeFocusSchema.safeParse({ durationMin: 481 }).success, false);

    const { res, state } = makeResponse();
    let persisted = false;
    validate(createTransactionSchema)(
      { body: { type: 'EXPENSE', amount: -20, category: 'OTHER' } } as never,
      res as never,
      () => { persisted = true; },
    );
    const result = state() as { statusCode: number; payload: { error: string; details: unknown[] } };
    assert.equal(result.statusCode, 400);
    assert.equal(result.payload.error, 'Datos inválidos');
    assert.ok(result.payload.details.length > 0);
    assert.equal(persisted, false);

    const focusResponse = makeResponse();
    let focusPersisted = false;
    validate(completeFocusSchema)(
      { body: { durationMin: -15 } } as never,
      focusResponse.res as never,
      () => { focusPersisted = true; },
    );
    assert.equal(focusResponse.state().statusCode, 400);
    assert.equal(focusPersisted, false);
  });
});
