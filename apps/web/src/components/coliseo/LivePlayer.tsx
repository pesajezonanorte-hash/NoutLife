// Modo en vivo del Coliseo: pantalla completa, sin distracciones, para entrenar
// con una mano. Un ejercicio a la vez con números grandes, la marca a superar
// arriba y «Completar serie» abajo, al alcance del pulgar. Al completar una serie
// arranca el descanso según el ejercicio y la clase de serie (lib/coliseo
// restFor), con sonido y vibración al terminar; mientras corre se anota el
// esfuerzo (RPE o RIR) de la serie recién hecha.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Minus, Music, Pause, Play, Plus, Trophy, X } from 'lucide-react';
import type { Exercise, SetType } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { slam } from '@/lib/motion';
import { SET_TYPES, oneRepMax, platesPerSide, previousBest, restFor, setTonnage, setTypeOf, type PreviousBest } from '@/lib/coliseo';
import { Badge, Button, ChipGroup, IconChip, Input, Modal, ResponsiveDialog, SegmentedControl, chipClasses, type SegmentOption } from '@/components/ui/lq';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { playChime } from '@/components/focus/ambientSound';
import { notifyLocal } from '@/lib/systemNotifications';
import * as workoutService from '@/services/workout.service';
import * as coliseo from '@/services/coliseo.service';
import { RollingClock } from './ColiseoMotion';

export interface ActiveSet { id: string; weight: string; reps: string; completed: boolean; type: SetType; rpe?: number; rir?: number }
export interface ActiveExercise {
  exerciseId: string;
  name: string;
  muscleGroup?: string;
  equipment?: string;
  sets: ActiveSet[];
  /** Mejores marcas anteriores: undefined = aún no se consultaron, null = primera vez. */
  prev?: PreviousBest | null;
}
export interface ActiveWorkout {
  id: string;
  title: string;
  startTime: number;
  exercises: ActiveExercise[];
  /** Milisegundos acumulados en pausa y, si está en pausa, desde cuándo. */
  pausedMs?: number;
  pausedAt?: number | null;
  /** Ejercicio en pantalla. */
  current?: number;
}
export type UpdateWorkout = (fn: (w: ActiveWorkout) => ActiveWorkout) => void;

export const blankSet = (id: number | string, weight = '', reps = ''): ActiveSet => ({ id: String(id), weight, reps, completed: false, type: 'normal' });

/** Id de una serie nueva: el mayor de la lista + 1, así no choca con otra serie tras borrar una. */
export const nextSetId = (sets: ActiveSet[]) => String(Math.max(0, ...sets.map((s) => Number(s.id) || 0)) + 1);

/** Tiempo activo de la sesión (descuenta las pausas). */
export function elapsedMs(w: ActiveWorkout, now: number) {
  const paused = (w.pausedMs ?? 0) + (w.pausedAt ? now - w.pausedAt : 0);
  return Math.max(0, now - w.startTime - paused);
}

/** Series de la sesión en el formato de la API. */
export const toWorkoutSets = (ex: ActiveExercise) => ex.sets.map((s) => ({
  weight: Math.max(0, Number(s.weight) || 0), reps: Math.max(0, Math.round(Number(s.reps)) || 0), completed: s.completed, type: s.type, rpe: s.rpe, rir: s.rir,
}));
export const sessionTonnage = (w: ActiveWorkout) =>
  w.exercises.reduce((a, ex) => a + toWorkoutSets(ex).reduce((b, s) => b + setTonnage(s), 0), 0);

const kg = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('es-ES')} kg`;
const mark = (t: { weight?: number; reps?: number }) => ((t.weight ?? 0) > 0 ? `${kg(t.weight ?? 0)} × ${t.reps ?? 0}` : `${t.reps ?? 0} reps`);
/** «80×8» con coma decimal (102,5×5). */
const pair = (w?: number | string, r?: number | string) => `${(Number(w) || 0).toLocaleString('es-ES')}×${Number(r) || 0}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');

type Scale = 'rpe' | 'rir';
const SCALES: SegmentOption<Scale>[] = [{ value: 'rpe', label: 'RPE 1–10' }, { value: 'rir', label: 'RIR 0–4' }];
const SCALE_KEY = 'coliseo.effortScale';
function readScale(): Scale {
  try { return localStorage.getItem(SCALE_KEY) === 'rir' ? 'rir' : 'rpe'; } catch { return 'rpe'; }
}

const MUSCLE_GROUPS = ['Todos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core', 'Cardio'].map((m) => ({ value: m, label: m }));

function ExerciseSearchModal({ onSelect, onClose }: { onSelect: (ex: Exercise) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('Todos');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    workoutService
      .fetchExercises(search || undefined, muscleFilter !== 'Todos' ? muscleFilter : undefined)
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => setLoading(false));
  }, [search, muscleFilter]);

  return (
    <ResponsiveDialog open onClose={onClose} title="Agregar ejercicio">
      <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ejercicio…" aria-label="Buscar ejercicio" autoFocus />
      <ChipGroup label="Grupo muscular" options={MUSCLE_GROUPS} value={muscleFilter} onChange={setMuscleFilter} />
      <div className="-mx-2 flex max-h-72 flex-col overflow-y-auto">
        {loading ? (
          <p role="status" className="py-6 text-center text-body-sm text-on-surface-light">Buscando…</p>
        ) : exercises.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-on-surface-light">Sin resultados</p>
        ) : (
          exercises.map((ex) => (
            <button key={ex.id} type="button" onClick={() => onSelect(ex)} className="flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-variant">
              <span className="text-body-md text-on-background">{ex.name}</span>
              {(ex.muscleGroup || ex.equipment) && <span className="text-body-sm text-on-surface-light">{[ex.muscleGroup, ex.equipment].filter(Boolean).join(' · ')}</span>}
            </button>
          ))
        )}
      </div>
    </ResponsiveDialog>
  );
}

/** Fila grande −/valor/+ para una sola mano (dianas de 56 px). */
function BigStepper({ label, unit, value, step, disabled, onChange }: {
  label: string; unit: string; value: string; step: number; disabled?: boolean; onChange: (v: string) => void;
}) {
  const num = parseFloat(value) || 0;
  const set = (n: number) => onChange(String(Math.max(0, Math.round(n * 100) / 100)));
  const btn = 'flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface-variant text-on-background transition-transform duration-150 active:scale-95 disabled:opacity-40';
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-label-lg text-on-surface-light">{unit}</span>
      <button type="button" disabled={disabled} aria-label={`Restar ${step} a ${label}`} onClick={() => set(num - step)} className={btn}>
        <Minus aria-hidden className="size-6" strokeWidth={2.25} />
      </button>
      <input
        type="number" inputMode="decimal" value={value} placeholder="0" disabled={disabled} aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="h-16 w-full min-w-0 flex-1 rounded-2xl border border-border-strong bg-background text-center font-mono text-display-sm font-bold tabular-nums text-on-background focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/25 disabled:opacity-60"
      />
      <button type="button" disabled={disabled} aria-label={`Sumar ${step} a ${label}`} onClick={() => set(num + step)} className={btn}>
        <Plus aria-hidden className="size-6" strokeWidth={2.25} />
      </button>
    </div>
  );
}

/**
 * Esfuerzo de una serie: RPE 1–10 o RIR 0–4 (se guarda uno; tocar el elegido lo quita).
 * `quick`: solo RPE 6–10, el rango de las series duras, en una fila para el panel de descanso.
 */
function EffortPicker({ scale, set, label, quick, onChange }: { scale: Scale; set: ActiveSet; label: string; quick?: boolean; onChange: (p: Partial<ActiveSet>) => void }) {
  const values = scale === 'rir' ? [0, 1, 2, 3, 4] : quick ? [6, 7, 8, 9, 10] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2">
      {values.map((v) => {
        const on = scale === 'rpe' ? set.rpe === v : set.rir === v;
        return (
          <button
            key={v} type="button" role="radio" aria-checked={on}
            onClick={() => onChange(scale === 'rpe' ? { rpe: on ? undefined : v, rir: undefined } : { rir: on ? undefined : v, rpe: undefined })}
            className={cn(chipClasses(on), 'justify-center px-0 font-mono tabular-nums')}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

interface Rest { endAt: number; total: number; reason: string; exIdx: number; setId: string; done?: boolean }
/** Bloqueo de pantalla (Screen Wake Lock); el tipo de la librería DOM no siempre lo trae. */
interface ScreenLock { release(): Promise<void>; addEventListener?: (type: 'release', fn: () => void) => void }

export function LivePlayer({ workout, update, playlistUrl, onMinimize, onFinish, onDiscard }: {
  workout: ActiveWorkout;
  update: UpdateWorkout;
  playlistUrl?: string | null;
  onMinimize: () => void;
  onFinish: (w: ActiveWorkout) => Promise<void>;
  onDiscard: (w: ActiveWorkout) => Promise<void>;
}) {
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<Rest | null>(null);
  /** Serie elegida a mano; sin elegir, la primera pendiente. */
  const [picked, setPicked] = useState<number | null>(null);
  const [prs, setPrs] = useState<Set<string>>(() => new Set());
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<'finish' | 'discard' | null>(null);
  const [scale, setScaleState] = useState<Scale>(readScale);
  const rootRef = useRef<HTMLDivElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const asked = useRef(new Set<string>());
  /** Ejercicios cuyo historial no se pudo leer: sin banner en vez de «Buscando…» para siempre. */
  const [noHistory, setNoHistory] = useState<Set<string>>(() => new Set());
  /** Serie borrada que se puede deshacer (5 s). */
  const [undo, setUndo] = useState<{ exIdx: number; index: number; set: ActiveSet } | null>(null);

  useEffect(() => {
    lockScroll();
    rootRef.current?.focus();
    return () => {
      unlockScroll();
      void audio.current?.close().catch(() => null);
    };
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Marca anterior de cada ejercicio (una consulta por ejercicio; si falla, sin banner).
  useEffect(() => {
    for (const ex of workout.exercises) {
      if (ex.prev !== undefined || asked.current.has(ex.exerciseId)) continue;
      asked.current.add(ex.exerciseId);
      coliseo.fetchExerciseHistory(ex.exerciseId)
        .then((h) => {
          const prev = previousBest(h.sessions);
          update((w) => ({ ...w, exercises: w.exercises.map((e) => (e.exerciseId === ex.exerciseId && e.prev === undefined ? { ...e, prev } : e)) }));
        })
        .catch(() => setNoHistory((s) => new Set(s).add(ex.exerciseId)));
    }
  }, [workout.exercises, update]);

  // Fin del descanso: sonido + vibración, y el aviso se va solo a los 4 s.
  useEffect(() => {
    if (!rest || rest.done || now < rest.endAt) return;
    setRest({ ...rest, done: true });
    if (audio.current) playChime(audio.current);
    navigator.vibrate?.([200, 100, 200]);
  }, [now, rest]);
  // Con la app en segundo plano, el fin del descanso va a la barra de avisos del móvil.
  // Su temporizador se borra al cancelar el descanso: si lo saltas, no suena ni avisa.
  useEffect(() => {
    if (!rest || rest.done) return;
    const id = window.setTimeout(() => {
      if (document.hidden) void notifyLocal('Descanso terminado', { body: 'Ya puedes hacer la siguiente serie.', tag: 'coliseo-rest', renotify: true, data: { link: '/coliseo' } });
    }, Math.max(0, rest.endAt - Date.now()));
    return () => window.clearTimeout(id);
  }, [rest?.endAt, rest?.done]);
  // Pantalla encendida mientras entrenas (Wake Lock): el descanso avisa con el móvil en la mano.
  useEffect(() => {
    const device = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<ScreenLock> } };
    let lock: ScreenLock | null = null;
    let active = true;
    const hold = () => {
      if (!active || lock || document.visibilityState !== 'visible' || !device.wakeLock) return;
      device.wakeLock.request('screen').then((s) => {
        if (!active) { void s.release().catch(() => undefined); return; }
        lock = s;
        s.addEventListener?.('release', () => { if (lock === s) lock = null; });
      }).catch(() => undefined);
    };
    hold();
    document.addEventListener('visibilitychange', hold);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', hold);
      void lock?.release().catch(() => undefined);
    };
  }, []);
  // «Deshacer» de una serie borrada: dura 5 s.
  useEffect(() => {
    if (!undo) return;
    const id = window.setTimeout(() => setUndo(null), 5000);
    return () => window.clearTimeout(id);
  }, [undo]);
  useEffect(() => {
    if (!rest?.done) return;
    const id = setTimeout(() => setRest(null), 4000);
    return () => clearTimeout(id);
  }, [rest?.done]);

  /** El audio solo arranca tras un toque: se prepara al completar la serie para que suene al acabar el descanso. */
  function primeAudio() {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      if (!audio.current || audio.current.state === 'closed') audio.current = new Ctx();
      if (audio.current.state === 'suspended') void audio.current.resume().catch(() => null);
    } catch {
      // Sin audio queda la vibración.
    }
  }

  const setScale = (s: Scale) => {
    setScaleState(s);
    try { localStorage.setItem(SCALE_KEY, s); } catch { /* preferencia de esta pestaña */ }
  };

  const n = workout.exercises.length;
  const exIdx = Math.min(workout.current ?? 0, Math.max(0, n - 1));
  const ex = workout.exercises[exIdx] as ActiveExercise | undefined;
  const pending = ex ? ex.sets.findIndex((s) => !s.completed) : -1;
  const setIdx = ex && ex.sets.length ? Math.min(picked ?? (pending >= 0 ? pending : ex.sets.length - 1), ex.sets.length - 1) : -1;
  const set = ex && setIdx >= 0 ? ex.sets[setIdx] : undefined;

  const done = workout.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  const planned = workout.exercises.reduce((a, e) => a + e.sets.length, 0);
  const paused = !!workout.pausedAt;

  const patchSet = useCallback((exI: number, setId: string, patch: Partial<ActiveSet>) => update((w) => ({
    ...w,
    exercises: w.exercises.map((e, i) => (i !== exI ? e : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) })),
  })), [update]);

  const goTo = (i: number) => {
    setPicked(null);
    update((w) => ({ ...w, current: i }));
  };

  function togglePause() {
    update((w) => (w.pausedAt
      ? { ...w, pausedMs: (w.pausedMs ?? 0) + (Date.now() - w.pausedAt), pausedAt: null }
      : { ...w, pausedAt: Date.now() }));
  }

  function addSet() {
    if (!ex) return;
    const last = ex.sets[ex.sets.length - 1];
    const id = nextSetId(ex.sets);
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, i) => (i !== exIdx ? e : { ...e, sets: [...e.sets, blankSet(id, last?.weight, last?.reps)] })),
    }));
    setPicked(ex.sets.length);
    // La serie nueva pasa a ser la que toca: el descanso anterior se cancela en silencio.
    setRest(null);
  }

  function addExercise(x: Exercise) {
    update((w) => ({
      ...w,
      current: w.exercises.length,
      exercises: [...w.exercises, { exerciseId: x.id, name: x.name, muscleGroup: x.muscleGroup, equipment: x.equipment, sets: [blankSet(1)] }],
    }));
    setPicked(null);
    setSearching(false);
    setRest(null);
  }

  /** Cambiar de serie o de ejercicio a mano corta el descanso en silencio: no suena ni avisa. */
  const jumpTo = (i: number) => {
    if (i !== exIdx) setRest(null);
    goTo(i);
  };
  const pickSet = (j: number) => {
    if (j !== setIdx) setRest(null);
    setPicked(j);
  };

  function toggleSet() {
    if (!ex || !set) return;
    if (set.completed) {
      patchSet(exIdx, set.id, { completed: false });
      setPicked(setIdx);
      setRest(null);
      return;
    }
    primeAudio();
    patchSet(exIdx, set.id, { completed: true });
    setPicked(null);

    // Récord: supera el mejor 1RM estimado anterior y lo mejor de hoy.
    const e1 = oneRepMax(Number(set.weight) || 0, Number(set.reps) || 0);
    const today = Math.max(0, ...ex.sets.filter((s) => s.completed && s.id !== set.id).map((s) => oneRepMax(Number(s.weight) || 0, Number(s.reps) || 0)));
    if (ex.prev && e1 > ex.prev.e1rm && e1 > today) setPrs((p) => new Set(p).add(`${exIdx}-${set.id}`));

    const left = workout.exercises.some((e, i) => e.sets.some((s) => !s.completed && !(i === exIdx && s.id === set.id)));
    if (left) {
      const r = restFor(ex.name, ex.muscleGroup, set.type);
      setRest({ endAt: Date.now() + r.seconds * 1000, total: r.seconds, reason: r.reason, exIdx, setId: set.id });
    } else {
      setRest(null);
    }
    // Ejercicio terminado: pasa al siguiente que tenga series pendientes.
    if (!ex.sets.some((s) => !s.completed && s.id !== set.id)) {
      const next = workout.exercises.findIndex((e, i) => i > exIdx && e.sets.some((s) => !s.completed));
      if (next >= 0) goTo(next);
    }
  }

  /** Borra una serie (hecha, cancelada o anotada por error) de un toque; se puede deshacer unos segundos. */
  function removeSet(j: number) {
    const removed = ex?.sets[j];
    if (!removed) return;
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, i) => (i !== exIdx ? e : { ...e, sets: e.sets.filter((s) => s.id !== removed.id) })),
    }));
    // Si el descanso era de esta serie, ya no tiene sentido: se cancela en silencio.
    if (rest && rest.exIdx === exIdx && rest.setId === removed.id) setRest(null);
    setPicked(j);
    setUndo({ exIdx, index: j, set: removed });
  }

  function undoRemove() {
    if (!undo) return;
    const { exIdx: i, index, set: s } = undo;
    update((w) => ({
      ...w,
      exercises: w.exercises.map((e, k) => (k !== i ? e : { ...e, sets: [...e.sets.slice(0, index), { ...s, id: nextSetId(e.sets) }, ...e.sets.slice(index)] })),
    }));
    setUndo(null);
  }

  async function run(kind: 'finish' | 'discard') {
    setBusy(kind);
    try {
      await (kind === 'finish' ? onFinish : onDiscard)(workout);
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  }

  const w = Number(set?.weight) || 0;
  const r = Number(set?.reps) || 0;
  const e1 = oneRepMax(w, r);
  const prev = ex?.prev;
  const beat = prev ? e1 - prev.e1rm : 0;
  // «Anterior» compara con la serie del mismo tipo y número de la última vez (calentamiento con calentamiento).
  const sameKind = (s: { type?: SetType }) => (s.type === 'warmup') === (set?.type === 'warmup');
  const previousSet = set && prev?.last.filter(sameKind)[ex!.sets.slice(0, setIdx).filter(sameKind).length];
  const plates = ex?.equipment === 'Barra' && w >= 20 ? platesPerSide(w).plates : null;
  const restLeft = rest ? Math.max(0, Math.ceil((rest.endAt - now) / 1000)) : 0;
  const ratedEx = rest ? workout.exercises[rest.exIdx] : undefined;
  const rated = ratedEx?.sets.find((s) => s.id === rest?.setId);

  return createPortal(
    <motion.div
      ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Entrenamiento en vivo: ${workout.title}`}
      className="fixed inset-0 z-[70] flex flex-col bg-background text-on-background outline-none"
      initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 32, transition: { duration: 0.2 } }} transition={slam}
    >
      <header className="border-b border-border px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Button variant="icon" aria-label="Minimizar el modo en vivo" onClick={onMinimize}>
            <ChevronDown aria-hidden className="size-6" strokeWidth={1.75} />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className={cn('flex items-center justify-center gap-1.5 truncate text-label-md', paused ? 'text-warning-text' : 'text-error-text')}>
              <span aria-hidden className={cn('size-2 rounded-full', paused ? 'bg-warning' : 'animate-pulse bg-error [.reduce-motion_&]:animate-none')} />
              {paused ? 'En pausa' : 'En vivo'} · {workout.title}
            </p>
            <RollingClock seconds={elapsedMs(workout, now) / 1000} label="Tiempo de entrenamiento" className={cn('text-heading-lg', paused && 'opacity-50')} />
          </div>
          {playlistUrl && (
            <a
              href={playlistUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir tu playlist de entrenamiento (pestaña nueva)"
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-success-text hover:bg-surface-variant"
            >
              <Music aria-hidden className="size-5" />
            </a>
          )}
          <Button variant="icon" aria-label={paused ? 'Reanudar' : 'Pausar'} onClick={togglePause}>
            {paused ? <Play aria-hidden className="size-6" /> : <Pause aria-hidden className="size-6" />}
          </Button>
        </div>
        <div
          role="progressbar" aria-label="Series completadas" aria-valuemin={0} aria-valuemax={planned || 1} aria-valuenow={done}
          className="mx-auto mt-2 h-1.5 max-w-lg overflow-hidden rounded-full bg-surface-variant"
        >
          <span className="block h-full origin-left rounded-full bg-primary transition-transform duration-500" style={{ transform: `scaleX(${planned ? done / planned : 0})` }} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {!ex ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-12 text-center">
            <IconChip icon={Dumbbell} tone="primary" size="lg" />
            <p className="text-heading-md">Agrega tu primer ejercicio</p>
            <p className="text-body-md text-on-surface-light">Búscalo por nombre o por grupo muscular. Verás tu marca anterior para superarla.</p>
            <Button size="lg" onClick={() => setSearching(true)}><Plus aria-hidden className="size-5" />Agregar ejercicio</Button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-lg flex-col gap-5">
            {n > 1 && (
              <ol aria-label="Ejercicios de la sesión" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [touch-action:pan-x] [overscroll-behavior-x:contain]">
                {workout.exercises.map((e, i) => {
                  const d = e.sets.filter((s) => s.completed).length;
                  const on = i === exIdx;
                  return (
                    <li key={`${e.exerciseId}-${i}`} className="shrink-0">
                      <button
                        type="button" aria-current={on ? 'step' : undefined} onClick={() => jumpTo(i)}
                        className={cn(chipClasses(on), 'max-w-[11rem]', d === e.sets.length && d > 0 && !on && 'text-success-text')}
                      >
                        {d === e.sets.length && d > 0 && <Check aria-hidden className="size-4" />}
                        <span className="truncate">{e.name}</span>
                        <span className="font-mono text-label-md tabular-nums opacity-80">{d}/{e.sets.length}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="flex items-center gap-1">
              <Button variant="icon" aria-label="Ejercicio anterior" disabled={exIdx === 0} onClick={() => jumpTo(exIdx - 1)}>
                <ChevronLeft aria-hidden className="size-6" />
              </Button>
              <div className="min-w-0 flex-1 text-center">
                <h2 className="text-heading-lg">{ex.name}</h2>
                <p className="text-body-sm text-on-surface-light">{[ex.muscleGroup, ex.equipment].filter(Boolean).join(' · ')}{n > 1 ? ` · ${exIdx + 1} de ${n}` : ''}</p>
              </div>
              <Button variant="icon" aria-label="Ejercicio siguiente" disabled={exIdx >= n - 1} onClick={() => jumpTo(exIdx + 1)}>
                <ChevronRight aria-hidden className="size-6" />
              </Button>
            </div>

            {/* Sobrecarga progresiva: la marca anterior y cómo superarla hoy */}
            {prev === undefined ? (
              !noHistory.has(ex.exerciseId) && <p role="status" className="text-center text-body-sm text-on-surface-light">Buscando tu marca anterior…</p>
            ) : prev === null ? (
              <p className="rounded-2xl bg-surface-variant/60 p-4 text-center text-body-sm text-on-surface">Primera vez con este ejercicio: lo que hagas hoy será tu marca a superar.</p>
            ) : (
              <section aria-label="Marca a superar" className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/[var(--lq-soft-alpha)] p-4">
                <div>
                  <p className="text-label-md text-primary-text">Para superarte hoy</p>
                  <p className="font-mono text-heading-md font-bold tabular-nums">{prev.targets.map(mark).join(' o ')}</p>
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-label-md text-on-surface-light">Mejor 1RM estimado</dt>
                    <dd className="font-mono text-label-lg tabular-nums">{prev.e1rm > 0 ? `${kg(Math.round(prev.e1rm))} (${mark(prev.best)})` : mark(prev.best)}</dd>
                  </div>
                  <div>
                    <dt className="text-label-md text-on-surface-light">Peso máximo</dt>
                    <dd className="font-mono text-label-lg tabular-nums">{mark({ weight: prev.maxWeight, reps: prev.maxWeightReps })}</dd>
                  </div>
                </dl>
                <p className="text-body-sm text-on-surface-light">
                  Última vez ({shortDate(prev.lastDate)}): <span className="font-mono tabular-nums text-on-surface">{prev.last.map((s) => pair(s.weight, s.reps)).join(' · ')}</span>
                </p>
              </section>
            )}

            {ex.sets.length > 0 && (
              <ol aria-label={`Series de ${ex.name}`} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-2 [touch-action:pan-x] [overscroll-behavior-x:contain]">
                {ex.sets.map((s, j) => {
                  const on = j === setIdx;
                  const type = setTypeOf(s.type);
                  const pr = prs.has(`${exIdx}-${s.id}`);
                  return (
                    <li key={s.id} className="relative shrink-0">
                      <button
                        type="button" aria-pressed={on} onClick={() => pickSet(j)}
                        aria-label={`Serie ${j + 1}${type.short ? `, ${type.label.toLowerCase()}` : ''}${s.completed ? `, hecha: ${s.weight || 0} kg por ${s.reps || 0}` : ', pendiente'}${pr ? ', récord' : ''}`}
                        className={cn(
                          'flex min-h-14 min-w-16 flex-col items-center justify-center rounded-2xl border px-3 transition-colors',
                          on ? 'border-primary bg-primary/[var(--lq-soft-alpha)]' : 'border-border bg-surface',
                          s.completed && 'text-success-text',
                        )}
                      >
                        <span className="flex items-center gap-1 text-label-md">
                          {pr ? <Trophy aria-hidden className="size-3.5 text-warning-text" /> : s.completed && <Check aria-hidden className="size-3.5" />}
                          {type.short || j + 1}
                        </span>
                        <span className="font-mono text-label-md tabular-nums">{s.weight || s.reps ? pair(s.weight, s.reps) : '–'}</span>
                      </button>
                      <button
                        type="button" aria-label={`Eliminar la serie ${j + 1}`} onClick={() => removeSet(j)}
                        className="absolute -right-1.5 -top-1.5 flex size-8 items-center justify-center rounded-full border border-border bg-background text-on-surface-light shadow-sm transition-colors hover:text-error-text"
                      >
                        <X aria-hidden className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            {set ? (
              <section aria-label={`Serie ${setIdx + 1}`} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-heading-sm">Serie {setIdx + 1} · {setTypeOf(set.type).label}</h3>
                  <AnimatePresence>
                    {prs.has(`${exIdx}-${set.id}`) && (
                      <motion.span initial={{ opacity: 0, scale: 2, rotate: -10 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0 }} transition={slam}>
                        <Badge variant="warning" icon={Trophy}>Récord</Badge>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <BigStepper label={`Kilos de la serie ${setIdx + 1}`} unit="Kilos" step={2.5} value={set.weight} disabled={set.completed} onChange={(v) => patchSet(exIdx, set.id, { weight: v })} />
                <BigStepper label={`Repeticiones de la serie ${setIdx + 1}`} unit="Reps" step={1} value={set.reps} disabled={set.completed} onChange={(v) => patchSet(exIdx, set.id, { reps: v })} />
                <p aria-live="polite" className="min-h-5 text-center text-body-sm text-on-surface-light">
                  {e1 > 0 && <>1RM est. <span className="font-mono tabular-nums text-on-background">{kg(Math.round(e1))}</span></>}
                  {e1 > 0 && prev && prev.e1rm > 0 && (
                    beat > 0
                      ? <span className="text-success-text"> · +{kg(Math.round(beat * 10) / 10)} sobre tu mejor marca</span>
                      : <span> · a {kg(Math.round(-beat * 10) / 10)} de tu mejor marca</span>
                  )}
                  {previousSet && <span className="block">Anterior en esta serie: <span className="font-mono tabular-nums">{pair(previousSet.weight, previousSet.reps)}</span></span>}
                  {plates && plates.length > 0 && <span className="block">Discos por lado: <span className="font-mono tabular-nums">{plates.map((p) => p.toLocaleString('es-ES')).join(' + ')}</span></span>}
                </p>

                <details className="group rounded-2xl border border-border bg-surface">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
                    <span className="text-label-lg">Tipo y esfuerzo</span>
                    <span className="min-w-0 flex-1 truncate text-right text-body-sm text-on-surface-light">
                      {setTypeOf(set.type).label}{set.rpe ? ` · RPE ${set.rpe}` : set.rir !== undefined ? ` · RIR ${set.rir}` : ''}
                    </span>
                    <ChevronDown aria-hidden className="size-5 shrink-0 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <div className="flex flex-col gap-4 px-4 pb-4">
                    <div role="radiogroup" aria-label="Tipo de serie" className="flex flex-wrap gap-2">
                      {SET_TYPES.map((t) => (
                        <button key={t.value} type="button" role="radio" aria-checked={set.type === t.value} onClick={() => patchSet(exIdx, set.id, { type: t.value })} className={chipClasses(set.type === t.value)}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <SegmentedControl label="Escala de esfuerzo" role="radiogroup" options={SCALES} value={scale} onChange={setScale} />
                    <EffortPicker scale={scale} set={set} label={scale === 'rpe' ? `RPE de la serie ${setIdx + 1}` : `Repeticiones en reserva de la serie ${setIdx + 1}`} onChange={(p) => patchSet(exIdx, set.id, p)} />
                    <p className="text-body-sm text-on-surface-light">{scale === 'rpe' ? 'RPE 10: no salía ni una repetición más.' : 'RIR: repeticiones que te quedaban en el tanque.'}</p>
                  </div>
                </details>
              </section>
            ) : (
              <Button variant="secondary" block onClick={addSet}><Plus aria-hidden className="size-4" />Agregar serie</Button>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          <AnimatePresence>
            {rest && (
              <motion.section
                key="rest" aria-label="Descanso" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8, transition: { duration: 0.18 } }} transition={slam}
                className={cn('relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-3', rest.done ? 'border-success/50 bg-success/[var(--lq-soft-alpha)]' : 'border-info/40 bg-info/[var(--lq-soft-alpha)]')}
              >
                <div className="flex items-center gap-2">
                  <div role="status" className="min-w-0 flex-1">
                    <p className={cn('truncate text-label-md', rest.done ? 'text-success-text' : 'text-info-text')}>{rest.done ? '¡A por la siguiente serie!' : 'Descanso'}</p>
                    <RollingClock seconds={restLeft} label="Descanso restante" className="text-display-sm" />
                    {!rest.done && <p className="truncate text-label-md text-on-surface-light">{rest.reason}</p>}
                  </div>
                  {!rest.done && (
                    <>
                      <Button variant="secondary" size="sm" aria-label="Restar 15 segundos al descanso" onClick={() => setRest({ ...rest, endAt: Math.max(Date.now(), rest.endAt - 15_000) })}>−15</Button>
                      <Button variant="secondary" size="sm" aria-label="Sumar 15 segundos al descanso" onClick={() => setRest({ ...rest, endAt: rest.endAt + 15_000, total: rest.total + 15 })}>+15</Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setRest(null)}>{rest.done ? 'Cerrar' : 'Saltar'}</Button>
                </div>
                {rated && ratedEx && (
                  <div className="flex flex-col gap-2">
                    <p className="text-label-md text-on-surface">
                      {scale === 'rpe' ? `¿Qué tan dura fue la serie ${ratedEx.sets.indexOf(rated) + 1}? RPE` : `¿Cuántas repeticiones te quedaban en la serie ${ratedEx.sets.indexOf(rated) + 1}?`}
                    </p>
                    <EffortPicker quick scale={scale} set={rated} label={scale === 'rpe' ? 'RPE de la serie recién hecha' : 'Repeticiones en reserva de la serie recién hecha'} onChange={(p) => patchSet(rest.exIdx, rated.id, p)} />
                  </div>
                )}
                {!rest.done && (
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 origin-left bg-info transition-transform duration-1000 ease-linear" style={{ transform: `scaleX(${rest.total ? restLeft / rest.total : 0})` }} />
                )}
              </motion.section>
            )}
          </AnimatePresence>

          {undo && (
            <div role="status" className="flex items-center justify-between gap-3 rounded-2xl bg-surface-variant px-4 py-2 text-body-sm">
              <span>Serie {undo.index + 1} eliminada</span>
              <Button variant="ghost" size="sm" onClick={undoRemove}>Deshacer</Button>
            </div>
          )}
          {set && (
            <motion.button
              type="button" onClick={toggleSet} whileTap={{ scale: 0.97 }} transition={slam}
              className={cn(
                'flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl px-4 text-heading-sm shadow-md transition-colors',
                set.completed ? 'border border-border-strong bg-surface-variant text-on-background' : 'bg-primary-strong text-on-primary',
              )}
            >
              <Check aria-hidden className="size-6" strokeWidth={2.5} />
              {set.completed ? `Desmarcar serie ${setIdx + 1}` : `Completar serie ${setIdx + 1}`}
            </motion.button>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="md" className="px-3" onClick={addSet} disabled={!ex}><Plus aria-hidden className="size-4 shrink-0" />Serie</Button>
            <Button variant="secondary" size="md" className="px-3" onClick={() => setSearching(true)}><Plus aria-hidden className="size-4 shrink-0" />Ejercicio</Button>
            <Button variant="ghost" size="md" className="px-3" onClick={() => setConfirming(true)}><Check aria-hidden className="size-4 shrink-0" />Terminar</Button>
          </div>
        </div>
      </footer>

      {searching && <ExerciseSearchModal onSelect={addExercise} onClose={() => setSearching(false)} />}

      <Modal open={confirming} onClose={() => { if (!busy) setConfirming(false); }} title="¿Terminar el entrenamiento?">
        <p className="text-body-md text-on-surface">
          <span className="font-mono tabular-nums">{done}</span> de <span className="font-mono tabular-nums">{planned}</span> series completadas · {kg(sessionTonnage(workout))} levantados.
        </p>
        {done === 0 && <p className="text-body-sm text-warning-text">No hay series completadas: se guardará solo el tiempo.</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" className="flex-1" disabled={!!busy} onClick={() => setConfirming(false)}>Seguir entrenando</Button>
          <Button className="flex-1" loading={busy === 'finish'} disabled={!!busy} onClick={() => void run('finish')}>Terminar y guardar</Button>
        </div>
        <Button variant="ghost" size="sm" className="self-center text-error-text" loading={busy === 'discard'} disabled={!!busy} onClick={() => void run('discard')}>
          Descartar sin guardar
        </Button>
      </Modal>
    </motion.div>,
    document.body,
  );
}
