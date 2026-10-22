import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isComplimentary, planOf, willRenew } from '../src/lib/plans';
import { prisma } from '../src/lib/prisma';

const NOW = new Date('2026-10-22T12:00:00.000Z');

test('isComplimentary: the compPro flag or COMP_PRO_EMAILS, case-insensitive', () => {
  assert.equal(isComplimentary({ email: 'pao@x.com', compPro: true }, ''), true);
  assert.equal(isComplimentary({ email: ' Pao@X.com ', compPro: false }, 'pao@x.com'), true);
  assert.equal(isComplimentary({ email: 'otra@x.com', compPro: null }, 'pao@x.com'), false);
  assert.equal(isComplimentary({ email: 'otra@x.com' }, undefined), false);
});

test('a compPro account is Pro after its gift or trial expired, and a saved Nequi never renews', () => {
  const expired = {
    subscriptionStatus: 'lite', trialEndsAt: new Date('2026-10-19T09:35:00.000Z'), currentPeriodEnd: null,
    paymentSourceId: '3891', createdAt: new Date('2026-09-28T00:00:00.000Z'), giftTrial: true,
  };
  const comp = { ...expired, complimentary: isComplimentary({ email: 'pao@x.com', compPro: true }, '') };
  assert.equal(planOf(expired, NOW), 'lite');
  assert.equal(planOf(comp, NOW), 'pro');
  assert.equal(willRenew({ ...comp, subscriptionStatus: 'active' }), false);
});

test('recheckTimedOutPayments applies a charge Wompi approved after the timeout and only notes a decline', async () => {
  process.env.WOMPI_PUBLIC_KEY = 'pub_test_fake';
  process.env.WOMPI_PRIVATE_KEY = 'prv_test_fake';
  process.env.WOMPI_INTEGRITY_SECRET = 'test_integrity_secret';
  const { recheckTimedOutPayments } = await import('../src/services/billing.service');
  const client = prisma as unknown as Record<string, unknown>;
  const originals = { subscriptionPayment: client.subscriptionPayment, user: client.user };
  const originalFetch = globalThis.fetch;

  const periodEnd = new Date('2026-11-19T09:35:52.911Z');
  const payment = (id: string, tx: string) => ({
    id, userId: `user-${id}`, wompiTransactionId: tx, status: 'ERROR', statusMessage: 'Wompi no confirmó el cobro a tiempo.',
    periodEnd, createdAt: new Date('2026-10-20T04:24:22.784Z'),
  });
  const rows = [payment('a', 'tx-approved'), payment('b', 'tx-declined'), payment('c', 'tx-pending')];
  const paymentUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const userUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
  let where: Record<string, unknown> = {};
  try {
    client.subscriptionPayment = {
      findMany: async (args: { where: Record<string, unknown> }) => { where = args.where; return rows; },
      findUnique: async ({ where: w }: { where: { id: string } }) => ({
        ...rows.find((r) => r.id === w.id),
        user: { id: `user-${w.id}`, subscriptionStatus: 'lite', currentPeriodEnd: null },
      }),
      update: async ({ where: w, data }: { where: { id: string }; data: Record<string, unknown> }) => { paymentUpdates.push({ id: w.id, data }); return {}; },
    };
    client.user = {
      update: async ({ where: w, data }: { where: { id: string }; data: Record<string, unknown> }) => { userUpdates.push({ id: w.id, data }); return {}; },
    };
    globalThis.fetch = (async (url: string | URL | Request) => {
      const tx = String(url).split('/').pop()!;
      const status = tx === 'tx-approved' ? 'APPROVED' : tx === 'tx-declined' ? 'DECLINED' : 'PENDING';
      return new Response(JSON.stringify({ data: { id: tx, status, status_message: null, reference: 'NL-x', amount_in_cents: 990000, currency: 'COP' } }), { status: 200 });
    }) as typeof fetch;

    const result = await recheckTimedOutPayments(NOW, { userId: 'user-a', minAgeMs: 0 });
    assert.deepEqual(result, { checked: 3, approved: 1 });
    assert.equal(where.userId, 'user-a');
    assert.equal(where.statusMessage, 'Wompi no confirmó el cobro a tiempo.');

    // Aprobado: el cobro queda APPROVED y la cuenta en Pro pagado hasta el fin del periodo.
    assert.equal(paymentUpdates.find((u) => u.id === 'a')?.data.status, 'APPROVED');
    const paid = userUpdates.find((u) => u.id === 'user-a');
    assert.equal(paid?.data.subscriptionStatus, 'active');
    assert.equal((paid?.data.currentPeriodEnd as Date).toISOString(), periodEnd.toISOString());
    // Rechazado: solo se anota en el cobro; la cuenta no se toca.
    assert.equal(paymentUpdates.find((u) => u.id === 'b')?.data.status, 'DECLINED');
    assert.equal(userUpdates.some((u) => u.id === 'user-b'), false);
    // Sigue en espera: solo rota la cola.
    assert.deepEqual(paymentUpdates.find((u) => u.id === 'c')?.data, { updatedAt: NOW });
  } finally {
    Object.assign(client, originals);
    globalThis.fetch = originalFetch;
  }
});
