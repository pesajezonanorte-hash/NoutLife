import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import {
  RENEWAL_GRACE_MS, TRIAL_DAYS, accessEndsAt, addDays, addMonth, hasProAccess, nextAction, paymentReference, planOf,
  type SubscriptionFields,
} from '../src/lib/plans';
import { eventChecksum, integritySignature, verifyEventChecksum, type WompiEvent } from '../src/lib/wompi';

const NOW = new Date('2026-10-12T15:00:00.000Z');
const HOUR = 60 * 60_000;

function user(overrides: Partial<SubscriptionFields> = {}): SubscriptionFields {
  return {
    subscriptionStatus: 'trialing',
    trialEndsAt: addDays(NOW, 3),
    currentPeriodEnd: null,
    paymentSourceId: null,
    createdAt: addDays(NOW, -4),
    ...overrides,
  };
}

test('a new account is Pro during its 7-day trial, with or without a card', () => {
  assert.equal(planOf(user(), NOW), 'pro');
  assert.equal(planOf(user({ paymentSourceId: '3891' }), NOW), 'pro');
  assert.equal(nextAction(user(), NOW), 'none');
});

test('an expired trial without a card downgrades to Lite', () => {
  const expired = user({ trialEndsAt: new Date(NOW.getTime() - HOUR) });
  assert.equal(planOf(expired, NOW), 'lite');
  assert.equal(nextAction(expired, NOW), 'downgrade');
});

test('an expired trial with a card is charged and keeps Pro only during the renewal grace', () => {
  const end = new Date(NOW.getTime() - HOUR);
  const withCard = user({ trialEndsAt: end, paymentSourceId: '3891' });
  assert.equal(nextAction(withCard, NOW), 'charge');
  assert.equal(planOf(withCard, NOW), 'pro');
  assert.equal(planOf(withCard, new Date(end.getTime() + RENEWAL_GRACE_MS + 1)), 'lite');
});

test('cancelling keeps Pro until the end of the trial, then downgrades without charging', () => {
  const canceled = user({ subscriptionStatus: 'canceled', paymentSourceId: '3891' });
  assert.equal(planOf(canceled, NOW), 'pro');
  const after = addDays(NOW, 4);
  assert.equal(planOf(canceled, after), 'lite');
  assert.equal(nextAction(canceled, after), 'downgrade');
});

test('an active month renews at the end of the paid period', () => {
  const active = user({ subscriptionStatus: 'active', currentPeriodEnd: addDays(NOW, 10), paymentSourceId: '3891' });
  assert.equal(accessEndsAt(active).toISOString(), addDays(NOW, 10).toISOString());
  assert.equal(nextAction(active, NOW), 'none');
  assert.equal(nextAction(active, addDays(NOW, 11)), 'charge');
});

test('Lite is never charged and never has Pro access', () => {
  const lite = user({ subscriptionStatus: 'lite', paymentSourceId: '3891', trialEndsAt: addDays(NOW, 3) });
  assert.equal(planOf(lite, NOW), 'lite');
  assert.equal(nextAction(lite, NOW), 'none');
  assert.equal(hasProAccess(lite, NOW), false);
});

test('accounts without a trial date count the trial from sign-up', () => {
  const legacy = user({ trialEndsAt: null, createdAt: addDays(NOW, -(TRIAL_DAYS + 1)) });
  assert.equal(nextAction(legacy, NOW), 'downgrade');
});

test('addMonth keeps the day and clamps to the end of shorter months', () => {
  assert.equal(addMonth(new Date('2026-01-31T10:00:00.000Z')).toISOString(), '2026-02-28T10:00:00.000Z');
  assert.equal(addMonth(new Date('2026-10-12T10:00:00.000Z')).toISOString(), '2026-11-12T10:00:00.000Z');
  assert.equal(addMonth(new Date('2026-12-15T10:00:00.000Z')).toISOString(), '2027-01-15T10:00:00.000Z');
});

test('the payment reference is stable per user and period, so concurrent charges collide', () => {
  const end = new Date('2026-10-19T15:00:00.000Z');
  assert.equal(paymentReference('cuid123', end), paymentReference('cuid123', new Date(end)));
  assert.notEqual(paymentReference('cuid123', end), paymentReference('cuid123', addMonth(end)));
});

test('integritySignature matches the Wompi example (SHA-256 of reference + cents + currency + secret)', () => {
  // Hash publicado en la documentación de Wompi (Widget & Checkout Web → firma de integridad).
  assert.equal(
    integritySignature('sk8-438k4-xmxm392-sn2m', 2490000, 'COP', 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6'),
    '37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5',
  );
});

test('event checksum follows signature.properties order, then timestamp, then the events secret', () => {
  const event: WompiEvent = {
    event: 'transaction.updated',
    data: { transaction: { id: '1234-1610641025-49201', status: 'APPROVED', amount_in_cents: 4490000 } },
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
    timestamp: 1530291411,
  };
  const expected = createHash('sha256').update('1234-1610641025-49201APPROVED44900001530291411test_events_secret').digest('hex');
  assert.equal(eventChecksum(event, 'test_events_secret'), expected);

  assert.equal(verifyEventChecksum({ ...event, signature: { ...event.signature, checksum: expected.toUpperCase() } }, 'test_events_secret'), true);
  assert.equal(verifyEventChecksum(event, 'test_events_secret', expected), true);
  assert.equal(verifyEventChecksum(event, 'another_secret', expected), false);
  const tampered = { ...event, data: { transaction: { id: '1234-1610641025-49201', status: 'APPROVED', amount_in_cents: 100 } } };
  assert.equal(verifyEventChecksum(tampered, 'test_events_secret', expected), false);
});

test('emailKey ignores case and spaces; cardKey ignores holder formatting but not the card', async () => {
  const { emailKey, cardKey } = await import('../src/lib/trial-keys');
  assert.equal(emailKey('  Ana.Perez@Gmail.com '), 'ana.perez@gmail.com');
  const card = { bin: '424242', lastFour: '4242', expMonth: '8', expYear: '2028', holder: 'José Pérez' };
  assert.equal(cardKey(card), cardKey({ ...card, expMonth: '08', expYear: '28', holder: 'JOSE  PEREZ' }));
  assert.notEqual(cardKey(card), cardKey({ ...card, lastFour: '1111' }));
});
