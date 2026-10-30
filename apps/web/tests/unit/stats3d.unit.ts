import test from 'node:test';
import assert from 'node:assert/strict';
import { energyAt, energyBarHeight, energyKey, energyLevel } from '../../src/components/ui/lq/energy';
import {
  COLUMN_MAX, COLUMN_MIN, bestXpDay, levelPercent, rankZones, weekdayRhythm, zoneColumns, zoneInsight, zoneRoute, type ZoneLike,
} from '../../src/components/stats/statsMath';

test('energía: cada barra ocupa una franja igual y los extremos se recortan', () => {
  assert.equal(energyAt(0, 300, 1, 10), 1);
  assert.equal(energyAt(29.9, 300, 1, 10), 1);
  assert.equal(energyAt(30, 300, 1, 10), 2);
  assert.equal(energyAt(155, 300, 1, 10), 6);
  assert.equal(energyAt(299, 300, 1, 10), 10);
  assert.equal(energyAt(-40, 300, 1, 10), 1, 'antes de la primera barra');
  assert.equal(energyAt(420, 300, 1, 10), 10, 'más allá de la última');
  assert.equal(energyAt(10, 0, 1, 10), 1, 'sin ancho medido');
});

test('energía: las barras suben de un tercio al total y los niveles tienen nombre', () => {
  assert.ok(Math.abs(energyBarHeight(0, 10) - 0.34) < 1e-9);
  assert.equal(energyBarHeight(9, 10), 1);
  for (let i = 1; i < 10; i++) assert.ok(energyBarHeight(i, 10) > energyBarHeight(i - 1, 10));
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(energyLevel), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('energía: teclado del slider (flechas, RePág/AvPág, Inicio/Fin)', () => {
  assert.equal(energyKey('ArrowRight', 5, 1, 10), 6);
  assert.equal(energyKey('ArrowUp', 10, 1, 10), 10);
  assert.equal(energyKey('ArrowLeft', 1, 1, 10), 1);
  assert.equal(energyKey('ArrowDown', 5, 1, 10), 4);
  assert.equal(energyKey('PageUp', 9, 1, 10), 10);
  assert.equal(energyKey('PageDown', 5, 1, 10), 3);
  assert.equal(energyKey('Home', 7, 1, 10), 1);
  assert.equal(energyKey('End', 2, 1, 10), 10);
  assert.equal(energyKey('Enter', 5, 1, 10), null);
});

test('ritmo semanal: media por día de la semana, lunes primero en español', () => {
  // 2026-10-26 es lunes.
  const points = [
    { date: '2026-10-26', xp: 100 }, { date: '2026-10-27', xp: 0 }, { date: '2026-10-28', xp: 40 },
    { date: '2026-11-02', xp: 50 }, { date: '2026-11-03', xp: 30 },
  ];
  const es = weekdayRhythm(points, 1)!;
  assert.deepEqual(es.map((r) => r.weekday), [1, 2, 3, 4, 5, 6, 0]);
  assert.equal(es[0].avg, 75, 'dos lunes: 100 y 50');
  assert.equal(es[0].days, 2);
  assert.equal(es[1].avg, 15, 'dos martes: 0 y 30');
  assert.equal(es[2].avg, 40);
  assert.equal(es[6].days, 0);
  const en = weekdayRhythm(points, 0)!;
  assert.deepEqual(en.map((r) => r.weekday), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(weekdayRhythm([{ date: '2026-10', xp: 5 }]), null, 'serie mensual');
  assert.equal(weekdayRhythm([]), null);
});

test('mejor día, porcentaje de nivel', () => {
  assert.equal(bestXpDay([{ date: 'a', xp: 0 }]), null);
  assert.deepEqual(bestXpDay([{ date: 'a', xp: 10 }, { date: 'b', xp: 30 }, { date: 'c', xp: 30 }]), { date: 'b', xp: 30 });
  assert.equal(levelPercent(250, 1000), 25);
  assert.equal(levelPercent(1200, 1000), 100);
  assert.equal(levelPercent(10, 0), 0);
});

const zone = (id: string, score: number, extra: Partial<ZoneLike> = {}): ZoneLike => ({
  id, name: id, score, scoreAvailable: true, hasData: true, isTracking: true, activityCount: 1, ...extra,
});

test('zonas: ranking por ritmo, parte de la actividad y ruta', () => {
  const zones = [
    zone('habits', 40, { activityCount: 6 }),
    zone('sleep', 90, { activityCount: 2 }),
    zone('finances', 0, { scoreAvailable: false, hasData: false, activityCount: 0 }),
    zone('coliseo', 90, { activityCount: 2 }),
  ];
  assert.deepEqual(rankZones(zones).map((z) => z.id), ['coliseo', 'sleep', 'habits']);
  assert.deepEqual(zoneInsight(zones[0], zones), { rank: 3, ranked: 3, share: 60 });
  assert.deepEqual(zoneInsight(zones[2], zones), { rank: null, ranked: 3, share: 0 });
  assert.equal(zoneRoute('mirror'), '/espejo');
  assert.equal(zoneRoute('nutrition'), '/food');
  assert.equal(zoneRoute('3f1d2c4b-1a2b-4c3d-8e9f-0a1b2c3d4e5f'), '/zonas/3f1d2c4b-1a2b-4c3d-8e9f-0a1b2c3d4e5f');
  assert.equal(zoneRoute('desconocida'), null);
});

test('mapa 3D: una columna por zona visible, en círculo y con altura por ritmo', () => {
  const zones = [
    zone('a', 100),
    zone('b', 50),
    zone('c', 0, { scoreAvailable: false, hasData: false }),
    zone('d', 0, { scoreAvailable: false, hasData: false, isTracking: false }), // sin configurar: no se dibuja
  ];
  const cols = zoneColumns(zones);
  assert.deepEqual(cols.map((c) => c.id), ['a', 'b', 'c']);
  assert.equal(cols[0].height, COLUMN_MAX);
  assert.equal(cols[2].height, COLUMN_MIN);
  assert.ok(Math.abs(cols[1].height - (COLUMN_MIN + (COLUMN_MAX - COLUMN_MIN) / 2)) < 1e-3);
  assert.deepEqual(cols.map((c) => c.lit), [1, 1, 0]);
  // La primera queda delante (hacia la cámara) y todas a la misma distancia del núcleo.
  assert.ok(Math.abs(cols[0].x) < 1e-3 && cols[0].z > 0);
  const r = cols.map((c) => Math.hypot(c.x, c.z));
  assert.ok(r.every((v) => Math.abs(v - r[0]) < 1e-3));
  // Con muchas zonas se queda con las de más ritmo, sin perder el orden original.
  const many = Array.from({ length: 20 }, (_, i) => zone(`z${i}`, i * 5));
  const top = zoneColumns(many, 16);
  assert.equal(top.length, 16);
  assert.deepEqual(top.map((c) => c.id), many.slice(4).map((z) => z.id));
  // Las columnas vecinas no se tocan (separación > ancho de una columna, ~0,36).
  for (let i = 0; i < top.length; i++) {
    const a = top[i], b = top[(i + 1) % top.length];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.4);
  }
  assert.deepEqual(zoneColumns([]), []);
});
