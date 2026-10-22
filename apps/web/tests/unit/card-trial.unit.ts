import test from 'node:test';
import assert from 'node:assert/strict';
import { cardTrialCopy, cardTrialDue, cardTrialKey, trialDaysLeft, trialDoneLine } from '../../src/lib/planPreview';

const DAY = 24 * 60 * 60_000;
const END = '2026-10-29T12:00:00.000Z';
const at = (daysBefore: number) => Date.parse(END) - daysBefore * DAY;
const card = { status: 'trialing', trialEndsAt: END, hasPaymentMethod: true, paymentMethodLabel: 'VISA •••• 4242', paymentMethodType: 'CARD' as const, complimentary: false };
const none = () => false;

test('days left round up and stop at zero', () => {
  assert.equal(trialDaysLeft(END, at(2)), 2);
  assert.equal(trialDaysLeft(END, at(1.5)), 2);
  assert.equal(trialDaysLeft(END, Date.parse(END) + DAY), 0);
});

test('a card linked during the trial gets the first notice once, then the pre-charge notice two days before', () => {
  assert.equal(cardTrialDue(card, none, at(6)), 'linked');
  assert.equal(cardTrialDue(card, (k) => k === 'linked', at(6)), null);
  assert.equal(cardTrialDue(card, (k) => k === 'linked', at(2)), 'pre-charge');
  assert.equal(cardTrialDue(card, (k) => k === 'linked' || k === 'pre-charge', at(2)), null);
});

test('no card notice without a linked card in trial, or for courtesy accounts', () => {
  assert.equal(cardTrialDue({ ...card, hasPaymentMethod: false }, none, at(2)), null);
  assert.equal(cardTrialDue({ ...card, status: 'active' }, none, at(2)), null);
  assert.equal(cardTrialDue({ ...card, complimentary: true }, none, at(2)), null);
  assert.equal(cardTrialDue(null, none, at(2)), null);
});

test('copy: dates and amounts are dynamic, both ways out are visible, no pressure words', () => {
  const linked = cardTrialCopy('linked', card);
  assert.match(linked.title, /^Tu prueba Pro termina el \d{1,2} de /);
  assert.match(linked.body, /\$9\.900 COP/);
  assert.match(linked.body, /unos \$330 COP al día/);
  assert.match(linked.body, /Si cancelas antes del /);
  assert.deepEqual([linked.primary, linked.secondary], ['Seguir con Pro', 'Ver mi plan']);

  const pre = cardTrialCopy('pre-charge', card);
  assert.equal(pre.title, 'En 2 días se cobra tu primer mes');
  assert.match(pre.body, /a tu VISA •••• 4242/);
  assert.deepEqual([pre.primary, pre.secondary], ['Seguir con Pro', 'Cancelar en Plan']);

  for (const text of [linked.title + linked.body, pre.title + pre.body]) {
    assert.doesNotMatch(text, /último|ahora mismo|urgente|no pierdas|horas/i);
  }
});

test('the pre-charge copy falls back to the method type when the label is missing', () => {
  const nequi = { ...card, paymentMethodLabel: null, paymentMethodType: 'NEQUI' as const };
  assert.match(cardTrialCopy('pre-charge', nequi).body, /a tu Nequi/);
});

test('the key is per trial, so a new trial with a card notifies again', () => {
  assert.notEqual(cardTrialKey('u1', 'linked', END), cardTrialKey('u1', 'linked', '2026-11-05T12:00:00.000Z'));
});

test('the line after linking says nothing is charged today and when the charge is', () => {
  const line = trialDoneLine(card);
  assert.match(line, /Hoy no se cobra nada/);
  assert.match(line, /\$9\.900 COP/);
  assert.match(trialDoneLine({ ...card, hasPaymentMethod: false }), /\$0 hoy/);
});
