// Coliseo: qué músculos trabaja cada ejercicio, fatiga y recuperación, series
// efectivas, balance empuje/tirón/piernas, tonelaje, 1RM, discos y descanso
// según el ejercicio. Funciones puras (sin React ni API): las usa la zona y las
// prueba tests/unit/coliseo.unit.ts.
import type { SetType, Workout, WorkoutSet } from '@noutlife/shared';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/* ───────── Series ───────── */

export const SET_TYPES: Array<{ value: SetType; label: string; short: string }> = [
  { value: 'normal', label: 'Efectiva', short: '' },
  { value: 'warmup', label: 'Calentamiento', short: 'C' },
  { value: 'drop', label: 'Drop-set', short: 'D' },
  { value: 'myo', label: 'Myo-reps', short: 'M' },
  { value: 'rest_pause', label: 'Rest-pause', short: 'RP' },
  { value: 'failure', label: 'Al fallo', short: 'F' },
];
export const setTypeOf = (type?: SetType) => SET_TYPES.find((t) => t.value === (type ?? 'normal')) ?? SET_TYPES[0];

type SetLike = Pick<WorkoutSet, 'weight' | 'reps' | 'type'> & { completed?: boolean };

/** Serie efectiva: completada, con repeticiones y que no es de calentamiento (las antiguas, sin tipo, cuentan). */
export const isEffective = (s: SetLike) => s.completed !== false && s.type !== 'warmup' && (s.reps ?? 1) > 0;

/** Tonelaje: kilos × repeticiones de las series completadas (el calentamiento también es peso levantado). */
export const setTonnage = (s: SetLike) => (s.completed !== false ? (s.weight ?? 0) * (s.reps ?? 0) : 0);
export const workoutTonnage = (w: Pick<Workout, 'exercises'>) =>
  (w.exercises ?? []).reduce((a, ex) => a + (ex.sets ?? []).reduce((b, s) => b + setTonnage(s), 0), 0);

/* ───────── Músculos ───────── */

export type Muscle =
  | 'chest' | 'frontDelts' | 'sideDelts' | 'rearDelts' | 'triceps' | 'biceps' | 'forearms' | 'traps'
  | 'lats' | 'lowerBack' | 'abs' | 'obliques' | 'glutes' | 'quads' | 'hamstrings' | 'calves';
type Split = 'push' | 'pull' | 'legs' | 'core';

/** En orden anatómico. `hours`: lo que tarda en recuperarse de una sesión dura (grandes 72 h, pequeños 48 h). */
export const MUSCLES: Record<Muscle, { label: string; hours: number; split: Split }> = {
  chest: { label: 'Pecho', hours: 72, split: 'push' },
  frontDelts: { label: 'Hombro frontal', hours: 48, split: 'push' },
  sideDelts: { label: 'Hombro lateral', hours: 48, split: 'push' },
  rearDelts: { label: 'Hombro posterior', hours: 48, split: 'pull' },
  triceps: { label: 'Tríceps', hours: 48, split: 'push' },
  biceps: { label: 'Bíceps', hours: 48, split: 'pull' },
  forearms: { label: 'Antebrazos', hours: 48, split: 'pull' },
  traps: { label: 'Trapecio', hours: 48, split: 'pull' },
  lats: { label: 'Dorsales', hours: 72, split: 'pull' },
  lowerBack: { label: 'Lumbares', hours: 72, split: 'pull' },
  abs: { label: 'Abdomen', hours: 48, split: 'core' },
  obliques: { label: 'Oblicuos', hours: 48, split: 'core' },
  glutes: { label: 'Glúteos', hours: 72, split: 'legs' },
  quads: { label: 'Cuádriceps', hours: 72, split: 'legs' },
  hamstrings: { label: 'Isquios', hours: 72, split: 'legs' },
  calves: { label: 'Gemelos', hours: 48, split: 'legs' },
};
export const MUSCLE_IDS = Object.keys(MUSCLES) as Muscle[];

type Targets = { primary: Muscle[]; secondary: Muscle[] };
const t = (primary: Muscle[], secondary: Muscle[] = []): Targets => ({ primary, secondary });

/** Catálogo de la API (lib/exercise-catalog.ts): músculos principales y secundarios. */
const EXERCISES: Record<string, Targets> = {
  'Press de Banca': t(['chest'], ['frontDelts', 'triceps']),
  'Press Inclinado con Mancuernas': t(['chest'], ['frontDelts', 'triceps']),
  'Press Declinado': t(['chest'], ['triceps']),
  'Aperturas con Mancuernas': t(['chest'], ['frontDelts']),
  'Fondos en Paralelas': t(['chest', 'triceps'], ['frontDelts']),
  Flexiones: t(['chest'], ['triceps', 'frontDelts', 'abs']),
  Dominadas: t(['lats'], ['biceps', 'rearDelts', 'forearms']),
  'Remo con Barra': t(['lats', 'traps'], ['rearDelts', 'biceps', 'lowerBack']),
  'Remo con Mancuerna': t(['lats'], ['traps', 'rearDelts', 'biceps']),
  'Jalón al Pecho': t(['lats'], ['biceps', 'rearDelts']),
  'Peso Muerto': t(['hamstrings', 'glutes', 'lowerBack'], ['traps', 'quads', 'forearms']),
  Hiperextensiones: t(['lowerBack'], ['glutes', 'hamstrings']),
  'Press Militar': t(['frontDelts'], ['sideDelts', 'triceps']),
  'Press Arnold': t(['frontDelts', 'sideDelts'], ['triceps']),
  'Elevaciones Laterales': t(['sideDelts']),
  'Elevaciones Frontales': t(['frontDelts']),
  'Pájaros': t(['rearDelts'], ['traps']),
  'Curl con Barra': t(['biceps'], ['forearms']),
  'Curl con Mancuernas': t(['biceps'], ['forearms']),
  'Curl Martillo': t(['biceps', 'forearms']),
  'Extensión de Tríceps Polea': t(['triceps']),
  'Press Francés': t(['triceps']),
  'Fondos en Banco': t(['triceps'], ['chest', 'frontDelts']),
  Sentadilla: t(['quads', 'glutes'], ['hamstrings', 'lowerBack']),
  'Sentadilla Goblet': t(['quads', 'glutes'], ['abs']),
  'Prensa de Piernas': t(['quads'], ['glutes']),
  Zancadas: t(['quads', 'glutes'], ['hamstrings']),
  'Extensión de Cuádriceps': t(['quads']),
  'Curl de Isquiotibiales': t(['hamstrings']),
  'Peso Muerto Rumano': t(['hamstrings', 'glutes'], ['lowerBack']),
  'Elevación de Gemelos': t(['calves']),
  Plancha: t(['abs'], ['obliques']),
  Crunches: t(['abs']),
  'Elevación de Piernas': t(['abs']),
  'Russian Twists': t(['obliques'], ['abs']),
};
/** Ejercicios fuera del catálogo: por su grupo muscular. Cardio no suma fatiga muscular. */
const GROUPS: Record<string, Targets> = {
  Pecho: t(['chest'], ['frontDelts', 'triceps']),
  Espalda: t(['lats'], ['biceps', 'rearDelts']),
  Hombros: t(['frontDelts', 'sideDelts']),
  'Bíceps': t(['biceps'], ['forearms']),
  'Tríceps': t(['triceps']),
  Piernas: t(['quads'], ['glutes', 'hamstrings']),
  Core: t(['abs'], ['obliques']),
};
export const targetsOf = (name?: string, group?: string): Targets =>
  (name && EXERCISES[name]) || (group && GROUPS[group]) || t([]);

/* ───────── Descanso ───────── */

const HEAVY = new Set(['Sentadilla', 'Peso Muerto', 'Press de Banca', 'Peso Muerto Rumano', 'Press Militar', 'Remo con Barra']);
const COMPOUND = new Set([
  'Press Inclinado con Mancuernas', 'Press Declinado', 'Fondos en Paralelas', 'Flexiones', 'Dominadas', 'Remo con Mancuerna',
  'Jalón al Pecho', 'Press Arnold', 'Sentadilla Goblet', 'Prensa de Piernas', 'Zancadas',
]);

/** Descanso tras una serie: más tras los compuestos pesados, menos tras aislamiento, calentamiento y técnicas de intensidad. */
export function restFor(name: string | undefined, group: string | undefined, type: SetType = 'normal'): { seconds: number; reason: string } {
  if (type === 'drop') return { seconds: 10, reason: 'Drop-set: baja el peso y sigue' };
  if (type === 'myo' || type === 'rest_pause') return { seconds: 20, reason: `${setTypeOf(type).label}: pausa corta` };
  const [seconds, reason]: [number, string] = name && HEAVY.has(name) ? [180, 'Compuesto pesado']
    : name && COMPOUND.has(name) ? [120, 'Compuesto']
      : group === 'Core' || group === 'Cardio' ? [60, 'Core y cardio']
        : [90, 'Aislamiento'];
  if (type === 'warmup') return { seconds: Math.min(seconds, 60), reason: 'Calentamiento' };
  if (type === 'failure') return { seconds: seconds + 30, reason: `${reason} al fallo` };
  return { seconds, reason };
}

/* ───────── 1RM y discos ───────── */

export type OneRmFormula = 'epley' | 'brzycki';

/** 1RM estimado. Epley: peso × (1 + reps/30). Brzycki: peso × 36 / (37 − reps), válido hasta 36 repeticiones. */
export function oneRepMax(weight: number, reps: number, formula: OneRmFormula = 'epley'): number {
  if (!(weight > 0) || !(reps >= 1)) return 0;
  if (reps === 1) return weight;
  if (formula === 'brzycki') return reps < 37 ? (weight * 36) / (37 - reps) : 0;
  return weight * (1 + reps / 30);
}

export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Discos por lado (de mayor a menor) para cargar `total` kg en una barra de `bar` kg; `rest` = kg que no cuadran. */
export function platesPerSide(total: number, bar = 20): { plates: number[]; rest: number } {
  let side = Math.max(0, (total - bar) / 2);
  const plates: number[] = [];
  for (const p of PLATES) while (side >= p - 1e-9) { plates.push(p); side -= p; }
  return { plates, rest: Math.round(side * 2 * 100) / 100 };
}

/* ───────── Fatiga y recuperación ───────── */

/** Series duras que deja una sesión intensa: con 6 recién hechas, el músculo está al 100 % de fatiga. */
const CAPACITY = 6;
const MODERATE = 0.25;
const HIGH = 0.6;

export type Recovery = 'idle' | 'fresh' | 'moderate' | 'high';

export interface MuscleState {
  /** 0 = descansado, 1 = sesión dura recién terminada (puede pasar de 1). */
  fatigue: number;
  /** Recuperación 0–100 %. */
  recovered: number;
  status: Recovery;
  /** Horas hasta bajar de fatiga moderada (0 = listo para entrenar). */
  readyIn: number;
  /** Series efectivas de los últimos 7 días; las de músculo secundario cuentan media. */
  weekSets: number;
  lastTrained: number | null;
}

interface Hit { muscle: Muscle; at: number; sets: number }

/** Series efectivas por músculo de las sesiones terminadas desde `since`. */
function hits(workouts: Workout[], since: number): Hit[] {
  const out: Hit[] = [];
  for (const w of workouts) {
    const at = Date.parse(w.date);
    if (!(w.xpEarned > 0) || at < since) continue;
    for (const ex of w.exercises ?? []) {
      const sets = (ex.sets ?? []).filter(isEffective).length;
      if (!sets) continue;
      const { primary, secondary } = targetsOf(ex.exerciseName, ex.muscleGroup);
      primary.forEach((muscle) => out.push({ muscle, at, sets }));
      secondary.forEach((muscle) => out.push({ muscle, at, sets: sets / 2 }));
    }
  }
  return out;
}

/** Cada serie se recupera en línea recta durante las horas del músculo. */
const fatigueAt = (list: Hit[], hours: number, at: number) =>
  list.reduce((sum, h) => sum + h.sets * Math.max(0, 1 - Math.max(0, at - h.at) / (hours * HOUR)), 0) / CAPACITY;

/**
 * Estado de cada músculo según las sesiones terminadas de los últimos 7 días.
 * ponytail: modelo lineal por número de series (sin carga ni RPE); afinar con el RPE si hace falta precisión.
 */
export function muscleStates(workouts: Workout[], now = Date.now()): Record<Muscle, MuscleState> {
  const all = hits(workouts, now - 7 * DAY);
  const states = {} as Record<Muscle, MuscleState>;
  for (const muscle of MUSCLE_IDS) {
    const { hours } = MUSCLES[muscle];
    const mine = all.filter((h) => h.muscle === muscle);
    const fatigue = fatigueAt(mine, hours, now);
    let readyIn = 0;
    while (readyIn < hours && fatigueAt(mine, hours, now + readyIn * HOUR) >= MODERATE) readyIn += 1;
    states[muscle] = {
      fatigue,
      recovered: Math.round(100 * (1 - Math.min(1, fatigue))),
      status: !mine.length ? 'idle' : fatigue >= HIGH ? 'high' : fatigue >= MODERATE ? 'moderate' : 'fresh',
      readyIn,
      weekSets: mine.reduce((a, h) => a + h.sets, 0),
      lastTrained: mine.length ? Math.max(...mine.map((h) => h.at)) : null,
    };
  }
  return states;
}

/* ───────── Hipertrofia ───────── */

/** Series efectivas por músculo y semana con mejor relación estímulo/fatiga. */
export const WEEKLY_RANGE = [10, 20] as const;
export const rangeOf = (sets: number): 'low' | 'optimal' | 'high' =>
  sets < WEEKLY_RANGE[0] ? 'low' : sets > WEEKLY_RANGE[1] ? 'high' : 'optimal';

export interface Balance { push: number; pull: number; legs: number; total: number; notes: string[] }

/** Series efectivas de empuje, tirón y pierna (por el músculo principal de cada ejercicio) de los últimos `days` días. */
export function pplBalance(workouts: Workout[], now = Date.now(), days = 28): Balance {
  const b = { push: 0, pull: 0, legs: 0 };
  for (const w of workouts) {
    if (!(w.xpEarned > 0) || Date.parse(w.date) < now - days * DAY) continue;
    for (const ex of w.exercises ?? []) {
      const main = targetsOf(ex.exerciseName, ex.muscleGroup).primary[0];
      const split = main && MUSCLES[main].split;
      if (split && split !== 'core') b[split] += (ex.sets ?? []).filter(isEffective).length;
    }
  }
  const total = b.push + b.pull + b.legs;
  const notes: string[] = [];
  if (total >= 6) {
    if (b.push > b.pull * 1.5) notes.push('Empujas mucho más de lo que tiras: suma remos o dominadas para equilibrar los hombros.');
    else if (b.pull > b.push * 1.5) notes.push('Tiras mucho más de lo que empujas: suma press o fondos.');
    if (b.legs < total * 0.2) notes.push('Las piernas se quedan atrás: hacen menos del 20 % de tus series.');
    else if (b.legs > total * 0.6) notes.push('El tren superior se queda atrás: las piernas se llevan más del 60 % de tus series.');
  }
  return { ...b, total, notes };
}

/** Tonelaje de la última sesión de fuerza, de 7 y 30 días, y de los 7 días anteriores (para comparar). */
export function tonnage(workouts: Workout[], now = Date.now()) {
  const done = workouts.filter((w) => w.xpEarned > 0);
  const sum = (fromDays: number, toDays: number) => done
    .filter((w) => { const age = now - Date.parse(w.date); return age >= toDays * DAY && age < fromDays * DAY; })
    .reduce((a, w) => a + workoutTonnage(w), 0);
  const last = done.find((w) => workoutTonnage(w) > 0);
  return { session: last ? workoutTonnage(last) : 0, week: sum(7, 0), month: sum(30, 0), prevWeek: sum(14, 7) };
}

/* ───────── Sobrecarga progresiva ───────── */

export interface HistorySession { workoutDate: string; sets: SetLike[] }

export interface PreviousBest {
  /** Mejor 1RM estimado (Epley) y la serie que lo dio. */
  e1rm: number;
  best: { weight: number; reps: number };
  /** Mayor peso movido y las repeticiones con ese peso. */
  maxWeight: number;
  maxWeightReps: number;
  /** Series completadas de la última sesión, para el «Anterior» de cada número de serie. */
  last: SetLike[];
  lastDate: string;
  /** Qué hacer hoy para superarla: una repetición más, o 2,5 kg más con las mismas. */
  targets: Array<{ weight: number; reps: number }>;
}

const kgOf = (s: SetLike) => s.weight ?? 0;
const repsOf = (s: SetLike) => s.reps ?? 0;
/** Más peso; a igual peso, más repeticiones. */
const heavier = (a: SetLike, b: SetLike) => kgOf(a) > kgOf(b) || (kgOf(a) === kgOf(b) && repsOf(a) > repsOf(b));
/** Más 1RM estimado; a igual 1RM (p. ej. peso corporal), más repeticiones. */
const stronger = (a: SetLike, b: SetLike) => {
  const ea = oneRepMax(kgOf(a), repsOf(a));
  const eb = oneRepMax(kgOf(b), repsOf(b));
  return ea > eb || (ea === eb && repsOf(a) > repsOf(b));
};

/** Mejores marcas a partir del historial del ejercicio (sesiones de la más reciente a la más antigua). */
export function previousBest(sessions: HistorySession[]): PreviousBest | null {
  const work = sessions.flatMap((s) => s.sets.filter((x) => isEffective(x) && repsOf(x) > 0));
  if (!sessions.length || !work.length) return null;
  const best = work.reduce((a, s) => (stronger(s, a) ? s : a));
  const max = work.reduce((a, s) => (heavier(s, a) ? s : a));
  const lastWork = sessions[0].sets.filter((x) => isEffective(x) && repsOf(x) > 0);
  const top = lastWork.length ? lastWork.reduce((a, s) => (heavier(s, a) ? s : a)) : max;
  return {
    e1rm: oneRepMax(kgOf(best), repsOf(best)),
    best: { weight: kgOf(best), reps: repsOf(best) },
    maxWeight: kgOf(max),
    maxWeightReps: repsOf(max),
    last: sessions[0].sets,
    lastDate: sessions[0].workoutDate,
    targets: kgOf(top) > 0
      ? [{ weight: kgOf(top), reps: repsOf(top) + 1 }, { weight: kgOf(top) + 2.5, reps: repsOf(top) }]
      : [{ weight: 0, reps: repsOf(top) + 1 }],
  };
}
