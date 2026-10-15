import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { purchaseItem } from '../src/services/shop.service';
import { seedWisdomCards } from '../src/services/wisdom.service';
import { DEFAULT_SHOP_ITEMS } from '../src/lib/default-catalog';
import { WISDOM_QUOTES } from '../src/lib/wisdom-quotes';

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

// ─── Temas ───────────────────────────────────────────────────────────────────

test('buying a theme charges its Gold, keeps it in the inventory and puts it on the account', async () => {
  const neon = DEFAULT_SHOP_ITEMS.find((i) => i.imageKey === 'theme_neon')!;
  const item = { id: 'neon', ...neon, stock: null, sold: 0 };
  const user = { id: 'u1', gold: 1000, level: 10, equippedTheme: null as string | null };
  const inventory: Array<{ id: string; userId: string; shopItemId: string; isEquipped: boolean; shopItem: typeof item }> = [];
  const userDelegate = {
    findUniqueOrThrow: async () => ({ ...user }),
    updateMany: async ({ where, data }: { where: { gold: { gte: number } }; data: { gold: { decrement: number } } }) => {
      if (user.gold < where.gold.gte) return { count: 0 };
      user.gold -= data.gold.decrement;
      return { count: 1 };
    },
    update: async ({ data }: { data: { equippedTheme?: string | null } }) => { Object.assign(user, data); return { ...user }; },
  };
  const inventoryItem = {
    findFirst: async ({ where }: { where: { id?: string; shopItemId?: string } }) =>
      inventory.find((i) => (where.id ? i.id === where.id : i.shopItemId === where.shopItemId)) ?? null,
    create: async ({ data }: { data: { userId: string; shopItemId: string } }) => {
      const row = { id: `inv-${inventory.length + 1}`, ...data, isEquipped: false, shopItem: item };
      inventory.push(row);
      return row;
    },
    updateMany: async () => ({ count: 0 }),
    update: async ({ where, data }: { where: { id: string }; data: { isEquipped: boolean } }) => {
      const row = inventory.find((i) => i.id === where.id)!;
      row.isEquipped = data.isEquipped;
      return row;
    },
  };
  await withMocks({
    shopItem: { findUniqueOrThrow: async () => item },
    user: userDelegate,
    inventoryItem,
    $transaction: async (run: (tx: Client) => Promise<unknown>) => run({ user: userDelegate, inventoryItem, shopItem: {} }),
  }, async () => {
    const result = await purchaseItem('u1', 'neon');
    assert.equal(user.gold, 1000 - neon.cost);
    assert.equal(inventory.length, 1);
    assert.equal(user.equippedTheme, 'theme_neon', 'the account carries the theme the web applies');
    assert.equal(result.user.equippedTheme, 'theme_neon');
    assert.equal(result.inventoryItem.isEquipped, true);
    await assert.rejects(() => purchaseItem('u1', 'neon'), /Ya tienes este artículo/);
    assert.equal(user.gold, 1000 - neon.cost, 'buying it twice never charges');
  });
});

test('the theme catalog has one entry per skin, each wearable on the theme slot', () => {
  const themes = DEFAULT_SHOP_ITEMS.filter((i) => i.type === 'THEME');
  const keys = themes.map((t) => t.imageKey);
  assert.equal(new Set(keys).size, keys.length);
  for (const id of ['aurora', 'mono', 'ocean', 'forest', 'lava', 'papyrus', 'neon', 'galaxy', 'cyber']) assert.ok(keys.includes(`theme_${id}`), id);
  for (const t of themes) {
    assert.equal('slot' in t && t.slot, 'theme');
    assert.equal('value' in t && t.value, t.imageKey);
  }
});

// ─── Sabiduría ───────────────────────────────────────────────────────────────

test('every wisdom quote has a named author, a known category and no duplicates', () => {
  const categories = new Set(['discipline', 'mindset', 'strategy', 'finance', 'health', 'relationships', 'growth']);
  assert.ok(WISDOM_QUOTES.length >= 80);
  assert.ok(WISDOM_QUOTES.filter((q) => q.levelRequired === 1).length >= 30, 'new players start with a wide repertoire');
  const seen = new Set<string>();
  for (const q of WISDOM_QUOTES) {
    assert.ok(q.author.trim().length > 2, q.quote);
    assert.ok(categories.has(q.category), q.category);
    assert.ok(!seen.has(q.quote), `duplicated: ${q.quote}`);
    seen.add(q.quote);
  }
});

test('seeding wisdom keeps stable ids and removes quotes that left the list', async () => {
  const calls: Array<{ notIn: string[]; created: string[] }> = [];
  let notIn: string[] = [];
  await withMocks({
    wisdomCard: {
      deleteMany: async ({ where }: { where: { id: { notIn: string[] } } }) => { notIn = where.id.notIn; return { count: 0 }; },
      createMany: async ({ data, skipDuplicates }: { data: Array<{ id: string }>; skipDuplicates: boolean }) => {
        assert.equal(skipDuplicates, true);
        calls.push({ notIn, created: data.map((d) => d.id) });
        return { count: data.length };
      },
    },
  }, async () => {
    await seedWisdomCards();
    await seedWisdomCards();
  });
  assert.deepEqual(calls[0].created, calls[1].created, 'same ids on every deploy');
  assert.deepEqual(calls[0].notIn, calls[0].created);
  assert.equal(new Set(calls[0].created).size, WISDOM_QUOTES.length);
});
