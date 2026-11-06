import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import {
  REWARD_THEME_KEY, generateRewardToken, hashRewardToken, isRewardToken, rewardLinkStatus,
} from '../src/lib/reward-links';
import { claimRewardLink, createRewardLinks, previewRewardLink, revokeRewardLink, RewardLinkError } from '../src/services/reward-link.service';
import { listShopItems, purchaseItem } from '../src/services/shop.service';
import { DEFAULT_SHOP_ITEMS } from '../src/lib/default-catalog';

const NOW = new Date('2026-12-08T12:00:00.000Z');
const DAY = 24 * 60 * 60_000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

// ─── Reglas puras ────────────────────────────────────────────────────────────

test('tokens are 43 url-safe characters, never repeat, and only their hash is stored', () => {
  const a = generateRewardToken();
  const b = generateRewardToken();
  assert.ok(isRewardToken(a) && isRewardToken(b));
  assert.notEqual(a, b);
  assert.match(hashRewardToken(a), /^[0-9a-f]{64}$/);
  assert.equal(hashRewardToken(a), hashRewardToken(a));
  assert.ok(!isRewardToken('abc'));
  assert.ok(!isRewardToken(`${a}!`));
  assert.ok(!isRewardToken(undefined));
});

test('a link is claimed once claimedAt exists, expired from expiresAt on, available otherwise', () => {
  assert.equal(rewardLinkStatus({ claimedAt: null, expiresAt: null }, NOW), 'available');
  assert.equal(rewardLinkStatus({ claimedAt: null, expiresAt: days(1) }, NOW), 'available');
  assert.equal(rewardLinkStatus({ claimedAt: null, expiresAt: NOW }, NOW), 'expired');
  assert.equal(rewardLinkStatus({ claimedAt: days(-1), expiresAt: days(-5) }, NOW), 'claimed');
});

// ─── Base en memoria ─────────────────────────────────────────────────────────

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Client = Record<string, unknown>;
const client = prisma as unknown as Client;

interface State { users: Row[]; links: Row[]; shopItems: Row[]; inventory: Row[] }

function baseUser(extra: Row): Row {
  return {
    id: 'u1', email: 'ana@example.com', createdAt: days(-40), subscriptionStatus: 'lite', trialEndsAt: days(-33), currentPeriodEnd: null,
    paymentSourceId: null, paymentMethodType: null, paymentMethodLabel: null, liteSince: days(-33), lastPaymentError: null, giftTrial: false,
    compPro: false, billingInterval: 'month', market: 'CO', creatorCodeId: null, creatorCode: null, equippedTheme: 'theme_neon', ...extra,
  };
}

const calma = { id: 'shop-calma', ...DEFAULT_SHOP_ITEMS.find((i) => i.imageKey === REWARD_THEME_KEY)!, stock: null, sold: 0, isLimited: false, createdAt: days(-1) };
const neon = { id: 'shop-neon', ...DEFAULT_SHOP_ITEMS.find((i) => i.imageKey === 'theme_neon')!, stock: null, sold: 0, isLimited: false, createdAt: days(-1) };

const matchesLinkWhere = (row: Row, where: Row) => {
  if (where.tokenHash && row.tokenHash !== where.tokenHash) return false;
  if (where.id && row.id !== where.id) return false;
  if ('claimedAt' in where && where.claimedAt === null && row.claimedAt) return false;
  if (where.OR && !(row.expiresAt === null || row.expiresAt > where.OR[1].expiresAt.gt)) return false;
  return true;
};

function delegates(state: State): Client {
  const pick = (row: Row | undefined) => (row ? { ...row } : null);
  return {
    $queryRaw: async () => [],
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => pick(state.users.find((u) => u.id === where.id)),
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const user = state.users.find((u) => u.id === where.id)!;
        Object.assign(user, data);
        return { ...user };
      },
    },
    rewardLink: {
      findUnique: async ({ where }: { where: Row }) => pick(state.links.find((l) => matchesLinkWhere(l, where))),
      findUniqueOrThrow: async ({ where }: { where: Row }) => ({ ...state.links.find((l) => matchesLinkWhere(l, where))! }),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const rows = state.links.filter((l) => matchesLinkWhere(l, where));
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(state.links.find((l) => l.id === where.id)!, data),
      create: async ({ data }: { data: Row }) => {
        const row = { id: `link-${state.links.length + 1}`, claimedAt: null, claimedById: null, outcome: null, createdAt: NOW, ...data };
        state.links.push(row);
        return row;
      },
      findMany: async () => [...state.links],
    },
    shopItem: {
      findFirst: async ({ where }: { where: Row }) => pick(state.shopItems.find((s) => s.imageKey === where.imageKey && s.type === where.type)),
      findMany: async () => [...state.shopItems],
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({ ...state.shopItems.find((s) => s.id === where.id)! }),
    },
    inventoryItem: {
      findFirst: async ({ where }: { where: Row }) => pick(state.inventory.find((i) => i.userId === where.userId && i.shopItemId === where.shopItemId)),
      findMany: async ({ where }: { where: Row }) => state.inventory.filter((i) => i.userId === where.userId),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const rows = state.inventory.filter((i) => i.userId === where.userId && i.isEquipped === where.isEquipped && i.shopItemId !== where.NOT.shopItemId);
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(state.inventory.find((i) => i.id === where.id)!, data),
      create: async ({ data }: { data: Row }) => {
        const row = { id: `inv-${state.inventory.length + 1}`, ...data };
        state.inventory.push(row);
        return row;
      },
    },
    subscriptionPayment: { count: async () => 0, findFirst: async () => null },
  };
}

/** Sustituye los delegados de Prisma; $transaction deshace todo si la función falla (como Postgres). */
async function withDb<T>(state: State, run: () => Promise<T>): Promise<T> {
  const fake = delegates(state);
  const mocks: Client = {
    ...fake,
    $transaction: async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
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

function freshState(user: Row, link: Row = {}): { state: State; token: string } {
  const token = generateRewardToken();
  const state: State = {
    users: [user],
    links: [{ id: 'link-1', tokenHash: hashRewardToken(token), proDays: 7, themeKey: REWARD_THEME_KEY, expiresAt: days(20), claimedAt: null, claimedById: null, outcome: null, ...link }],
    shopItems: [calma, neon],
    inventory: [{ id: 'inv-neon', userId: 'u1', shopItemId: 'shop-neon', isEquipped: true }],
  };
  return { state, token };
}

const rejectsWith = (code: string) => (error: unknown) => error instanceof RewardLinkError && error.code === code;

// ─── Canje ───────────────────────────────────────────────────────────────────

test('a Lite account gets 7 days of Pro from now as a gift trial, and the exclusive theme is unlocked and worn', async () => {
  const { state, token } = freshState(baseUser({}));
  const result = await withDb(state, () => claimRewardLink('u1', token, NOW));
  assert.equal(result.claim.outcome, 'activated');
  assert.equal(result.claim.accessEndsAt, days(7).toISOString());
  assert.equal(result.claim.themeUnlocked, true);
  const user = state.users[0];
  assert.equal(user.subscriptionStatus, 'trialing');
  assert.equal(user.giftTrial, true, 'the reward never charges when it ends');
  assert.equal(user.equippedTheme, REWARD_THEME_KEY);
  assert.deepEqual(state.inventory.map((i) => [i.shopItemId, i.isEquipped]), [['shop-neon', false], ['shop-calma', true]]);
  assert.equal(state.links[0].claimedById, 'u1');
  assert.equal(state.links[0].outcome, 'activated');
  assert.equal(result.subscription.plan, 'pro');
});

test('an active paid plan keeps its days: 7 more are added after its end (15 Dec → 22 Dec)', async () => {
  const end = new Date('2026-12-15T12:00:00.000Z');
  const { state, token } = freshState(baseUser({ subscriptionStatus: 'active', currentPeriodEnd: end, paymentSourceId: 'src_1', liteSince: null }));
  const result = await withDb(state, () => claimRewardLink('u1', token, NOW));
  assert.equal(result.claim.outcome, 'extended');
  assert.equal(state.users[0].currentPeriodEnd.toISOString(), '2026-12-22T12:00:00.000Z');
  assert.equal(state.users[0].subscriptionStatus, 'active');
});

test('a running trial (new account) is extended, not restarted', async () => {
  const { state, token } = freshState(baseUser({ subscriptionStatus: 'trialing', trialEndsAt: days(5), liteSince: null, createdAt: days(-2) }));
  const result = await withDb(state, () => claimRewardLink('u1', token, NOW));
  assert.equal(result.claim.outcome, 'extended');
  assert.equal(state.users[0].trialEndsAt.toISOString(), days(12).toISOString());
});

test('complimentary Pro has no date to extend but still receives the theme', async () => {
  const { state, token } = freshState(baseUser({ compPro: true }));
  const result = await withDb(state, () => claimRewardLink('u1', token, NOW));
  assert.equal(result.claim.outcome, 'complimentary');
  assert.equal(result.claim.accessEndsAt, null);
  assert.equal(state.users[0].subscriptionStatus, 'lite', 'the stored status is untouched');
  assert.equal(state.users[0].equippedTheme, REWARD_THEME_KEY);
});

test('a link works once: the same account or another one gets «ya se usó» and nothing else changes', async () => {
  const { state, token } = freshState(baseUser({}));
  state.users.push(baseUser({ id: 'u2', email: 'leo@example.com' }));
  await withDb(state, () => claimRewardLink('u1', token, NOW));
  const endAfterFirst = state.users[0].trialEndsAt.toISOString();
  await assert.rejects(withDb(state, () => claimRewardLink('u1', token, NOW)), rejectsWith('claimed'));
  await assert.rejects(withDb(state, () => claimRewardLink('u2', token, NOW)), rejectsWith('claimed'));
  assert.equal(state.users[0].trialEndsAt.toISOString(), endAfterFirst);
  assert.equal(state.users[1].subscriptionStatus, 'lite');
  assert.equal(state.users[1].equippedTheme, 'theme_neon');
  assert.equal((await withDb(state, () => previewRewardLink(token, NOW))).status, 'claimed');
});

test('expired, revoked and unknown links are refused without touching the account', async () => {
  const expired = freshState(baseUser({}), { expiresAt: days(-1) });
  await assert.rejects(withDb(expired.state, () => claimRewardLink('u1', expired.token, NOW)), rejectsWith('expired'));
  assert.equal(expired.state.users[0].subscriptionStatus, 'lite');

  const revoked = freshState(baseUser({}));
  await withDb(revoked.state, () => revokeRewardLink('link-1', days(-0.01)));
  await assert.rejects(withDb(revoked.state, () => claimRewardLink('u1', revoked.token, NOW)), rejectsWith('expired'));

  await assert.rejects(withDb(expired.state, () => claimRewardLink('u1', generateRewardToken(), NOW)), rejectsWith('invalid'));
  await assert.rejects(withDb(expired.state, () => claimRewardLink('u1', 'not-a-token', NOW)), rejectsWith('invalid'));
});

test('if the theme cannot be granted, the whole claim rolls back and the link stays usable', async () => {
  const { state, token } = freshState(baseUser({}));
  state.shopItems = [neon];
  await assert.rejects(withDb(state, () => claimRewardLink('u1', token, NOW)), /REWARD_THEME_MISSING/);
  assert.equal(state.links[0].claimedAt, null);
  assert.equal(state.users[0].subscriptionStatus, 'lite');
});

test('admin creation returns the full token once and stores only its hash, 30 days by default', async () => {
  const state: State = { users: [], links: [], shopItems: [], inventory: [] };
  const made = await withDb(state, () => createRewardLinks({ count: 3, note: '  @ana_ig ' }, 'admin-1', NOW));
  assert.equal(made.length, 3);
  assert.equal(new Set(made.map((m) => m.token)).size, 3);
  for (const [i, row] of state.links.entries()) {
    assert.equal(row.tokenHash, hashRewardToken(made[i].token));
    assert.ok(!Object.values(row).includes(made[i].token), 'the raw token is never stored');
    assert.equal(row.note, '@ana_ig');
    assert.equal(row.expiresAt.toISOString(), days(30).toISOString());
  }
  const forever = await withDb(state, () => createRewardLinks({ count: 1, expiresInDays: null }, 'admin-1', NOW));
  assert.equal(state.links.find((l) => l.id === forever[0].id)!.expiresAt, null);
});

// ─── Tienda ──────────────────────────────────────────────────────────────────

test('the Shop never sells the reward theme and shows it only to whoever owns it', async () => {
  const { state } = freshState(baseUser({ level: 20, gold: 10_000, avatarConfig: {}, equippedAura: null, equippedFrame: null }));
  const userDelegate = { findUniqueOrThrow: async () => ({ ...state.users[0] }) };
  const run = <T>(fn: () => Promise<T>) => withDb(state, async () => {
    const original = client.user;
    client.user = { ...(original as object), ...userDelegate };
    try { return await fn(); } finally { client.user = original; }
  });
  const before = await run(() => listShopItems('u1'));
  assert.ok(!before.some((item) => item.imageKey === REWARD_THEME_KEY));
  await assert.rejects(run(() => purchaseItem('u1', 'shop-calma')), /exclusivo/);

  state.inventory.push({ id: 'inv-calma', userId: 'u1', shopItemId: 'shop-calma', isEquipped: true });
  const after = await run(() => listShopItems('u1'));
  assert.ok(after.some((item) => item.imageKey === REWARD_THEME_KEY && item.owned));
});
