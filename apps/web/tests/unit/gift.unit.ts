import test from 'node:test';
import assert from 'node:assert/strict';
import type { Subscription } from '@noutlife/shared';
import { GIFT_WELCOME, giftProgress, shouldShowGiftWelcome } from '../../src/lib/gift';

const DAY = 24 * 60 * 60_000;
const NOW = Date.parse('2026-10-22T12:00:00.000Z');
const gift = (overrides: Partial<Subscription> = {}): Subscription => ({
  status: 'trialing', plan: 'pro', giftTrial: true, trialDays: 7,
  trialEndsAt: new Date(NOW + 7 * DAY).toISOString(),
  currentPeriodEnd: null, accessEndsAt: null, renews: false, hasPaymentMethod: false,
  paymentMethodLabel: null, liteSince: null, lastPaymentError: null, pendingPayment: false,
  trialAvailable: false, priceCop: 9900,
  ...overrides,
} as Subscription);

test('the gift starts on day 1 and counts up to day 7', () => {
  assert.deepEqual(giftProgress(gift(), NOW), { day: 1, of: 7 });
  assert.deepEqual(giftProgress(gift({ trialEndsAt: new Date(NOW + 3 * DAY).toISOString() }), NOW), { day: 5, of: 7 });
  assert.deepEqual(giftProgress(gift({ trialEndsAt: new Date(NOW + 0.5 * DAY).toISOString() }), NOW), { day: 7, of: 7 });
});

test('a paid trial, a Lite account or a complimentary Pro is not a gift', () => {
  assert.equal(giftProgress(gift({ giftTrial: false }), NOW), null);
  assert.equal(giftProgress(gift({ giftTrial: undefined }), NOW), null, 'older APIs never send the flag');
  assert.equal(giftProgress(gift({ status: 'lite', plan: 'lite' }), NOW), null);
  assert.equal(giftProgress(gift({ status: 'active' }), NOW), null);
  assert.equal(giftProgress(undefined, NOW), null);
});

test('the welcome shows once per account while the gift is active', () => {
  assert.equal(shouldShowGiftWelcome(gift(), false, NOW), true);
  assert.equal(shouldShowGiftWelcome(gift(), true, NOW), false, 'already closed on this device');
  assert.equal(shouldShowGiftWelcome(gift({ giftTrial: false }), false, NOW), false);
});

test('the welcome tells the truth about the end: no charge, back to Lite', () => {
  assert.match(GIFT_WELCOME.title, /7 días de NoutLife Pro/);
  assert.match(GIFT_WELCOME.ending, /Lite/);
  assert.match(GIFT_WELCOME.ending, /No hay cobros/);
});
