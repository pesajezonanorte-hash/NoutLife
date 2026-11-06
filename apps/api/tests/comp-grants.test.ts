import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { COMP_MAX_DAYS, normalizeCompTarget } from '../src/lib/comp-grants';
import { CompGrantError, grantComp, listCompGrants } from '../src/services/comp-grant.service';

const NOW = new Date('2026-12-08T12:00:00.000Z');
const DAY = 24 * 60 * 60_000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

// ─── Reglas puras ────────────────────────────────────────────────────────────

test('the target is an email (lowercased) or a @username, and anything else is refused', () => {
  assert.deepEqual(normalizeCompTarget('  Ana@Ejemplo.com '), { kind: 'email', value: 'ana@ejemplo.com' });
  assert.deepEqual(normalizeCompTarget('@ana_1'), { kind: 'username', value: 'ana_1' });
  assert.deepEqual(normalizeCompTarget('ana_1'), { kind: 'username', value: 'ana_1' });
  assert.equal(normalizeCompTarget(''), null);
  assert.equal(normalizeCompTarget('@ab'), null, 'usernames have at least 3 characters');
  assert.equal(normalizeCompTarget('@ana bella'), null, 'spaces are not allowed');
  assert.equal(normalizeCompTarget('ana@'), null);
  assert.equal(normalizeCompTarget('a b@c.com'), null);
});

// ─── Base en memoria ─────────────────────────────────────────────────────────

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Client = Record<string, unknown>;
const client = prisma as unknown as Client;

interface State { users: Row[]; grants: Row[] }

function baseUser(extra: Row): Row {
  return {
    id: 'u1', email: 'ana@example.com', username: 'ana', subscriptionStatus: 'lite', trialEndsAt: days(-33), currentPeriodEnd: null,
    paymentSourceId: null, liteSince: days(-33), giftTrial: false, compPro: false, ...extra,
  };
}

const matchesUser = (u: Row, where: Row) => {
  if (where.id && u.id !== where.id) return false;
  if (where.email && u.email !== where.email) return false;
  if (where.username?.equals && u.username.toLowerCase() !== where.username.equals.toLowerCase()) return false;
  return true;
};

function delegates(state: State): Client {
  const pick = (row: Row | undefined) => (row ? { ...row } : null);
  return {
    $queryRaw: async () => [],
    user: {
      findFirst: async ({ where }: { where: Row }) => pick(state.users.find((u) => matchesUser(u, where))),
      findUnique: async ({ where }: { where: Row }) => pick(state.users.find((u) => matchesUser(u, where))),
      findMany: async ({ where }: { where: { id: { in: string[] } } }) => state.users
        .filter((u) => where.id.in.includes(u.id)).map((u) => ({ id: u.id, username: u.username })),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const user = state.users.find((u) => u.id === where.id)!;
        Object.assign(user, data);
        return { ...user };
      },
    },
    compGrant: {
      create: async ({ data }: { data: Row }) => {
        // Cada concesión llega un segundo después, para que el orden por fecha sea observable.
        const row = { id: `grant-${state.grants.length + 1}`, createdAt: new Date(NOW.getTime() + state.grants.length * 1000), ...data };
        state.grants.push(row);
        return { id: row.id, createdAt: row.createdAt };
      },
      findMany: async () => [...state.grants].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    },
  };
}

/** Sustituye los delegados de Prisma; $transaction deshace todo si la función falla (como Postgres). */
async function withDb<T>(state: State, run: () => Promise<T>): Promise<T> {
  const fake = delegates(state);
  const mocks: Client = {
    ...fake,
    $transaction: async (arg: unknown) => {
      const snapshot = structuredClone(state);
      try {
        return await (arg as (tx: Client) => Promise<unknown>)(fake);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
  };
  const original = new Map<string, unknown>();
  for (const [key, value] of Object.entries(mocks)) { original.set(key, client[key]); client[key] = value; }
  try { return await run(); } finally { for (const [key, value] of original) client[key] = value; }
}

const fresh = (user: Row): State => ({ users: [user], grants: [] });
const rejectsWith = (status: number) => (error: unknown) => error instanceof CompGrantError && error.status === status;

// ─── Concesión ───────────────────────────────────────────────────────────────

test('a Lite account gets the days as a gift trial from now, never charged, and the grant is recorded', async () => {
  const state = fresh(baseUser({ paymentSourceId: 'src-1' }));
  const record = await withDb(state, () => grantComp({ target: '@ana', days: 30, note: 'Ganador de reto Instagram' }, 'admin-1', NOW));
  const user = state.users[0];
  assert.equal(user.subscriptionStatus, 'trialing');
  assert.equal(user.giftTrial, true, 'a gift trial never charges the saved card');
  assert.equal(user.trialEndsAt.getTime(), days(30).getTime());
  assert.equal(record.outcome, 'activated');
  assert.equal(record.accessEndsAt, days(30).toISOString());
  assert.equal(state.grants.length, 1);
  assert.equal(state.grants[0].targetUserId, 'u1');
  assert.equal(state.grants[0].grantedById, 'admin-1');
  assert.equal(state.grants[0].note, 'Ganador de reto Instagram');
});

test('a Pro account keeps its paid period and the days are added after its end', async () => {
  const periodEnd = days(7);
  const state = fresh(baseUser({ subscriptionStatus: 'active', currentPeriodEnd: periodEnd, paymentSourceId: 'src-1' }));
  const record = await withDb(state, () => grantComp({ target: 'ana@example.com', days: 90 }, 'admin-1', NOW));
  assert.equal(record.outcome, 'extended');
  assert.equal(state.users[0].currentPeriodEnd.getTime(), periodEnd.getTime() + 90 * DAY, 'added to the end, not from now');
  assert.equal(record.accessEndsAt, new Date(periodEnd.getTime() + 90 * DAY).toISOString());
});

test('a running trial is extended from its end, never shortened', async () => {
  const state = fresh(baseUser({ subscriptionStatus: 'trialing', trialEndsAt: days(10) }));
  const record = await withDb(state, () => grantComp({ target: 'ana', days: 7 }, 'admin-1', NOW));
  assert.equal(record.outcome, 'extended');
  assert.equal(state.users[0].trialEndsAt.getTime(), days(17).getTime());
});

test('indefinite grants set the courtesy flag, keep the paid period, and record no end date', async () => {
  const state = fresh(baseUser({ subscriptionStatus: 'active', currentPeriodEnd: days(20), paymentSourceId: 'src-1' }));
  const record = await withDb(state, () => grantComp({ target: '@ana', days: null, note: 'Prueba VIP de soporte' }, 'admin-1', NOW));
  assert.equal(state.users[0].compPro, true);
  assert.equal(state.users[0].currentPeriodEnd.getTime(), days(20).getTime(), 'the paid period is not touched');
  assert.equal(record.outcome, 'permanent');
  assert.equal(record.days, null);
  assert.equal(record.accessEndsAt, null);
  assert.equal(state.grants[0].outcome, 'permanent');
});

test('an account that is already courtesy Pro is refused and nothing is written', async () => {
  const state = fresh(baseUser({ compPro: true }));
  await assert.rejects(withDb(state, () => grantComp({ target: 'ana', days: 30 }, 'admin-1', NOW)), rejectsWith(409));
  await assert.rejects(withDb(state, () => grantComp({ target: 'ana', days: null }, 'admin-1', NOW)), rejectsWith(409));
  assert.equal(state.grants.length, 0);
  assert.equal(state.users[0].subscriptionStatus, 'lite');
});

test('unknown accounts, malformed targets and out-of-range days are refused', async () => {
  const state = fresh(baseUser({}));
  await assert.rejects(withDb(state, () => grantComp({ target: 'nadie@example.com', days: 7 }, 'admin-1', NOW)), rejectsWith(404));
  await assert.rejects(withDb(state, () => grantComp({ target: '@ab', days: 7 }, 'admin-1', NOW)), rejectsWith(400));
  await assert.rejects(withDb(state, () => grantComp({ target: 'ana', days: 0 }, 'admin-1', NOW)), rejectsWith(400));
  await assert.rejects(withDb(state, () => grantComp({ target: 'ana', days: COMP_MAX_DAYS + 1 }, 'admin-1', NOW)), rejectsWith(400));
  await assert.rejects(withDb(state, () => grantComp({ target: 'ana', days: 1.5 }, 'admin-1', NOW)), rejectsWith(400));
  assert.equal(state.grants.length, 0);
});

test('the username is matched without caring about case', async () => {
  const state = fresh(baseUser({ username: 'Ana_Lopez' }));
  const record = await withDb(state, () => grantComp({ target: '@ANA_LOPEZ', days: 7 }, 'admin-1', NOW));
  assert.equal(record.targetUsername, 'Ana_Lopez');
});

test('the history lists the grants newest first with the admin who made them', async () => {
  const state: State = {
    users: [baseUser({}), baseUser({ id: 'admin-1', email: 'admin@example.com', username: 'miguel' })],
    grants: [],
  };
  await withDb(state, () => grantComp({ target: 'ana', days: 7 }, 'admin-1', NOW));
  await withDb(state, () => grantComp({ target: 'ana', days: null, note: 'Ganador' }, 'admin-1', NOW));
  const history = await withDb(state, () => listCompGrants());
  assert.equal(history.length, 2);
  assert.equal(history[0].outcome, 'permanent');
  assert.equal(history[0].note, 'Ganador');
  assert.equal(history[1].days, 7);
  assert.equal(history[0].grantedBy, 'miguel');
});

// ─── Total de días del regalo ────────────────────────────────────────────────

test('a gift keeps its granted total, so the app shows day X of 30 and not of 7', async () => {
  const { proExtension, giftTotalDays } = await import('../src/lib/referrals');
  const lite = baseUser({});
  const first = proExtension(lite, 30, NOW);
  assert.equal(first?.giftTrial, true);
  assert.equal(first?.giftDays, 30);

  const running = { ...baseUser({}), subscriptionStatus: 'trialing', giftTrial: true, giftDays: 30, trialEndsAt: days(10) };
  const more = proExtension(running, 7, NOW);
  assert.equal(more?.giftDays, 37, 'adding days to a running gift adds to its total');
  assert.equal(giftTotalDays(running, NOW), 30);
  assert.equal(giftTotalDays({ ...running, giftDays: null, trialEndsAt: days(5) }, NOW), 7, 'older gifts fall back to at least the normal 7');
});
