import assert from 'node:assert/strict';
import test from 'node:test';
import { detectSleepGap, nightOverlapMinutes } from '../src/services/sleep.service';

const TZ = 'America/Bogota'; // UTC-5

test('sleep detection: una brecha nocturna se sugiere como descanso', () => {
  const last = new Date('2026-10-10T04:30:00Z'); // 23:30 local
  const now = new Date('2026-10-10T12:00:00Z'); // 07:00 local
  const gap = detectSleepGap(last, now, TZ);
  assert.ok(gap);
  assert.equal(gap!.start.toISOString(), last.toISOString());
  assert.equal(gap!.end.toISOString(), now.toISOString());
});

test('sleep detection: una pausa de tarde o muy corta no cuenta', () => {
  assert.equal(detectSleepGap(new Date('2026-10-10T17:00:00Z'), new Date('2026-10-10T22:00:00Z'), TZ), null, 'tarde');
  assert.equal(detectSleepGap(new Date('2026-10-10T05:00:00Z'), new Date('2026-10-10T06:30:00Z'), TZ), null, '1.5 h');
  assert.equal(detectSleepGap(null, new Date(), TZ), null, 'sin actividad previa');
  assert.equal(detectSleepGap(new Date('2026-10-08T04:00:00Z'), new Date('2026-10-10T12:00:00Z'), TZ), null, 'más de 16 h');
});

test('sleep detection: el solape nocturno usa la zona horaria del usuario', () => {
  // 22:00–06:00 local = 8 h de noche completa.
  assert.equal(nightOverlapMinutes(new Date('2026-10-10T03:00:00Z'), new Date('2026-10-10T11:00:00Z'), TZ), 480);
});
