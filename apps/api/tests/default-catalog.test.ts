import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_SHOP_ITEMS,
  ensureDefaultCatalog,
} from '../src/lib/default-catalog';

test('ensureDefaultCatalog restores only missing global shop rows and preserves existing achievement rows', async () => {
  const existingShopName = DEFAULT_SHOP_ITEMS[0].name;
  const createdShopItems: string[] = [];
  const achievementUpserts: Array<{ key: string; update: Record<string, never> }> = [];
  const shopUpdates: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];

  const client = {
    achievement: {
      upsert: async (args: { where: { key: string }; update: Record<string, never> }) => {
        achievementUpserts.push({ key: args.where.key, update: args.update });
      },
    },
    shopItem: {
      // A row created before items knew which part of the character they change.
      findMany: async () => [{ id: 'row-1', name: existingShopName, slot: null, value: null, type: 'HAT', description: null, stock: null }],
      create: async (args: { data: { name: string } }) => {
        createdShopItems.push(args.data.name);
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        shopUpdates.push(args);
      },
    },
  };

  await ensureDefaultCatalog(client as never);

  assert.equal(achievementUpserts.length, DEFAULT_ACHIEVEMENTS.length);
  assert.ok(achievementUpserts.every(({ update }) => Object.keys(update).length === 0));
  assert.equal(createdShopItems.length, DEFAULT_SHOP_ITEMS.length - 1);
  assert.ok(!createdShopItems.includes(existingShopName));
  // The existing row learns its slot and value; its price and level are left alone.
  assert.equal(shopUpdates.length, 1);
  assert.equal(shopUpdates[0].where.id, 'row-1');
  assert.equal(shopUpdates[0].data.slot, DEFAULT_SHOP_ITEMS[0].slot);
  assert.equal(shopUpdates[0].data.value, DEFAULT_SHOP_ITEMS[0].value);
  assert.ok(!('cost' in shopUpdates[0].data) && !('levelRequired' in shopUpdates[0].data));
});

test('default catalog keeps the player-facing achievements and shop populated', () => {
  assert.equal(DEFAULT_ACHIEVEMENTS.length, 33);
  assert.ok(DEFAULT_SHOP_ITEMS.length >= 25);
  assert.equal(new Set(DEFAULT_ACHIEVEMENTS.map((achievement) => achievement.key)).size, DEFAULT_ACHIEVEMENTS.length);
  assert.equal(new Set(DEFAULT_SHOP_ITEMS.map((item) => item.name)).size, DEFAULT_SHOP_ITEMS.length);
});
