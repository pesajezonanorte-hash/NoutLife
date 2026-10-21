import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextAction, planOf, willRenew } from '../src/lib/plans';
import { grantableDays, proExtension, REFERRAL_MONTHLY_CAP_DAYS } from '../src/lib/referrals';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const DAY = 24 * 60 * 60_000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

test('referral rewards stop at 30 days a month per person', () => {
  assert.equal(grantableDays(0), 7);
  assert.equal(grantableDays(25), 5);
  assert.equal(grantableDays(REFERRAL_MONTHLY_CAP_DAYS), 0);
  assert.equal(grantableDays(40), 0);
  assert.equal(grantableDays(0, 3), 3);
});

test('Lite becomes a gift trial of the reward days, without the old Lite date', () => {
  const lite = { subscriptionStatus: 'lite', trialEndsAt: days(-30), currentPeriodEnd: days(-10), paymentSourceId: null, createdAt: days(-60) };
  const data = proExtension(lite, 7, NOW);
  assert.equal(data?.subscriptionStatus, 'trialing');
  assert.equal(data?.trialEndsAt?.toISOString(), days(7).toISOString());
  assert.equal(data?.currentPeriodEnd, null);
  assert.equal(data?.giftTrial, true);
});

test('a gift trial with a saved card never renews: it ends in Lite without a charge', () => {
  const gift = { subscriptionStatus: 'trialing', trialEndsAt: days(7), currentPeriodEnd: null, paymentSourceId: '3891', createdAt: days(-30), giftTrial: true };
  assert.equal(willRenew(gift), false);
  assert.equal(planOf(gift, NOW), 'pro');
  const ended = { ...gift, trialEndsAt: days(-1) };
  assert.equal(nextAction(ended, NOW), 'downgrade');
  assert.equal(planOf(ended, NOW), 'lite');
});

test('linking a card ends the gift: the trial renews again (the flag is cleared by the server)', () => {
  const linked = { subscriptionStatus: 'trialing', trialEndsAt: days(7), currentPeriodEnd: null, paymentSourceId: '3891', createdAt: days(-30), giftTrial: false };
  assert.equal(willRenew(linked), true);
});

test('a running trial is extended from its end, not from today', () => {
  const trial = { subscriptionStatus: 'trialing', trialEndsAt: days(2), currentPeriodEnd: null, paymentSourceId: null, createdAt: days(-5) };
  assert.equal(proExtension(trial, 7, NOW)?.trialEndsAt?.toISOString(), days(9).toISOString());
});

test('a paid period is extended from its end; an expired one from today', () => {
  const paid = { subscriptionStatus: 'active', trialEndsAt: null, currentPeriodEnd: days(10), paymentSourceId: '3891', createdAt: days(-40) };
  assert.equal(proExtension(paid, 7, NOW)?.currentPeriodEnd?.toISOString(), days(17).toISOString());
  const expired = { ...paid, currentPeriodEnd: days(-1) };
  assert.equal(proExtension(expired, 7, NOW)?.currentPeriodEnd?.toISOString(), days(7).toISOString());
});

test('complimentary accounts and empty grants get nothing', () => {
  const comp = { subscriptionStatus: 'lite', trialEndsAt: null, currentPeriodEnd: null, paymentSourceId: null, createdAt: days(-400), complimentary: true };
  assert.equal(proExtension(comp, 7, NOW), null);
  assert.equal(proExtension({ ...comp, complimentary: false }, 0, NOW), null);
});
