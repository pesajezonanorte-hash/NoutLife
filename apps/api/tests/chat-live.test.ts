import assert from 'node:assert/strict';
import { test } from 'node:test';
import { holdUntil, parseDate, REACTIONS, snippet, validReaction } from '../src/services/chat-live.service';

test('validReaction accepts the offered reactions and treats empty as "remove"', () => {
  for (const emoji of REACTIONS) assert.equal(validReaction(emoji), emoji);
  assert.equal(validReaction(null), null);
  assert.equal(validReaction(''), null);
  assert.throws(() => validReaction('💩'), /no existe/);
  assert.throws(() => validReaction(42), /no existe/);
});

test('snippet describes photos and trims long text', () => {
  assert.equal(snippet({ kind: 'SNAP', content: null }), 'Foto');
  assert.equal(snippet({ kind: 'SNAP', content: 'mi rincón' }), 'Foto · mi rincón');
  assert.equal(snippet({ kind: 'TEXT', content: 'x'.repeat(300) }, 50).length, 50);
});

test('parseDate ignores invalid cursors', () => {
  assert.equal(parseDate('nope'), null);
  assert.equal(parseDate(undefined), null);
  assert.equal(parseDate('2026-10-07T10:00:00.000Z')?.toISOString(), '2026-10-07T10:00:00.000Z');
});

test('holdUntil answers at once when there is already something new', async () => {
  const started = Date.now();
  assert.equal(await holdUntil(async () => 'new', true), 'new');
  assert.ok(Date.now() - started < 500);
});

test('holdUntil does not wait when the caller does not ask for it', async () => {
  const started = Date.now();
  assert.equal(await holdUntil(async () => null, false), null);
  assert.ok(Date.now() - started < 500);
});

test('holdUntil keeps checking until something shows up', async () => {
  let calls = 0;
  const found = await holdUntil(async () => (++calls >= 3 ? calls : null), true);
  assert.equal(found, 3);
});
