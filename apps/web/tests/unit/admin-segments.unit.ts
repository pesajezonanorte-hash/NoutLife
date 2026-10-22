import test from 'node:test';
import assert from 'node:assert/strict';
import type { AdminUser } from '../../src/services/admin.service';
import { activitySegment, planSegment, segmentUsers } from '../../src/lib/admin-segments';

const DAY = 24 * 60 * 60_000;
const NOW = Date.parse('2026-10-22T12:00:00.000Z');
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();
const user = (overrides: Partial<AdminUser>): AdminUser => ({
  status: 'lite', complimentary: false, giftTrial: false, lastSeenAt: ago(1), createdAt: ago(60),
  ...overrides,
} as AdminUser);

test('planSegment separates gift trials, signup trials, paid Pro and courtesy', () => {
  assert.equal(planSegment(user({ status: 'trialing', giftTrial: true })), 'gift');
  assert.equal(planSegment(user({ status: 'trialing' })), 'trial');
  assert.equal(planSegment(user({ status: 'active' })), 'paid');
  assert.equal(planSegment(user({ status: 'canceled' })), 'canceled');
  assert.equal(planSegment(user({ status: 'active', complimentary: true })), 'complimentary');
  assert.equal(planSegment(user({})), 'lite');
});

test('activitySegment buckets by last visit; never seen counts as dormant', () => {
  assert.equal(activitySegment(ago(7), NOW), 'week');
  assert.equal(activitySegment(ago(8), NOW), 'month');
  assert.equal(activitySegment(ago(31), NOW), 'dormant');
  assert.equal(activitySegment(null, NOW), 'dormant');
});

test('segmentUsers adds every account once per dimension', () => {
  const s = segmentUsers([
    user({ status: 'trialing', giftTrial: true, createdAt: ago(2) }),
    user({ status: 'active', lastSeenAt: ago(20) }),
    user({ lastSeenAt: null }),
  ], NOW);
  assert.deepEqual(s.plan, { paid: 1, gift: 1, trial: 0, canceled: 0, lite: 1, complimentary: 0 });
  assert.deepEqual(s.activity, { week: 1, month: 1, dormant: 1 });
  assert.equal(s.newThisWeek, 1);
});
