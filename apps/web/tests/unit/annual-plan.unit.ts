import test from 'node:test';
import assert from 'node:assert/strict';
import { PRICE_LISTS, PRO_ANNUAL_PRICE_COP, annualAvailable, longDate } from '../../src/lib/plan';
import { freeMonthsLabel, offerFor } from '../../src/lib/offer';
import { cardTrialCopy, foundingPriceLine, trialDoneLine } from '../../src/lib/planPreview';

// La oferta colombiana en español: los mismos textos de siempre (montos en centavos: pesos × 100).
const co = offerFor('es', PRICE_LISTS.CO);
const cop = (pesos: number) => pesos * 100;

test('annual numbers come from the price arithmetic: $89.900, $28.900 saved (24 %), $7.492 a month, $246 a day', () => {
  assert.equal(PRO_ANNUAL_PRICE_COP, 89900);
  assert.equal(co.listFor('year'), cop(89900));
  assert.equal(co.savings, cop(28900));
  assert.equal(co.savingsPercent, 24);
  assert.equal(co.perMonthOfYear, cop(7492));
  assert.equal(co.perDayFor('year'), cop(246));
  assert.equal(co.perDayFor('month'), cop(330));
});

test('free months are only claimed when the arithmetic backs them', () => {
  assert.equal(co.freeMonths, 'casi 3 meses gratis');
  assert.equal(freeMonthsLabel(19800, 9900), '2 meses gratis');
  assert.equal(freeMonthsLabel(29700, 9900), '3 meses gratis');
  assert.equal(freeMonthsLabel(24750, 9900), 'más de 2 meses gratis');
  assert.equal(freeMonthsLabel(9900, 9900), '1 mes gratis');
});

test('first payment with a creator code: whole pesos, capped at 50 %, same as the API', () => {
  assert.equal(co.firstPayment('year'), cop(89900));
  assert.equal(co.firstPayment('year', 10), cop(80910));
  assert.equal(co.firstPayment('month', 15), cop(8415));
  assert.equal(co.firstPayment('month', 80), cop(4950));
  assert.equal(co.priceLabel('year', cop(89900)), '$89.900/año');
  assert.equal(co.priceLabel('year', cop(80910)), '$80.910 el primer año');
  assert.equal(co.priceLabel('month', cop(9900)), '$9.900/mes');
});

test('what is charged today and after, in one sentence', () => {
  assert.equal(co.chargeLine('year', cop(89900)), 'Hoy $89.900 por 12 meses de Pro. Se renueva cada año, el mismo día. Cancela la renovación con 1 clic.');
  assert.equal(co.chargeLine('year', cop(80910)), 'Hoy $80.910 por 12 meses de Pro. Luego $89.900 cada año, el mismo día. Cancela la renovación con 1 clic.');
  assert.equal(co.chargeLine('month', cop(9900)), 'Hoy $9.900 y luego cada mes, el mismo día. Cancela en cualquier momento con 1 clic.');
  assert.equal(co.chargeLine('month', cop(8910)), 'Hoy $8.910 y luego $9.900 cada mes, el mismo día. Cancela en cualquier momento con 1 clic.');
});

test('per-day framing for each plan, never a product comparison', () => {
  assert.equal(co.framing('month'), 'Solo $330 COP al día para desbloquear todo tu potencial.');
  assert.equal(co.framing('month', true), 'Después de tu prueba: solo $330 COP al día para desbloquear todo tu potencial.');
  assert.equal(co.framing('year'), 'Solo $246 COP al día por un año completo de Pro.');
  assert.equal(co.framing('year', true), 'Después de tu prueba: solo $246 COP al día por un año completo de Pro.');
  const copy = [co.framing('year'), co.annualPitch.title, co.annualPitch.body, ...co.annualPitch.points].join(' ');
  assert.doesNotMatch(copy, /café|sándwich|XP|nivel|héroe|temporada/i);
  assert.match(co.annualPitch.body, /casi 3 meses gratis/);
});

test('the annual plan is offered only when the API returns an interval (an older API would bill monthly)', () => {
  assert.equal(annualAvailable({ interval: 'month' } as never), true);
  assert.equal(annualAvailable({} as never), false);
  assert.equal(annualAvailable(null), false);
});

test('long dates show the year only when it is not the current one', () => {
  const now = new Date(2026, 9, 25);
  assert.doesNotMatch(longDate(new Date(2026, 10, 19, 12).toISOString(), now), /2026/);
  assert.match(longDate(new Date(2027, 9, 25, 12).toISOString(), now), /2027/);
});

const END = '2026-10-29T12:00:00.000Z';
const annualCard = {
  status: 'trialing', trialEndsAt: END, hasPaymentMethod: true, paymentMethodLabel: 'VISA •••• 4242', paymentMethodType: 'CARD' as const,
  complimentary: false, interval: 'year' as const, nextChargeCop: 80910,
};

test('trial notices state the real annual charge (with the code discount) the API will make', () => {
  const linked = cardTrialCopy('linked', annualCard);
  assert.match(linked.body, /se cobran \$80\.910 COP por un año completo \(unos \$222 COP al día\)/);
  const pre = cardTrialCopy('pre-charge', annualCard);
  assert.equal(pre.title, 'En 2 días se cobra tu primer año');
  assert.match(pre.body, /\$80\.910 COP a tu VISA •••• 4242/);
  assert.match(trialDoneLine(annualCard), /se cobran \$80\.910 COP por un año para seguir con Pro/);
  for (const text of [linked.title + linked.body, pre.title + pre.body]) {
    assert.doesNotMatch(text, /último|ahora mismo|urgente|no pierdas|horas/i);
  }
});

test('the founding price line mentions the annual plan only when it exists', () => {
  assert.equal(foundingPriceLine(), '$9.900 COP al mes (unos $330 al día), tarifa congelada mientras sigas en Pro.');
  assert.equal(foundingPriceLine(true), '$9.900 COP al mes (unos $330 al día) o $89.900 al año (unos $246 al día), tarifa congelada mientras sigas en Pro.');
});
