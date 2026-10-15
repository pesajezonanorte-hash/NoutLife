import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAdminEmail, ADMIN_EMAILS } from '../src/lib/admin';
import { prisma } from '../src/lib/prisma';
import { requireAdmin } from '../src/middleware/admin.middleware';
import { listUsers } from '../src/services/admin.service';

test('only the two owner accounts are admins, case-insensitive', () => {
  assert.deepEqual([...ADMIN_EMAILS].sort(), ['prizzypelo@gmail.com', 'ztafakss@gmail.com']);
  assert.ok(isAdminEmail('ZTafakss@Gmail.com'));
  assert.ok(isAdminEmail(' prizzypelo@gmail.com'));
  assert.ok(!isAdminEmail('otra@gmail.com'));
  assert.ok(!isAdminEmail(null));
});

test('requireAdmin answers 403 for other users and calls next for admins', async () => {
  const client = prisma as unknown as { user: unknown };
  const original = client.user;
  try {
    for (const [email, allowed] of [['otra@gmail.com', false], ['ztafakss@gmail.com', true]] as const) {
      client.user = { findUnique: async () => ({ email }) };
      let status = 0; let called = false;
      const res = { status(code: number) { status = code; return this; }, json() { return this; } };
      await requireAdmin({ userId: 'u' } as never, res as never, () => { called = true; });
      assert.equal(called, allowed, email);
      if (!allowed) assert.equal(status, 403);
    }
  } finally { client.user = original; }
});

test('listUsers never exposes the payment source id and computes what is paid and when it ends', async () => {
  const client = prisma as unknown as Record<string, unknown>;
  const originals = { user: client.user, subscriptionPayment: client.subscriptionPayment };
  const now = new Date('2026-10-14T12:00:00.000Z');
  const base = { displayName: 'Ana', username: 'ana', level: 3, createdAt: new Date('2026-10-01T00:00:00.000Z'), lastSeenAt: null, subscriptionStatus: 'active', trialEndsAt: null, currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'), paymentMethodType: 'CARD', paymentMethodLabel: 'VISA •••• 4242', liteSince: null, lastPaymentError: null, gender: 'female' };
  try {
    client.user = { findMany: async () => [
      { ...base, id: 'a', email: 'ana@x.com', paymentSourceId: 'SECRET-SRC' },
      { ...base, id: 'b', email: 'beto@x.com', paymentSourceId: null, subscriptionStatus: 'trialing', currentPeriodEnd: null, trialEndsAt: new Date('2026-10-20T00:00:00.000Z') },
    ] };
    client.subscriptionPayment = { findMany: async () => [
      { userId: 'a', status: 'APPROVED', amountInCents: 990000, createdAt: new Date('2026-10-01T00:00:00.000Z'), periodEnd: new Date('2026-11-01T00:00:00.000Z') },
    ] };
    const [ana, beto] = await listUsers(now);
    assert.equal(JSON.stringify(ana).includes('SECRET-SRC'), false, 'payment source never leaves the server');
    assert.equal(ana.hasPaid, true);
    assert.equal(ana.paidTotalCop, 9900);
    assert.equal(ana.paymentMethod, 'VISA •••• 4242');
    assert.equal(ana.nextEvent, 'charge');
    assert.equal(ana.nextEventAt, '2026-11-01T00:00:00.000Z');
    assert.equal(beto.hasPaid, false);
    assert.equal(beto.hasPaymentMethod, false);
    assert.equal(beto.nextEvent, 'expire');
    assert.equal(beto.nextEventAt, '2026-10-20T00:00:00.000Z');
  } finally { Object.assign(client, originals); }
});
