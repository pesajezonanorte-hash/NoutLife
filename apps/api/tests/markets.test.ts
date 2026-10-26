import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { addDays } from '../src/lib/plans';
import { quoteCharge } from '../src/lib/creator-codes';
import {
  PRICE_LISTS, PRO_ANNUAL_PRICE_USD_CENTS, PRO_PRICE_USD_CENTS, listInCentsFor, marketForTimezone, marketOf, validTimezone,
} from '../src/lib/pricing';
import { FxUnavailableError, colombiaDay, copCentsFromUsdCents, parseTrm, resetFxCache, usdCopRate } from '../src/lib/fx';

const NOW = new Date('2026-10-26T15:00:00.000Z');
const HOUR = 60 * 60_000;

afterEach(() => {
  resetFxCache();
  delete process.env.USD_COP_FALLBACK_RATE;
});

test('USD list: $4.99 a month or $39.99 a year, 33 % less than twelve months (almost 4 months free, 11¢ a day)', () => {
  assert.deepEqual(PRICE_LISTS.INTL, { market: 'INTL', currency: 'USD', monthInCents: 499, yearInCents: 3999 });
  const twelve = PRO_PRICE_USD_CENTS * 12;
  assert.equal(twelve - PRO_ANNUAL_PRICE_USD_CENTS, 1989);
  assert.equal(Math.round(((twelve - PRO_ANNUAL_PRICE_USD_CENTS) / twelve) * 100), 33);
  assert.equal(Math.round(PRO_ANNUAL_PRICE_USD_CENTS / 365), 11);
  assert.equal(Math.round(PRO_PRICE_USD_CENTS / 30), 17);
});

test('the Colombian list keeps the peso prices it always had', () => {
  assert.deepEqual(PRICE_LISTS.CO, { market: 'CO', currency: 'COP', monthInCents: 990000, yearInCents: 8990000 });
  assert.equal(listInCentsFor('CO', 'year'), 8990000);
  assert.equal(listInCentsFor('INTL', 'month'), 499);
});

test('the market comes from the device time zone: Bogotá pays in pesos, the rest of the world in dollars', () => {
  assert.equal(marketForTimezone('America/Bogota'), 'CO');
  assert.equal(marketForTimezone('America/New_York'), 'INTL');
  assert.equal(marketForTimezone('America/Los_Angeles'), 'INTL');
  assert.equal(marketForTimezone('Europe/Madrid'), 'INTL');
  // Clientes anteriores (sin zona) o una zona inventada: Colombia, nunca un precio más alto por error.
  assert.equal(marketForTimezone(undefined), 'CO');
  assert.equal(marketForTimezone('Mars/Olympus'), 'CO');
  assert.equal(validTimezone('America/Chicago'), 'America/Chicago');
  assert.equal(validTimezone('x'.repeat(65)), null);
  assert.equal(validTimezone(42), null);
});

test('a stored market is INTL only when it says so; anything else (older accounts) is CO', () => {
  assert.equal(marketOf('INTL'), 'INTL');
  assert.equal(marketOf('CO'), 'CO');
  assert.equal(marketOf(null), 'CO');
  assert.equal(marketOf('US'), 'CO');
});

test('a USD quote rounds the creator discount to whole cents and only on the first payment', () => {
  assert.deepEqual(quoteCharge('year', 0, false, 'INTL'), { currency: 'USD', listInCents: 3999, discountInCents: 0, amountInCents: 3999 });
  assert.deepEqual(quoteCharge('year', 10, true, 'INTL'), { currency: 'USD', listInCents: 3999, discountInCents: 400, amountInCents: 3599 });
  assert.deepEqual(quoteCharge('month', 50, true, 'INTL'), { currency: 'USD', listInCents: 499, discountInCents: 250, amountInCents: 249 });
  assert.equal(quoteCharge('month', 20, false, 'INTL').amountInCents, 499, 'renewals go at list price');
  assert.equal(quoteCharge('month', 90, true, 'INTL').amountInCents, 249, 'the discount is capped at 50 %');
});

test('dollars become whole pesos at the TRM: $4.99 and $39.99 at 3,158.43', () => {
  assert.equal(copCentsFromUsdCents(499, 3158.43), 1576100);
  assert.equal(copCentsFromUsdCents(3999, 3158.43), 12630600);
  assert.equal(copCentsFromUsdCents(0, 3158.43), 0);
});

test('the TRM row is read from datos.gov.co; a broken value is never a rate', () => {
  assert.deepEqual(
    parseTrm([{ valor: '3158.43', unidad: 'COP', vigenciadesde: '2026-10-24T00:00:00.000', vigenciahasta: '2026-10-26T00:00:00.000' }]),
    { rate: 3158.43, asOf: '2026-10-24', source: 'trm' },
  );
  assert.equal(parseTrm([]), null);
  assert.equal(parseTrm([{ valor: '0', vigenciadesde: '2026-10-24T00:00:00.000' }]), null);
  assert.equal(parseTrm([{ valor: '31584300', vigenciadesde: '2026-10-24T00:00:00.000' }]), null);
  assert.equal(parseTrm({ error: true }), null);
});

test('the Colombian day is UTC−5: 10 p.m. in Bogotá is still the same day', () => {
  assert.equal(colombiaDay(Date.parse('2026-10-27T03:00:00.000Z')), '2026-10-26');
  assert.equal(colombiaDay(Date.parse('2026-10-27T05:00:00.000Z')), '2026-10-27');
});

const trmResponse = (valor: string) => new Response(JSON.stringify([{ valor, vigenciadesde: '2026-10-24T00:00:00.000' }]), { status: 200 });

test('the rate asks for the TRM in force today and is reused for 6 hours', async () => {
  const urls: string[] = [];
  const fetcher = (async (url: string) => { urls.push(url); return trmResponse('3158.43'); }) as unknown as typeof fetch;
  const first = await usdCopRate({ now: NOW.getTime(), fetcher });
  assert.deepEqual(first, { rate: 3158.43, asOf: '2026-10-24', source: 'trm' });
  assert.match(decodeURIComponent(urls[0]), /vigenciadesde <= '2026-10-26T00:00:00\.000'/);
  await usdCopRate({ now: NOW.getTime() + 5 * HOUR, fetcher });
  assert.equal(urls.length, 1, 'still fresh: no second request');
  await usdCopRate({ now: NOW.getTime() + 7 * HOUR, fetcher });
  assert.equal(urls.length, 2, 'after 6 hours it asks again');
});

test('when datos.gov.co fails: last known rate up to 7 days, then the env fallback, then no charge', async () => {
  const ok = (async () => trmResponse('3158.43')) as unknown as typeof fetch;
  const down = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
  await usdCopRate({ now: NOW.getTime(), fetcher: ok });
  assert.equal((await usdCopRate({ now: NOW.getTime() + 3 * 24 * HOUR, fetcher: down })).rate, 3158.43);

  await assert.rejects(usdCopRate({ now: NOW.getTime() + 8 * 24 * HOUR, fetcher: down }), FxUnavailableError);

  process.env.USD_COP_FALLBACK_RATE = '3200';
  assert.deepEqual(await usdCopRate({ now: NOW.getTime() + 8 * 24 * HOUR, fetcher: down }), { rate: 3200, asOf: '2026-11-03', source: 'fallback' });
  process.env.USD_COP_FALLBACK_RATE = 'abc';
  await assert.rejects(usdCopRate({ now: NOW.getTime() + 8 * 24 * HOUR, fetcher: down }), FxUnavailableError);
});

test('the subscription view carries the price list of its market and the next charge in that currency', async () => {
  const { subscriptionView } = await import('../src/services/billing.service');
  const base = {
    id: 'u1', email: 'ana@example.com', createdAt: addDays(NOW, -3), subscriptionStatus: 'trialing',
    trialEndsAt: addDays(NOW, 4), currentPeriodEnd: null, paymentSourceId: 'src_1', paymentMethodType: 'CARD',
    paymentMethodLabel: 'VISA •••• 4242', liteSince: null, lastPaymentError: null, giftTrial: false, compPro: false,
    billingInterval: 'year', creatorCodeId: null, creatorCode: null,
  };
  const intl = subscriptionView({ ...base, market: 'INTL' } as never, NOW);
  assert.deepEqual(intl.pricing, PRICE_LISTS.INTL);
  assert.equal(intl.nextChargeInCents, 3999);
  assert.equal(intl.nextChargeCop, null, 'a dollar account has no peso charge to promise');

  const co = subscriptionView({ ...base, market: 'CO' } as never, NOW);
  assert.deepEqual(co.pricing, PRICE_LISTS.CO);
  assert.equal(co.nextChargeInCents, 8990000);
  assert.equal(co.nextChargeCop, 89900);

  const older = subscriptionView({ ...base, market: undefined } as never, NOW);
  assert.equal(older.pricing.market, 'CO', 'an account without a market keeps paying in pesos');

  const lite = subscriptionView({ ...base, market: 'INTL', subscriptionStatus: 'lite', paymentSourceId: null } as never, NOW);
  assert.equal(lite.nextChargeInCents, null);
});
