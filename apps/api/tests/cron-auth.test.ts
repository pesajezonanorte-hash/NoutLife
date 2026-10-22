import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkCronSecret, givenCronSecret } from '../src/lib/cron-auth';
import { inWindow } from '../src/lib/smart-reminders';

test('cron secret comes from the Bearer header first, then from ?key', () => {
  assert.equal(givenCronSecret('Bearer abc123', undefined), 'abc123');
  assert.equal(givenCronSecret('bearer   abc123 ', 'other'), 'abc123');
  assert.equal(givenCronSecret(undefined, 'k-1'), 'k-1');
  assert.equal(givenCronSecret('', ''), undefined);
  assert.equal(givenCronSecret(undefined, ['a', 'b']), undefined);
});

test('cron tick is authorized only with the exact server secret', () => {
  assert.equal(checkCronSecret('s3cret', 's3cret'), 'ok');
  assert.equal(checkCronSecret('s3cret', 'wrong'), 'unauthorized');
  assert.equal(checkCronSecret('s3cret', 's3cre'), 'unauthorized');
  assert.equal(checkCronSecret('s3cret', undefined), 'unauthorized');
});

test('a server without CRON_SECRET authorizes nothing and says why', () => {
  assert.equal(checkCronSecret(undefined, 'anything'), 'missing-secret');
  assert.equal(checkCronSecret('', ''), 'missing-secret');
});

test('a reminder is caught by a 15-minute tick: two chances inside its 30-minute window', () => {
  const target = 9 * 60; // 09:00
  const ticks = [8 * 60 + 50, 9 * 60 + 5, 9 * 60 + 20, 9 * 60 + 35];
  assert.deepEqual(ticks.map((t) => inWindow(t, target)), [false, true, true, false]);
});
