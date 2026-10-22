import assert from 'node:assert/strict';
import { test } from 'node:test';
import { giftDates, giftFunnel, referralMetrics, utcMonthStart } from '../src/lib/admin-metrics';

const NOW = new Date('2026-10-22T12:00:00.000Z');
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const user = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, email: `${id}@x.com`, createdAt: day('2026-09-01'), subscriptionStatus: 'lite', trialEndsAt: null as Date | null, giftTrial: false,
  ...overrides,
});
const used = (id: string, at: string, overrides: Record<string, unknown> = {}) => ({
  emailKey: `${id}@x.com`, paymentKey: null as string | null, paymentKeys: [] as string[], createdAt: day(at), ...overrides,
});

test('giftDates tells the Lite gift apart from the signup reverse trial and card trials', () => {
  const users = [
    user('lite-gift'),
    user('signup', { createdAt: day('2026-10-10') }),
    user('card', { createdAt: day('2026-08-01') }),
    user('referral', { subscriptionStatus: 'trialing', giftTrial: true, trialEndsAt: day('2026-10-25') }),
  ];
  const dates = giftDates(users, [
    used('lite-gift', '2026-10-20'),
    used('signup', '2026-10-09'), // reclamada antes de crear la cuenta: prueba inversa, no regalo
    used('card', '2026-08-02', { paymentKey: 'fp' }),
  ]);
  assert.deepEqual([...dates.keys()].sort(), ['lite-gift', 'referral']);
  assert.equal(dates.get('referral')?.toISOString(), '2026-10-18T00:00:00.000Z');
});

test('giftFunnel counts live gifts, conversions paid after the gift and gifts that ended in Lite', () => {
  const users = [
    user('live', { subscriptionStatus: 'trialing', giftTrial: true, trialEndsAt: day('2026-10-26') }),
    user('paid', { subscriptionStatus: 'active' }),
    user('lapsed'),
    user('paid-before', { subscriptionStatus: 'active' }),
  ];
  const funnel = giftFunnel(users, [
    used('paid', '2026-10-01'), used('lapsed', '2026-10-01'), used('paid-before', '2026-10-01'),
  ], [
    { userId: 'paid', createdAt: day('2026-10-08') },
    { userId: 'paid-before', createdAt: day('2026-09-15') },
  ], NOW);
  assert.deepEqual(funnel, { available: 0, active: 1, received: 4, converted: 1, conversionRate: 0.25, backToLite: 1 });
});

test('giftFunnel has no conversion rate without gifts', () => {
  assert.equal(giftFunnel([user('a')], [], [], NOW).conversionRate, null);
});

test('referralMetrics uses the UTC month and counts who reached the monthly cap', () => {
  assert.equal(utcMonthStart(new Date('2026-11-01T02:00:00.000Z')).toISOString(), '2026-11-01T00:00:00.000Z');
  const row = (inviterId: string, inviteeId: string, activatedAt: string | null, overrides: Record<string, unknown> = {}) => ({
    inviterId, inviteeId, status: activatedAt ? 'ACTIVATED' : 'PENDING', inviterDays: activatedAt ? 7 : 0, inviteeDays: activatedAt ? 7 : 0,
    flaggedSelfReferral: false, activatedAt: activatedAt ? new Date(activatedAt) : null, ...overrides,
  });
  const metrics = referralMetrics([
    row('ana', 'b1', '2026-10-02T10:00:00.000Z'),
    row('ana', 'b2', '2026-10-05T10:00:00.000Z'),
    row('ana', 'b3', '2026-10-09T10:00:00.000Z'),
    row('ana', 'b4', '2026-10-12T10:00:00.000Z', { inviterDays: 9 }),
    row('ana', 'b5', '2026-09-30T23:59:00.000Z'), // mes anterior en UTC
    row('ana', 'b6', null),
    row('ana', 'b7', null, { flaggedSelfReferral: true }),
  ], NOW);
  assert.equal(metrics.total, 7);
  assert.equal(metrics.activated, 5);
  assert.equal(metrics.pending, 1);
  assert.equal(metrics.flagged, 1);
  assert.equal(metrics.monthStart, '2026-10-01T00:00:00.000Z');
  assert.equal(metrics.activatedThisMonth, 4);
  assert.equal(metrics.daysGrantedThisMonth, 7 + 7 + 7 + 9 + 4 * 7);
  assert.equal(metrics.capDays, 30);
  assert.equal(metrics.atCap, 1);
});
