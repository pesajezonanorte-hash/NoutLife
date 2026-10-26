import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLocale, resolveLocale } from '../../src/lib/locale';
import { PRICE_LISTS, PRO_ZONES, formatMoney, marketForTimezone, priceListFor } from '../../src/lib/plan';
import { offerFor } from '../../src/lib/offer';
import { cardTrialCopy, foundingPriceLine, habitsLine, trialDoneLine, trialNoticeTitle } from '../../src/lib/planPreview';
import { apiErrorMessage, localizeBillingMessage } from '../../src/lib/billing-messages';
import { LANDING } from '../../src/pages/Login/copy';
import { canLetter } from '../../src/components/layout/Lettering';

test('the browser language picks Spanish or English; anything else falls back to English', () => {
  assert.equal(detectLocale(['es-CO', 'en']), 'es');
  assert.equal(detectLocale(['en-US']), 'en');
  assert.equal(detectLocale(['pt-BR', 'es-419']), 'es');
  assert.equal(detectLocale(['fr-FR', 'de']), 'en');
  assert.equal(detectLocale([]), 'en');
  assert.equal(detectLocale(undefined), 'en');
});

test('the account language wins; without a session, the saved choice and then the browser', () => {
  assert.equal(resolveLocale('en', 'es', 'es'), 'en');
  assert.equal(resolveLocale('es', null, 'en'), 'es', 'an older Spanish account stays Spanish on an English browser');
  assert.equal(resolveLocale(undefined, 'en', 'es'), 'en');
  assert.equal(resolveLocale(undefined, null, 'es'), 'es');
  assert.equal(resolveLocale('fr', 'en', 'es'), 'en', 'an unknown account value is ignored');
});

test('money reads naturally in each language: pesos without cents, dollars with them (US$ in Spanish)', () => {
  assert.equal(formatMoney(990000, 'COP', 'es'), '$9.900');
  assert.equal(formatMoney(990000, 'COP', 'en'), '$9,900');
  assert.equal(formatMoney(499, 'USD', 'en'), '$4.99');
  assert.equal(formatMoney(499, 'USD', 'es'), 'US$4.99');
  assert.equal(formatMoney(399900, 'USD', 'en'), '$3,999.00');
});

test('visitors see the list of their device time zone; accounts, the one the API decided', () => {
  assert.equal(marketForTimezone('America/Bogota'), 'CO');
  assert.equal(marketForTimezone('America/New_York'), 'INTL');
  assert.equal(marketForTimezone(undefined), 'CO');
  assert.equal(priceListFor(null, 'America/Los_Angeles').currency, 'USD');
  assert.equal(priceListFor(null, 'America/Bogota').currency, 'COP');
  assert.equal(priceListFor({ pricing: PRICE_LISTS.INTL } as never, 'America/Bogota').currency, 'USD', 'the account wins over the device');
  assert.equal(priceListFor({} as never, 'America/New_York').currency, 'COP', 'an API without markets bills in pesos');
});

const us = offerFor('en', PRICE_LISTS.INTL);

test('USD offer: $4.99 or $39.99, save $19.89 (33 %), almost 4 months free, 11¢ a day', () => {
  assert.equal(us.money(us.listFor('year')), '$39.99');
  assert.equal(us.money(us.listFor('month')), '$4.99');
  assert.equal(us.savings, 1989);
  assert.equal(us.savingsPercent, 33);
  assert.equal(us.freeMonths, 'almost 4 months free');
  assert.equal(us.perDayFor('year'), 11);
  assert.equal(us.perDayFor('month'), 17);
  assert.equal(us.perDay(us.perDayFor('year')), '11¢');
  assert.equal(us.money(us.perMonthOfYear), '$3.33');
});

test('a creator discount in dollars rounds like the API (quoteCharge): whole cents, capped at 50 %', () => {
  assert.equal(us.firstPayment('year', 10), 3599);
  assert.equal(us.firstPayment('month', 50), 249);
  assert.equal(us.firstPayment('month', 90), 249);
  assert.equal(us.priceLabel('month', 249), '$2.49 for the first month');
  assert.equal(us.priceLabel('year', 3999), '$39.99/year');
});

test('English pricing copy: per day, honest about renewals, no product comparison, no pressure, no gaming hook', () => {
  assert.equal(us.framing('year'), 'Just 11¢ a day for a full year of Pro.');
  assert.equal(us.framing('month', true), 'After your trial: just 17¢ a day to unlock all of NoutLife.');
  assert.equal(us.chargeLine('year', 3599), '$35.99 today for 12 months of Pro. Then $39.99 every year on the same date. Turn off renewal anytime in 1 click.');
  assert.equal(us.chargeLine('month', 499), '$4.99 today, then every month on the same date. Cancel anytime in 1 click.');
  const copy = [us.framing('year'), us.framing('month'), us.annualPitch.title, us.annualPitch.body, ...us.annualPitch.points].join(' ');
  assert.doesNotMatch(copy, /coffee|sandwich|latte|\bXP\b|level up|hero|season|hurry|last chance|don’t miss/i);
  assert.match(us.annualPitch.body, /almost 4 months free/);
});

test('Spanish with dollars and English with pesos keep the right currency marks', () => {
  const esUs = offerFor('es', PRICE_LISTS.INTL);
  assert.equal(esUs.framing('year'), 'Solo US$0.11 al día por un año completo de Pro.');
  assert.equal(esUs.chargeLine('month', 499), 'Hoy US$4.99 y luego cada mes, el mismo día. Cancela en cualquier momento con 1 clic.');
  assert.equal(esUs.freeMonths, 'casi 4 meses gratis');
  const enCo = offerFor('en', PRICE_LISTS.CO);
  assert.equal(enCo.moneyCode(990000), '$9,900 COP');
  assert.equal(enCo.framing('month'), 'Just $330 COP a day to unlock all of NoutLife.');
});

const END = '2026-10-29T12:00:00.000Z';
const usCard = {
  status: 'trialing', trialEndsAt: END, hasPaymentMethod: true, paymentMethodLabel: 'VISA •••• 4242', paymentMethodType: 'CARD' as const,
  complimentary: false, interval: 'year' as const, nextChargeCop: null, nextChargeInCents: 3599, pricing: PRICE_LISTS.INTL,
};

test('trial notices in dollars say the amount, the date, how to cancel and that Wompi charges in pesos', () => {
  const linked = cardTrialCopy('linked', usCard, 'en');
  assert.match(linked.title, /^Your Pro trial ends on October 2[89]$/);
  assert.match(linked.body, /charged \$35\.99 for a full year \(about 10¢ a day\) \(billed in Colombian pesos at that day’s official rate\)/);
  assert.match(linked.body, /If you cancel before/);
  const pre = cardTrialCopy('pre-charge', usCard, 'en');
  assert.equal(pre.title, 'Your first year is charged in 2 days');
  assert.match(pre.body, /\$35\.99 \(billed in Colombian pesos at that day’s official rate\) to your VISA •••• 4242/);
  for (const text of [linked.title + linked.body, pre.title + pre.body]) {
    assert.doesNotMatch(text, /last chance|right now|urgent|don’t miss|hours/i);
  }
  assert.match(cardTrialCopy('linked', usCard, 'es').body, /US\$35\.99 por un año completo \(unos US\$0\.10 al día\) \(se cobra en pesos colombianos con la TRM de ese día\)/);
  assert.match(trialDoneLine(usCard, 'en'), /Nothing is charged today/);
});

test('Lite preview and founding price, in English', () => {
  assert.equal(trialNoticeTitle(1, 'en'), 'Tomorrow your account moves to Lite');
  assert.equal(trialNoticeTitle(2, 'en'), 'In 2 days your account moves to Lite');
  const base = { activeHabits: 1, habitLimit: 3, activeRoutines: 0, routineLimit: 3, notebooks: 0, notebookLimit: 2, historyDays: 3, historyLimit: 5 };
  assert.equal(habitsLine(base, 'en'), 'You have 1 active habit. It fits in Lite.');
  assert.match(habitsLine({ ...base, activeHabits: 5 }, 'en'), /the rest stay here/);
  assert.equal(foundingPriceLine(true, us), '$4.99 a month (about 17¢ a day) or $39.99 a year (about 11¢ a day), price locked while you stay on Pro.');
});

test('server messages: Spanish as sent; in English by code, by known text or a general English fallback', () => {
  assert.equal(localizeBillingMessage('Tu banco rechazó el cobro. (Fondos insuficientes)', 'en'), 'Your bank declined the charge. (Fondos insuficientes)');
  assert.equal(localizeBillingMessage('Tu banco rechazó el cobro.', 'es'), 'Tu banco rechazó el cobro.');
  assert.equal(localizeBillingMessage('Algo nuevo del servidor', 'en'), null);
  const error = (status: number, data: object) => ({ response: { status, data } });
  assert.match(apiErrorMessage(error(503, { code: 'FX_UNAVAILABLE', error: 'Los pagos en dólares…' }), 'en', 'x'), /US dollars/);
  assert.equal(apiErrorMessage(error(429, { error: 'Demasiados intentos.' }), 'en', 'x'), 'Too many attempts. Please wait a few minutes and try again.');
  assert.equal(apiErrorMessage(error(400, { error: 'Datos inválidos' }), 'es', 'x'), 'Datos inválidos');
  assert.equal(apiErrorMessage(error(400, { error: 'Datos inválidos' }), 'en', 'Fallback in English'), 'Fallback in English');
  assert.equal(apiErrorMessage(new Error('network'), 'en', 'Fallback in English'), 'Fallback in English');
});

test('every Pro zone has an English name and pitch (the glossary for the app translation)', () => {
  assert.deepEqual(Object.keys(PRO_ZONES.en).sort(), Object.keys(PRO_ZONES.es).sort());
  for (const info of Object.values(PRO_ZONES.en)) {
    assert.ok(info.label && info.pitch.endsWith('.'));
    assert.doesNotMatch(info.pitch, /\bXP\b|level/i);
  }
});

test('the landing headline can be drawn with the brand lettering in both languages, and the copy leads with the product', () => {
  assert.ok(canLetter(LANDING.en.headline));
  assert.ok(canLetter(LANDING.es.headline));
  const en = [LANDING.en.headline, LANDING.en.subhead, LANDING.en.pillarsTitle, LANDING.en.meta.title, LANDING.en.meta.description, ...LANDING.en.pillars.map((p) => p.line + p.body)].join(' ');
  assert.doesNotMatch(en, /game|gamif|\bXP\b|level|hero|quest|guild|season/i);
  assert.ok(LANDING.en.meta.title.length <= 60, 'title fits a search result');
  assert.ok(LANDING.en.meta.description.length <= 160, 'description fits a search result');
  assert.match(LANDING.en.trialLine(us), /from about 11¢ a day/);
});
