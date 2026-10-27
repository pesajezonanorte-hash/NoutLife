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
import { oneRepMax, platesPerSide, previousBest, restFor, setTonnage, setTypeOf, setTypesFor, type PreviousBest } from '@/lib/coliseo';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';
import { Badge, Button, ChipGroup, IconChip, Input, Modal, ResponsiveDialog, SegmentedControl, chipClasses, type SegmentOption } from '@/components/ui/lq';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { playChime } from '@/components/focus/ambientSound';
import { notifyLocal } from '@/lib/systemNotifications';
import * as workoutService from '@/services/workout.service';
import * as coliseo from '@/services/coliseo.service';
import { RollingClock } from './ColiseoMotion';
import { exerciseName, exerciseTags } from './exerciseText';

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

const es = {
  // Filtros: el valor es el grupo tal como lo guarda la API; solo cambia el texto.
  groupNames: { Todos: 'Todos', Pecho: 'Pecho', Espalda: 'Espalda', Hombros: 'Hombros', 'Bíceps': 'Bíceps', 'Tríceps': 'Tríceps', Piernas: 'Piernas', Core: 'Core', Cardio: 'Cardio' } as Record<string, string>,
  addExercise: 'Agregar ejercicio',
  searchPlaceholder: 'Buscar ejercicio…',
  searchAria: 'Buscar ejercicio',
  muscleGroup: 'Grupo muscular',
  searching: 'Buscando…',
  noResults: 'Sin resultados',
  minusAria: (step: number, label: string): string => `Restar ${step} a ${label}`,
  plusAria: (step: number, label: string): string => `Sumar ${step} a ${label}`,
  unitWeight: 'Kilos',
  unitReps: 'Reps',
  repsWord: 'reps',
  dialogAria: (title: string): string => `Entrenamiento en vivo: ${title}`,
  minimize: 'Minimizar el modo en vivo',
  paused: 'En pausa',
  live: 'En vivo',
  clockLabel: 'Tiempo de entrenamiento',
  playlist: 'Abrir tu playlist de entrenamiento (pestaña nueva)',
  resume: 'Reanudar',
  pause: 'Pausar',
  setsProgress: 'Series completadas',
  firstTitle: 'Agrega tu primer ejercicio',
  firstBody: 'Búscalo por nombre o por grupo muscular. Verás tu marca anterior para superarla.',
  exercisesAria: 'Ejercicios de la sesión',
  prevEx: 'Ejercicio anterior',
  nextEx: 'Ejercicio siguiente',
  ofN: (i: number, n: number): string => `${i} de ${n}`,
  lookingUp: 'Buscando tu marca anterior…',
  firstTime: 'Primera vez con este ejercicio: lo que hagas hoy será tu marca a superar.',
  markToBeat: 'Marca a superar',
  toBeat: 'Para superarte hoy',
  bestE1rm: 'Mejor 1RM estimado',
  topWeight: 'Peso máximo',
  lastTime: (d: string): string => `Última vez (${d}): `,
  setsOf: (name: string): string => `Series de ${name}`,
  setLabel: (n: number, typeText: string, status: string, record: string): string => `Serie ${n}${typeText}${status}${record}`,
  typeSep: (type: string): string => `, ${type}`,
  doneAt: (w: number, r: number): string => `, hecha: ${w} kg por ${r}`,
  pendingStatus: ', pendiente',
  recordTag: ', récord',
  removeSet: (n: number): string => `Eliminar la serie ${n}`,
  setHeading: (n: number, type: string): string => `Serie ${n} · ${type}`,
  record: 'Récord',
  kilosOf: (n: number): string => `Kilos de la serie ${n}`,
  repsOf: (n: number): string => `Repeticiones de la serie ${n}`,
  est1rm: '1RM est.',
  beatBest: (v: string): string => ` · +${v} sobre tu mejor marca`,
  behindBest: (v: string): string => ` · a ${v} de tu mejor marca`,
  prevInSet: 'Anterior en esta serie:',
  platesSide: 'Discos por lado:',
  effortTitle: 'Tipo y esfuerzo',
  setTypeAria: 'Tipo de serie',
  effortScale: 'Escala de esfuerzo',
  rpeLabel: (n: number): string => `RPE de la serie ${n}`,
  rirLabel: (n: number): string => `Repeticiones en reserva de la serie ${n}`,
  rpeHelp: 'RPE 10: no salía ni una repetición más.',
  rirHelp: 'RIR: repeticiones que te quedaban en el tanque.',
  addSet: 'Agregar serie',
  restAria: 'Descanso',
  restLabel: 'Descanso',
  nextSetNow: '¡A por la siguiente serie!',
  minus15: 'Restar 15 segundos al descanso',
  plus15: 'Sumar 15 segundos al descanso',
  closeRest: 'Cerrar',
  skipRest: 'Saltar',
  restRemaining: 'Descanso restante',
  rpeQuestion: (n: number): string => `¿Qué tan dura fue la serie ${n}? RPE`,
  rirQuestion: (n: number): string => `¿Cuántas repeticiones te quedaban en la serie ${n}?`,
  rpeRecent: 'RPE de la serie recién hecha',
  rirRecent: 'Repeticiones en reserva de la serie recién hecha',
  setDeleted: (n: number): string => `Serie ${n} eliminada`,
  undo: 'Deshacer',
  unmark: (n: number): string => `Desmarcar serie ${n}`,
  complete: (n: number): string => `Completar serie ${n}`,
  addSetBtn: 'Serie',
  addExBtn: 'Ejercicio',
  finishBtn: 'Terminar',
  confirmTitle: '¿Terminar el entrenamiento?',
  of: 'de',
  setsDone: 'series completadas',
  lifted: 'levantados',
  noSetsDone: 'No hay series completadas: se guardará solo el tiempo.',
  keepTraining: 'Seguir entrenando',
  finishSave: 'Terminar y guardar',
  discardNoSave: 'Descartar sin guardar',
  restDoneNotif: 'Descanso terminado',
  restDoneBody: 'Ya puedes hacer la siguiente serie.',
};

const en: typeof es = {
  groupNames: { Todos: 'All', Pecho: 'Chest', Espalda: 'Back', Hombros: 'Shoulders', 'Bíceps': 'Biceps', 'Tríceps': 'Triceps', Piernas: 'Legs', Core: 'Core', Cardio: 'Cardio' },
  addExercise: 'Add exercise',
  searchPlaceholder: 'Search exercise…',
  searchAria: 'Search exercise',
  muscleGroup: 'Muscle group',
  searching: 'Searching…',
  noResults: 'No results',
  minusAria: (step: number, label: string): string => `Subtract ${step} from ${label}`,
  plusAria: (step: number, label: string): string => `Add ${step} to ${label}`,
  unitWeight: 'Weight',
  unitReps: 'Reps',
  repsWord: 'reps',
  dialogAria: (title: string): string => `Live workout: ${title}`,
  minimize: 'Minimize live mode',
  paused: 'Paused',
  live: 'Live',
  clockLabel: 'Workout time',
  playlist: 'Open your workout playlist (new tab)',
  resume: 'Resume',
  pause: 'Pause',
  setsProgress: 'Sets completed',
  firstTitle: 'Add your first exercise',
  firstBody: 'Search by name or muscle group. You will see your previous best to beat.',
  exercisesAria: 'Session exercises',
  prevEx: 'Previous exercise',
  nextEx: 'Next exercise',
  ofN: (i: number, n: number): string => `${i} of ${n}`,
  lookingUp: 'Looking up your previous best…',
  firstTime: 'First time with this exercise: whatever you do today becomes the mark to beat.',
  markToBeat: 'Mark to beat',
  toBeat: 'To beat yourself today',
  bestE1rm: 'Best estimated 1RM',
  topWeight: 'Top weight',
  lastTime: (d: string): string => `Last time (${d}): `,
  setsOf: (name: string): string => `Sets of ${name}`,
  setLabel: (n: number, typeText: string, status: string, record: string): string => `Set ${n}${typeText}${status}${record}`,
  typeSep: (type: string): string => `, ${type}`,
  doneAt: (w: number, r: number): string => `, done: ${w} kg for ${r}`,
  pendingStatus: ', pending',
  recordTag: ', record',
  removeSet: (n: number): string => `Delete set ${n}`,
  setHeading: (n: number, type: string): string => `Set ${n} · ${type}`,
  record: 'Record',
  kilosOf: (n: number): string => `Weight of set ${n}`,
  repsOf: (n: number): string => `Reps of set ${n}`,
  est1rm: 'Est. 1RM',
  beatBest: (v: string): string => ` · +${v} over your best`,
  behindBest: (v: string): string => ` · ${v} short of your best`,
  prevInSet: 'Previous in this set:',
  platesSide: 'Plates per side:',
  effortTitle: 'Type and effort',
  setTypeAria: 'Set type',
  effortScale: 'Effort scale',
  rpeLabel: (n: number): string => `RPE of set ${n}`,
  rirLabel: (n: number): string => `Reps in reserve for set ${n}`,
  rpeHelp: 'RPE 10: could not have done one more rep.',
  rirHelp: 'RIR: reps you had left in the tank.',
  addSet: 'Add set',
  restAria: 'Rest',
  restLabel: 'Rest',
  nextSetNow: 'Time for the next set!',
  minus15: 'Subtract 15 seconds from rest',
  plus15: 'Add 15 seconds to rest',
  closeRest: 'Close',
  skipRest: 'Skip',
  restRemaining: 'Rest left',
  rpeQuestion: (n: number): string => `How hard was set ${n}? RPE`,
  rirQuestion: (n: number): string => `How many reps did you have left in set ${n}?`,
  rpeRecent: 'RPE of the set you just did',
  rirRecent: 'Reps in reserve for the set you just did',
  setDeleted: (n: number): string => `Set ${n} deleted`,
  undo: 'Undo',
  unmark: (n: number): string => `Unmark set ${n}`,
  complete: (n: number): string => `Complete set ${n}`,
  addSetBtn: 'Set',
  addExBtn: 'Exercise',
  finishBtn: 'Finish',
  confirmTitle: 'Finish the workout?',
  of: 'of',
  setsDone: 'sets completed',
  lifted: 'lifted',
  noSetsDone: 'No sets completed: only the time will be saved.',
  keepTraining: 'Keep training',
  finishSave: 'Finish and save',
  discardNoSave: 'Discard without saving',
  restDoneNotif: 'Rest over',
  restDoneBody: 'You can do the next set now.',
};

const COPY: Copy<typeof es> = { es, en };

type Scale = 'rpe' | 'rir';
const SCALES: SegmentOption<Scale>[] = [{ value: 'rpe', label: 'RPE 1–10' }, { value: 'rir', label: 'RIR 0–4' }];
const SCALE_KEY = 'coliseo.effortScale';
function readScale(): Scale {
  try { return localStorage.getItem(SCALE_KEY) === 'rir' ? 'rir' : 'rpe'; } catch { return 'rpe'; }
}

/** Grupos del filtro del buscador: el valor es el que entiende la API. */
const MUSCLE_FILTERS = ['Todos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core', 'Cardio'];

function ExerciseSearchModal({ onSelect, onClose }: { onSelect: (ex: Exercise) => void; onClose: () => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('Todos');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const muscleGroups = MUSCLE_FILTERS.map((m) => ({ value: m, label: t.groupNames[m] }));

  useEffect(() => {
    setLoading(true);
    workoutService
      .fetchExercises(search || undefined, muscleFilter !== 'Todos' ? muscleFilter : undefined)
      .then(setExercises)
      .catch(() => setExercises([]))
      .finally(() => setLoading(false));
  }, [search, muscleFilter]);

  return (
    <ResponsiveDialog open onClose={onClose} title={t.addExercise}>
      <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.searchAria} autoFocus />
      <ChipGroup label={t.muscleGroup} options={muscleGroups} value={muscleFilter} onChange={setMuscleFilter} />
      <div className="-mx-2 flex max-h-72 flex-col overflow-y-auto">
        {loading ? (
          <p role="status" className="py-6 text-center text-body-sm text-on-surface-light">{t.searching}</p>
        ) : exercises.length === 0 ? (
          <p className="py-6 text-center text-body-sm text-on-surface-light">{t.noResults}</p>
        ) : (
          exercises.map((ex) => (
            <button key={ex.id} type="button" onClick={() => onSelect(ex)} className="flex min-h-12 flex-col justify-center rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-variant">
              <span className="text-body-md text-on-background">{exerciseName(ex.name, locale)}</span>
              {(ex.muscleGroup || ex.equipment) && <span className="text-body-sm text-on-surface-light">{exerciseTags(ex.muscleGroup, ex.equipment, locale)}</span>}
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
  const t = useText(COPY);
  const num = parseFloat(value) || 0;
  const set = (n: number) => onChange(String(Math.max(0, Math.round(n * 100) / 100)));
  const btn = 'flex size-14 shrink-0 items-center justify-center rounded-2xl bg-surface-variant text-on-background transition-transform duration-150 active:scale-95 disabled:opacity-40';
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-label-lg text-on-surface-light">{unit}</span>
      <button type="button" disabled={disabled} aria-label={t.minusAria(step, label)} onClick={() => set(num - step)} className={btn}>
        <Minus aria-hidden className="size-6" strokeWidth={2.25} />
      </button>
      <input
        type="number" inputMode="decimal" value={value} placeholder="0" disabled={disabled} aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className="h-16 w-full min-w-0 flex-1 rounded-2xl border border-border-strong bg-background text-center font-mono text-display-sm font-bold tabular-nums text-on-background focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/25 disabled:opacity-60"
      />
      <button type="button" disabled={disabled} aria-label={t.plusAria(step, label)} onClick={() => set(num + step)} className={btn}>
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
  const t = useText(COPY);
  const locale = useLocale();
  const nf = INTL_LOCALE[locale];
  const kg = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString(nf)} kg`;
  const mark = (x: { weight?: number; reps?: number }) => ((x.weight ?? 0) > 0 ? `${kg(x.weight ?? 0)} × ${x.reps ?? 0}` : `${x.reps ?? 0} ${t.repsWord}`);
  /** «80×8» con coma decimal (102,5×5). */
  const pair = (w?: number | string, r?: number | string) => `${(Number(w) || 0).toLocaleString(nf)}×${Number(r) || 0}`;
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(nf, { day: 'numeric', month: 'short' }).replace('.', '');
  const setTypes = setTypesFor(locale);

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
      if (document.hidden) void notifyLocal(t.restDoneNotif, { body: t.restDoneBody, tag: 'coliseo-rest', renotify: true, data: { link: '/coliseo' } });
    }, Math.max(0, rest.endAt - Date.now()));
    return () => window.clearTimeout(id);
  }, [rest?.endAt, rest?.done, t]);
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
      const r = restFor(ex.name, ex.muscleGroup, set.type, locale);
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
      ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={t.dialogAria(workout.title)}
      className="fixed inset-0 z-[70] flex flex-col bg-background text-on-background outline-none"
      initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 32, transition: { duration: 0.2 } }} transition={slam}
    >
      <header className="border-b border-border px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Button variant="icon" aria-label={t.minimize} onClick={onMinimize}>
            <ChevronDown aria-hidden className="size-6" strokeWidth={1.75} />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className={cn('flex items-center justify-center gap-1.5 truncate text-label-md', paused ? 'text-warning-text' : 'text-error-text')}>
              <span aria-hidden className={cn('size-2 rounded-full', paused ? 'bg-warning' : 'animate-pulse bg-error [.reduce-motion_&]:animate-none')} />
              {paused ? t.paused : t.live} · {workout.title}
            </p>
            <RollingClock seconds={elapsedMs(workout, now) / 1000} label={t.clockLabel} className={cn('text-heading-lg', paused && 'opacity-50')} />
          </div>
          {playlistUrl && (
            <a
              href={playlistUrl} target="_blank" rel="noopener noreferrer" aria-label={t.playlist}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-success-text hover:bg-surface-variant"
            >
              <Music aria-hidden className="size-5" />
            </a>
          )}
          <Button variant="icon" aria-label={paused ? t.resume : t.pause} onClick={togglePause}>
            {paused ? <Play aria-hidden className="size-6" /> : <Pause aria-hidden className="size-6" />}
          </Button>
        </div>
        <div
          role="progressbar" aria-label={t.setsProgress} aria-valuemin={0} aria-valuemax={planned || 1} aria-valuenow={done}
          className="mx-auto mt-2 h-1.5 max-w-lg overflow-hidden rounded-full bg-surface-variant"
        >
          <span className="block h-full origin-left rounded-full bg-primary transition-transform duration-500" style={{ transform: `scaleX(${planned ? done / planned : 0})` }} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {!ex ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-12 text-center">
            <IconChip icon={Dumbbell} tone="primary" size="lg" />
            <p className="text-heading-md">{t.firstTitle}</p>
            <p className="text-body-md text-on-surface-light">{t.firstBody}</p>
            <Button size="lg" onClick={() => setSearching(true)}><Plus aria-hidden className="size-5" />{t.addExercise}</Button>
          </div>
        ) : (
          <div className="mx-auto flex max-w-lg flex-col gap-5">
            {n > 1 && (
              <ol aria-label={t.exercisesAria} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [touch-action:pan-x] [overscroll-behavior-x:contain]">
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
              <Button variant="icon" aria-label={t.prevEx} disabled={exIdx === 0} onClick={() => jumpTo(exIdx - 1)}>
                <ChevronLeft aria-hidden className="size-6" />
              </Button>
              <div className="min-w-0 flex-1 text-center">
                <h2 className="text-heading-lg">{exerciseName(ex.name, locale)}</h2>
                <p className="text-body-sm text-on-surface-light">{exerciseTags(ex.muscleGroup, ex.equipment, locale)}{n > 1 ? ` · ${t.ofN(exIdx + 1, n)}` : ''}</p>
              </div>
              <Button variant="icon" aria-label={t.nextEx} disabled={exIdx >= n - 1} onClick={() => jumpTo(exIdx + 1)}>
                <ChevronRight aria-hidden className="size-6" />
              </Button>
            </div>

            {/* Sobrecarga progresiva: la marca anterior y cómo superarla hoy */}
            {prev === undefined ? (
              !noHistory.has(ex.exerciseId) && <p role="status" className="text-center text-body-sm text-on-surface-light">{t.lookingUp}</p>
            ) : prev === null ? (
              <p className="rounded-2xl bg-surface-variant/60 p-4 text-center text-body-sm text-on-surface">{t.firstTime}</p>
            ) : (
              <section aria-label={t.markToBeat} className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/[var(--lq-soft-alpha)] p-4">
                <div>
                  <p className="text-label-md text-primary-text">{t.toBeat}</p>
                  <p className="font-mono text-heading-md font-bold tabular-nums">{prev.targets.map(mark).join(' o ')}</p>
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-label-md text-on-surface-light">{t.bestE1rm}</dt>
                    <dd className="font-mono text-label-lg tabular-nums">{prev.e1rm > 0 ? `${kg(Math.round(prev.e1rm))} (${mark(prev.best)})` : mark(prev.best)}</dd>
                  </div>
                  <div>
                    <dt className="text-label-md text-on-surface-light">{t.topWeight}</dt>
                    <dd className="font-mono text-label-lg tabular-nums">{mark({ weight: prev.maxWeight, reps: prev.maxWeightReps })}</dd>
                  </div>
                </dl>
                <p className="text-body-sm text-on-surface-light">
                  {t.lastTime(shortDate(prev.lastDate))}<span className="font-mono tabular-nums text-on-surface">{prev.last.map((s) => pair(s.weight, s.reps)).join(' · ')}</span>
                </p>
              </section>
            )}

            {ex.sets.length > 0 && (
              <ol aria-label={t.setsOf(ex.name)} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-2 [touch-action:pan-x] [overscroll-behavior-x:contain]">
                {ex.sets.map((s, j) => {
                  const on = j === setIdx;
                  const type = setTypeOf(s.type, locale);
                  const pr = prs.has(`${exIdx}-${s.id}`);
                  return (
                    <li key={s.id} className="relative shrink-0">
                      <button
                        type="button" aria-pressed={on} onClick={() => pickSet(j)}
                        aria-label={t.setLabel(
                          j + 1,
                          type.short ? t.typeSep(type.label.toLowerCase()) : '',
                          s.completed ? t.doneAt(Number(s.weight) || 0, Number(s.reps) || 0) : t.pendingStatus,
                          pr ? t.recordTag : '',
                        )}
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
                        type="button" aria-label={t.removeSet(j + 1)} onClick={() => removeSet(j)}
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
              <section aria-label={t.setHeading(setIdx + 1, setTypeOf(set.type, locale).label)} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-heading-sm">{t.setHeading(setIdx + 1, setTypeOf(set.type, locale).label)}</h3>
                  <AnimatePresence>
                    {prs.has(`${exIdx}-${set.id}`) && (
                      <motion.span initial={{ opacity: 0, scale: 2, rotate: -10 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0 }} transition={slam}>
                        <Badge variant="warning" icon={Trophy}>{t.record}</Badge>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <BigStepper label={t.kilosOf(setIdx + 1)} unit={t.unitWeight} step={2.5} value={set.weight} disabled={set.completed} onChange={(v) => patchSet(exIdx, set.id, { weight: v })} />
                <BigStepper label={t.repsOf(setIdx + 1)} unit={t.unitReps} step={1} value={set.reps} disabled={set.completed} onChange={(v) => patchSet(exIdx, set.id, { reps: v })} />
                <p aria-live="polite" className="min-h-5 text-center text-body-sm text-on-surface-light">
                  {e1 > 0 && <>{t.est1rm} <span className="font-mono tabular-nums text-on-background">{kg(Math.round(e1))}</span></>}
                  {e1 > 0 && prev && prev.e1rm > 0 && (
                    beat > 0
                      ? <span className="text-success-text">{t.beatBest(kg(Math.round(beat * 10) / 10))}</span>
                      : <span>{t.behindBest(kg(Math.round(-beat * 10) / 10))}</span>
                  )}
                  {previousSet && <span className="block">{t.prevInSet} <span className="font-mono tabular-nums">{pair(previousSet.weight, previousSet.reps)}</span></span>}
                  {plates && plates.length > 0 && <span className="block">{t.platesSide} <span className="font-mono tabular-nums">{plates.map((p) => p.toLocaleString(nf)).join(' + ')}</span></span>}
                </p>

                <details className="group rounded-2xl border border-border bg-surface">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
                    <span className="text-label-lg">{t.effortTitle}</span>
                    <span className="min-w-0 flex-1 truncate text-right text-body-sm text-on-surface-light">
                      {setTypeOf(set.type, locale).label}{set.rpe ? ` · RPE ${set.rpe}` : set.rir !== undefined ? ` · RIR ${set.rir}` : ''}
                    </span>
                    <ChevronDown aria-hidden className="size-5 shrink-0 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <div className="flex flex-col gap-4 px-4 pb-4">
                    <div role="radiogroup" aria-label={t.setTypeAria} className="flex flex-wrap gap-2">
                      {setTypes.map((opt) => (
                        <button key={opt.value} type="button" role="radio" aria-checked={set.type === opt.value} onClick={() => patchSet(exIdx, set.id, { type: opt.value })} className={chipClasses(set.type === opt.value)}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <SegmentedControl label={t.effortScale} role="radiogroup" options={SCALES} value={scale} onChange={setScale} />
                    <EffortPicker scale={scale} set={set} label={scale === 'rpe' ? t.rpeLabel(setIdx + 1) : t.rirLabel(setIdx + 1)} onChange={(p) => patchSet(exIdx, set.id, p)} />
                    <p className="text-body-sm text-on-surface-light">{scale === 'rpe' ? t.rpeHelp : t.rirHelp}</p>
                  </div>
                </details>
              </section>
            ) : (
              <Button variant="secondary" block onClick={addSet}><Plus aria-hidden className="size-4" />{t.addSet}</Button>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          <AnimatePresence>
            {rest && (
              <motion.section
                key="rest" aria-label={t.restAria} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8, transition: { duration: 0.18 } }} transition={slam}
                className={cn('relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-3', rest.done ? 'border-success/50 bg-success/[var(--lq-soft-alpha)]' : 'border-info/40 bg-info/[var(--lq-soft-alpha)]')}
              >
                <div className="flex items-center gap-2">
                  <div role="status" className="min-w-0 flex-1">
                    <p className={cn('truncate text-label-md', rest.done ? 'text-success-text' : 'text-info-text')}>{rest.done ? t.nextSetNow : t.restLabel}</p>
                    <RollingClock seconds={restLeft} label={t.restRemaining} className="text-display-sm" />
                    {!rest.done && <p className="truncate text-label-md text-on-surface-light">{rest.reason}</p>}
                  </div>
                  {!rest.done && (
                    <>
                      <Button variant="secondary" size="sm" aria-label={t.minus15} onClick={() => setRest({ ...rest, endAt: Math.max(Date.now(), rest.endAt - 15_000) })}>−15</Button>
                      <Button variant="secondary" size="sm" aria-label={t.plus15} onClick={() => setRest({ ...rest, endAt: rest.endAt + 15_000, total: rest.total + 15 })}>+15</Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setRest(null)}>{rest.done ? t.closeRest : t.skipRest}</Button>
                </div>
                {rated && ratedEx && (
                  <div className="flex flex-col gap-2">
                    <p className="text-label-md text-on-surface">
                      {scale === 'rpe' ? t.rpeQuestion(ratedEx.sets.indexOf(rated) + 1) : t.rirQuestion(ratedEx.sets.indexOf(rated) + 1)}
                    </p>
                    <EffortPicker quick scale={scale} set={rated} label={scale === 'rpe' ? t.rpeRecent : t.rirRecent} onChange={(p) => patchSet(rest.exIdx, rated.id, p)} />
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
              <span>{t.setDeleted(undo.index + 1)}</span>
              <Button variant="ghost" size="sm" onClick={undoRemove}>{t.undo}</Button>
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
              {set.completed ? t.unmark(setIdx + 1) : t.complete(setIdx + 1)}
            </motion.button>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="md" className="px-3" onClick={addSet} disabled={!ex}><Plus aria-hidden className="size-4 shrink-0" />{t.addSetBtn}</Button>
            <Button variant="secondary" size="md" className="px-3" onClick={() => setSearching(true)}><Plus aria-hidden className="size-4 shrink-0" />{t.addExBtn}</Button>
            <Button variant="ghost" size="md" className="px-3" onClick={() => setConfirming(true)}><Check aria-hidden className="size-4 shrink-0" />{t.finishBtn}</Button>
          </div>
        </div>
      </footer>

      {searching && <ExerciseSearchModal onSelect={addExercise} onClose={() => setSearching(false)} />}

      <Modal open={confirming} onClose={() => { if (!busy) setConfirming(false); }} title={t.confirmTitle}>
        <p className="text-body-md text-on-surface">
          <span className="font-mono tabular-nums">{done}</span> {t.of} <span className="font-mono tabular-nums">{planned}</span> {t.setsDone} · {kg(sessionTonnage(workout))} {t.lifted}.
        </p>
        {done === 0 && <p className="text-body-sm text-warning-text">{t.noSetsDone}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" className="flex-1" disabled={!!busy} onClick={() => setConfirming(false)}>{t.keepTraining}</Button>
          <Button className="flex-1" loading={busy === 'finish'} disabled={!!busy} onClick={() => void run('finish')}>{t.finishSave}</Button>
        </div>
        <Button variant="ghost" size="sm" className="self-center text-error-text" loading={busy === 'discard'} disabled={!!busy} onClick={() => void run('discard')}>
          {t.discardNoSave}
        </Button>
      </Modal>
    </motion.div>,
    document.body,
  );
}
