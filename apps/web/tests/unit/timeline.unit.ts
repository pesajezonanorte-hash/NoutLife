// Reparto de bloques en la rejilla del día (src/components/ui/lq/timelineLayout.ts). Corre con: npm run test:unit --workspace=apps/web
// (.unit.ts para que Playwright, que recoge *.test.ts y *.spec.ts de tests/, no lo tome).
import assert from 'node:assert/strict';
import test from 'node:test';
import { MIN_BLOCK_PX, layoutTimeline, type TimelineItem } from '../../src/components/ui/lq/timelineLayout';

// A 64 px por hora, el bloque mínimo de 28 px ocupa unos 26 min de la rejilla.
const MIN_MINUTES = (MIN_BLOCK_PX / 64) * 60;
const block = (id: string, start: number, duration: number): TimelineItem => ({ id, start, duration, render: null });
const extent = (item: TimelineItem) => Math.max(item.duration, MIN_MINUTES);

test('timeline: back-to-back blocks stack in the single column, each on its own slot', () => {
  const placed = layoutTimeline([block('a', 540, 30), block('b', 570, 30)], MIN_MINUTES);
  assert.deepEqual(placed.map((p) => [p.item.id, p.col, p.cols]), [['a', 0, 1], ['b', 0, 1]]);
});

test('timeline: a short block drawn at its minimum height never shares a column with the block that follows', () => {
  // 15 min se dibuja con 28 px: el de las 9:15 no puede quedar encima.
  const placed = layoutTimeline([block('a', 540, 15), block('b', 555, 20)], MIN_MINUTES);
  assert.notEqual(placed[0].col, placed[1].col);
  assert.equal(placed[0].cols, 2);
  assert.equal(placed[1].cols, 2);
});

test('timeline: real overlaps are split into columns that share the width', () => {
  const placed = layoutTimeline([block('a', 540, 60), block('b', 570, 60), block('c', 600, 30)], MIN_MINUTES);
  const byId = Object.fromEntries(placed.map((p) => [p.item.id, p]));
  assert.equal(byId.a.col, 0);
  assert.equal(byId.b.col, 1);
  assert.equal(byId.c.col, 0);
  assert.ok(placed.every((p) => p.cols === 2));
});

test('timeline: whatever the mix of durations, no two blocks in the same column overlap', () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let round = 0; round < 200; round += 1) {
    const items = Array.from({ length: 2 + Math.floor(random() * 12) }, (_, i) =>
      block(String(i), 420 + Math.floor(random() * 600), 5 + Math.floor(random() * 120)));
    const placed = layoutTimeline(items, MIN_MINUTES);
    assert.equal(placed.length, items.length);
    for (const a of placed) {
      for (const b of placed) {
        if (a === b || a.col !== b.col) continue;
        const aEnd = a.item.start + extent(a.item);
        const bEnd = b.item.start + extent(b.item);
        assert.ok(aEnd <= b.item.start || bEnd <= a.item.start, `${a.item.id} and ${b.item.id} overlap in column ${a.col}`);
      }
    }
  }
});
