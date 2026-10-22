import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prisma } from '../src/lib/prisma';
import { MARK_GIFT_AVAILABLE_SQL } from '../src/lib/gift-trial-migrations';

const DAY = 24 * 60 * 60_000;

test('entering the app activates an available gift: 7 days from now, giftTrial on, availability cleared', async () => {
  const { giftTrialToLite } = await import('../src/services/auth.service');
  const client = prisma as unknown as Record<string, unknown>;
  const originals = { user: client.user, subscriptionPayment: client.subscriptionPayment, usedTrial: client.usedTrial };
  const updates: Array<Record<string, unknown>> = [];
  const claimed: string[] = [];
  try {
    client.user = {
      findUnique: async () => ({ email: 'Ana@x.com', subscriptionStatus: 'lite', currentPeriodEnd: null, paymentSourceId: null, onboardingCompleted: true, compPro: false }),
      update: async ({ data }: { data: Record<string, unknown> }) => { updates.push(data); return {}; },
    };
    client.subscriptionPayment = { findFirst: async () => null };
    client.usedTrial = { create: async ({ data }: { data: { emailKey: string } }) => { claimed.push(data.emailKey); return {}; } };

    const before = Date.now();
    await giftTrialToLite('u1');
    assert.deepEqual(claimed, ['ana@x.com']);
    assert.equal(updates.length, 1);
    const [data] = updates;
    assert.equal(data.subscriptionStatus, 'trialing');
    assert.equal(data.giftTrial, true);
    assert.equal(data.giftAvailable, false);
    const end = (data.trialEndsAt as Date).getTime();
    assert.ok(end >= before + 7 * DAY && end <= Date.now() + 7 * DAY, 'the 7 days start at the moment of entry');
  } finally { Object.assign(client, originals); }
});

test('a team courtesy account never activates the gift nor spends its used_trials row', async () => {
  const { giftTrialToLite } = await import('../src/services/auth.service');
  const client = prisma as unknown as Record<string, unknown>;
  const originals = { user: client.user, usedTrial: client.usedTrial };
  let touched = false;
  try {
    client.user = {
      findUnique: async () => ({ email: 'pao@x.com', subscriptionStatus: 'lite', currentPeriodEnd: null, paymentSourceId: null, onboardingCompleted: true, compPro: true }),
      update: async () => { touched = true; return {}; },
    };
    client.usedTrial = { create: async () => { touched = true; return {}; } };
    await giftTrialToLite('u2');
    assert.equal(touched, false);
  } finally { Object.assign(client, originals); }
});

test('the availability mark only records eligibility: it never changes plan, status or dates', () => {
  const setClause = MARK_GIFT_AVAILABLE_SQL.slice(MARK_GIFT_AVAILABLE_SQL.indexOf('SET'), MARK_GIFT_AVAILABLE_SQL.indexOf('FROM eligible'));
  assert.match(setClause, /"giftAvailable" = e\.ok/);
  assert.doesNotMatch(setClause, /subscriptionStatus|trialEndsAt|giftTrial"/);
  for (const rule of ['"subscriptionStatus" = \'lite\'', '"paymentSourceId" IS NULL', '"compPro" = false', '"used_trials"', '\'APPROVED\'']) {
    assert.ok(MARK_GIFT_AVAILABLE_SQL.includes(rule), rule);
  }
});
