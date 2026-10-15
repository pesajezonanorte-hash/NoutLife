import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analytics, averages, cycleLengths, cycleShape, regularityOf, snapshot, type PeriodRow,
} from '../src/lib/cycle';
import { CONTRACEPTIVES, MOODS, SEXUAL_ACTIVITY } from '../src/lib/cycle';
import { cycleLogSchema } from '../src/schemas/cycle.schemas';

const day = (key: string) => new Date(`${key}T00:00:00.000Z`);
const period = (start: string, end?: string): PeriodRow => ({ startDate: day(start), endDate: end ? day(end) : null });
const FALLBACK = { cycleLength: 28, periodLength: 5 };

test('regularity is read from the spread of the last cycles', () => {
  assert.equal(regularityOf(1), 'regular');
  assert.equal(regularityOf(2), 'regular');
  assert.equal(regularityOf(4), 'variable');
  assert.equal(regularityOf(7), 'irregular');
});

test('with fewer than two cycles there is no spread and no window', () => {
  const avg = averages([period('2026-08-01', '2026-08-05'), period('2026-08-29', '2026-09-02')], FALLBACK);
  assert.equal(avg.cyclesTracked, 1);
  assert.equal(avg.stdDev, null);
  assert.equal(avg.regularity, null);
  const snap = snapshot(day('2026-09-10'), [period('2026-08-01', '2026-08-05'), period('2026-08-29', '2026-09-02')], avg);
  assert.ok(snap);
  assert.equal(snap.nextPeriodEarliest, null);
  assert.equal(snap.nextPeriodLatest, null);
});

test('a retroactive correction recalculates the average, the spread and the next period', () => {
  // Historial con ciclos de 28, 30 y 26 días: promedio 28, regular.
  const history = [
    period('2026-05-01', '2026-05-05'),
    period('2026-05-29', '2026-06-02'),
    period('2026-06-28', '2026-07-02'),
    period('2026-07-24', '2026-07-28'),
  ];
  const avg = averages(history, FALLBACK);
  assert.deepEqual(cycleLengths(history).map((c) => c.length), [28, 30, 26]);
  assert.equal(avg.cycleLength, 28);
  assert.equal(avg.stdDev, 1.6);
  assert.equal(avg.regularity, 'regular');

  const today = day('2026-08-03');
  const before = snapshot(today, history, avg)!;
  assert.equal(before.nextPeriod, '2026-08-21', '24 Jul + 28 días');
  assert.equal(before.nextPeriodEarliest, '2026-08-19', 'regular: ventana de 2 días (la desviación es 1,6)');

  // Corrige: el periodo de julio empezó el 18, no el 24. El ciclo es de 20 días.
  const corrected = [
    period('2026-05-01', '2026-05-05'),
    period('2026-05-29', '2026-06-02'),
    period('2026-06-28', '2026-07-02'),
    period('2026-07-18', '2026-07-22'),
  ];
  const after = averages(corrected, FALLBACK);
  assert.deepEqual(cycleLengths(corrected).map((c) => c.length), [28, 30, 20]);
  assert.equal(after.cycleLength, 26);
  assert.equal(after.regularity, 'variable');
  const snap = snapshot(today, corrected, after)!;
  assert.equal(snap.nextPeriod, '2026-08-13', '18 Jul + 26 días');
  assert.equal(snap.nextPeriodEarliest, '2026-08-09', 'la ventana se abre 4 días por delante');
  assert.equal(snap.nextPeriodLatest, '2026-08-17', 'y 4 por detrás');
});

test('variability widens the fertile window in both directions', () => {
  const regular = [period('2026-05-01', '2026-05-05'), period('2026-05-29', '2026-06-02'), period('2026-06-26', '2026-06-30'), period('2026-07-24', '2026-07-28')];
  const erratic = [period('2026-05-01', '2026-05-05'), period('2026-05-29', '2026-06-02'), period('2026-06-20', '2026-06-24'), period('2026-07-24', '2026-07-28')];
  const today = day('2026-08-01');
  const a = snapshot(today, regular, averages(regular, FALLBACK))!;
  const b = snapshot(today, erratic, averages(erratic, FALLBACK))!;
  assert.ok(day(b.fertileStart) < day(a.fertileStart), 'empieza antes');
  assert.ok(day(b.fertileEnd) > day(a.fertileEnd), 'termina después');
});

test('fertility is peak on ovulation, high in the window, low elsewhere', () => {
  const history = [period('2026-05-01', '2026-05-05'), period('2026-05-29', '2026-06-02'), period('2026-06-26', '2026-06-30'), period('2026-07-24', '2026-07-28')];
  const avg = averages(history, FALLBACK);
  const shape = cycleShape(avg.cycleLength, avg.periodLength);
  const cycleStart = day('2026-07-24');
  const at = (cycleDay: number) => {
    const d = new Date(cycleStart.getTime() + (cycleDay - 1) * 86_400_000);
    return snapshot(d, history, avg)!.fertility;
  };
  assert.equal(at(shape.ovulationDay), 'peak');
  assert.equal(at(shape.ovulationDay - 3), 'high');
  assert.equal(at(3), 'low');
});

test('analytics lists cycle and period lengths and counts symptoms per phase', () => {
  const history = [period('2026-05-01', '2026-05-05'), period('2026-05-29', '2026-06-02'), period('2026-06-26', '2026-06-30')];
  const avg = averages(history, FALLBACK);
  const logs = [
    { date: day('2026-06-27'), flow: 'medium', energy: 2, symptoms: ['cramps'] },
    { date: day('2026-06-28'), flow: 'light', energy: 2, symptoms: ['cramps', 'fatigue'] },
    { date: day('2026-06-29'), flow: null, energy: 3, symptoms: ['cramps'] },
  ];
  const a = analytics(logs, history, avg);
  assert.deepEqual(a.cycles, [{ start: '2026-05-01', length: 28 }, { start: '2026-05-29', length: 28 }]);
  assert.deepEqual(a.periods.map((p) => p.length), [5, 5, 5]);
  assert.equal(a.symptomsByPhase.menstrual.days, 3);
  assert.deepEqual(a.symptomsByPhase.menstrual.symptoms[0], { symptom: 'cramps', count: 3 });
  assert.equal(a.symptomsByPhase.luteal.days, 0);
});

test('daily log accepts the Flo-style fields and rejects values out of range', () => {
  assert.ok(MOODS.includes('mood_swings'));
  assert.ok(SEXUAL_ACTIVITY.includes('protected'));
  assert.ok(CONTRACEPTIVES.includes('iud'));
  const ok = cycleLogSchema.safeParse({ moods: ['happy', 'anxious'], sexualActivity: 'protected', contraception: 'pill', sleepQuality: 4, stress: 2, waterGlasses: 8, symptoms: ['cramps'] });
  assert.equal(ok.success, true);
  assert.equal(cycleLogSchema.safeParse({ sleepQuality: 6 }).success, false);
  assert.equal(cycleLogSchema.safeParse({ waterGlasses: 21 }).success, false);
  assert.equal(cycleLogSchema.safeParse({ moods: ['sad'] }).success, false);
  assert.equal(cycleLogSchema.safeParse({ mood: 3 }).success, false, 'the legacy numeric mood is gone');
});
