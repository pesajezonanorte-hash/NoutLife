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

test('reverse trial: day 8 without a card is Lite, keeping the account (only the status changes)', () => {
  const created = addDays(NOW, -8);
  const reverse = user({ createdAt: created, trialEndsAt: addDays(created, TRIAL_DAYS) });
  assert.equal(planOf(reverse, addDays(created, TRIAL_DAYS - 1)), 'pro');
  assert.equal(planOf(reverse, NOW), 'lite');
  assert.equal(nextAction(reverse, NOW), 'downgrade');
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

test('emailKey ignores case and spaces', async () => {
  const { emailKey } = await import('../src/lib/trial-keys');
  assert.equal(emailKey('  Ana.Perez@Gmail.com '), 'ana.perez@gmail.com');
});

test('paymentKey uses only the card data Wompi returns: BIN + last four, whatever the holder or validity', async () => {
  const { paymentKey } = await import('../src/lib/trial-keys');
  // public_data real de GET /payment_sources/:id en producción (12-10-2026): sin exp_month ni exp_year.
  const card = { type: 'CARD', bin: '424242', last_four: '4242', card_holder: 'PEDRO PEREZ', validity_ends_at: '2029-12-31T23:59:59.000Z' };
  const key = paymentKey(card);
  assert.match(key ?? '', /^[0-9a-f]{64}$/);
  assert.equal(paymentKey({ ...card, card_holder: 'OTRO NOMBRE', validity_ends_at: '2031-01-31T23:59:59.000Z' }), key);
  assert.equal(paymentKey({ ...card, bin: '42424200' }), key);
  // Una respuesta con vencimiento (otro ambiente) es la misma tarjeta: el vencimiento no entra.
  assert.equal(paymentKey({ type: 'CARD', bin: '424242', last_four: '4242', exp_month: '8', exp_year: '2028' }), key);
  assert.notEqual(paymentKey({ ...card, last_four: '1111' }), key);
  assert.notEqual(paymentKey({ ...card, bin: '411111' }), key);
  // Sin datos reales de Wompi no hay huella: el servidor no concede la prueba.
  assert.equal(paymentKey({ type: 'CARD' }), null);
  assert.equal(paymentKey({ type: 'CARD', bin: '4242', last_four: '4242' }), null);
  assert.equal(paymentKey({}), null);
});

test('the payment_key log shows which fields Wompi sent and their format, never the values', async () => {
  const { publicDataShape } = await import('../src/lib/trial-keys');
  assert.deepEqual(
    publicDataShape({ type: 'CARD', bin: '424242', last_four: '4242', card_holder: 'José Pérez', validity_ends_at: '2029-12-31T23:59:59.000Z' }),
    { type: 'CARD', bin: '999999', last_four: '9999', card_holder: 'aaaa aaaaa', validity_ends_at: '9999-99-99a99:99:99.999a' },
  );
});

test('Wompi keys from different environments turn billing off instead of failing every payment', async () => {
  const { wompiConfig } = await import('../src/lib/wompi');
  const names = ['WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY', 'WOMPI_INTEGRITY_SECRET'] as const;
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_fake';
    process.env.WOMPI_PUBLIC_KEY = 'pub_test_fake';
    process.env.WOMPI_PRIVATE_KEY = 'prv_prod_fake';
    assert.equal(wompiConfig().keysMatch, false);
    assert.equal(wompiConfig().configured, false);
    process.env.WOMPI_PRIVATE_KEY = 'prv_test_fake';
    assert.equal(wompiConfig().keysMatch, true);
    assert.equal(wompiConfig().configured, true);
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
});

test('Nequi paymentKey: celular de Wompi + cédula, con HMAC y un secreto del servidor', async () => {
  const { paymentKey } = await import('../src/lib/trial-keys');
  const proof = { documentNumber: '1032456789', secret: 'test_fingerprint_secret' };
  const nequi = { type: 'NEQUI', phone_number: '3105671703' };
  const key = paymentKey(nequi, proof);
  assert.match(key ?? '', /^[0-9a-f]{64}$/);
  // El celular se compara sin indicativo ni espacios.
  assert.equal(paymentKey({ ...nequi, phone_number: '+57 310 567 1703' }, proof), key);
  // Otra cédula u otro secreto no es la misma huella.
  assert.notEqual(paymentKey(nequi, { ...proof, documentNumber: '1032456780' }), key);
  assert.notEqual(paymentKey(nequi, { ...proof, secret: 'otro_secreto' }), key);
  // Sin cédula, sin secreto o sin un celular de 10 dígitos: no hay huella y no se concede la prueba.
  assert.equal(paymentKey(nequi), null);
  assert.equal(paymentKey(nequi, { documentNumber: '', secret: proof.secret }), null);
  assert.equal(paymentKey(nequi, { documentNumber: proof.documentNumber, secret: '' }), null);
  assert.equal(paymentKey({ type: 'NEQUI', phone_number: '12' }, proof), null);
  // No es un SHA-256 plano: sin el secreto, una tabla filtrada no basta para revertir la huella.
  assert.notEqual(key, createHash('sha256').update('NEQUI|3105671703|1032456789').digest('hex'));
});

test('payment method body: Nequi needs a 6–10 digit cédula; a body without method is a card (old clients)', async () => {
  const { paymentMethodSchema } = await import('../src/schemas/billing.schemas');
  const nequi = { method: 'NEQUI', nequiToken: 'nequi_prod_abc123', documentNumber: '1032456789', acceptTerms: true, acceptPersonalData: true };
  assert.equal(paymentMethodSchema.safeParse(nequi).success, true);
  assert.equal(paymentMethodSchema.safeParse({ ...nequi, documentNumber: '123' }).success, false);
  assert.equal(paymentMethodSchema.safeParse({ ...nequi, documentNumber: '10.324.567' }).success, false);
  assert.equal(paymentMethodSchema.safeParse({ ...nequi, acceptPersonalData: false }).success, false);
  const legacy = paymentMethodSchema.parse({ token: 'tok_test_123', brand: 'VISA', acceptTerms: true, acceptPersonalData: true });
  assert.equal(legacy.method, 'CARD');
});

test('a charge on a Nequi source sends only the source, amount and signature; a card charge keeps payment_method and recurrent', async () => {
  const { createTransaction } = await import('../src/lib/wompi');
  process.env.WOMPI_PUBLIC_KEY = 'pub_test_fake';
  process.env.WOMPI_PRIVATE_KEY = 'prv_test_fake';
  process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_secret';
  const sent: Array<Record<string, unknown>> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ data: { id: '9001', status: 'PENDING', reference: 'NL-x', amount_in_cents: 990000, currency: 'COP' } }), { status: 200 });
  }) as typeof fetch;
  const charge = { paymentSourceId: '3891', reference: 'NL-x', amountInCents: 990000, currency: 'COP', customerEmail: 'ana@example.com' };
  try {
    await createTransaction({ ...charge, sourceType: 'NEQUI' });
    await createTransaction({ ...charge, sourceType: 'CARD' });
  } finally {
    globalThis.fetch = original;
  }
  const [nequi, card] = sent;
  assert.equal(nequi.payment_source_id, 3891);
  assert.equal(nequi.signature, integritySignature('NL-x', 990000, 'COP', 'test_integrity_secret'));
  assert.equal('payment_method' in nequi, false);
  assert.equal('recurrent' in nequi, false);
  assert.deepEqual(card.payment_method, { installments: 1 });
  assert.equal(card.recurrent, true);
});

test('there is no entry paywall: a fresh account without a payment method enters; a denied trial with a linked method stays on Lite', async () => {
  const { subscriptionView } = await import('../src/services/billing.service');
  const base = {
    id: 'u1', email: 'ana@example.com', createdAt: addDays(NOW, -1), subscriptionStatus: 'lite', trialEndsAt: NOW,
    currentPeriodEnd: null, paymentSourceId: null, paymentMethodType: null, paymentMethodLabel: null, liteSince: null, lastPaymentError: null,
  };
  const fresh = subscriptionView(base, NOW, false, true);
  assert.equal(fresh.paywall, false);
  assert.equal(fresh.trialAvailable, true);

  const denied = subscriptionView(
    { ...base, paymentSourceId: '3891', paymentMethodType: 'CARD', lastPaymentError: 'Este método de pago ya se usó en una prueba gratis.' },
    NOW, false, false,
  );
  assert.equal(denied.paywall, false);
  assert.equal(denied.plan, 'lite');
});

test('COMP_PRO_EMAILS: a complimentary Pro needs no payment, never renews and never downgrades', async () => {
  const { complimentaryEmails, nextAction, planOf, willRenew } = await import('../src/lib/plans');
  const list = complimentaryEmails(' Prizzy@Gmail.com , ,otra@example.com ');
  assert.equal(list.has('prizzy@gmail.com'), true);
  assert.equal(list.has('otra@example.com'), true);
  assert.equal(complimentaryEmails(undefined).size, 0);

  // En Lite y con la prueba vencida hace años: sigue Pro, sin paywall y sin pasar a Lite.
  const comp = { subscriptionStatus: 'lite', trialEndsAt: addDays(NOW, -400), currentPeriodEnd: null, paymentSourceId: null, createdAt: addDays(NOW, -400), complimentary: true };
  assert.equal(planOf(comp, NOW), 'pro');
  assert.equal(nextAction(comp, NOW), 'none');

  // Con tarjeta y el periodo vencido: no cobra ni renueva.
  const withCard = { ...comp, subscriptionStatus: 'active', currentPeriodEnd: addDays(NOW, -40), paymentSourceId: '3891' };
  assert.equal(planOf(withCard, NOW), 'pro');
  assert.equal(nextAction(withCard, NOW), 'none');
  assert.equal(willRenew(withCard), false);
});

test('a complimentary account reads as an active Pro without dates or renewal', async () => {
  const { subscriptionView } = await import('../src/services/billing.service');
  const view = subscriptionView(
    {
      id: 'u2', email: 'prizzy@gmail.com', createdAt: addDays(NOW, -400), subscriptionStatus: 'lite', trialEndsAt: null,
      currentPeriodEnd: null, paymentSourceId: null, paymentMethodType: null, paymentMethodLabel: null, liteSince: null,
      lastPaymentError: null, complimentary: true,
    },
    NOW, false, false,
  );
  assert.equal(view.plan, 'pro');
  assert.equal(view.status, 'active');
  assert.equal(view.complimentary, true);
  assert.equal(view.accessEndsAt, null);
  assert.equal(view.renews, false);
  assert.equal(view.paywall, false);
});

test('a Nequi charge waiting for approval shows as pending_approval, keeps the plan and never blocks the paywall', async () => {
  const { subscriptionView } = await import('../src/services/billing.service');
  const renewing = {
    id: 'u3', email: 'ana@example.com', createdAt: addDays(NOW, -40), subscriptionStatus: 'active', trialEndsAt: null,
    currentPeriodEnd: addDays(NOW, -1), paymentSourceId: '3891', paymentMethodType: 'NEQUI' as const,
    paymentMethodLabel: 'NEQUI •••• 1703', liteSince: null, lastPaymentError: null,
  };
  const waiting = subscriptionView(renewing, NOW, true, false, true);
  assert.equal(waiting.status, 'pending_approval');
  assert.equal(waiting.pendingPayment, true);
  // Renovación dentro del margen: sigue en Pro mientras Wompi responde, y no pide otro método de pago.
  assert.equal(waiting.plan, 'pro');
  assert.equal(waiting.paywall, false);
  // Sin cobro en espera, la vista no cambia.
  assert.equal(subscriptionView(renewing, NOW, false, false, false).status, 'active');
});

test('a Pro zone lock answers 402 with `lock` (not `feature`) so older web builds never open an unknown dialog', async () => {
  const { sendProLocked, proLockMessage } = await import('../src/middleware/plan.middleware');
  const { PRO_ZONES, PRO_ZONE_LABELS, LITE_LIMITS } = await import('../src/lib/plans');
  let status = 0;
  let body: Record<string, unknown> = {};
  const res = { status(code: number) { status = code; return this; }, json(data: Record<string, unknown>) { body = data; return this; } };
  sendProLocked(res as never, 'finances');
  assert.equal(status, 402);
  assert.equal(body.code, 'PRO_REQUIRED');
  assert.equal(body.lock, 'finances');
  assert.equal('feature' in body, false);
  assert.match(String(body.error), /Finanzas es una zona de NoutLife Pro/);
  assert.match(proLockMessage('routines'), new RegExp(`${LITE_LIMITS.activeRoutines} rutinas activas`));
  for (const zone of PRO_ZONES) assert.ok(PRO_ZONE_LABELS[zone], `label for ${zone}`);
});
