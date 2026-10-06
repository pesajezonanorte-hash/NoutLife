import assert from 'node:assert/strict';
import test from 'node:test';
import { fitOf, messagePreview, STREAK_MIN, streakView } from '../src/services/network.service';

test('a streak between friends only lights up on the third day in a row', () => {
  const today = '2026-10-06';
  const two = streakView(2, 2, '2026-10-05', today);
  assert.equal(two.alive, true);
  assert.equal(two.active, false, 'two days talking is not a streak yet');

  const three = streakView(STREAK_MIN, STREAK_MIN, today, today);
  assert.equal(three.active, true);
  assert.equal(three.doneToday, true);

  const stale = streakView(5, 5, '2026-10-03', today);
  assert.equal(stale.alive, false);
  assert.equal(stale.active, false);
  assert.equal(stale.revivable, true, 'a lit streak lost in the last days can be revived');
  assert.equal(stale.lost, 5);

  const neverLit = streakView(2, 2, '2026-10-03', today);
  assert.equal(neverLit.revivable, false, 'a streak that never lit up cannot be revived');
});

test('the letter background framing is clamped to sane values', () => {
  assert.deepEqual(fitOf({ x: 2, y: -1, zoom: 9, paper: 0.05 }), { x: 1, y: 0, zoom: 3, paper: 0.2 });
  assert.deepEqual(fitOf(null), { x: 0.5, y: 0.5, zoom: 1, paper: 0.42 });
  assert.deepEqual(fitOf({ x: 0.3, y: 0.7, zoom: 1.5, paper: 0.6 }), { x: 0.3, y: 0.7, zoom: 1.5, paper: 0.6 });
});

test('previews never call a camera photo "photo of the day"', () => {
  assert.equal(messagePreview({ kind: 'SNAP', content: null }), 'Foto');
  assert.equal(messagePreview({ kind: 'SNAP', content: 'en la playa' }), 'Foto · en la playa');
  assert.equal(messagePreview({ kind: 'EVENT', content: 'bg' }), 'Nuevo fondo para la carta');
  assert.equal(messagePreview({ kind: 'EVENT', content: 'bg-off' }), 'La carta volvió al papel');
  assert.equal(messagePreview({ kind: 'TEXT', content: 'hola' }), 'hola');
});
