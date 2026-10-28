// Modelo del Coliseo (src/lib/coliseo.ts). Corre con: npm run test:unit --workspace=apps/web
// (.unit.ts para que Playwright, que recoge *.test.ts y *.spec.ts de tests/, no lo tome).
import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import type { SetType, Workout } from '@noutlife/shared';
import {
  MUSCLE_IDS, carryForward, muscleStates, oneRepMax, platesPerSide, pplBalance, previousBest, restFor, routineFromSession, tonnage,
} from '../../src/lib/coliseo';
import { buildFigure } from '../../src/components/coliseo/muscle3d/figure';
import { heatColor, type HeatTokens } from '../../src/components/coliseo/muscle3d/heat';

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
  ['Sentadilla', 'Piernas', [{ weight: 40, reps: 10, type: 'warmup' }, ...Array(5).fill({ weight: 100, reps: 5 })]],
  ['Press de Banca', 'Pecho', Array(4).fill({ weight: 80, reps: 8 })],
];

test('registrar una rutina pinta sus músculos por bandas de fatiga y se recuperan en los días siguientes', () => {
  assert.equal(muscleStates([], NOW).quads.status, 'idle');

  const fresh = muscleStates([workout(0, legDay)], NOW);
  assert.equal(fresh.quads.fatiguePct, 83, '5 series duras de 6 posibles');
  assert.equal(fresh.quads.status, 'high', 'más de 70 %: fatiga alta');
  assert.equal(fresh.glutes.status, 'high');
  assert.equal(fresh.chest.fatiguePct, 67);
  assert.equal(fresh.chest.status, 'moderate', 'de 31 a 70 %: moderada');
  assert.equal(fresh.hamstrings.status, 'moderate', 'secundario: media serie por serie');
  assert.equal(fresh.triceps.status, 'moderate');
  assert.equal(fresh.biceps.status, 'idle', 'lo que no se entrenó no cambia');
  assert.equal(fresh.quads.weekSets, 5, 'el calentamiento no cuenta');
  assert.equal(fresh.triceps.weekSets, 2);
  assert.equal(fresh.quads.fullIn, 72, 'los músculos grandes tardan 72 h en recuperarse del todo');

  const nextDay = muscleStates([workout(24, legDay)], NOW);
  assert.equal(nextDay.quads.status, 'moderate');
  assert.equal(nextDay.quads.readyIn, 22, 'horas hasta bajar a 30 %');
  assert.equal(nextDay.quads.fullIn, 48, 'horas hasta 0 %');
  assert.equal(nextDay.triceps.fullIn, 24, 'los pequeños, 48 h');

  const recovered = muscleStates([workout(80, legDay)], NOW);
  assert.equal(recovered.quads.status, 'fresh');
  assert.equal(recovered.quads.recovered, 100);
  assert.equal(recovered.quads.readyIn, 0);
  assert.equal(recovered.quads.fullIn, 0);

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

test('las bandas cortan en 30 y 70 % y el % tiene tope en 100', () => {
  // 6 series = 100 %; los cuádriceps se recuperan en línea recta durante 72 h.
  const quads = (hoursAgo: number, n = 6) =>
    muscleStates([workout(hoursAgo, [['Extensión de Cuádriceps', 'Piernas', Array(n).fill({ weight: 40, reps: 12 })]])], NOW).quads;
  const band = (s: ReturnType<typeof quads>) => [s.fatiguePct, s.status];
  assert.deepEqual(band(quads(50.4)), [30, 'fresh']);
  assert.deepEqual(band(quads(49.68)), [31, 'moderate']);
  assert.deepEqual(band(quads(21.6)), [70, 'moderate']);
  assert.deepEqual(band(quads(20.88)), [71, 'high']);
  const over = quads(0, 9);
  assert.equal(over.fatiguePct, 100, '9 series pasan de 1, pero se muestra 100 %');
  assert.equal(over.recovered, 0);
});

test('el color va de azul claro a verde, de amarillo a naranja y de rojo a carmesí', () => {
  const t: HeatTokens = { success: [58, 155, 103], warning: [212, 149, 42], error: [200, 70, 63], info: [59, 126, 166] };
  assert.deepEqual(heatColor(30, t), t.success, '30 % es el verde del tema');
  assert.deepEqual(heatColor(71, t), t.error, '71 % es el rojo del tema');
  assert.ok(heatColor(0, t)[2] > t.success[2], '0 % tira a azul');
  const [yellow, orange] = [heatColor(31, t), heatColor(70, t)];
  assert.ok(yellow[1] / yellow[0] > orange[1] / orange[0], 'de amarillo a naranja baja el verde');
  assert.ok(heatColor(100, t).reduce((a, b) => a + b) < t.error.reduce((a, b) => a + b), 'el carmesí es más oscuro que el rojo');
});

test('la figura 3D tiene los 16 músculos en espejo y cada toque cae en su músculo', () => {
  const fig = buildFigure();
  const material = new MeshBasicMaterial(); // FrontSide: un rayo solo choca con caras que miran hacia él
  const meshes = [new Mesh(fig.body, material), ...MUSCLE_IDS.map((m) => Object.assign(new Mesh(fig.muscles[m], material), { name: m }))];
  for (const m of MUSCLE_IDS) {
    const g = fig.muscles[m];
    assert.ok(g.index!.count >= 300, `${m}: tiene malla`);
    const box = new Box3().setFromBufferAttribute(g.getAttribute('position') as never);
    assert.ok(Math.abs(box.min.x + box.max.x) < 1e-6, `${m}: los dos lados son espejo`);
    assert.ok(box.min.y > 0 && box.max.y < 1.6, `${m}: dentro del cuerpo`);
  }
  // Rayo horizontal desde delante (+z) o desde detrás (−z) hacia (x, y), lado derecho.
  const hit = (x: number, y: number, front: boolean) =>
    new Raycaster(new Vector3(x, y, front ? 3 : -3), new Vector3(0, 0, front ? -1 : 1)).intersectObjects(meshes, false)[0]?.object.name || 'maniquí';
  const front: Array<[number, number, string]> = [
    [0.09, 1.32, 'chest'], [0.03, 1.21, 'abs'], [0.03, 1.15, 'abs'], [0.135, 1.15, 'obliques'], [0.2, 1.4, 'frontDelts'],
    [0.22, 1.25, 'biceps'], [0.275, 1.04, 'forearms'], [0.1, 0.7, 'quads'], [0, 1.65, 'maniquí'],
  ];
  const back: Array<[number, number, string]> = [
    [0.03, 1.38, 'traps'], [0.14, 1.22, 'lats'], [0.03, 1.06, 'lowerBack'], [0.2, 1.4, 'rearDelts'], [0.22, 1.25, 'triceps'],
    [0.08, 0.88, 'glutes'], [0.1, 0.66, 'hamstrings'], [0.1, 0.36, 'calves'],
  ];
  for (const [x, y, m] of front) assert.equal(hit(x, y, true), m, `de frente en (${x}, ${y})`);
  for (const [x, y, m] of back) assert.equal(hit(x, y, false), m, `de espaldas en (${x}, ${y})`);
  assert.equal(hit(-0.09, 1.32, true), 'chest', 'el lado izquierdo también');
  assert.deepEqual([fig.facing.chest, fig.facing.glutes, fig.facing.sideDelts], [1, -1, 0]);
});

test('tonelaje por sesión, semana y mes', () => {
  const t = tonnage([workout(1, legDay), workout(10 * 24, legDay)], NOW);
  const session = 40 * 10 + 5 * 100 * 5 + 4 * 80 * 8;
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

test('la serie siguiente hereda «al fallo» o el esfuerzo de la anterior, sin pisar lo que la persona ajustó', () => {
  type S = { completed: boolean; type: SetType; rpe?: number; rir?: number; auto?: boolean };
  const s = (p: Partial<S> = {}): S => ({ completed: false, type: 'normal', ...p });

  // Al fallo: la siguiente pendiente se preselecciona igual.
  const fail = carryForward([s({ completed: true, type: 'failure' }), s()], 0);
  assert.equal(fail[1].type, 'failure');
  assert.equal(fail[1].auto, true);
  // Con RPE (o RIR) también se hereda la intensidad.
  assert.equal(carryForward([s({ completed: true, rpe: 9 }), s()], 0)[1].rpe, 9);
  assert.equal(carryForward([s({ completed: true, rir: 1 }), s()], 0)[1].rir, 1);
  // El calentamiento no se hereda: después viene una serie efectiva.
  assert.equal(carryForward([s({ completed: true, type: 'warmup' }), s()], 0)[1].type, 'normal');
  // Lo que la persona eligió en la siguiente no se toca, ni una serie ya hecha.
  assert.equal(carryForward([s({ type: 'failure' }), s({ type: 'drop' })], 0)[1].type, 'drop');
  assert.equal(carryForward([s({ type: 'failure' }), s({ completed: true })], 0)[1].type, 'normal');
  // Si la de origen vuelve a efectiva, la heredada se limpia.
  const undone = carryForward([s({ type: 'normal' }), s({ type: 'failure', auto: true })], 0);
  assert.equal(undone[1].type, 'normal');
  assert.equal(undone[1].auto, false);
  // Sin serie anterior o siguiente, nada cambia.
  const one = [s({ type: 'failure' })];
  assert.equal(carryForward(one, 0), one);
  assert.equal(carryForward(one, -1), one);
});

test('una sesión se guarda como rutina con las series hechas: peso, repeticiones y clase', () => {
  const routine = routineFromSession([
    { exerciseId: 'b', name: 'Press de Banca', muscleGroup: 'Pecho', sets: [
      { weight: '40', reps: '12', completed: true, type: 'warmup' },
      { weight: '80', reps: '8', completed: true, type: 'normal' },
      { weight: '80', reps: '6', completed: true, type: 'failure' },
      { weight: '80', reps: '', completed: false, type: 'normal' },
    ] },
    { exerciseId: 'f', name: 'Fondos', sets: [{ weight: '', reps: '10', completed: false }] },
    { exerciseId: 'x', name: 'Vacío', sets: [] },
  ]);
  assert.equal(routine.length, 2, 'un ejercicio sin series no se guarda');
  assert.deepEqual(routine[0].targetSets, [
    { weight: 40, reps: 12, type: 'warmup' }, { weight: 80, reps: 8, type: 'normal' }, { weight: 80, reps: 6, type: 'failure' },
  ], 'solo las series hechas');
  assert.equal(routine[0].sets, 3);
  assert.equal(routine[0].weight, 80, 'el peso de trabajo, no el del calentamiento');
  assert.deepEqual(routine[1].targetSets, [{ weight: 0, reps: 10, type: 'normal' }], 'sin series hechas, se guarda lo planeado');
});
