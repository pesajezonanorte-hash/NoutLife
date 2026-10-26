import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PRO_ANNUAL_PRICE_COP, PRO_PRICE_COP, addDays, intervalOf, periodEndFor, priceCopFor,
} from '../src/lib/plans';
import {
  DEFAULT_SHARE_MONTHS, DEFAULT_SHARE_PERCENT, commissionCop, creatorReport, inShareWindow, normalizeCreatorCode, quoteCharge,
  type CreatorCodeRow, type CreatorLedgerRow,
} from '../src/lib/creator-codes';
import { prisma } from '../src/lib/prisma';

const NOW = new Date('2026-10-25T15:00:00.000Z');

test('the annual plan costs $89.900: 24% less than twelve monthly charges', () => {
  assert.equal(priceCopFor('month'), PRO_PRICE_COP);
  assert.equal(priceCopFor('year'), PRO_ANNUAL_PRICE_COP);
  const twelve = PRO_PRICE_COP * 12;
  assert.equal(twelve - PRO_ANNUAL_PRICE_COP, 28900);
  assert.equal(Math.round(((twelve - PRO_ANNUAL_PRICE_COP) / twelve) * 100), 24);
  assert.equal(Math.round(PRO_ANNUAL_PRICE_COP / 365), 246);
});

test('unknown or missing intervals bill monthly (accounts before the annual plan)', () => {
  assert.equal(intervalOf('year'), 'year');
  assert.equal(intervalOf('month'), 'month');
  assert.equal(intervalOf(null), 'month');
  assert.equal(intervalOf('weekly'), 'month');
});

test('an annual period ends the same day next year; 29 February ends on the 28th', () => {
  assert.equal(periodEndFor(new Date('2026-10-25T15:00:00.000Z'), 'year').toISOString(), '2027-10-25T15:00:00.000Z');
  assert.equal(periodEndFor(new Date('2028-02-29T10:00:00.000Z'), 'year').toISOString(), '2029-02-28T10:00:00.000Z');
  assert.equal(periodEndFor(new Date('2026-01-31T10:00:00.000Z'), 'month').toISOString(), '2026-02-28T10:00:00.000Z');
});

test('creator codes are case-insensitive, 3 to 20 characters, letters, numbers, - and _', () => {
  assert.equal(normalizeCreatorCode('  miguel '), 'MIGUEL');
  assert.equal(normalizeCreatorCode('prizzy_25'), 'PRIZZY_25');
  assert.equal(normalizeCreatorCode('ed-uardo'), 'ED-UARDO');
  assert.equal(normalizeCreatorCode('ab'), null);
  assert.equal(normalizeCreatorCode('-MIGUEL'), null);
  assert.equal(normalizeCreatorCode('MIGUÉL'), null);
  assert.equal(normalizeCreatorCode('A'.repeat(21)), null);
  assert.equal(normalizeCreatorCode(undefined), null);
  assert.equal(normalizeCreatorCode(42), null);
});

test('the code discount applies only to the first payment, monthly or annual, in whole pesos', () => {
  assert.deepEqual(quoteCharge('month'), { currency: 'COP', listInCents: 990000, discountInCents: 0, amountInCents: 990000 });
  assert.deepEqual(quoteCharge('year', 10, true), { currency: 'COP', listInCents: 8990000, discountInCents: 899000, amountInCents: 8091000 });
  assert.deepEqual(quoteCharge('month', 15, true), { currency: 'COP', listInCents: 990000, discountInCents: 148500, amountInCents: 841500 });
  // Renovación: precio de lista aunque la cuenta tenga código.
  assert.equal(quoteCharge('year', 10, false).amountInCents, 8990000);
  // El descuento nunca pasa del 50 % ni baja de 0.
  assert.equal(quoteCharge('month', 90, true).amountInCents, 495000);
  assert.equal(quoteCharge('month', -5, true).amountInCents, 990000);
});

test('commission: 30% of each payment in the first 6 months from the conversion; an annual payment counts in full', () => {
  assert.equal(DEFAULT_SHARE_PERCENT, 30);
  assert.equal(DEFAULT_SHARE_MONTHS, 6);
  const converted = new Date('2026-01-15T12:00:00.000Z');
  assert.equal(commissionCop(990000, converted, converted, 30, 6), 2970);
  assert.equal(commissionCop(990000, new Date('2026-07-14T12:00:00.000Z'), converted, 30, 6), 2970);
  assert.equal(commissionCop(990000, new Date('2026-07-15T12:00:00.000Z'), converted, 30, 6), 0);
  assert.equal(commissionCop(8990000, converted, converted, 30, 6), 26970);
  // Sin límite de meses: toda renovación tiene comisión.
  assert.equal(inShareWindow(new Date('2030-01-01T00:00:00.000Z'), converted, null), true);
  assert.equal(commissionCop(8091000, converted, converted, 20, null), 16182);
});

const code = (overrides: Partial<CreatorCodeRow> = {}): CreatorCodeRow => ({
  id: 'c-miguel', code: 'MIGUEL', creatorName: 'Miguel', discountPercent: 10, sharePercent: 30, shareMonths: 6, active: true,
  createdAt: new Date('2026-10-01T00:00:00.000Z'), ...overrides,
});

const row = (overrides: Partial<CreatorLedgerRow>): CreatorLedgerRow => ({
  id: Math.random().toString(36).slice(2), creatorCodeId: 'c-miguel', userId: 'u1', interval: 'month', amountInCents: 891000,
  discountInCents: 99000, kind: 'first', status: 'APPROVED', paidAt: new Date('2026-10-02T00:00:00.000Z'), ...overrides,
});

test('report: uses, monthly and annual conversions, revenue and commission per code; voided payments add nothing', () => {
  const codes = [code(), code({ id: 'c-prizzy', code: 'PRIZZY', creatorName: 'Prizzy', sharePercent: 20, shareMonths: null })];
  const ledger = [
    row({ userId: 'u1', paidAt: new Date('2026-10-02T00:00:00.000Z') }),
    row({ userId: 'u1', kind: 'renewal', amountInCents: 990000, discountInCents: 0, paidAt: new Date('2026-11-02T00:00:00.000Z') }),
    row({ userId: 'u2', interval: 'year', amountInCents: 8091000, discountInCents: 899000, paidAt: new Date('2026-10-20T00:00:00.000Z') }),
    row({ userId: 'u3', status: 'VOIDED', paidAt: new Date('2026-10-21T00:00:00.000Z') }),
    row({ creatorCodeId: 'c-prizzy', userId: 'u4', interval: 'year', amountInCents: 8990000, discountInCents: 0, paidAt: new Date('2026-10-22T00:00:00.000Z') }),
  ];
  const report = creatorReport(codes, ledger, new Map([['c-miguel', 5], ['c-prizzy', 1]]), { from: null, to: null });
  const miguel = report.codes.find((c) => c.code === 'MIGUEL')!;
  assert.equal(miguel.applied, 5);
  assert.equal(miguel.conversions, 2);
  assert.equal(miguel.monthlyConversions, 1);
  assert.equal(miguel.annualConversions, 1);
  assert.equal(miguel.payments, 3);
  assert.equal(miguel.revenueCop, 8910 + 9900 + 80910);
  assert.equal(miguel.commissionCop, 2673 + 2970 + 24273);
  assert.equal(miguel.lastPaidAt, '2026-11-02T00:00:00.000Z');
  const prizzy = report.codes.find((c) => c.code === 'PRIZZY')!;
  assert.equal(prizzy.commissionCop, 17980);
  // El anulado sale en el detalle, con comisión 0, y no suma.
  assert.equal(report.lines.length, 5);
  assert.equal(report.lines.find((l) => l.status === 'VOIDED')?.commissionCop, 0);
  assert.equal(report.lines[0].paidAt, '2026-11-02T00:00:00.000Z');
  assert.deepEqual(report.totals, { applied: 6, conversions: 3, payments: 4, revenueCop: 8910 + 9900 + 80910 + 89900, commissionCop: 2673 + 2970 + 24273 + 17980 });
});

test('report range: only payments inside it, but the commission window counts from the real conversion', () => {
  const ledger = [
    row({ userId: 'u1', paidAt: new Date('2026-01-10T00:00:00.000Z') }),
    row({ userId: 'u1', kind: 'renewal', amountInCents: 990000, discountInCents: 0, paidAt: new Date('2026-06-10T00:00:00.000Z') }),
    row({ userId: 'u1', kind: 'renewal', amountInCents: 990000, discountInCents: 0, paidAt: new Date('2026-07-10T00:00:00.000Z') }),
  ];
  const june = creatorReport([code()], ledger, new Map(), { from: new Date('2026-06-01T00:00:00.000Z'), to: new Date('2026-07-01T00:00:00.000Z') });
  assert.equal(june.lines.length, 1);
  assert.equal(june.codes[0].conversions, 0);
  assert.equal(june.codes[0].commissionCop, 2970);
  const july = creatorReport([code()], ledger, new Map(), { from: new Date('2026-07-01T00:00:00.000Z'), to: new Date('2026-08-01T00:00:00.000Z') });
  assert.equal(july.codes[0].payments, 1);
  assert.equal(july.codes[0].commissionCop, 0);
  assert.equal(july.lines[0].inWindow, false);
});

test('subscription view: next charge with the code discount on the first annual payment, list price after', async () => {
  const { subscriptionView } = await import('../src/services/billing.service');
  const user = {
    id: 'u1', email: 'ana@x.com', createdAt: addDays(NOW, -3), subscriptionStatus: 'trialing', trialEndsAt: addDays(NOW, 4),
    currentPeriodEnd: null, paymentSourceId: '3891', paymentMethodType: 'CARD', paymentMethodLabel: 'VISA •••• 4242', liteSince: null,
    lastPaymentError: null, giftTrial: false, compPro: false, complimentary: false, billingInterval: 'year', creatorCodeId: 'c-miguel',
    creatorCode: { code: 'MIGUEL', creatorName: 'Miguel', discountPercent: 10 },
  };
  const first = subscriptionView(user, NOW);
  assert.equal(first.interval, 'year');
  assert.equal(first.annualPriceCop, 89900);
  assert.equal(first.nextChargeCop, 80910);
  assert.deepEqual(first.creatorCode, { code: 'MIGUEL', creatorName: 'Miguel', discountPercent: 10 });
  assert.equal(first.creatorCodeEditable, true);

  const renewal = subscriptionView({ ...user, subscriptionStatus: 'active', currentPeriodEnd: addDays(NOW, 300) }, NOW, false, false, false, true);
  assert.equal(renewal.nextChargeCop, 89900);
  assert.equal(renewal.creatorCodeEditable, false);
  // Sin renovación (cancelada o cortesía) no hay próximo cobro, y la cortesía no usa códigos.
  assert.equal(subscriptionView({ ...user, subscriptionStatus: 'canceled' }, NOW).nextChargeCop, null);
  const comp = subscriptionView({ ...user, complimentary: true }, NOW);
  assert.equal(comp.nextChargeCop, null);
  assert.equal(comp.creatorCodeEditable, false);
  // Cuentas anteriores al campo: mensual a $9.900.
  assert.equal(subscriptionView({ ...user, billingInterval: 'month', creatorCode: null, creatorCodeId: null }, NOW).nextChargeCop, 9900);
});

test('schemas: subscribe works without a body (old clients), interval is month or year, and payment methods carry it', async () => {
  const { subscribeSchema, intervalSchema, paymentMethodSchema, creatorCodeSchema } = await import('../src/schemas/billing.schemas');
  assert.deepEqual(subscribeSchema.parse(undefined), {});
  assert.deepEqual(subscribeSchema.parse({}), {});
  assert.deepEqual(subscribeSchema.parse({ interval: 'year' }), { interval: 'year' });
  assert.equal(subscribeSchema.safeParse({ interval: 'weekly' }).success, false);
  assert.equal(intervalSchema.safeParse({}).success, false);
  const card = paymentMethodSchema.parse({ token: 'tok_test_123', acceptTerms: true, acceptPersonalData: true, interval: 'year' });
  assert.equal((card as { interval?: string }).interval, 'year');
  assert.equal(creatorCodeSchema.parse({ code: '  miguel ' }).code, 'miguel');
  assert.equal(creatorCodeSchema.safeParse({ code: '' }).success, false);
});

test('admin schemas: a new code defaults to 0% discount and 30% commission for 6 months; the code itself cannot be edited', async () => {
  const { createCreatorCodeSchema, updateCreatorCodeSchema } = await import('../src/schemas/creator-code.schemas');
  assert.deepEqual(createCreatorCodeSchema.parse({ code: 'MIGUEL', creatorName: 'Miguel' }), {
    code: 'MIGUEL', creatorName: 'Miguel', discountPercent: 0, sharePercent: 30, shareMonths: 6,
  });
  assert.equal(createCreatorCodeSchema.safeParse({ code: 'MIGUEL', creatorName: 'Miguel', discountPercent: 60 }).success, false);
  assert.equal(createCreatorCodeSchema.parse({ code: 'MIGUEL', creatorName: 'Miguel', shareMonths: null }).shareMonths, null);
  assert.deepEqual(updateCreatorCodeSchema.parse({ code: 'OTRO', active: false }), { active: false });
});

// ── Flujo completo con una base de datos en memoria ───────────────────────────────────────────

type Row = Record<string, any>;

/** Lo mínimo de Prisma que usan el cobro y los códigos, en memoria. */
function fakeDb(state: { users: Row[]; payments: Row[]; codes: Row[]; ledger: Row[] }) {
  const userView = (user: Row) => ({ ...user, creatorCode: state.codes.find((c) => c.id === user.creatorCodeId) ?? null });
  const matches = (rowValue: Row, where: Row = {}) => Object.entries(where).every(([key, value]) => {
    if (key === 'NOT') return Object.entries(value as Row).every(([k, v]) => rowValue[k] !== v);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('lt' in value) return rowValue[key] < value.lt;
      if ('not' in value) return rowValue[key] !== value.not;
      if ('in' in value) return (value.in as unknown[]).includes(rowValue[key]);
    }
    return rowValue[key] === value;
  });
  let n = 0;
  return {
    user: {
      findUnique: async ({ where }: Row) => { const u = state.users.find((x) => x.id === where.id); return u ? userView(u) : null; },
      update: async ({ where, data }: Row) => { const u = state.users.find((x) => x.id === where.id)!; Object.assign(u, data); return userView(u); },
      updateMany: async ({ where, data }: Row) => {
        const list = state.users.filter((u) => matches(u, where));
        list.forEach((u) => Object.assign(u, data));
        return { count: list.length };
      },
    },
    subscriptionPayment: {
      findUnique: async ({ where, include }: Row) => {
        const p = state.payments.find((x) => (where.id ? x.id === where.id : x.reference === where.reference));
        if (!p) return null;
        return include?.user ? { ...p, user: userView(state.users.find((u) => u.id === p.userId)!) } : { ...p };
      },
      findFirst: async ({ where }: Row) => state.payments.find((p) => matches(p, where)) ?? null,
      findMany: async ({ where }: Row) => state.payments.filter((p) => matches(p, where)).map((p) => ({ ...p })),
      count: async ({ where }: Row) => state.payments.filter((p) => matches(p, where)).length,
      create: async ({ data }: Row) => {
        const p = { id: `pay-${++n}`, status: 'PENDING', statusMessage: null, wompiTransactionId: null, createdAt: new Date(NOW.getTime() + n), ...data };
        state.payments.push(p);
        return { ...p };
      },
      update: async ({ where, data }: Row) => { const p = state.payments.find((x) => x.id === where.id)!; Object.assign(p, data); return { ...p }; },
    },
    creatorCode: {
      findUnique: async ({ where }: Row) => state.codes.find((c) => c.code === where.code) ?? null,
    },
    creatorCodePayment: {
      findUnique: async ({ where }: Row) => state.ledger.find((r) => r.reference === where.reference) ?? null,
      findMany: async () => state.ledger.map((r) => ({ ...r })),
      create: async ({ data }: Row) => { const r = { id: `led-${++n}`, status: 'APPROVED', ...data }; state.ledger.push(r); return r; },
      updateMany: async ({ where, data }: Row) => {
        const list = state.ledger.filter((r) => matches(r, where));
        list.forEach((r) => Object.assign(r, data));
        return { count: list.length };
      },
    },
    usedTrial: { findUnique: async () => ({ id: 'used' }) },
  };
}

async function withFakes<T>(state: Parameters<typeof fakeDb>[0], wompi: (body: Row) => Row, run: () => Promise<T>): Promise<T> {
  process.env.WOMPI_PUBLIC_KEY = 'pub_test_fake';
  process.env.WOMPI_PRIVATE_KEY = 'prv_test_fake';
  process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_secret';
  const client = prisma as unknown as Record<string, unknown>;
  const fake = fakeDb(state) as unknown as Record<string, unknown>;
  const originals = Object.fromEntries(Object.keys(fake).map((key) => [key, client[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(client, fake);
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    return new Response(JSON.stringify({ data: wompi(body) }), { status: 200 });
  }) as typeof fetch;
  try {
    return await run();
  } finally {
    Object.assign(client, originals);
    globalThis.fetch = originalFetch;
  }
}

const baseUser = (overrides: Row = {}): Row => ({
  id: 'u1', email: 'ana@x.com', createdAt: addDays(NOW, -8), subscriptionStatus: 'trialing', trialEndsAt: addDays(NOW, -0.01),
  currentPeriodEnd: null, paymentSourceId: '3891', paymentMethodType: 'CARD', paymentMethodLabel: 'VISA •••• 4242', liteSince: null,
  lastPaymentError: null, giftTrial: false, compPro: false, billingInterval: 'year', creatorCodeId: 'c-miguel', creatorCodeAt: addDays(NOW, -5),
  ...overrides,
});

test('a trial that ends with Pro Anual charges $89.900 minus the code discount for 12 months and records the conversion', async () => {
  const { syncSubscription } = await import('../src/services/billing.service');
  const state = { users: [baseUser()], payments: [] as Row[], codes: [{ ...code(), createdAt: NOW }], ledger: [] as Row[] };
  const charged: Row[] = [];
  const view = await withFakes(state, (body) => {
    charged.push(body);
    return { id: 'tx-1', status: 'APPROVED', status_message: null, reference: body.reference, amount_in_cents: body.amount_in_cents, currency: 'COP' };
  }, () => syncSubscription('u1'));

  assert.equal(charged.length, 1);
  assert.equal(charged[0].amount_in_cents, 8091000);
  assert.equal(charged[0].recurrent, true);
  const payment = state.payments[0];
  assert.equal(payment.status, 'APPROVED');
  assert.equal(payment.billingInterval, 'year');
  assert.equal(payment.creatorCodeId, 'c-miguel');
  assert.equal(payment.discountInCents, 899000);
  assert.equal(payment.periodEnd.toISOString(), periodEndFor(payment.periodStart, 'year').toISOString());
  // La cuenta queda en Pro pagado un año, y la próxima renovación va a precio de lista.
  assert.equal(state.users[0].subscriptionStatus, 'active');
  assert.equal(view.interval, 'year');
  assert.equal(view.nextChargeCop, 89900);
  assert.equal(view.creatorCodeEditable, false);
  // El libro del revenue share anota la conversión con el monto cobrado.
  assert.equal(state.ledger.length, 1);
  assert.deepEqual(
    { kind: state.ledger[0].kind, interval: state.ledger[0].interval, amount: state.ledger[0].amountInCents, code: state.ledger[0].creatorCodeId, ref: state.ledger[0].reference },
    { kind: 'first', interval: 'year', amount: 8091000, code: 'c-miguel', ref: payment.reference },
  );
});

test('a renewal keeps the attribution at list price, and recording it twice adds one ledger row', async () => {
  const { syncSubscription } = await import('../src/services/billing.service');
  const paid = { id: 'pay-old', userId: 'u1', reference: 'NL-u1-old', status: 'APPROVED', amountInCents: 891000, billingInterval: 'month', creatorCodeId: 'c-miguel', discountInCents: 99000, createdAt: addDays(NOW, -31), periodStart: addDays(NOW, -31), periodEnd: addDays(NOW, -0.01) };
  const state = {
    users: [baseUser({ subscriptionStatus: 'active', billingInterval: 'month', currentPeriodEnd: addDays(NOW, -0.01) })],
    payments: [paid] as Row[], codes: [{ ...code(), createdAt: NOW }], ledger: [] as Row[],
  };
  await withFakes(state, (body) => ({ id: 'tx-2', status: 'APPROVED', status_message: null, reference: body.reference, amount_in_cents: body.amount_in_cents, currency: 'COP' }), () => syncSubscription('u1'));
  const renewal = state.payments[1];
  assert.equal(renewal.amountInCents, 990000);
  assert.equal(renewal.discountInCents, 0);
  assert.equal(renewal.creatorCodeId, 'c-miguel');
  assert.equal(state.ledger[0].kind, 'renewal');

  const { recordCreatorPayment } = await import('../src/services/billing.service');
  // Repetir la anotación no duplica la fila.
  await withFakes(state, () => ({}), () => recordCreatorPayment(renewal as never));
  assert.equal(state.ledger.length, 1);
});

test('applying a code: only before the first payment, never with a charge pending or for courtesy accounts', async () => {
  const { applyCreatorCode, removeCreatorCode } = await import('../src/services/billing.service');
  const state = { users: [baseUser({ creatorCodeId: null, creatorCodeAt: null, subscriptionStatus: 'lite' })], payments: [] as Row[], codes: [{ ...code(), createdAt: NOW }, { ...code({ id: 'c-old', code: 'VIEJO', active: false }), createdAt: NOW }], ledger: [] as Row[] };
  const view = await withFakes(state, () => ({}), () => applyCreatorCode('u1', ' miguel '));
  assert.equal(view.creatorCode?.code, 'MIGUEL');
  assert.equal(state.users[0].creatorCodeId, 'c-miguel');

  const fails = async (run: () => Promise<unknown>, code: string) => {
    await assert.rejects(() => withFakes(state, () => ({}), run), (error: { code?: string }) => error.code === code);
  };
  await fails(() => applyCreatorCode('u1', 'VIEJO'), 'CREATOR_CODE_NOT_FOUND');
  await fails(() => applyCreatorCode('u1', 'NO-EXISTE'), 'CREATOR_CODE_NOT_FOUND');

  state.payments.push({ id: 'p1', userId: 'u1', reference: 'r1', status: 'PENDING', createdAt: NOW });
  await fails(() => removeCreatorCode('u1'), 'PAYMENT_PENDING');
  state.payments[0].status = 'APPROVED';
  await fails(() => applyCreatorCode('u1', 'MIGUEL'), 'CREATOR_CODE_LOCKED');

  state.users[0].compPro = true;
  await fails(() => applyCreatorCode('u1', 'MIGUEL'), 'COMPLIMENTARY');
});

test('the admin report first repairs the ledger: adds approved payments that were missed and marks voided ones', async () => {
  const { reconcileCreatorLedger } = await import('../src/services/creator-code.service');
  const pay = (id: string, status: string, createdAt: Date) => ({
    id, userId: 'u1', reference: `NL-${id}`, status, amountInCents: 891000, billingInterval: 'month', creatorCodeId: 'c-miguel', discountInCents: 99000, createdAt,
  });
  const state = {
    users: [baseUser()],
    payments: [pay('a', 'APPROVED', addDays(NOW, -40)), pay('b', 'APPROVED', addDays(NOW, -10)), pay('c', 'VOIDED', addDays(NOW, -5))] as Row[],
    codes: [{ ...code(), createdAt: NOW }],
    ledger: [{ id: 'led-c', reference: 'NL-c', status: 'APPROVED', creatorCodeId: 'c-miguel', userId: 'u1' }] as Row[],
  };
  const result = await withFakes(state, () => ({}), () => reconcileCreatorLedger());
  assert.deepEqual(result, { added: 2, voided: 1 });
  assert.deepEqual(state.ledger.map((r) => [r.reference, r.status, r.kind ?? null]).sort(), [
    ['NL-a', 'APPROVED', 'first'], ['NL-b', 'APPROVED', 'renewal'], ['NL-c', 'VOIDED', null],
  ]);
  // Una segunda pasada no cambia nada.
  assert.deepEqual(await withFakes(state, () => ({}), () => reconcileCreatorLedger()), { added: 0, voided: 0 });
});
