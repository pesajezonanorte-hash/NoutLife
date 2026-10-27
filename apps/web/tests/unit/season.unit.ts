import test from 'node:test';
import assert from 'node:assert/strict';
import { isHalloween } from '../../src/lib/season';

test('Halloween dura hasta el 31-10-2026 y se apaga solo', () => {
  assert.equal(isHalloween(new Date('2026-10-27T09:00:00')), true);
  assert.equal(isHalloween(new Date('2026-10-31T23:59:00')), true);
  assert.equal(isHalloween(new Date('2026-11-01T00:00:00')), false);
  assert.equal(isHalloween(new Date('2027-10-31T12:00:00')), false);
});
