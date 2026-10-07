import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../src/lib/prisma';
import { factoryResetSchema } from '../src/schemas/auth.schemas';
import { resetAccountData } from '../src/services/account-reset.service';

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

void test('factory reset de cuenta', async (suite) => {
  await suite.test('requiere frase literal de confirmación', () => {
    assert.equal(factoryResetSchema.safeParse({}).success, false);
    assert.equal(factoryResetSchema.safeParse({ confirmation: 'RESET_MY_LIFEQUEST' }).success, true);
  });

  await suite.test('borra datos propios, protege datos compartidos y reinicia el perfil de juego', async () => {
    const calls: string[] = [];
    let userUpdate: Record<string, unknown> | null = null;

    const count = (name: string) => async () => {
      calls.push(name);
      return { count: 1 };
    };

    const tx = new Proxy({} as Record<string, unknown>, {
      get(_target, property) {
        const delegate = String(property);
        if (delegate === 'challenge') {
          return {
            findMany: async () => [
              { id: 'challenge-solo', participants: [] },
              { id: 'challenge-shared', participants: [{ id: 'participant-other' }] },
            ],
            deleteMany: count('challenge.deleteMany'),
            updateMany: count('challenge.updateMany'),
          };
        }
        if (delegate === 'guild') {
          return {
            findMany: async () => [{ id: 'guild-1' }],
            update: async () => { calls.push('guild.update'); return {}; },
            delete: async () => { calls.push('guild.delete'); return {}; },
          };
        }
        if (delegate === 'guildMember') {
          return {
            findFirst: async () => ({ id: 'member-successor', userId: 'user-2' }),
            update: async () => { calls.push('guildMember.update'); return {}; },
            deleteMany: count('guildMember.deleteMany'),
          };
        }
        if (delegate === 'user') {
          return {
            update: async ({ data }: { data: Record<string, unknown> }) => {
              userUpdate = data;
              calls.push('user.update');
              return { level: 1, xp: 0, gold: 0, onboardingCompleted: false };
            },
          };
        }
        if (delegate === 'relationship') {
          // Los jardines compartidos de otras personas solo se desvinculan.
          return { deleteMany: count('relationship.deleteMany'), updateMany: count('relationship.updateMany') };
        }
        return { deleteMany: count(`${delegate}.deleteMany`) };
      },
    });

    await withMocks({
      $transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => operation(tx),
    }, async () => {
      const result = await resetAccountData('user-1');

      assert.equal(result.sharedChallengesCancelled, 1);
      assert.equal(result.guildLeadershipsTransferred, 1);
      assert.equal(result.guildsDeleted, 0);
      assert.equal(result.user.level, 1);
      assert.equal(result.user.xp, 0);
      assert.equal(result.user.gold, 0);
      assert.equal(result.user.onboardingCompleted, false);
      for (const key of [
        'habits', 'quests', 'rituals', 'transactions', 'inventoryItems',
        'userAchievements', 'notifications', 'pushSubscriptions', 'feedback',
        'directMessages', 'socialGestures', 'guildInvites',
        'workouts', 'routines', 'gymAttendances', 'bodyWeights', 'progressPhotos',
        'workoutExercises', 'stickers', 'chatPrefs', 'messageReactions',
      ]) {
        assert.equal(result.deleted[key], 1, `expected ${key} to be deleted`);
      }
      assert.ok(calls.includes('challenge.updateMany'));
      assert.ok(calls.includes('relationship.updateMany'), 'shared gardens of other people are only unlinked');
      assert.ok(calls.includes('guild.update'));
      assert.ok(calls.includes('guildMember.update'));
      assert.equal(userUpdate?.level, 1);
      assert.equal(userUpdate?.xp, 0);
      assert.equal(userUpdate?.gold, 0);
      assert.equal(userUpdate?.onboardingCompleted, false);
      assert.equal(userUpdate?.activeTheme, 'aurora');
      assert.equal(userUpdate?.playerClass, null);
      assert.equal(userUpdate?.gymPlaylistUrl, null);
      assert.equal('googleAccessToken' in (userUpdate ?? {}), false, 'Google connection was explicitly retained');
    });
  });
});
