import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../src/lib/prisma';
import {
  getActivityRadar,
  getFinanceTrend,
  getGymProgression,
  getHabitHeatmap,
  getPredictions,
  getSleepScatter,
  getStatsSummary,
  getXpHistory,
  periodRange,
} from '../src/services/stats.service';
import { calculateDynamicLifeScore, calculateLifeScore, getYearInReview } from '../src/services/lifescore.service';
import { getHistorySummary } from '../src/services/history.service';
import { getTransactionSummary } from '../src/services/finance.service';
import { getFinancialProjection } from '../src/services/finance2.service';
import { getExerciseHistory, getWeeklyVolume } from '../src/services/gym2.service';
import { summary as statsSummaryController } from '../src/controllers/stats.controller';
import { logHabit } from '../src/services/habit.service';
import { getSleepStats, updateSleep } from '../src/services/sleep.service';
import { finishWorkout } from '../src/services/workout.service';
import { getCalendarDay } from '../src/lib/calendar';

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

const emptyReconcileHabitDelegate = {
  findMany: async (args: { where?: { currentStreak?: unknown } }) => (
    args.where?.currentStreak ? [] : []
  ),
};

void test('auditoría de contratos analíticos', async (suite) => {
  await suite.test('los rangos no incluyen registros futuros y mantienen periodos previos', () => {
    const now = new Date('2026-09-26T15:00:00.000Z');
    const month = periodRange('month', now);
    const week = periodRange('week', now);

    assert.equal(month.start.toISOString(), '2026-09-01T00:00:00.000Z');
    assert.equal(month.end.toISOString(), now.toISOString());
    assert.equal(month.prevStart.toISOString(), '2026-08-01T00:00:00.000Z');
    assert.equal(week.start.toISOString(), '2026-09-19T15:00:00.000Z');
    assert.equal(week.prevEnd.toISOString(), week.start.toISOString());
  });

  await suite.test('summary agrega XP, misiones, dinero y totales históricos reales', async () => {
    const aggregates = [{ _sum: { xpAmount: 120 } }, { _sum: { xpAmount: 60 } }, { _sum: { xpAmount: 890 } }];
    const counts = [4, 2, 31, 48, 9, 5];

    await withMocks({
      user: {
        findUnique: async () => ({ currentStreak: 0, lastActivityDate: null, timezone: 'America/Bogota' }),
        findUniqueOrThrow: async () => ({ currentStreak: 4, longestStreak: 6 }),
      },
      habit: {
        findMany: async (args: { where?: { currentStreak?: unknown } }) => (
          args.where?.currentStreak ? [] : [{ longestStreak: 12 }, { longestStreak: 7 }]
        ),
      },
      xpEvent: { aggregate: async () => aggregates.shift() },
      questCompletion: { count: async () => counts.shift() },
      habitLog: { count: async () => counts.shift() },
      workout: { count: async () => counts.shift() },
      quest: { count: async () => counts.shift() },
      transaction: {
        findMany: async () => [
          { type: 'INCOME', amount: 1000 },
          { type: 'EXPENSE', amount: 250 },
          { type: 'EXPENSE', amount: 75 },
        ],
      },
    }, async () => {
      const summary = await getStatsSummary('u-1', 'month');
      assert.deepEqual(summary.xp, { value: 120, change: 100 });
      assert.deepEqual(summary.quests, { completed: 4, change: 100, total: 5 });
      assert.equal(summary.currentStreak, 4);
      assert.equal(summary.bestStreak, 12);
      assert.deepEqual(summary.finance, { income: 1000, expenses: 325, balance: 675 });
      assert.deepEqual(summary.totals, {
        xpEarned: 890,
        questsCompleted: 31,
        habitCompletions: 48,
        workouts: 9,
      });
    });
  });

  await suite.test('las series de XP, hábitos, sueño, gym, radar y dinero conservan datos reales', async () => {
    await withMocks({
      user: { findUnique: async () => ({ timezone: 'America/Bogota' }) },
      xpEvent: {
        findMany: async () => [
          { createdAt: new Date('2026-09-02T10:00:00Z'), xpAmount: 20 },
          { createdAt: new Date('2026-09-02T15:00:00Z'), xpAmount: 30 },
          { createdAt: new Date('2026-09-04T10:00:00Z'), xpAmount: 50 },
        ],
      },
    }, async () => {
      const history = await getXpHistory('u-1', 'month', new Date('2026-09-05T15:00:00Z'));
      assert.deepEqual(history, {
        data: [
          { date: '2026-09-01', xp: 0, cumulativeXp: 0 },
          { date: '2026-09-02', xp: 50, cumulativeXp: 50 },
          { date: '2026-09-03', xp: 0, cumulativeXp: 50 },
          { date: '2026-09-04', xp: 50, cumulativeXp: 100 },
          { date: '2026-09-05', xp: 0, cumulativeXp: 100 },
        ],
        avg: 20,
        activeDays: 2,
        daysInPeriod: 5,
        totalXp: 100,
      });
    });

    const counts = {
      workout: [2, 1],
      transaction: [4, 2],
      habitLog: [3, 1],
      questCompletion: [1, 0],
      sleepLog: [5, 1],
      learningItem: [2, 0],
      journalEntry: [2, 1],
      careLog: [1, 0],
    };
    await withMocks({
      workout: { count: async () => counts.workout.shift() },
      transaction: { count: async () => counts.transaction.shift() },
      habitLog: { count: async () => counts.habitLog.shift() },
      questCompletion: { count: async () => counts.questCompletion.shift() },
      sleepLog: { count: async () => counts.sleepLog.shift() },
      learningItem: { count: async () => counts.learningItem.shift() },
      journalEntry: { count: async () => counts.journalEntry.shift() },
      careLog: { count: async () => counts.careLog.shift() },
    }, async () => {
      const radar = await getActivityRadar('u-1', 'week', new Date('2026-09-26T15:00:00Z'));
      assert.deepEqual(radar.current.map((item) => item.value), [33, 43, 67, 100, 71, 100, 29, 14]);
      assert.deepEqual(radar.previous.map((item) => item.value), [0, 14, 33, 100, 14, 0, 14, 0]);
    });

    await withMocks({
      transaction: {
        findMany: async () => [
          { date: new Date('2026-05-03T12:00:00Z'), type: 'INCOME', amount: 500 },
          { date: new Date('2026-05-10T12:00:00Z'), type: 'EXPENSE', amount: 150 },
        ],
      },
    }, async () => {
      const finance = await getFinanceTrend('u-1', '3months', new Date('2026-06-15T15:00:00Z'));
      assert.equal(finance.length, 4);
      assert.equal(finance.filter((point) => point.income !== 0 || point.expenses !== 0).length, 1);
      assert.equal(finance.find((point) => point.month === '2026-05')?.balance, 350);
    });

    await withMocks({
      habitLog: {
        findMany: async () => [
          { date: new Date('2026-09-02T00:00:00Z') },
          { date: new Date('2026-09-02T00:00:00Z') },
          { date: new Date('2026-09-04T00:00:00Z') },
        ],
      },
    }, async () => {
      assert.deepEqual(await getHabitHeatmap('u-1'), [
        { date: '2026-09-02', count: 2 },
        { date: '2026-09-04', count: 1 },
      ]);
    });

    await withMocks({
      sleepLog: {
        findMany: async () => [
          { date: new Date('2026-09-01T00:00:00Z'), duration: 7.5, quality: 4 },
          { date: new Date('2026-09-02T00:00:00Z'), duration: 6.5, quality: 3 },
        ],
      },
    }, async () => {
      assert.deepEqual(await getSleepScatter('u-1', 'month'), [
        { date: '2026-09-01', duration: 7.5, quality: 4 },
        { date: '2026-09-02', duration: 6.5, quality: 3 },
      ]);
    });

    await withMocks({
      workoutExercise: {
        findMany: async () => [
          {
            exercise: { name: 'Sentadilla' },
            workout: { date: new Date('2026-09-01T00:00:00Z') },
            sets: [{ weight: 80, completed: true }, { weight: 100, completed: false }],
          },
          {
            exercise: { name: 'Sentadilla' },
            workout: { date: new Date('2026-09-03T00:00:00Z') },
            sets: [{ weight: 90, completed: true }],
          },
          {
            exercise: { name: 'Press' },
            workout: { date: new Date('2026-09-02T00:00:00Z') },
            sets: [{ weight: 50, completed: true }],
          },
        ],
      },
    }, async () => {
      assert.deepEqual(await getGymProgression('u-1', 'month'), [
        { name: 'Sentadilla', data: [{ date: '2026-09-01', weight: 80 }, { date: '2026-09-03', weight: 90 }] },
        { name: 'Press', data: [{ date: '2026-09-02', weight: 50 }] },
      ]);
    });
  });

  await suite.test('predicciones calculan ritmo, metas y riesgo según días programados', async () => {
    const today = getCalendarDay('America/Bogota');
    const habitLogs = Array.from({ length: 7 }, (_, index) => ({
      date: new Date(today.getTime() - index * 86400000),
      completed: index < 6,
    }));

    await withMocks({
      user: {
        findUniqueOrThrow: async () => ({ level: 3, xp: 40, xpToNextLevel: 100, timezone: 'America/Bogota' }),
      },
      xpEvent: { aggregate: async () => ({ _sum: { xpAmount: 300 } }) },
      transaction: { findMany: async () => [{ type: 'INCOME', amount: 1000 }, { type: 'EXPENSE', amount: 400 }] },
      financialGoal: { findMany: async () => [{ title: 'Fondo', targetAmount: 2000, currentAmount: 800 }] },
      habit: {
        findMany: async () => [{
          title: 'Entrenar',
          currentStreak: 6,
          frequency: { type: 'daily', days: [] },
          logs: habitLogs,
        }],
      },
    }, async () => {
      const predictions = await getPredictions('u-1');
      assert.equal(predictions.avgDailyXp, 10);
      assert.equal(predictions.daysToNextLevel, 6);
      assert.deepEqual(predictions.goalPredictions, [{ title: 'Fondo', remaining: 1200, months: 2 }]);
      assert.deepEqual(predictions.habitRisks, [{
        title: 'Entrenar', currentStreak: 6, completedDays: 6, scheduledDays: 7, completionRate: 86, risk: 'low',
      }]);
    });
  });

  await suite.test('la tendencia de sueño separa semanas por fecha y no por posición en el listado', async () => {
    const now = Date.now();
    await withMocks({
      sleepLog: {
        findMany: async () => [
          { date: new Date(now - 10 * 86400000), duration: 6, quality: 2 },
          { date: new Date(now - 2 * 86400000), duration: 8, quality: 4 },
          { date: new Date(now - 9 * 86400000), duration: 6, quality: 3 },
        ],
      },
    }, async () => {
      const stats = await getSleepStats('u-1');
      assert.equal(stats.weeklyAvg, 8);
      assert.equal(stats.trend, 'improving');
      assert.equal(stats.totalLogs, 3);
    });
  });

  await suite.test('finanzas y gym excluyen movimientos y entrenamientos futuros de sus agregados', async () => {
    let summaryWhere: { date?: { lte?: Date } } | undefined;
    await withMocks({
      transaction: {
        findMany: async (args: { where: { date?: { lte?: Date } } }) => {
          summaryWhere = args.where;
          return [{ type: 'INCOME', amount: 100 }];
        },
      },
    }, async () => {
      const result = await getTransactionSummary('u-1', '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z');
      assert.equal(result.balance, 100);
      assert.ok(summaryWhere?.date?.lte instanceof Date);
      assert.ok((summaryWhere?.date?.lte?.getTime() ?? 0) <= Date.now() + 50);
    });

    const gymQueries: Array<{ workout?: { date?: { lte?: Date }; xpEarned?: { gt?: number } } }> = [];
    await withMocks({
      workoutExercise: {
        findMany: async (args: { where: { workout?: { date?: { lte?: Date }; xpEarned?: { gt?: number } } } }) => {
          gymQueries.push(args.where);
          return [];
        },
      },
    }, async () => {
      await getExerciseHistory('u-1', 'exercise-1');
      await getWeeklyVolume('u-1');
      assert.equal(gymQueries.length, 2);
      for (const query of gymQueries) {
        assert.equal(query.workout?.xpEarned?.gt, 0);
        assert.ok(query.workout?.date?.lte instanceof Date);
      }
    });
  });

  await suite.test('Life Score estático y proyección financiera combinan solo los registros pertinentes', async () => {
    await withMocks({
      habit: { findMany: async () => [{ id: 'habit-1' }] },
      habitLog: { findMany: async () => Array.from({ length: 5 }, () => ({ completed: true })) },
      workout: { findMany: async () => [{ xpEarned: 40 }, { xpEarned: 40 }] },
      sleepLog: { findMany: async () => [{ duration: 7.5, quality: 4, sleepScore: 80, bedtime: new Date('2026-09-01T22:30:00Z') }] },
      transaction: { findMany: async () => [{ type: 'INCOME', amount: 1000 }, { type: 'EXPENSE', amount: 200, category: 'FOOD' }] },
      budget: { findMany: async () => [{ category: 'FOOD', amount: 500 }] },
      quest: { findMany: async () => [{ status: 'ACTIVE' }] },
      questCompletion: { findMany: async () => [{ id: 'q1' }, { id: 'q2' }] },
      learningItem: { findMany: async () => [{ status: 'IN_PROGRESS' }] },
      journalEntry: { findMany: async () => [{ id: 'j1' }, { id: 'j2' }] },
      relationship: { findMany: async () => [{ isPartner: true }] },
    }, async () => {
      const score = await calculateLifeScore('u-1');
      assert.deepEqual(score.breakdown, {
        habits: 71,
        fitness: 73,
        finances: 90,
        quests: 60,
        learning: 40,
        relationships: 65,
        journal: 40,
      });
      assert.equal(score.total, 68);
    });

    let projectionTransactionWhere: { date?: { lt?: Date } } | undefined;
    await withMocks({
      recurringTransaction: { findMany: async () => [
        { type: 'INCOME', amount: 1000 },
        { type: 'EXPENSE', amount: 300 },
      ] },
      debt: { findMany: async () => [{
        id: 'debt-1', title: 'Crédito', currentAmount: 500,
        payments: [{ amount: 100 }, { amount: 100 }],
      }] },
      transaction: { findMany: async (args: { where: { date?: { lt?: Date } } }) => {
        projectionTransactionWhere = args.where;
        return [{ type: 'EXPENSE', amount: 150 }, { type: 'EXPENSE', amount: 150 }];
      } },
    }, async () => {
      const projection = await getFinancialProjection('u-1', 2);
      assert.equal(projection.avgVariableExpenses, 100);
      assert.equal(projection.netMonthly, 600);
      assert.deepEqual(projection.projection.map((item) => item.balance), [600, 1200]);
      assert.deepEqual(projection.debtProjections, [{
        id: 'debt-1', title: 'Crédito', remaining: 500, avgMonthlyPayment: 100, monthsToPayoff: 5,
      }]);
      assert.ok(projectionTransactionWhere?.date?.lt instanceof Date);
    });
  });

  await suite.test('Life Score conserva todas las zonas y separa XP por zona personalizada', async () => {
    let aggregateCalls = 0;
    await withMocks({
      user: { findUnique: async () => ({ timezone: 'America/Bogota' }) },
      quest: { findMany: async () => [] },
      questCompletion: { findMany: async () => [] },
      habit: {
        findMany: async () => [{
          id: 'habit-zone', isActive: true, frequency: { type: 'daily', days: [] }, customZoneId: 'zone-1',
        }],
      },
      habitLog: { findMany: async () => [] },
      workout: { findMany: async () => [], count: async () => 0 },
      transaction: { findMany: async () => [], count: async () => 0 },
      budget: { findMany: async () => [] },
      financialGoal: { findMany: async () => [] },
      sleepLog: { findMany: async () => [], count: async () => 0 },
      learningItem: { findMany: async () => [] },
      journalEntry: { findMany: async () => [], count: async () => 0 },
      customZone: {
        findMany: async () => [{
          id: 'zone-1', name: 'Proyecto', icon: 'target', accentColor: '#000000',
          isMeasurable: true, measureMetric: 'xp_gained', weeklyXpGoal: 100, order: 0,
        }],
      },
      careRoutine: { findMany: async () => [] },
      careLog: { findMany: async () => [], count: async () => 0 },
      clothingItem: { findMany: async () => [] },
      outfit: { findMany: async () => [] },
      presenceCheckin: { findMany: async () => [] },
      meal: { findMany: async () => [], count: async () => 0 },
      nutritionGoal: { findUnique: async () => null },
      relationship: { findMany: async () => [] },
      giftIdea: { findMany: async () => [] },
      xpEvent: {
        findMany: async () => [{ sourceId: 'habit-zone', xpAmount: 60 }],
        aggregate: async () => ({ _sum: { xpAmount: aggregateCalls++ === 0 ? 60 : 0 } }),
      },
    }, async () => {
      const dynamic = await calculateDynamicLifeScore('u-1', 'week', new Date('2026-09-26T15:00:00Z'));
      const expectedCoreZones = ['quests', 'habits', 'gym', 'finances', 'sleep', 'learning', 'journal', 'mirror', 'nutrition', 'relationships'];
      for (const id of expectedCoreZones) assert.ok(dynamic.zones.some((zone) => zone.id === id), `${id} debe estar visible`);

      const customZone = dynamic.zones.find((zone) => zone.id === 'zone-1');
      assert.ok(customZone);
      assert.equal(customZone.score, 60);
      assert.equal(customZone.hasData, true);
      assert.equal(customZone.activityLabel, '60 XP de 100 objetivo');
      assert.equal(dynamic.zones.find((zone) => zone.id === 'mirror')?.status, 'not_configured');
    });

    await withMocks({
      xpEvent: { findMany: async () => [{ xpAmount: 100, goldAmount: 5, createdAt: new Date('2026-02-10T00:00:00Z') }] },
      workout: { findMany: async () => [] },
      sleepLog: { findMany: async () => [] },
      questCompletion: { findMany: async () => [] },
      journalEntry: { findMany: async () => [] },
      learningItem: { findMany: async () => [{ type: 'BOOK' }] },
    }, async () => {
      const review = await getYearInReview('u-1', 2026);
      assert.equal(review.totalBooksCompleted, 1);
      assert.equal(review.totalXp, 100);
    });
  });

  await suite.test('history conserva XP, oro, misiones y hábitos por fecha', async () => {
    await withMocks({
      questCompletion: {
        findMany: async () => [{
          completedAt: new Date('2026-09-04T12:00:00Z'),
          quest: { category: 'FITNESS' },
        }],
      },
      habitLog: {
        findMany: async () => [{ date: new Date('2026-09-04T00:00:00Z'), status: 'completed' }],
      },
      xpEvent: {
        findMany: async () => [{ createdAt: new Date('2026-09-04T13:00:00Z'), xpAmount: 70, goldAmount: 12 }],
      },
    }, async () => {
      const history = await getHistorySummary('u-1', new Date('2026-09-01'), new Date('2026-09-10'));
      assert.equal(history.totalXp, 70);
      assert.equal(history.totalGold, 12);
      assert.equal(history.totalQuestsCompleted, 1);
      assert.equal(history.totalHabitsCompleted, 1);
      assert.deepEqual(history.categoryDistribution, [{ category: 'FITNESS', count: 1 }]);
      assert.equal(history.days[0]?.productivityScore, 70);
    });
  });

  await suite.test('la API de estadísticas responde JSON estable ante un fallo de agregación', async () => {
    let statusCode = 0;
    let payload: unknown;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
        return this;
      },
    };
    const originalConsoleError = console.error;
    console.error = () => undefined;
    try {
      await withMocks({
        user: { findUnique: async () => { throw new Error('database unavailable'); } },
        habit: { findMany: async () => [] },
      }, async () => {
        await statsSummaryController({ userId: 'u-1', query: { period: 'month' } } as never, res as never);
      });
    } finally {
      console.error = originalConsoleError;
    }
    assert.equal(statusCode, 500);
    assert.deepEqual(payload, { error: 'No se pudieron cargar estas estadísticas.' });
  });

  await suite.test('reintentar un hábito completado no concede más XP ni aumenta la racha', async () => {
    let xpEventsCreated = 0;
    let habitUpdates = 0;
    const existingLog = { id: 'log-1', habitId: 'habit-1', completed: true, status: 'completed' };

    await withMocks({
      habit: {
        findMany: async (args: { where?: { currentStreak?: unknown } }) => (args.where?.currentStreak ? [] : []),
        findFirst: async () => ({
          id: 'habit-1', userId: 'u-1', title: 'Leer', category: 'LEARNING', currentStreak: 4, longestStreak: 9,
          frequency: { type: 'daily', days: [] }, xpReward: 20, goldReward: 5, icon: 'book', user: { timezone: 'America/Bogota' },
        }),
        findUnique: async () => ({ id: 'habit-1' }),
        update: async () => { habitUpdates += 1; return {}; },
      },
      habitLog: {
        findUnique: async () => existingLog,
        upsert: async () => existingLog,
      },
      recoveryChallenge: { findFirst: async () => null },
      xpEvent: { create: async () => { xpEventsCreated += 1; return {}; } },
    }, async () => {
      const result = await logHabit('u-1', 'habit-1', 'completed');
      assert.equal(result.rewards, null);
      assert.equal(result.currentStreak, 4);
      assert.equal(xpEventsCreated, 0);
      assert.equal(habitUpdates, 0);
    });
  });

  await suite.test('un entrenamiento ya premiado no puede finalizarse otra vez', async () => {
    await withMocks({
      workout: { findFirst: async () => ({ id: 'workout-1', xpEarned: 50 }) },
    }, async () => {
      await assert.rejects(
        () => finishWorkout('u-1', 'workout-1', {}),
        /WORKOUT_ALREADY_FINISHED/,
      );
    });
  });

  await suite.test('editar una parte de una noche recalcula duración y score', async () => {
    let updateData: Record<string, unknown> | null = null;
    await withMocks({
      sleepLog: {
        findFirst: async () => ({
          id: 'sleep-1',
          bedtime: new Date('2026-09-10T23:00:00Z'),
          wakeTime: new Date('2026-09-11T06:00:00Z'),
          quality: 3,
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updateData = data;
          return { id: 'sleep-1', ...data };
        },
      },
    }, async () => {
      await updateSleep('u-1', 'sleep-1', { wakeTime: '2026-09-11T07:30:00Z' });
      assert.equal(updateData?.duration, 8.5);
      assert.equal(typeof updateData?.sleepScore, 'number');
    });
  });
});
