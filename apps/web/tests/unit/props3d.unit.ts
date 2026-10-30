// Objetos 3D de las zonas: modelos de Blender (props-*.glb), tótem de racha, monumento de
// Misiones, física de las repisas, flujo de caja, metal de la vitrina y discos del rack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeProps } from '../../src/components/three3d/models';
import { PARTS } from '../../src/components/three3d/propMaterial';
import { PHYSICS, makeBody, moving, shelfAnchors, stepBodies, type Bounds } from '../../src/components/three3d/physics';
import { TOTEM_MAX_MOTES, TOTEM_MILESTONES, totemState } from '../../src/components/habits/totemMath';
import { MONUMENT_MAX_ORBS, SUMMIT_Y, TIER_H, orbSpots, tierFill, tierOf, tierScale } from '../../src/components/quests/monumentMath';
import { barHeights, cashPeaks, cashflowDays } from '../../src/components/finances/cashflowMath';
import { trophyTier } from '../../src/components/achievements/trophyTier';
import { platePositions } from '../../src/components/coliseo/rack';

const load = async (name: string) => {
  const file = readFileSync(new URL(`../../src/assets/models/${name}.glb`, import.meta.url));
  return decodeProps(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
};

const SETS: Record<string, string[]> = {
  habits: ['crystal', 'shard', 'pedestal', 'notch'],
  goals: ['tier', 'flag', 'chest_body', 'chest_lid', 'chest_lock', 'chest_shackle'],
  hobbies: ['gamepad', 'headphones', 'd20', 'palette', 'clapper'],
  gym: ['dumbbell', 'barbell', 'plate', 'kettlebell'],
  finance: ['coin'],
  trophies: ['cup', 'medal', 'star'],
};
const LOD = new Set(['hobbies', 'gym', 'finance', 'trophies']);

test('modelos: cada .glb trae sus objetos con normales unitarias, partes válidas e índices en rango', async () => {
  for (const [set, names] of Object.entries(SETS)) {
    for (const file of LOD.has(set) ? [`props-${set}`, `props-${set}-hd`] : [`props-${set}`]) {
      const models = await load(file);
      assert.deepEqual([...models.keys()].sort(), [...names].sort(), file);
      for (const [name, d] of models) {
        const verts = d.position.length / 3;
        assert.equal(d.normal.length, d.position.length, `${file}/${name}: una normal por vértice`);
        assert.equal(d.part.length, verts, `${file}/${name}: una parte por vértice`);
        assert.ok(d.index.length % 3 === 0 && d.index.length > 0, `${file}/${name}: triángulos`);
        assert.ok(d.index.every((i) => i < verts), `${file}/${name}: índices dentro de la malla`);
        assert.ok(d.part.every((p) => Number.isInteger(p) && p >= 0 && p < PARTS.length), `${file}/${name}: partes conocidas`);
        for (let i = 0; i < d.normal.length; i += 3) {
          const l = Math.hypot(d.normal[i], d.normal[i + 1], d.normal[i + 2]);
          if (Math.abs(l - 1) > 0.02) assert.fail(`${file}/${name}: normal de largo ${l}`);
        }
        assert.ok(d.radius > 0.04 && d.radius < 1.2, `${file}/${name}: radio razonable (${d.radius})`);
      }
    }
  }
});

test('modelos: el LOD bajo tiene menos triángulos que el alto y el mismo tamaño', async () => {
  for (const set of LOD) {
    const lo = await load(`props-${set}`);
    const hi = await load(`props-${set}-hd`);
    for (const [name, l] of lo) {
      const h = hi.get(name)!;
      assert.ok(l.index.length < h.index.length || name === 'star', `${set}/${name}: ${l.index.length / 3} < ${h.index.length / 3} triángulos`);
      assert.ok(Math.abs(l.radius - h.radius) / h.radius < 0.05, `${set}/${name}: mismo radio`);
    }
  }
});

test('modelos: el cofre trae los pivotes de la tapa, el candado y el arco; el cristal crece desde el ecuador', async () => {
  const goals = await load('props-goals');
  for (const name of ['chest_lid', 'chest_lock', 'chest_shackle']) {
    const pivot = goals.get(name)!.extras.pivot as number[];
    assert.equal(pivot?.length, 3, `${name}: pivote`);
  }
  const lid = goals.get('chest_lid')!;
  const [, py, pz] = lid.extras.pivot as number[];
  // La bisagra está en la arista trasera de arriba del cuerpo.
  assert.ok(pz < -0.2 && Math.abs(py - 0.44) < 0.01);
  assert.ok(goals.get('chest_body')!.part.includes(PARTS.indexOf('glow')), 'el fondo del cofre se enciende');
  const crystal = (await load('props-habits')).get('crystal')!;
  let top = -Infinity;
  let bottom = Infinity;
  for (let i = 1; i < crystal.position.length; i += 3) { top = Math.max(top, crystal.position[i]); bottom = Math.min(bottom, crystal.position[i]); }
  assert.ok(top > 0.9 && bottom < -0.7, 'punta arriba y raíz abajo del ecuador');
});

test('tótem: crece, brilla y suelta más energía con la racha; los hitos suman fragmentos y anillos', () => {
  const zero = totemState(0);
  assert.equal(zero.growth, 0);
  assert.equal(zero.motes, 0);
  assert.equal(zero.tier, 0);
  assert.equal(zero.next, 3);
  let prev = zero;
  for (const s of [1, 2, 3, 7, 14, 30, 60, 100, 200, 365]) {
    const cur = totemState(s);
    assert.ok(cur.growth > prev.growth && cur.energy >= prev.energy && cur.motes >= prev.motes, `racha ${s}`);
    prev = cur;
  }
  assert.equal(totemState(365).growth, 1);
  assert.equal(totemState(9999).growth, 1, 'tope al año');
  assert.equal(totemState(365).motes, TOTEM_MAX_MOTES);
  assert.equal(totemState(7).rings, 1);
  assert.equal(totemState(30).rings, 2);
  assert.equal(totemState(100).rings, 3);
  assert.equal(totemState(21).tier, 4);
  assert.equal(totemState(21).shards, 4);
  assert.equal(totemState(TOTEM_MILESTONES.at(-1)!).tier, TOTEM_MILESTONES.length);
  // Hacia el próximo hito.
  const s10 = totemState(10);
  assert.deepEqual([s10.prev, s10.next], [7, 14]);
  assert.ok(Math.abs(s10.toNext - 3 / 7) < 1e-9);
  // Pasado el año, cada aniversario es el siguiente hito.
  const s400 = totemState(400);
  assert.deepEqual([s400.prev, s400.next], [365, 730]);
  assert.equal(totemState(-3).streak, 0);
  assert.equal(totemState(Number.NaN).streak, 0);
});

test('monumento: cada peldaño es un 10 % y los núcleos flotan junto al suyo', () => {
  assert.deepEqual([0, 9, 10, 55, 99, 100].map(tierOf), [0, 0, 1, 5, 9, 9]);
  assert.equal(tierFill(35, 2), 1);
  assert.ok(Math.abs(tierFill(35, 3) - 0.5) < 1e-9);
  assert.equal(tierFill(35, 4), 0);
  for (let i = 1; i < 10; i++) assert.ok(tierScale(i) < tierScale(i - 1), 'cada peldaño es más estrecho');
  assert.ok(tierScale(9) > 0.15);
  assert.ok(Math.abs(SUMMIT_Y - 10 * TIER_H) < 1e-9);
  const goals = Array.from({ length: 15 }, (_, i) => ({ id: `q${i}`, title: `Meta ${i}`, pct: (i * 7) % 101 }));
  const spots = orbSpots(goals);
  assert.equal(spots.length, MONUMENT_MAX_ORBS, 'como mucho 12 núcleos');
  for (const s of spots) {
    const g = goals.find((x) => x.id === s.id)!;
    assert.equal(s.tier, tierOf(g.pct));
    assert.ok(s.y > s.tier * TIER_H && s.y < (s.tier + 1) * TIER_H, 'a la altura de su peldaño');
    assert.ok(s.radius > (tierScale(s.tier) / 2) * Math.SQRT2 * 0.5, 'fuera de la losa');
  }
});

test('física: suelto vuelve a su sitio con rebote; agarrado sigue al dedo; los choques separan', () => {
  const bounds: Bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5, minZ: -5, maxZ: 5 };
  const a = makeBody(0, 0, 0, 0.3);
  a.x = 1.5;
  let overshoot = false;
  for (let i = 0; i < 600; i++) { stepBodies([a], 1 / 60, bounds); if (a.x < -0.02) overshoot = true; }
  assert.ok(overshoot, 'el muelle es elástico: pasa de largo y vuelve');
  assert.ok(!moving(a), 'y acaba quieto en su ancla');
  const held = makeBody(0, 0, 0, 0.3);
  held.held = true;
  held.tx = 1;
  held.ty = 0.5;
  for (let i = 0; i < 90; i++) stepBodies([held], 1 / 60, bounds);
  assert.ok(Math.abs(held.x - 1) < 0.01 && Math.abs(held.y - 0.5) < 0.01, 'llega al dedo');
  assert.ok(Math.hypot(held.wx, held.wy, held.wz) < PHYSICS.maxSpin + 1e-9);
  // Lanzado: gira por la inercia y el giro se frena despacio.
  held.held = false;
  held.wz = 6;
  stepBodies([held], 1 / 60, bounds);
  const w1 = Math.abs(held.wz);
  for (let i = 0; i < 60; i++) stepBodies([held], 1 / 60, bounds);
  assert.ok(Math.abs(held.wz) < w1 && Math.abs(held.wz) > 0.5, 'la inercia dura y se frena');
  // Dos esferas encimadas se separan.
  const p = makeBody(0, 0, 0, 0.4);
  const q = makeBody(0.1, 0, 0, 0.4);
  q.ax = 0.1;
  stepBodies([p, q], 1 / 60, bounds);
  assert.ok(Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) >= 0.8 - 1e-6);
  // Los bordes del lienzo no se cruzan.
  const fast = makeBody(0, 0, 0, 0.3);
  fast.vx = 40;
  for (let i = 0; i < 30; i++) { stepBodies([fast], 1 / 60, bounds); assert.ok(fast.x + fast.r <= bounds.maxX + 1e-9); }
});

test('repisa: anclas centradas en filas', () => {
  assert.deepEqual(shelfAnchors(3, 3, 1, 3).map(([x]) => x), [-1, 0, 1]);
  const rows = shelfAnchors(5, 3, 2, 3);
  assert.equal(rows.length, 5);
  assert.ok(rows[0][1] > 0 && rows[3][1] < 0, 'dos filas, arriba y abajo');
  assert.ok(Math.abs(rows[3][0] + rows[4][0]) < 1e-9, 'la fila corta va centrada');
});

test('flujo de caja: ingresos y gastos por día hasta hoy, alturas relativas y picos', () => {
  const txs = [
    { date: '2026-10-01T10:00:00.000Z', type: 'INCOME' as const, amount: 1000 },
    { date: '2026-10-01T18:00:00.000Z', type: 'EXPENSE' as const, amount: 250 },
    { date: '2026-10-03T12:00:00.000Z', type: 'EXPENSE' as const, amount: 500 },
    { date: '2026-09-30T12:00:00.000Z', type: 'INCOME' as const, amount: 9999 },
  ];
  const days = cashflowDays(txs as never, '2026-10-01', '2026-10-31', new Date('2026-10-05T15:00:00'));
  assert.equal(days.length, 5, 'del día 1 a hoy');
  assert.deepEqual(days.map((d) => d.key), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
  assert.deepEqual([days[0].income, days[0].expense, days[2].expense], [1000, 250, 500]);
  const h = barHeights(days);
  assert.equal(h[0].up, 1);
  assert.equal(h[2].down, 0.5);
  assert.deepEqual(cashPeaks(days), { inI: 0, outI: 2 });
  assert.deepEqual(cashPeaks(cashflowDays([], '2026-10-01', '2026-10-31', new Date('2026-10-02T09:00:00'))), { inI: -1, outI: -1 });
});

test('vitrina y rack: el metal sigue al avance y los discos se reparten a cada lado', () => {
  assert.deepEqual([0, 0.2, 0.34, 0.5, 0.67, 0.99, 1].map(trophyTier), ['bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'platinum']);
  assert.equal(platePositions(0).length, 0);
  assert.equal(platePositions(12).length, 7, 'como mucho 7 discos');
  const p = platePositions(3).map(([x]) => x);
  assert.ok(p[0] > 0 && p[1] < 0 && p[2] > p[0], 'por turnos y hacia fuera');
});
