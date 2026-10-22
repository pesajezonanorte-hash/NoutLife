import assert from 'node:assert/strict';
import { test } from 'node:test';
import { complimentaryEmails, giftEligible } from '../src/lib/plans';

const lite = {
  subscriptionStatus: 'lite',
  currentPeriodEnd: null,
  paymentSourceId: null,
  onboardingCompleted: true,
};

test('a Lite account that never tried Pro nor paid gets the gift', () => {
  assert.equal(giftEligible(lite, false), true);
});

test('the gift is never given to an account that has paid, has a card, has a paid period or is complimentary', () => {
  assert.equal(giftEligible(lite, true), false, 'an approved charge in the past');
  assert.equal(giftEligible({ ...lite, paymentSourceId: '3891' }, false), false, 'a saved card');
  assert.equal(giftEligible({ ...lite, currentPeriodEnd: new Date('2026-09-01') }, false), false, 'a paid period');
  assert.equal(giftEligible({ ...lite, complimentary: true }, false), false, 'a complimentary account');
});

test('accounts that have not finished onboarding, or are not on Lite, are left alone', () => {
  assert.equal(giftEligible({ ...lite, onboardingCompleted: false }, false), false);
  assert.equal(giftEligible({ ...lite, subscriptionStatus: 'trialing' }, false), false);
  assert.equal(giftEligible({ ...lite, subscriptionStatus: 'active' }, false), false);
});

test('complimentary emails are matched case-insensitively and ignore blanks', () => {
  const list = complimentaryEmails(' Prizzy@Gmail.com , ,otra@example.com ');
  assert.equal(list.has('prizzy@gmail.com'), true);
  assert.equal(list.has('otra@example.com'), true);
  assert.equal(list.size, 2);
});
