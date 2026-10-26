import test from 'node:test';
import assert from 'node:assert/strict';
import { creatorCsv, creatorLink, rangeFor, shareLabel } from '../../src/lib/creator-admin';
import type { CreatorPaymentLine } from '../../src/services/admin.service';

const NOW = new Date(2026, 9, 25, 15, 30); // 25 oct 2026, hora local

test('ranges are local calendar months, so a monthly payout matches what the team sees', () => {
  assert.deepEqual(rangeFor('month', NOW), { from: new Date(2026, 9, 1), to: new Date(2026, 10, 1) });
  assert.deepEqual(rangeFor('last-month', NOW), { from: new Date(2026, 8, 1), to: new Date(2026, 9, 1) });
  assert.deepEqual(rangeFor('last-month', new Date(2027, 0, 10)), { from: new Date(2026, 11, 1), to: new Date(2027, 0, 1) });
  assert.deepEqual(rangeFor('90d', NOW), { from: new Date(2026, 6, 28), to: null });
  assert.deepEqual(rangeFor('all', NOW), { from: null, to: null });
});

test('share label and creator link', () => {
  assert.equal(shareLabel(30, 6), '30 % · 6 meses');
  assert.equal(shareLabel(20, 1), '20 % · 1 mes');
  assert.equal(shareLabel(15, null), '15 % · sin límite');
  assert.equal(creatorLink('MIGUEL', 'https://noutlife.site/'), 'https://noutlife.site/?ref=MIGUEL');
});

const line = (overrides: Partial<CreatorPaymentLine> = {}): CreatorPaymentLine => ({
  id: 'l1', creatorCodeId: 'c1', code: 'MIGUEL', creatorName: 'Miguel', userId: 'u1', email: 'ana@x.com', displayName: 'Ana',
  interval: 'year', kind: 'first', status: 'APPROVED', amountCop: 80910, discountCop: 8990, commissionCop: 24273, inWindow: true,
  paidAt: '2026-10-20T15:00:00.000Z', ...overrides,
});

test('CSV: semicolons and BOM for Spanish Excel, plain peso amounts, deleted accounts without personal data', () => {
  const csv = creatorCsv([line(), line({ id: 'l2', email: null, interval: 'month', kind: 'renewal', status: 'VOIDED', amountCop: 9900, discountCop: 0, commissionCop: 0, inWindow: false, creatorName: 'Ed; "Edu"' })]);
  assert.ok(csv.startsWith('﻿fecha;codigo;creador;correo;plan;tipo;estado;monto_cop;descuento_cop;comision_cop;dentro_de_ventana\r\n'));
  const rows = csv.trim().split('\r\n');
  assert.equal(rows[1], '2026-10-20;MIGUEL;Miguel;ana@x.com;anual;alta;aprobado;80910;8990;24273;si');
  assert.equal(rows[2], '2026-10-20;MIGUEL;"Ed; ""Edu""";cuenta borrada;mensual;renovacion;anulado;9900;0;0;no');
});
