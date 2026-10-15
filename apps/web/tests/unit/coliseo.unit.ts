// Modelo del Coliseo (src/lib/coliseo.ts). Corre con: npm run test:unit --workspace=apps/web
// (.unit.ts para que Playwright, que recoge *.test.ts y *.spec.ts de tests/, no lo tome).
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Workout } from '@noutlife/shared';
import {
  muscleStates, oneRepMax, platesPerSide, pplBalance, previousBest, restFor, tonnage,
} from '../../src/lib/coliseo';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-15T18:00:00.000Z');

type Ex = [name: string, group: string, sets: Array<{ weight: number; reps: number; type?: 'warmup' | 'drop' }>];
function workout(hoursAgo: number, exercises: Ex[], xpEarned = 120): Workout {
  return {
    id: `w${hoursAgo}`, userId: 'u', title: 'Rutina', date: new Date(NOW - hoursAgo * HOUR).toISOString(), xpEarned, goldEarned: 0,
    createdAt: '', updatedAt: '',
    exercises: exercises.map(([exerciseName, muscleGroup, sets], order) => ({
      id: `e${order}`, workoutId: 'w', exerciseId: exerciseName, exerciseName, muscleGroup, order,
      sets: sets.map((s, i) => ({ id: String(i), completed: true, ...s })),
    })),
  };
}
const legDay: Ex[] = [
  ['Sentadilla', 'Piernas', [{ weight: 40, reps: 10, type: 'warmup' }, ...Array(4).fill({ weight: 100, reps: 5 })]],
  ['Press de Banca', 'Pecho', Array(4).fill({ weight: 80, reps: 8 })],
];

test('registrar una rutina pone en rojo sus músculos y se recuperan en los días siguientes', () => {
  assert.equal(muscleStates([], NOW).quads.status, 'idle');

  const fresh = muscleStates([workout(0, legDay)], NOW);
  assert.equal(fresh.quads.status, 'high');
  assert.equal(fresh.glutes.status, 'high');
  assert.equal(fresh.chest.status, 'high');
  assert.equal(fresh.hamstrings.status, 'moderate', 'secundario: media serie por serie');
  assert.equal(fresh.triceps.status, 'moderate');
  assert.equal(fresh.biceps.status, 'idle', 'lo que no se entrenó no cambia');
  assert.equal(fresh.quads.weekSets, 4, 'el calentamiento no cuenta');
  assert.equal(fresh.triceps.weekSets, 2);

  const nextDay = muscleStates([workout(24, legDay)], NOW);
  assert.equal(nextDay.quads.status, 'moderate');
  assert.equal(nextDay.quads.readyIn, 22);

  const recovered = muscleStates([workout(80, legDay)], NOW);
  assert.equal(recovered.quads.status, 'fresh');
  assert.equal(recovered.quads.recovered, 100);
  assert.equal(recovered.quads.readyIn, 0);

  assert.equal(muscleStates([workout(8 * 24, legDay)], NOW).quads.status, 'idle', 'fuera de la semana');
  assert.equal(muscleStates([workout(0, legDay, 0)], NOW).quads.status, 'idle', 'un borrador sin terminar no cuenta');
  assert.equal(muscleStates([workout(0, [['Curl con Barra', 'Bíceps', Array(5).fill({ weight: 30, reps: 0 })]])], NOW).biceps.status, 'idle', 'series marcadas sin repeticiones no cuentan');
});

test('el balance avisa cuando el empuje supera al tirón', () => {
  const push = workout(2, [['Press de Banca', 'Pecho', Array(6).fill({ weight: 60, reps: 10 })], ['Remo con Barra', 'Espalda', Array(2).fill({ weight: 60, reps: 10 })]]);
  const b = pplBalance([push], NOW);
  assert.deepEqual([b.push, b.pull, b.legs], [6, 2, 0]);
  assert.equal(b.notes.length, 2);
  assert.match(b.notes[0], /Empujas/);
  assert.equal(pplBalance([workout(2, [['Sentadilla', 'Piernas', Array(5).fill({ weight: 60, reps: 5 })]])], NOW).notes.length, 0, 'menos de 6 series: sin juicio');
});

test('tonelaje por sesión, semana y mes', () => {
  const t = tonnage([workout(1, legDay), workout(10 * 24, legDay)], NOW);
  const session = 40 * 10 + 4 * 100 * 5 + 4 * 80 * 8;
  assert.deepEqual(t, { session, week: session, month: session * 2, prevWeek: session });
});

test('1RM, discos y descanso', () => {
  assert.equal(oneRepMax(100, 1), 100);
  assert.equal(Math.round(oneRepMax(100, 5) * 10) / 10, 116.7);
  assert.equal(oneRepMax(100, 5, 'brzycki'), 112.5);
  assert.deepEqual(platesPerSide(100), { plates: [25, 15], rest: 0 });
  assert.deepEqual(platesPerSide(61.25), { plates: [20], rest: 1.25 });
  assert.equal(restFor('Sentadilla', 'Piernas').seconds, 180);
  assert.equal(restFor('Curl con Barra', 'Bíceps').seconds, 90);
  assert.equal(restFor('Sentadilla', 'Piernas', 'warmup').seconds, 60);
  assert.equal(restFor('Curl con Barra', 'Bíceps', 'drop').seconds, 10);
});

test('la mejor marca anterior ignora el calentamiento y propone cómo superarla', () => {
  const best = previousBest([
    { workoutDate: '2026-10-13', sets: [{ weight: 100, reps: 12, type: 'warmup' }, { weight: 80, reps: 8 }, { weight: 80, reps: 7 }] },
    { workoutDate: '2026-10-06', sets: [{ weight: 85, reps: 5 }] },
  ]);
  assert.ok(best);
  assert.deepEqual(best.best, { weight: 80, reps: 8 });
  assert.equal(best.maxWeight, 85);
  assert.deepEqual(best.targets, [{ weight: 80, reps: 9 }, { weight: 82.5, reps: 8 }]);
  assert.equal(previousBest([]), null);
});
