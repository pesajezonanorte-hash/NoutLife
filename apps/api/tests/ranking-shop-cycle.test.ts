import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { rankEntries, type RankingEntry } from '../src/services/social.service';
import { effectiveActivityStreak, missedActivityDays } from '../src/services/xp.service';
import { activityCost, habitCost } from '../src/services/streak-revival.service';
import { invitePartner } from '../src/services/network.service';
import { purchaseItem } from '../src/services/shop.service';
import { DEFAULT_SHOP_ITEMS } from '../src/lib/default-catalog';
import { MAX_SHIELD_DAYS, shieldDaysOf } from '../src/lib/streak-shields';
import { canUseCycle } from '../src/lib/gender';
import { adviceFor, averages, cycleShape, patterns, phaseOn, snapshot, typicalEnergy } from '../src/lib/cycle';

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

const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
const entry = (id: string, level: number, value: number, streak: number): RankingEntry => ({
  id, username: id, displayName: id, nameColor: null, avatarConfig: {}, avatarUrl: null, equippedAura: null, equippedFrame: null, equippedHat: null,
  level, xpToNextLevel: 500, rank: null, value, streak, active: streak > 0,
});

// ─── Ranking ─────────────────────────────────────────────────────────────────

test('ranking: only active streaks get a place, level first and then XP', () => {
  const rows = [entry('ana', 7, 40, 3), entry('bea', 9, 10, 0), entry('cami', 7, 300, 1), entry('dani', 8, 0, 12)];
  const global = rankEntries('xp', rows, false);
  assert.deepEqual(global.map((e) => [e.id, e.rank]), [['dani', 1], ['cami', 2], ['ana', 3]]);
  // Bea (nivel 9, racha 0) no aparece en la global, ni siquiera en el podio.
  assert.ok(!global.some((e) => e.id === 'bea'));
});

test('ranking among friends: friends without a streak are listed last, paused and without a place', () => {
  const rows = [entry('ana', 3, 40, 0), entry('bea', 2, 10, 5), entry('cami', 5, 0, 0)];
  const friends = rankEntries('xp', rows, true);
  assert.deepEqual(friends.map((e) => [e.id, e.rank]), [['bea', 1], ['cami', null], ['ana', null]]);
});

test('streak ranking orders by the live streak', () => {
  const rows = [entry('ana', 3, 4, 4), entry('bea', 9, 12, 12), entry('cami', 1, 0, 0)];
  assert.deepEqual(rankEntries('streak', rows, false).map((e) => e.id), ['bea', 'ana']);
});

// ─── Racha y escudo ──────────────────────────────────────────────────────────

test('a shield keeps the general streak alive through the missed days it covers', () => {
  const now = new Date('2026-10-14T15:00:00.000Z'); // 10:00 en Bogotá
  const base = { currentStreak: 9, timezone: 'America/Bogota' };
  const yesterday = new Date('2026-10-13T15:00:00.000Z');
  const threeDaysAgo = new Date('2026-10-11T15:00:00.000Z');
  assert.equal(missedActivityDays({ ...base, lastActivityDate: yesterday }, now), 0);
  assert.equal(missedActivityDays({ ...base, lastActivityDate: threeDaysAgo }, now), 2);
  assert.equal(effectiveActivityStreak({ ...base, lastActivityDate: yesterday }, now), 9);
  // Dos días enteros sin actividad: sin escudo se rompe, con 1 día no alcanza, con 2 sigue.
  assert.equal(effectiveActivityStreak({ ...base, lastActivityDate: threeDaysAgo }, now), 0);
  assert.equal(effectiveActivityStreak({ ...base, lastActivityDate: threeDaysAgo, streakShieldDays: 1 }, now), 0);
  assert.equal(effectiveActivityStreak({ ...base, lastActivityDate: threeDaysAgo, streakShieldDays: 2 }, now), 9);
});

test('protecting a streak always costs less than reviving one', () => {
  const shields = DEFAULT_SHOP_ITEMS.filter((item) => shieldDaysOf(item.imageKey) > 0);
  assert.equal(shields.length, 2);
  // El revivir más barato es el de una racha de 2 días (la mínima que se puede revivir).
  const cheapestRevive = Math.min(activityCost(2), habitCost(2));
  for (const item of shields) {
    assert.ok(item.cost < cheapestRevive, `${item.name} (${item.cost}) debe costar menos que revivir (${cheapestRevive})`);
  }
  // Y por día protegido, el escudo grande sale más barato que el pase.
  const [pass, shield] = [...shields].sort((a, b) => shieldDaysOf(a.imageKey) - shieldDaysOf(b.imageKey));
  assert.ok(shield.cost / shieldDaysOf(shield.imageKey) < pass.cost / shieldDaysOf(pass.imageKey));
  // Revivir sigue subiendo con la racha perdida.
  assert.ok(activityCost(30) > activityCost(2) && habitCost(30) > habitCost(2));
});

test('buying a protector adds shield days, can be bought again and stops at the cap', async () => {
  const pass = { id: 'pass', cost: 40, imageKey: 'streak_pass', levelRequired: 1, type: 'PASS' };
  const user = { gold: 500, streakShieldDays: MAX_SHIELD_DAYS - 1 };
  const created: unknown[] = [];
  const userDelegate = {
    findUniqueOrThrow: async (args: { select?: Record<string, boolean> }) => (args.select?.streakShieldDays ? { ...user } : { level: 3 }),
    updateMany: async ({ where, data }: { where: { gold: { gte: number }; streakShieldDays: { lte: number } }; data: { gold: { decrement: number }; streakShieldDays: { increment: number } } }) => {
      if (user.gold < where.gold.gte || user.streakShieldDays > where.streakShieldDays.lte) return { count: 0 };
      user.gold -= data.gold.decrement;
      user.streakShieldDays += data.streakShieldDays.increment;
      return { count: 1 };
    },
  };
  const tx = {
    user: userDelegate,
    inventoryItem: { create: async (args: unknown) => { created.push(args); return { id: `inv-${created.length}`, shopItem: pass }; } },
  };
  await withMocks({
    shopItem: { findUniqueOrThrow: async () => pass },
    user: userDelegate,
    // Un protector nunca bloquea por «Ya tienes este artículo».
    inventoryItem: { findFirst: async () => { throw new Error('ownership must not be checked for protectors'); } },
    $transaction: async (run: (t: typeof tx) => Promise<unknown>) => run(tx),
  }, async () => {
    const first = await purchaseItem('u1', 'pass');
    assert.equal(first.user.streakShieldDays, MAX_SHIELD_DAYS);
    assert.equal(user.gold, 460);
    await assert.rejects(() => purchaseItem('u1', 'pass'), /máximo es 7/);
    assert.equal(user.gold, 460, 'a rejected purchase never charges');
  });
});

// ─── Jardín ──────────────────────────────────────────────────────────────────

test('re-inviting the person who already shares your garden says so clearly', async () => {
  const friendship = { findFirst: async () => ({ status: 'ACCEPTED', requester: { timezone: 'America/Bogota' } }) };
  await withMocks({
    friendship,
    relationship: { findFirst: async () => ({ userId: 'me', partnerUserId: 'pareja' }) },
  }, async () => {
    await assert.rejects(() => invitePartner('me', 'pareja'), { message: 'Esta persona ya comparte un jardín contigo.' });
  });
  await withMocks({
    friendship,
    relationship: { findFirst: async () => ({ userId: 'pareja', partnerUserId: 'otra' }) },
  }, async () => {
    await assert.rejects(() => invitePartner('me', 'pareja'), { message: 'Esa persona ya comparte su jardín con otra persona.' });
  });
});

// ─── Ciclo ───────────────────────────────────────────────────────────────────

test('only women see the Cycle zone', () => {
  assert.equal(canUseCycle('female'), true);
  for (const g of ['male', 'other', 'unspecified', null, undefined]) assert.equal(canUseCycle(g), false);
});

test('a 28-day cycle splits into its four phases', () => {
  const shape = cycleShape(28, 5);
  assert.deepEqual(shape.ranges, {
    menstrual: { start: 1, end: 5 }, follicular: { start: 6, end: 12 }, ovulation: { start: 13, end: 15 }, luteal: { start: 16, end: 28 },
  });
  assert.equal(phaseOn(1, shape), 'menstrual');
  assert.equal(phaseOn(14, shape), 'ovulation');
  assert.equal(phaseOn(31, shape), 'luteal', 'a late period stays in the luteal phase');
  // Ciclos cortos y largos siguen dejando cada fase en orden y la ovulación después del periodo.
  for (const [length, period] of [[18, 10], [21, 5], [45, 7], [60, 2]]) {
    const s = cycleShape(length, period);
    assert.ok(s.ranges.ovulation.start > s.ranges.menstrual.end);
    assert.ok(s.ranges.luteal.start <= s.ranges.luteal.end);
    assert.equal(s.ranges.luteal.end, length);
  }
});

test('averages come from her own cycles and ignore impossible gaps', () => {
  const periods = [
    { startDate: day('2026-06-01'), endDate: day('2026-06-05') },
    { startDate: day('2026-06-30'), endDate: day('2026-07-05') },
    // Un periodo sin anotar deja un hueco de 60+ días: no cuenta.
    { startDate: day('2026-09-15'), endDate: day('2026-09-18') },
    { startDate: day('2026-10-14'), endDate: null },
  ];
  const avg = averages(periods, { cycleLength: 30, periodLength: 6 });
  assert.equal(avg.cycleLength, 29); // (29 + 29) / 2
  assert.equal(avg.periodLength, 5); // (5 + 6 + 4) / 3
  assert.equal(avg.cyclesTracked, 2);
  assert.deepEqual(averages([], { cycleLength: 30, periodLength: 6 }).cycleLength, 30);
});

test('the snapshot counts days, predicts the next period and notices a delay', () => {
  const periods = [{ startDate: day('2026-10-01'), endDate: day('2026-10-05') }];
  const avg = { cycleLength: 28, periodLength: 5 };
  const today = snapshot(day('2026-10-14'), periods, avg)!;
  assert.equal(today.cycleDay, 14);
  assert.equal(today.phase, 'ovulation');
  assert.equal(today.onPeriod, false);
  assert.equal(today.nextPeriod, '2026-10-29');
  assert.equal(today.daysUntilNextPeriod, 15);
  assert.equal(today.lateDays, 0);
  const late = snapshot(day('2026-11-01'), periods, avg)!;
  assert.equal(late.lateDays, 4);
  assert.equal(late.phase, 'luteal');
  assert.equal(snapshot(day('2026-09-30'), periods, avg), null, 'no period yet: nothing to predict');
  // Un periodo abierto con sangrado anotado más allá del promedio sigue contando como periodo.
  const open = snapshot(day('2026-10-07'), [{ startDate: day('2026-10-01'), endDate: null }], avg, 7)!;
  assert.equal(open.onPeriod, true);
  assert.equal(open.phase, 'menstrual');
});

test('advice prefers what she logged today and only a real log can pause fitness habits', () => {
  const shape = cycleShape(28, 5);
  const none = { energy: { menstrual: null, follicular: null, ovulation: null, luteal: null }, symptoms: { menstrual: [], follicular: [], ovulation: [], luteal: [] } };
  // Sin registro: el patrón típico (día 1 = energía baja) sugiere calma, pero no pausa nada.
  const predicted = adviceFor({ phase: 'menstrual', cycleDay: 1, shape }, null, none);
  assert.equal(predicted.energySource, 'typical');
  assert.equal(predicted.energy, typicalEnergy(1, shape));
  assert.equal(predicted.intensity, 'gentle');
  assert.equal(predicted.pauseFitness, false);
  // Cólicos anotados hoy con energía 2: descanso, y puede pausar sus hábitos de ejercicio.
  const log = { date: day('2026-10-14'), flow: 'medium', mood: 3, energy: 2, symptoms: ['cramps'] };
  const today = adviceFor({ phase: 'menstrual', cycleDay: 2, shape }, log, none);
  assert.equal(today.energySource, 'today');
  assert.equal(today.intensity, 'rest');
  assert.equal(today.pauseFitness, true);
  assert.deepEqual(today.symptoms, ['cramps']);
  // Energía alta en ovulación: día para exigirse.
  assert.equal(adviceFor({ phase: 'ovulation', cycleDay: 14, shape }, null, none).intensity, 'high');
});

test('patterns learn her usual energy and symptoms per phase', () => {
  const periods = [{ startDate: day('2026-08-01'), endDate: day('2026-08-05') }, { startDate: day('2026-08-29'), endDate: day('2026-09-02') }];
  const logs = [
    { date: day('2026-08-01'), flow: 'heavy', mood: 2, energy: 2, symptoms: ['cramps', 'headache'] },
    { date: day('2026-08-02'), flow: 'medium', mood: 3, energy: 1, symptoms: ['cramps'] },
    { date: day('2026-08-29'), flow: 'heavy', mood: 2, energy: 2, symptoms: ['cramps'] },
    { date: day('2026-08-14'), flow: null, mood: 5, energy: 5, symptoms: [] },
  ];
  const p = patterns(logs, periods, { cycleLength: 28, periodLength: 5 });
  assert.equal(p.energy.menstrual, 2);
  assert.deepEqual(p.symptoms.menstrual, ['cramps']);
  assert.equal(p.energy.ovulation, null, 'one log is not a pattern');
});
