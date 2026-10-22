import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays } from '../src/lib/plans';

const NOW = new Date('2026-10-22T12:00:00.000Z');

test('the subscription the app receives says when the trial is a gift', async () => {
  const { subscriptionView } = await import('../src/services/billing.service');
  const base = {
    id: 'u1', email: 'ana@example.com', createdAt: addDays(NOW, -30), subscriptionStatus: 'trialing',
    trialEndsAt: addDays(NOW, 7), currentPeriodEnd: null, paymentSourceId: null, paymentMethodType: null,
    paymentMethodLabel: null, liteSince: null, lastPaymentError: null,
  };
  const gift = subscriptionView({ ...base, giftTrial: true } as never, NOW, false, false);
  assert.equal(gift.giftTrial, true);
  assert.equal(gift.plan, 'pro');
  assert.equal(gift.status, 'trialing');
  assert.equal(gift.renews, false, 'a gift never renews, even with a saved card');

  const paid = subscriptionView({ ...base, giftTrial: false } as never, NOW, false, false);
  assert.equal(paid.giftTrial, false);
});
