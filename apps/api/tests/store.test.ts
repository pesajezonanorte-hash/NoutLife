import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma';
import { eventChecksum, type WompiEvent } from '../src/lib/wompi';
import {
  canTransition, chargeLevel, detectProofMime, maskWhatsapp, newOrderCode, nextStatuses, normalizeWhatsapp, orderFinance,
  parseStoreReference, storeReference, usablePaymentMethods, wompiCheckoutUrl, wompiFee, wompiMissing,
} from '../src/lib/store';
import {
  StoreError, addProof, adminTransition, applyWompiTransaction, createOrder, exchangeHandoff, getPublicOrder, isStoreAdmin,
  startWompi, verifyPanelSession,
} from '../src/services/store.service';
import { handleWompiEvent } from '../src/services/billing.service';

process.env.JWT_SECRET = 'test-jwt-secret-store';
process.env.WOMPI_PUBLIC_KEY = 'pub_test_store';
process.env.WOMPI_PRIVATE_KEY = 'prv_test_store';
process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_store';
process.env.WOMPI_EVENTS_SECRET = 'test_events_store';

// ─── Reglas puras ────────────────────────────────────────────────────────────

test('only Wompi jumps from pending payment to verified; the customer only reports', () => {
  assert.equal(canTransition('pendiente_pago', 'pago_verificado', 'wompi'), true);
  assert.equal(canTransition('pago_reportado', 'pago_verificado', 'wompi'), true);
  assert.equal(canTransition('pendiente_pago', 'pago_verificado', 'admin'), false);
  assert.equal(canTransition('pendiente_pago', 'pago_reportado', 'cliente'), true);
  assert.equal(canTransition('pago_reportado', 'pago_verificado', 'cliente'), false);
  assert.equal(canTransition('en_proceso', 'entregado', 'wompi'), false);
  assert.equal(canTransition('pendiente_pago', 'entregado', 'admin'), false, 'no delivery without a verified payment');
  assert.equal(canTransition('pago_verificado', 'cancelado', 'admin'), false, 'after payment, closing is a refund');
  assert.equal(canTransition('entregado', 'reembolsado', 'admin'), true);
  assert.deepEqual(nextStatuses('pendiente_pago'), ['pago_reportado', 'cancelado']);
  assert.deepEqual(nextStatuses('cancelado'), []);
});

test('the charge bar lights 0 to 5 segments and turns off when cancelled or refunded', () => {
  assert.equal(chargeLevel('pendiente_pago'), 0);
  assert.equal(chargeLevel('entregado'), 5);
  assert.equal(chargeLevel('cancelado'), null);
  assert.equal(chargeLevel('reembolsado'), null);
});

test('WhatsApp numbers are Colombian mobiles normalized to +57', () => {
  assert.equal(normalizeWhatsapp('300 123 4567'), '+573001234567');
  assert.equal(normalizeWhatsapp('+57 (300) 123-4567'), '+573001234567');
  assert.equal(normalizeWhatsapp('573001234567'), '+573001234567');
  assert.equal(normalizeWhatsapp('6011234567'), null, 'landlines are not WhatsApp numbers');
  assert.equal(normalizeWhatsapp('30012345'), null);
  assert.equal(maskWhatsapp('+573001234567'), '+57300 ••• ••67');
});

test('order codes avoid ambiguous characters and Wompi references round-trip', () => {
  for (let i = 0; i < 200; i++) assert.match(newOrderCode(), /^VT-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  assert.equal(storeReference('VT-ABC234', 2), 'VT-ABC234-2');
  assert.deepEqual(parseStoreReference('VT-ABC234-2'), { code: 'VT-ABC234', attempt: 2 });
  assert.equal(parseStoreReference('VT-ABC234'), null);
  assert.equal(parseStoreReference('NL-123'), null);
});

test('Wompi fee adds VAT and stays empty until configured', () => {
  assert.equal(wompiFee(60000, 0, 0), null);
  assert.equal(wompiFee(60000, 265, 700), Math.round((1590 + 700) * 1.19));
});

test('profit is sale minus provider cost minus fee, and a refund keeps an unreturned cost', () => {
  assert.deepEqual(orderFinance({ status: 'entregado', priceCop: 60000, costCop: 40000, providerRefunded: false, feeCop: null }), { revenue: 60000, cost: 40000, fee: 0, profit: 20000 });
  assert.deepEqual(orderFinance({ status: 'reembolsado', priceCop: 60000, costCop: 40000, providerRefunded: false, feeCop: 2725 }), { revenue: 0, cost: 40000, fee: 2725, profit: -42725 });
  assert.deepEqual(orderFinance({ status: 'reembolsado', priceCop: 60000, costCop: 40000, providerRefunded: true, feeCop: null }), { revenue: 0, cost: 0, fee: 0, profit: 0 });
  assert.equal(orderFinance({ status: 'pago_reportado', priceCop: 60000, costCop: null, providerRefunded: false, feeCop: null }).revenue, 0, 'a reported payment is not income yet');
});

test('proofs are recognized by their bytes, not by their name', () => {
  assert.equal(detectProofMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(detectProofMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(detectProofMime(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(detectProofMime(new TextEncoder().encode('%PDF-1.7')), 'application/pdf');
  assert.equal(detectProofMime(new TextEncoder().encode('<script>alert(1)</script>')), null);
});

test('payment methods are offered only when active with holder and number; Wompi needs the visible seller', () => {
  const methods = usablePaymentMethods([
    { id: 'nequi', kind: 'nequi', label: 'Nequi', holder: 'Ana', number: '3001234567', active: true },
    { id: 'banco', kind: 'transferencia', label: 'Banco', holder: '', number: '123', active: true },
    { id: 'otro', kind: 'transferencia', label: 'Otro', holder: 'Ana', number: '1', active: false },
  ]);
  assert.deepEqual(methods.map((m) => m.id), ['nequi']);
  assert.equal(wompiMissing({ legalName: 'Ana Pérez', documentId: '1.234', wompiMerchantName: '' }).length, 1);
});

test('the checkout URL carries the signed reference and the return address', () => {
  const url = new URL(wompiCheckoutUrl({ publicKey: 'pub_test_x', reference: 'VT-ABC234-1', amountInCents: 6_000_000, signature: 'sig', redirectUrl: 'https://tienda.example/pedido/1' }));
  assert.equal(url.origin + url.pathname, 'https://checkout.wompi.co/p/');
  assert.equal(url.searchParams.get('signature:integrity'), 'sig');
  assert.equal(url.searchParams.get('amount-in-cents'), '6000000');
  assert.equal(url.searchParams.get('redirect-url'), 'https://tienda.example/pedido/1');
});

// ─── Base en memoria ─────────────────────────────────────────────────────────

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const client = prisma as unknown as Record<string, unknown>;
let seq = 0;
const id = (prefix: string) => `${prefix}${++seq}`;

interface State { settings: Row; products: Row[]; providers: Row[]; offers: Row[]; orders: Row[]; events: Row[]; files: Row[] }

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'NOT') return !matches(row, cond as Row);
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return (cond.in as unknown[]).includes(value);
      if ('gte' in cond) return value >= cond.gte;
      if ('not' in cond) return value !== cond.not;
      return true;
    }
    return value === cond;
  });
}

function install(state: State) {
  const rich = (o: Row) => ({
    ...o,
    product: state.products.find((p) => p.id === o.productId),
    provider: state.providers.find((p) => p.id === o.providerId) ?? null,
    events: state.events.filter((e) => e.orderId === o.id),
    files: state.files.filter((f) => f.orderId === o.id),
    _count: { files: state.files.filter((f) => f.orderId === o.id).length },
  });
  client.storeSettings = { upsert: async () => state.settings };
  client.storeProduct = { findUnique: async ({ where }: Row) => state.products.find((p) => matches(p, where)) ?? null };
  client.storeProvider = { findUnique: async ({ where }: Row) => state.providers.find((p) => matches(p, where)) ?? null };
  client.storeProviderProduct = {
    findFirst: async ({ where }: Row) => state.offers.find((o) => matches(o, where)) ?? null,
    findMany: async ({ where }: Row) => state.offers.filter((o) => matches(o, where)).map((o) => ({ ...o, provider: state.providers.find((p) => p.id === o.providerId) })),
  };
  client.storeOrder = {
    findUnique: async ({ where }: Row) => { const o = state.orders.find((r) => matches(r, where)); return o ? rich(o) : null; },
    findFirst: async ({ where }: Row) => state.orders.find((r) => matches(r, where)) ?? null,
    count: async ({ where }: Row) => state.orders.filter((r) => matches(r, where)).length,
    create: async ({ data }: Row) => {
      const { events, ...rest } = data;
      const order = { id: id('order-'), status: 'pendiente_pago', notes: '', wompiAttempts: 0, wompiStatus: null, wompiTransactionId: null, providerId: null, costCop: null, feeCop: null, providerRefunded: false, paymentMethod: null, createdAt: new Date(), updatedAt: new Date(), ...rest };
      state.orders.push(order);
      if (events?.create) state.events.push({ id: id('event-'), orderId: order.id, createdAt: new Date(), ...events.create });
      return { id: order.id, code: order.code };
    },
    update: async ({ where, data }: Row) => {
      const o = state.orders.find((r) => matches(r, where));
      if (!o) throw new Error('not found');
      for (const [k, v] of Object.entries(data)) o[k] = v && typeof v === 'object' && 'increment' in (v as Row) ? o[k] + (v as Row).increment : v;
      o.updatedAt = new Date();
      return o;
    },
    updateMany: async ({ where, data }: Row) => {
      const rows = state.orders.filter((r) => matches(r, where));
      for (const o of rows) Object.assign(o, data, { updatedAt: new Date() });
      return { count: rows.length };
    },
  };
  client.storeOrderEvent = { create: async ({ data }: Row) => { const e = { id: id('event-'), createdAt: new Date(), ...data }; state.events.push(e); return e; } };
  client.storeFile = { create: async ({ data }: Row) => { const f = { id: id('file-'), createdAt: new Date(), ...data }; state.files.push(f); return f; } };
  client.$transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn(client);
}

function freshState(extra: Partial<State> = {}): State {
  return {
    settings: {
      id: 1, legalName: 'Ana Pérez', documentId: '1.234.567', city: '', address: '', email: 'ventas@example.com', whatsapp: '+573001112233', supportHours: '',
      deliveryEstimate: 'Hasta 2 horas', siteUrl: 'https://tienda.example', wompiEnabled: true, wompiMerchantName: 'Comercio de prueba', wompiFeeBps: 265, wompiFeeFixedCop: 700,
      paymentMethods: [{ id: 'nequi', kind: 'nequi', label: 'Nequi', holder: 'Ana Pérez', number: '3109998877', bank: 'Nequi', accountType: '', instructions: '', active: true }],
    },
    products: [{ id: 'p1', slug: 'juego', name: 'Juego', platform: 'Xbox Series X|S', accessMode: 'Cuenta compartida', deliveryEstimate: null, priceCop: 60000, availability: 'disponible', active: true }],
    providers: [{ id: 'prov1', name: 'Proveedor Uno', active: true }],
    offers: [{ id: 'o1', providerId: 'prov1', productId: 'p1', costCop: 40000, available: true, isDefault: true, checkedAt: new Date() }],
    orders: [], events: [], files: [],
    ...extra,
  };
}

const order = { slug: 'juego', name: 'Ana Pérez', whatsapp: '300 123 4567', accept: true as const };

async function rejects(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (err: unknown) => err instanceof StoreError && err.code === code);
}

test('an order needs confirmed availability, a valid WhatsApp and at most 3 unpaid orders per number', async () => {
  const state = freshState();
  install(state);
  const created = await createOrder(order, '1.1.1.1');
  assert.match(created.code, /^VT-/);
  assert.equal(state.orders[0].customerWhatsapp, '+573001234567');
  assert.equal(state.events[0].status, 'pendiente_pago');

  await rejects(createOrder({ ...order, whatsapp: '601 123 4567' }, '1.1.1.1'), 'WHATSAPP');
  state.products[0].availability = 'por_confirmar';
  await rejects(createOrder(order, '1.1.1.1'), 'UNAVAILABLE');
  state.products[0].availability = 'disponible';
  await createOrder(order, '1.1.1.2');
  await createOrder(order, '1.1.1.3');
  await rejects(createOrder(order, '1.1.1.4'), 'TOO_MANY_UNPAID');
});

test('the public order never shows cost, provider, internal notes or fee', async () => {
  const state = freshState();
  install(state);
  const { id: orderId } = await createOrder(order, '2.2.2.2');
  Object.assign(state.orders[0], { costCop: 40000, providerId: 'prov1', notes: 'interno', feeCop: 2725, ipHash: 'x' });
  const view = await getPublicOrder(orderId);
  const json = JSON.stringify(view);
  for (const secret of ['costCop', 'providerId', 'interno', 'feeCop', 'ipHash', 'Proveedor Uno', '+573001234567']) assert.equal(json.includes(secret), false, secret);
  assert.equal(view.whatsappMasked, '+57300 ••• ••67');
  assert.equal(view.payment?.methods.length, 1);
});

test('a proof moves the order to reported payment once, and only real images or PDFs are accepted', async () => {
  const state = freshState();
  install(state);
  const { id: orderId } = await createOrder(order, '3.3.3.3');
  await rejects(addProof(orderId, { method: 'nequi', reference: '', data: Buffer.from('hola mundo, no soy imagen').toString('base64') }), 'TYPE');
  await rejects(addProof(orderId, { method: 'transferencia', reference: '', data: Buffer.from('%PDF-1.7 ...').toString('base64') }), 'METHOD');
  const view = await addProof(orderId, { method: 'nequi', reference: 'M123', data: Buffer.from('%PDF-1.7 comprobante').toString('base64') });
  assert.equal(view.status, 'pago_reportado');
  assert.equal(state.files.length, 1);
  await rejects(addProof(orderId, { method: 'nequi', reference: '', data: Buffer.from('%PDF-1.7 otro').toString('base64') }), 'NOT_WAITING');
});

test('Wompi: approved verifies with the fee, repeats are no-ops, other amounts are ignored and a second approval is flagged', async () => {
  const state = freshState();
  install(state);
  const { id: orderId, code } = await createOrder(order, '4.4.4.4');
  const { url } = await startWompi(orderId);
  assert.equal(new URL(url).searchParams.get('reference'), `${code}-1`);

  assert.equal(await applyWompiTransaction({ id: 'tx-bad', reference: `${code}-1`, status: 'APPROVED', amountInCents: 100, currency: 'COP' }), false);
  assert.equal(state.orders[0].status, 'pendiente_pago');

  await applyWompiTransaction({ id: 'tx-1', reference: `${code}-1`, status: 'DECLINED', amountInCents: 6_000_000, currency: 'COP' });
  assert.equal(state.orders[0].wompiStatus, 'DECLINED');

  assert.equal(await applyWompiTransaction({ id: 'tx-2', reference: `${code}-2`, status: 'APPROVED', amountInCents: 6_000_000, currency: 'COP' }), true);
  assert.equal(state.orders[0].status, 'pago_verificado');
  assert.equal(state.orders[0].feeCop, wompiFee(60000, 265, 700));
  assert.equal(state.events.at(-1)?.actor, 'wompi');

  const events = state.events.length;
  await applyWompiTransaction({ id: 'tx-2', reference: `${code}-2`, status: 'APPROVED', amountInCents: 6_000_000, currency: 'COP' });
  assert.equal(state.events.length, events, 'the same transaction twice changes nothing');

  await applyWompiTransaction({ id: 'tx-3', reference: `${code}-3`, status: 'APPROVED', amountInCents: 6_000_000, currency: 'COP' });
  assert.match(state.orders[0].notes, /Pago duplicado por Wompi \(transacción tx-3/);
  assert.equal(state.orders[0].status, 'pago_verificado');
});

test('the billing webhook hands store references to the store after checking the checksum', async () => {
  const state = freshState();
  install(state);
  const { code } = await createOrder(order, '5.5.5.5');
  const event: WompiEvent = {
    event: 'transaction.updated',
    data: { transaction: { id: 'tx-9', reference: `${code}-1`, status: 'APPROVED', amount_in_cents: 6_000_000, currency: 'COP' } },
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'] },
    timestamp: 1_700_000_000,
  };
  event.signature!.checksum = eventChecksum(event, 'test_events_store');
  assert.deepEqual(await handleWompiEvent(event), { handled: true });
  assert.equal(state.orders[0].status, 'pago_verificado');
  await assert.rejects(handleWompiEvent({ ...event, signature: { ...event.signature, checksum: 'f'.repeat(64) } }));
});

test('moving to «En proceso» takes the default provider and cost, and fails without one', async () => {
  const state = freshState();
  install(state);
  const { id: orderId } = await createOrder(order, '6.6.6.6');
  await rejects(adminTransition(orderId, { status: 'pago_verificado', note: '' }), 'TRANSITION');
  await adminTransition(orderId, { status: 'pago_reportado', note: 'Comprobante por WhatsApp' });
  state.orders[0].status = 'pago_verificado';
  await adminTransition(orderId, { status: 'en_proceso', note: '' });
  assert.equal(state.orders[0].status, 'en_proceso');
  assert.equal(state.orders[0].providerId, 'prov1');
  assert.equal(state.orders[0].costCop, 40000);

  const other = freshState({ offers: [] });
  install(other);
  const second = await createOrder(order, '7.7.7.7');
  other.orders[0].status = 'pago_verificado';
  await rejects(adminTransition(second.id, { status: 'en_proceso', note: '' }), 'PROVIDER');
});

test('panel tokens: a handoff becomes a session, and neither works for someone outside the list', () => {
  process.env.STORE_ADMIN_USER_IDS = 'owner-1';
  assert.equal(isStoreAdmin('owner-1', 'x@example.com'), true);
  assert.equal(isStoreAdmin('other', 'x@example.com'), false);
  const secret = createHash('sha256').update('test-jwt-secret-store:store-panel').digest('hex');
  const handoff = jwt.sign({ userId: 'owner-1', email: 'x@example.com', typ: 'handoff' }, secret, { expiresIn: '2m' });
  const session = exchangeHandoff(handoff);
  assert.equal(verifyPanelSession(session.token).userId, 'owner-1');
  assert.throws(() => verifyPanelSession(handoff), StoreError, 'a handoff is not a session');
  assert.throws(() => exchangeHandoff(session.token), StoreError, 'a session is not a handoff');
  const appToken = jwt.sign({ userId: 'owner-1', email: 'x@example.com' }, 'test-jwt-secret-store');
  assert.throws(() => verifyPanelSession(appToken), StoreError, 'an app token does not open the panel');
  process.env.STORE_ADMIN_USER_IDS = 'someone-else';
  assert.throws(() => verifyPanelSession(session.token), StoreError, 'removing the id closes the session');
  delete process.env.STORE_ADMIN_USER_IDS;
});
