import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyMove, newGame, type RpsGame, type TttGame } from '../src/services/games.service';
import { publicMeta, snippet } from '../src/services/chat-live.service';
import { levelFromTotal, xpForLevel } from '../src/services/xp.service';
import { applyAvatarItem, stripUnowned, wearing } from '../src/lib/avatar-items';

test('tic-tac-toe: turns, a win on a line and no moves after it', () => {
  let g = newGame('ttt', 'ana', 'bea') as TttGame;
  g = applyMove(g, 'ana', 0) as TttGame;
  assert.throws(() => applyMove(g, 'ana', 1), /turno/);
  assert.throws(() => applyMove(g, 'bea', 0), /ocupada/);
  for (const [who, cell] of [['bea', 3], ['ana', 1], ['bea', 4], ['ana', 2]] as const) g = applyMove(g, who, cell) as TttGame;
  assert.equal(g.winner, 'X');
  assert.deepEqual(g.line, [0, 1, 2]);
  assert.throws(() => applyMove(g, 'bea', 8), /terminó/);
});

test('tic-tac-toe in a guild: the first other player to move becomes O', () => {
  let g = newGame('ttt', 'ana', null) as TttGame;
  g = applyMove(g, 'ana', 4) as TttGame;
  g = applyMove(g, 'carlos', 0) as TttGame;
  assert.equal(g.players.O, 'carlos');
  assert.throws(() => applyMove(g, 'dani', 1), /otras dos personas/);
});

test('rock-paper-scissors keeps picks hidden until both chose', () => {
  let g = newGame('rps', 'ana', null) as RpsGame;
  g = applyMove(g, 'ana', 'r') as RpsGame;
  const hidden = publicMeta({ game: g }, 'bea')?.game as RpsGame & { picked: string[] };
  assert.deepEqual(hidden.picks, {});
  assert.deepEqual(hidden.picked, ['ana']);
  assert.deepEqual((publicMeta({ game: g }, 'ana')?.game as RpsGame).picks, { ana: 'r' });
  g = applyMove(g, 'bea', 's') as RpsGame;
  assert.equal(g.winner, 'ana');
  assert.deepEqual((publicMeta({ game: g }, 'bea')?.game as RpsGame).picks, { ana: 'r', bea: 's' });
  assert.throws(() => applyMove(g, 'carlos', 'p'), /terminó/);
});

test('snippets describe every kind of message', () => {
  assert.equal(snippet({ kind: 'VOICE', content: null, meta: { durationMs: 65_000 } }), 'Nota de voz · 1:05');
  assert.equal(snippet({ kind: 'STICKER', content: null }), 'Sticker');
  assert.equal(snippet({ kind: 'PHOTO', content: 'playa' }), 'Foto · playa');
  assert.equal(snippet({ kind: 'TEXT', content: 'hola', deletedAt: new Date() }), 'Mensaje borrado');
  assert.equal(snippet({ kind: 'GAME', content: null, meta: { game: { type: 'ttt' } } }), 'Tres en raya');
});

test('ranking levels: level first, then XP inside that level', () => {
  assert.deepEqual(levelFromTotal(0), { level: 1, xp: 0, next: 100 });
  assert.deepEqual(levelFromTotal(99), { level: 1, xp: 99, next: 100 });
  const two = levelFromTotal(100 + 20);
  assert.equal(two.level, 2);
  assert.equal(two.xp, 20);
  assert.equal(two.next, xpForLevel(2));
  // Más XP total nunca da un nivel menor.
  for (let t = 0; t < 20_000; t += 137) assert.ok(levelFromTotal(t + 137).level >= levelFromTotal(t).level);
});

test('shop items go on the pixel character and only owners can keep them', () => {
  const legacy = { bodyType: 'female', hairColor: '#b5382f', shirtColor: '#3aa58b', hairStyle: 'long' };
  const withHat = applyAvatarItem(legacy, 'extra', 'sombrero_mago', true);
  assert.equal(wearing(withHat, 'extra', 'sombrero_mago'), true);
  // Los colores del avatar antiguo no se pierden.
  assert.equal((withHat.pixel as Record<string, unknown>).hairColor, '#b5382f');
  // Un sombrero quita al otro.
  const swapped = applyAvatarItem({ pixel: { body: 'male', extras: ['gorra', 'gafas'] } }, 'extra', 'casco_vikingo', true);
  assert.deepEqual((swapped.pixel as { extras: string[] }).extras, ['gafas', 'casco_vikingo']);
  const off = applyAvatarItem(swapped, 'extra', 'casco_vikingo', false);
  assert.deepEqual((off.pixel as { extras: string[] }).extras, ['gafas']);
  const stripped = stripUnowned({ pixel: { body: 'male', hair: 'samurai', top: 'armadura', extras: ['capa', 'gafas'] } }, new Set(['extra:capa']));
  assert.deepEqual(stripped.pixel, { body: 'male', hair: 'puntas', top: 'camiseta', extras: ['capa', 'gafas'] });
});
