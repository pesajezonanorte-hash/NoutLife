import assert from 'node:assert/strict';
import { test } from 'node:test';
import { grantableDays, proExtension, referralMonthStart, REFERRAL_MONTHLY_CAP_DAYS } from '../src/lib/referrals';

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

test('the monthly cap resets on the first day of the UTC month', () => {
  assert.equal(referralMonthStart(NOW).toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(referralMonthStart(new Date('2026-10-31T23:59:00.000Z')).toISOString(), '2026-10-01T00:00:00.000Z');
});

test('Lite becomes a gift trial of the reward days, without the old Lite date', () => {
  const lite = { subscriptionStatus: 'lite', trialEndsAt: days(-30), currentPeriodEnd: days(-10), paymentSourceId: null, createdAt: days(-60) };
  const data = proExtension(lite, 7, NOW);
  assert.equal(data?.subscriptionStatus, 'trialing');
  assert.equal(data?.trialEndsAt?.toISOString(), days(7).toISOString());
  assert.equal(data?.currentPeriodEnd, null);
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
