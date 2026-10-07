// Gimnasio — GymDesktop.dc.html. Asistencia semanal (DayDot + toast), sesión en
// curso con cronómetro y series, resumen con confeti, volumen semanal, rutinas
// y récords. La lógica de servicios es la de siempre (workout.service).
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Check, ChevronRight, ClipboardList, Dumbbell, Footprints, ExternalLink, Flame, History, Minus, Music,
  Pause, Play, Plus, Sparkles, Timer as TimerIcon, Trophy, TrendingUp,
} from 'lucide-react';
import type { Workout, Exercise, Routine } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { expo, heavy, item, slam, stagger, useCountUp } from '@/lib/motion';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useToast } from '../../hooks/useToast';
import { AnimatedValue, Badge, Button, Card, ChipGroup, Confetti, DayDot, EmptyState, ErrorState, Field, IconChip, Input, Modal, ProgressBar, ResponsiveDialog, formatClock, type DayStatus, type Tone, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import * as workoutService from '../../services/workout.service';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { BodyWeightTracker, OneRMCalculator, WeeklyVolumeWidget, ProgressPhotos, RestTimer } from '../../components/gym/GymExtras';
import { Barbell, DropTitle, LiftBars, LoadBar, RollingClock, Thud, type LiftDay } from '../../components/gym/GymMotion';

const MUSCLE_GROUPS = ['Todos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core', 'Cardio'].map((m) => ({ value: m, label: m }));

type GymTab = 'history' | 'routines' | 'analytics' | 'photos';

const GYM_TABS: Array<{ id: GymTab; label: string; helper: string; icon: typeof History; tone: Tone }> = [
  { id: 'history', label: 'Historial', helper: 'Tus sesiones', icon: History, tone: 'primary' },
  { id: 'routines', label: 'Rutinas', helper: 'Planes listos', icon: ClipboardList, tone: 'forest' },
  { id: 'analytics', label: 'Análisis', helper: 'Tu rendimiento', icon: TrendingUp, tone: 'info' },
  { id: 'photos', label: 'Progreso', helper: 'Fotos y cambios', icon: Camera, tone: 'success' },
];

const WEEKDAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DAY_MS = 86_400_000;
const ROUTINE_TONES: Tone[] = ['primary', 'forest', 'warning', 'success'];

const REST_SECONDS = 90;
const kg = (n: number) => `${Math.round(n).toLocaleString('es-ES')} kg`;
const longDate = (iso: string) => {
  const s = new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function routineExerciseCount(routine: Routine) {
  return routine.days.length > 0
    ? routine.days.reduce((total, day) => total + day.exercises.length, 0)
    : routine.exercises.length;
}

function setVolume(s: { weight?: number; reps?: number; completed: boolean }) {
  return s.completed ? (s.weight ?? 0) * (s.reps ?? 0) : 0;
}
const workoutVolume = (w: Workout) => w.exercises.reduce((a, ex) => a + ex.sets.reduce((b, s) => b + setVolume(s), 0), 0);
const workoutSets = (w: Workout) => w.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).length, 0);

interface ActiveSet { id: string; weight: string; reps: string; completed: boolean }
interface ActiveExercise {
  exerciseId: string;
  name: string;
  muscleGroup?: string;
  sets: ActiveSet[];
  prevBest?: { weight: number; reps: number } | null;
  personalRecord?: number; // max kg×reps ever
}
interface ActiveWorkout {
  id: string;
  title: string;
  startTime: number;
  exercises: ActiveExercise[];
  /** Milisegundos acumulados en pausa y, si está en pausa, desde cuándo. */
  pausedMs?: number;
  pausedAt?: number | null;
}

/** Tiempo activo de la sesión (descuenta las pausas). */
function elapsedMs(w: ActiveWorkout, now: number) {
  const paused = (w.pausedMs ?? 0) + (w.pausedAt ? now - w.pausedAt : 0);
  return Math.max(0, now - w.startTime - paused);
}

interface Summary { title: string; xp: number; gold: number; seconds: number; sets: number; volume: number; cardio?: { label: string; distanceKm?: number } }

type CardioKind = 'WALK' | 'CARDIO';
const CARDIO_LABEL: Record<CardioKind, string> = { WALK: 'Caminata', CARDIO: 'Cardio general' };
const CARDIO_OPTIONS: { value: CardioKind; label: string }[] = [
  { value: 'WALK', label: 'Caminata' },
  { value: 'CARDIO', label: 'Cardio general' },
];

// ▲▼ stepper
function NumericStepper({
  value, onChange, step = 1, min = 0, disabled, label,
}: { value: string; onChange: (v: string) => void; step?: number; min?: number; disabled?: boolean; label: string }) {
  const num = parseFloat(value) || 0;
  const btn = 'flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-variant text-on-surface transition-colors hover:bg-border disabled:opacity-40 md:size-10';
  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={disabled} aria-label={`Restar a ${label}`} onClick={() => onChange(String(Math.max(min, num - step)))} className={btn}>
        <Minus aria-hidden className="size-4" strokeWidth={2} />
      </button>
      <input
        type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" disabled={disabled} aria-label={label}
        className="h-11 w-16 min-w-0 rounded-md border border-border-strong bg-background text-center font-mono text-body-md tabular-nums text-on-background focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/25 disabled:opacity-50 md:h-10"
      />
      <button type="button" disabled={disabled} aria-label={`Sumar a ${label}`} onClick={() => onChange(String(num + step))} className={btn}>
        <Plus aria-hidden className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}

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

function ActiveWorkoutView({
  workout, onFinish,
}: {
  workout: ActiveWorkout;
  onUpdate: (w: ActiveWorkout) => void;
  onFinish: (w: ActiveWorkout) => void;
}) {
  const [activeWorkout, setActiveWorkout] = useState(workout);
  const [showExSearch, setShowExSearch] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  /** Cada descanso nuevo reinicia la barra que se vacía. */
  const [restRun, setRestRun] = useState(0);
  const [newPRs, setNewPRs] = useState<Set<string>>(new Set()); // "exIdx-setIdx"
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (restTimer === null || restTimer <= 0) return;
    const id = setTimeout(() => setRestTimer((t) => (t !== null ? t - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [restTimer]);

  const paused = !!activeWorkout.pausedAt;
  function togglePause() {
    setActiveWorkout((w) => w.pausedAt
      ? { ...w, pausedMs: (w.pausedMs ?? 0) + (Date.now() - w.pausedAt), pausedAt: null }
      : { ...w, pausedAt: Date.now() });
  }

  function addExercise(ex: Exercise) {
    setActiveWorkout((prev) => ({
      ...prev,
      exercises: [...prev.exercises, {
        exerciseId: ex.id, name: ex.name, muscleGroup: ex.muscleGroup,
        sets: [{ id: '1', weight: '', reps: '', completed: false }], prevBest: null, personalRecord: 0,
      }],
    }));
  }

  function addSet(exIdx: number) {
    setActiveWorkout((prev) => {
      const exercises = [...prev.exercises];
      const ex = exercises[exIdx];
      const lastSet = ex.sets[ex.sets.length - 1]; // pre-rellena con la serie anterior
      exercises[exIdx] = { ...ex, sets: [...ex.sets, { id: String(ex.sets.length + 1), weight: lastSet?.weight ?? '', reps: lastSet?.reps ?? '', completed: false }] };
      return { ...prev, exercises };
    });
  }

  function updateSet(exIdx: number, setIdx: number, field: 'weight' | 'reps' | 'completed', value: string | boolean) {
    setActiveWorkout((prev) => {
      const exercises = [...prev.exercises];
      const ex = exercises[exIdx];
      const sets = [...ex.sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };

      // PR al completar una serie
      if (field === 'completed' && value === true) {
        setRestTimer(REST_SECONDS);
        setRestRun((n) => n + 1);
        const volume = (parseFloat(sets[setIdx].weight) || 0) * (parseFloat(sets[setIdx].reps) || 0);
        if (volume > 0 && volume > (ex.personalRecord ?? 0)) {
          exercises[exIdx] = { ...ex, sets, personalRecord: volume };
          setNewPRs((prs) => new Set([...prs, `${exIdx}-${setIdx}`]));
          return { ...prev, exercises };
        }
      }
      exercises[exIdx] = { ...ex, sets };
      return { ...prev, exercises };
    });
  }

  const totalSets = activeWorkout.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).length, 0);
  const plannedSets = activeWorkout.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const totalVolume = activeWorkout.exercises.reduce(
    (a, ex) => a + ex.sets.filter((s) => s.completed).reduce((b, s) => b + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 1), 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <Thud as="section" trigger={totalSets} aria-label="Sesión en curso" className="flex flex-col gap-6 rounded-2xl border border-primary/40 bg-background p-6 shadow-md md:gap-8 md:p-8">
        <div className="flex flex-wrap items-center gap-6 md:gap-8">
          <div className="flex flex-col gap-2">
            <span className={cn('flex items-center gap-2 text-label-lg uppercase', paused ? 'text-warning-text' : 'text-error-text')}>
              <span aria-hidden className={cn('size-2 rounded-full', paused ? 'bg-warning' : 'animate-pulse bg-error [.reduce-motion_&]:animate-none')} />
              {paused ? 'En pausa' : 'En curso'} · {activeWorkout.title}
            </span>
            <RollingClock seconds={elapsedMs(activeWorkout, now) / 1000} label="Tiempo de entrenamiento" className={cn('text-display-lg transition-opacity duration-300', paused && 'opacity-50')} />
            <span className="flex items-center gap-1 font-mono text-body-sm tabular-nums text-on-surface-light">
              <motion.span key={totalSets} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={slam} className="inline-block text-on-background">{totalSets}</motion.span>
              de {plannedSets} series{totalVolume > 0 ? ` · ${kg(totalVolume)}` : ''}
            </span>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="secondary" size="md" onClick={togglePause}>
              {paused ? <Play aria-hidden className="size-4" /> : <Pause aria-hidden className="size-4" />}{paused ? 'Reanudar' : 'Pausar'}
            </Button>
            <Button size="md" onClick={() => onFinish(activeWorkout)}><Check aria-hidden className="size-4" />Terminar</Button>
          </div>
        </div>
        {/* Carga de la sesión: se llena con peso con cada serie completada */}
        <div role="progressbar" aria-label="Series completadas" aria-valuemin={0} aria-valuemax={plannedSets || 1} aria-valuenow={totalSets} className="h-1.5 overflow-hidden rounded-full bg-surface-variant">
          <motion.span className="block h-full rounded-full bg-primary" style={{ originX: 0 }} initial={{ scaleX: 0 }} animate={{ scaleX: plannedSets ? totalSets / plannedSets : 0 }} transition={heavy} />
        </div>
      </Thud>

      <AnimatePresence>
        {restTimer !== null && restTimer > 0 && (
          <motion.div
            key="rest" role="status"
            initial={{ opacity: 0, y: -16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.2 } }}
            transition={slam}
          >
            <Card variant="base" padding="sm" className="relative flex items-center gap-4 overflow-hidden border-info/40">
              <IconChip icon={TimerIcon} tone="info" size="sm" />
              <div className="flex-1">
                <p className="text-label-lg text-info-text">Descanso · recupera el aire</p>
                <RollingClock seconds={restTimer} label="Descanso restante" className="text-heading-md" />
              </div>
              <Button variant="secondary" size="sm" onClick={() => setRestTimer(null)}>Saltar</Button>
              {/* Barra que se vacía durante el descanso */}
              <motion.span
                key={restRun} aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-info"
                style={{ originX: 0 }} initial={{ scaleX: 1 }} animate={{ scaleX: 0 }}
                transition={{ duration: REST_SECONDS, ease: 'linear' }}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {activeWorkout.exercises.map((ex, exIdx) => {
          const done = ex.sets.filter((s) => s.completed).length;
          const allDone = ex.sets.length > 0 && done === ex.sets.length;
          const exVolume = ex.sets.filter((s) => s.completed).reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 1), 0);
          return (
            <motion.div
              key={`${ex.exerciseId}-${exIdx}`} layout="position"
              initial={{ opacity: 0, y: -28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={slam}
            >
              <Thud as="section" trigger={done} aria-label={ex.name} className={cn('flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-sm transition-colors duration-500 md:p-6', allDone ? 'border-success/50' : 'border-border')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <h2 className="text-heading-sm">{ex.name}</h2>
                    <AnimatePresence>
                      {allDone && (
                        <motion.span initial={{ opacity: 0, scale: 1.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={slam}>
                          <Badge variant="success" icon={Check}>Completado</Badge>
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {ex.muscleGroup && <Badge variant="neutral">{ex.muscleGroup}</Badge>}
                  </div>
                  <span className="font-mono text-body-sm tabular-nums text-on-surface-light">
                    {done}/{ex.sets.length} series{ex.prevBest ? ` · mejor ${ex.prevBest.weight} kg × ${ex.prevBest.reps}` : ''}
                  </span>
                </div>

                <ol className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {ex.sets.map((set, setIdx) => {
                      const isPR = newPRs.has(`${exIdx}-${setIdx}`);
                      return (
                        <motion.li
                          key={set.id} layout="position"
                          initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={slam}
                          className="relative grid grid-cols-[auto_1fr_auto] items-center gap-3 overflow-hidden rounded-xl bg-surface-variant/50 p-3 md:grid-cols-[2rem_auto_auto_1fr_auto]"
                        >
                          {/* Barrido al completar la serie */}
                          <motion.span
                            aria-hidden className="pointer-events-none absolute inset-0 bg-success/[var(--lq-soft-alpha)]"
                            style={{ originX: 0 }} initial={false}
                            animate={{ scaleX: set.completed ? 1 : 0, opacity: set.completed ? 1 : 0 }}
                            transition={set.completed ? heavy : { duration: 0.25, ease: expo }}
                          />
                          <span className="relative font-mono text-label-lg tabular-nums text-on-surface-light">{setIdx + 1}</span>
                          <div className="relative col-span-2 flex flex-wrap gap-3 md:col-span-1 md:contents">
                            <NumericStepper label={`Kilos de la serie ${setIdx + 1}`} value={set.weight} onChange={(v) => updateSet(exIdx, setIdx, 'weight', v)} step={2.5} disabled={set.completed} />
                            <NumericStepper label={`Repeticiones de la serie ${setIdx + 1}`} value={set.reps} onChange={(v) => updateSet(exIdx, setIdx, 'reps', v)} disabled={set.completed} />
                          </div>
                          <span className="relative hidden font-mono text-body-sm tabular-nums text-on-surface md:block">
                            Anterior: {ex.prevBest ? `${ex.prevBest.weight}×${ex.prevBest.reps}` : '—'}
                          </span>
                          <div className="relative col-span-3 flex items-center justify-between gap-2 md:col-span-1 md:justify-end">
                            <AnimatePresence>
                              {isPR && (
                                <motion.span initial={{ opacity: 0, scale: 2, rotate: -10 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0 }} transition={slam}>
                                  <Badge variant="warning" icon={Trophy}>PR</Badge>
                                </motion.span>
                              )}
                            </AnimatePresence>
                            <motion.button
                              type="button" aria-pressed={set.completed}
                              aria-label={`${set.completed ? 'Desmarcar' : 'Completar'} serie ${setIdx + 1} de ${ex.name}`}
                              onClick={() => updateSet(exIdx, setIdx, 'completed', !set.completed)}
                              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.82 }}
                              animate={{ scale: 1 }} transition={slam}
                              className={cn(
                                'flex size-11 items-center justify-center rounded-full border-2 transition-colors duration-200 md:ml-auto',
                                set.completed ? 'border-success bg-success text-on-primary' : 'border-border-strong text-on-surface-light hover:border-success',
                              )}
                            >
                              <motion.span initial={false} animate={set.completed ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 0.4, rotate: -45, opacity: 0 }} transition={slam} className="flex">
                                <Check aria-hidden className="size-5" strokeWidth={2.5} />
                              </motion.span>
                            </motion.button>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ol>

                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => addSet(exIdx)}><Plus aria-hidden className="size-4" />Serie</Button>
                  {exVolume > 0 && (
                    <span className="font-mono text-body-sm tabular-nums text-on-surface-light">
                      Volumen: <motion.span key={exVolume} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={slam} className="inline-block text-on-background">{kg(exVolume)}</motion.span>
                    </span>
                  )}
                </div>
              </Thud>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <Button variant="secondary" block onClick={() => setShowExSearch(true)}><Plus aria-hidden className="size-4" />Agregar ejercicio</Button>

      {showExSearch && (
        <ExerciseSearchModal onSelect={(ex) => { addExercise(ex); setShowExSearch(false); }} onClose={() => setShowExSearch(false)} />
      )}
    </div>
  );
}

/** XP del resumen: cuenta con peso y aterriza con un golpe. */
function SummaryXP({ xp }: { xp: number }) {
  const v = useCountUp(xp, 1.3);
  return (
    <motion.p
      className="font-mono text-display-sm font-bold tabular-nums text-primary-text"
      initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...slam, delay: 0.25 }}
    >
      <span aria-hidden>+{Math.round(v)} XP</span><span className="sr-only">+{xp} XP</span>
    </motion.p>
  );
}

function SessionHeader({ title, description, actions }: { title: string; description: string; actions: React.ReactNode }) {
  return (
    <motion.section variants={item} className="flex flex-wrap items-end justify-between gap-6">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2">
        <span className="text-label-lg text-primary-text">Zona de entrenamiento</span>
        <DropTitle text={title} className="text-display-sm md:text-display-md lg:text-display-lg" />
        <p className="text-body-lg text-on-surface-light">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </motion.section>
  );
}

export default function GymPage() {
  const { addFloatingXP, triggerLevelUp, showAchievementToast } = useUIStore();
  const { updateUser, user } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [attendances, setAttendances] = useState<workoutService.GymAttendance[]>([]);
  const [recordingAttendance, setRecordingAttendance] = useState(false);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [cardioKind, setCardioKind] = useState<CardioKind>('WALK');
  const [cardioMinutes, setCardioMinutes] = useState('');
  const [cardioKm, setCardioKm] = useState('');
  const [cardioSaving, setCardioSaving] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [tab, setTab] = useState<GymTab>('history');
  /** Sentido del cambio de pestaña: el panel entra desde ese lado. */
  const tabDir = useRef(1);
  const changeTab = (next: GymTab) => {
    tabDir.current = GYM_TABS.findIndex((t) => t.id === next) >= GYM_TABS.findIndex((t) => t.id === tab) ? 1 : -1;
    setTab(next);
  };
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [ws, rs, attendance] = await Promise.all([
        workoutService.fetchWorkouts(30),
        workoutService.fetchRoutines(),
        workoutService.fetchGymAttendances(),
      ]);
      setWorkouts(ws);
      setRoutines(rs);
      setAttendances(attendance);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function recordAttendance() {
    setRecordingAttendance(true);
    try {
      const attendance = await workoutService.recordGymAttendance();
      setAttendances((current) => [...current.filter((i) => i.id !== attendance.id), attendance]);
      toast.success('Asistencia registrada', 'Tu visita de hoy ya cuenta.');
    } catch {
      toast.error('No se pudo registrar la asistencia');
    } finally {
      setRecordingAttendance(false);
    }
  }

  async function startWorkout(title?: string) {
    const t = title ?? newTitle;
    if (!t.trim()) return;
    try {
      const w = await workoutService.createWorkout({ title: t });
      setActiveWorkout({ id: w.id, title: w.title, startTime: Date.now(), exercises: [] });
      setShowStartModal(false);
      setNewTitle('');
    } catch {
      toast.error('Error al iniciar entrenamiento');
    }
  }

  async function startFromRoutine(routine: Routine) {
    try {
      const today = new Date().getDay();
      const routineDay = routine.days.find((day) => day.weekday === today && !day.isRestDay)
        ?? routine.days.find((day) => !day.isRestDay);
      const w = await workoutService.createWorkout({ title: routineDay?.title || routine.name, routineDayId: routineDay?.id });
      const exercises = routineDay
        ? routineDay.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          name: exercise.exercise.name,
          muscleGroup: exercise.exercise.muscleGroup,
          sets: (exercise.targetSets ?? []).map((set, index) => ({
            id: String(index + 1), weight: set.weight ? String(set.weight) : '', reps: set.reps ? String(set.reps) : '', completed: false,
          })),
          prevBest: null,
          personalRecord: 0,
        }))
        : (routine.exercises as Array<{ exerciseId: string; name: string; sets: number; reps?: number }>).map((exercise) => ({
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          muscleGroup: undefined as string | undefined,
          sets: Array.from({ length: exercise.sets }, (_, index) => ({
            id: String(index + 1), weight: '', reps: exercise.reps ? String(exercise.reps) : '', completed: false,
          })),
          prevBest: null,
          personalRecord: 0,
        }));
      setActiveWorkout({ id: w.id, title: w.title, startTime: Date.now(), exercises });
    } catch {
      toast.error('Error al iniciar rutina');
    }
  }

  async function finishWorkout(aw: ActiveWorkout) {
    const activeMs = elapsedMs(aw, Date.now());
    const duration = Math.round(activeMs / 60000);
    const exercises = aw.exercises.map((ex, i) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets.map((s) => ({ weight: Number(s.weight) || 0, reps: Number(s.reps) || 0, completed: s.completed })),
      order: i,
    }));
    const sets = aw.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).length, 0);
    const volume = aw.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).reduce((b, s) => b + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0), 0);

    try {
      const result = await workoutService.finishWorkout(aw.id, { duration, exercises });
      const rewards = result.rewards as { xpGained: number; goldGained: number; leveledUp: boolean; oldLevel: number; newLevel: number };
      setActiveWorkout(null);
      updateUser(result.user as never);
      addFloatingXP(rewards.xpGained ?? 50, window.innerWidth / 2, 200);
      if (rewards.leveledUp) {
        triggerLevelUp({ oldLevel: rewards.oldLevel, newLevel: rewards.newLevel, xpEarned: rewards.xpGained, goldEarned: rewards.goldGained, statIncreases: {} });
      }
      setSummary({ title: aw.title, xp: rewards.xpGained ?? 0, gold: rewards.goldGained ?? 0, seconds: Math.round(activeMs / 1000), sets, volume });
      for (const achievement of result.achievementsUnlocked ?? []) showAchievementToast(achievement);
      await load();
    } catch {
      toast.error('Error al finalizar entrenamiento');
    }
  }

  async function logCardio() {
    const minutes = Math.round(Number(cardioMinutes));
    const km = Number(cardioKm.replace(',', '.'));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440 || cardioSaving) return;
    const distanceKm = Number.isFinite(km) && km > 0 ? km : undefined;
    setCardioSaving(true);
    try {
      const created = await workoutService.createWorkout({ title: CARDIO_LABEL[cardioKind], kind: cardioKind });
      const result = await workoutService.finishWorkout(created.id, { duration: minutes, distanceKm });
      const rewards = result.rewards as { xpGained: number; goldGained: number; leveledUp: boolean; oldLevel: number; newLevel: number };
      updateUser(result.user as never);
      addFloatingXP(rewards.xpGained ?? 30, window.innerWidth / 2, 200);
      if (rewards.leveledUp) {
        triggerLevelUp({ oldLevel: rewards.oldLevel, newLevel: rewards.newLevel, xpEarned: rewards.xpGained, goldEarned: rewards.goldGained, statIncreases: {} });
      }
      setShowCardioModal(false);
      setCardioMinutes('');
      setCardioKm('');
      setSummary({ title: CARDIO_LABEL[cardioKind], xp: rewards.xpGained ?? 0, gold: rewards.goldGained ?? 0, seconds: minutes * 60, sets: 0, volume: 0, cardio: { label: CARDIO_LABEL[cardioKind], distanceKm } });
      for (const achievement of result.achievementsUnlocked ?? []) showAchievementToast(achievement);
      await load();
    } catch {
      toast.error('No se pudo registrar el cardio');
    } finally {
      setCardioSaving(false);
    }
  }

  const tz = user?.timezone ?? 'America/Bogota';
  const calendarKey = useCallback((date: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(date).reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }, [tz]);

  const todayKey = calendarKey(new Date());
  const attendedToday = attendances.some((a) => a.date.slice(0, 10) === todayKey);
  const attendanceDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const day = new Date(Date.now() - (6 - index) * DAY_MS);
    const key = calendarKey(day);
    const attended = attendances.some((a) => a.date.slice(0, 10) === key);
    const isToday = key === todayKey;
    const name = day.toLocaleDateString('es-ES', { timeZone: tz, weekday: 'long' });
    const status: DayStatus = attended ? 'done' : isToday ? 'today' : 'rest';
    return {
      key, status,
      label: day.toLocaleDateString('es-ES', { timeZone: tz, weekday: 'narrow' }).toUpperCase(),
      aria: `${name}: ${attended ? 'asististe' : isToday ? 'hoy, pendiente' : 'descanso'}`,
    };
  }), [attendances, calendarKey, todayKey, tz]);

  // Racha: días consecutivos con asistencia hasta hoy (o ayer si hoy falta).
  const streak = useMemo(() => {
    const set = new Set(attendances.map((a) => a.date.slice(0, 10)));
    let n = 0;
    let cursor = Date.now();
    if (!set.has(calendarKey(new Date(cursor)))) cursor -= DAY_MS;
    while (set.has(calendarKey(new Date(cursor)))) { n += 1; cursor -= DAY_MS; }
    return n;
  }, [attendances, calendarKey]);

  // Volumen por día de los últimos 7 días + comparación con la semana anterior.
  const weekly = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * DAY_MS);
      const key = calendarKey(d);
      const ws = workouts.filter((w) => calendarKey(new Date(w.date)) === key);
      const vol = ws.reduce((a, w) => a + workoutVolume(w), 0);
      const title = d.toLocaleDateString('es-ES', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'short' }).replace(/\./g, '');
      return {
        key, vol, sessions: ws.map((w) => w.title),
        title: title.charAt(0).toUpperCase() + title.slice(1),
        label: d.toLocaleDateString('es-ES', { timeZone: tz, weekday: 'narrow' }).toUpperCase(),
        name: d.toLocaleDateString('es-ES', { timeZone: tz, weekday: 'long' }),
      };
    });
    const sumRange = (from: number, to: number) => workouts
      .filter((w) => { const t = new Date(w.date).getTime(); return t > Date.now() - to * DAY_MS && t <= Date.now() - from * DAY_MS; })
      .reduce((a, w) => a + workoutVolume(w), 0);
    const cur = sumRange(0, 7);
    const prev = sumRange(7, 14);
    const max = Math.max(...days.map((d) => d.vol), 0);
    return { days, max, delta: prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null };
  }, [workouts, calendarKey, tz]);

  // TODO(api): no hay endpoint de récords históricos; se calculan sobre las últimas 30 sesiones.
  const records = useMemo(() => {
    const best = new Map<string, number>();
    for (const w of workouts) for (const ex of w.exercises) for (const s of ex.sets) {
      if (s.completed && (s.weight ?? 0) > (best.get(ex.exerciseName) ?? 0)) best.set(ex.exerciseName, s.weight ?? 0);
    }
    const top = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const max = top[0]?.[1] ?? 1;
    return top.map(([name, weight]) => ({ name, weight, pct: Math.round((weight / max) * 100) }));
  }, [workouts]);

  const sessionOpen = !!activeWorkout;
  const latest = workouts[0];

  const startButtons = (
    <>
      <SageContextButton message="¿Qué entreno hoy? Sugiere un workout basado en mi historial y los días que llevo sin entrenar." label="¿Qué entreno hoy?" />
      <Button variant="ghost" size="md" onClick={() => setShowRestTimer(true)}><TimerIcon aria-hidden className="size-4" />Descanso</Button>
      <Button variant="secondary" onClick={() => setShowCardioModal(true)} disabled={sessionOpen}><Footprints aria-hidden className="size-4" />Registrar cardio</Button>
      <Button onClick={() => setShowStartModal(true)} disabled={sessionOpen}><Play aria-hidden className="size-4" />Iniciar entrenamiento</Button>
    </>
  );

  const playlist = (
    <Card variant="base" padding="sm" className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-body-sm text-on-surface"><Music aria-hidden className="size-4 text-success-text" />{user?.gymPlaylistUrl ? 'Playlist de entrenamiento' : 'Sin playlist configurada'}</p>
      {user?.gymPlaylistUrl ? (
        <div className="flex gap-2">
          <a href={user.gymPlaylistUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-success/[var(--lq-soft-alpha)] px-4 text-label-lg text-success-text md:min-h-9">
            Abrir Spotify<ExternalLink aria-hidden className="size-4" /><span className="sr-only">(se abre en una pestaña nueva)</span>
          </a>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>Editar</Button>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>Configurar</Button>
      )}
    </Card>
  );

  if (activeWorkout) {
    return (
      <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
        <SessionHeader title="Gimnasio" description="Cada serie suma XP y fortalece a tu personaje." actions={<Button variant="ghost" size="md" onClick={() => setShowRestTimer(true)}><TimerIcon aria-hidden className="size-4" />Descanso</Button>} />
        {playlist}
        <ActiveWorkoutView workout={activeWorkout} onUpdate={setActiveWorkout} onFinish={finishWorkout} />
        {showRestTimer && <RestTimer onClose={() => setShowRestTimer(false)} />}
      </motion.div>
    );
  }

  const liftDays: LiftDay[] = weekly.days.map((d) => ({ key: d.key, label: d.label, title: d.title, value: d.vol, sessions: d.sessions }));
  const latestTops = latest ? latest.exercises.map((ex) => Math.max(0, ...ex.sets.filter((s) => s.completed).map((s) => s.weight ?? 0))) : [];
  const latestTop = Math.max(1, ...latestTops);
  const platesThisWeek = attendanceDays.filter((d) => d.status === 'done').length;

  const lastCard = latest && (
    <Card as="article" variant="elevated" padding="lg" aria-labelledby="gym-last" className="flex flex-col gap-6 md:p-8">
      <div className="flex flex-wrap items-center gap-5">
        <IconChip icon={Dumbbell} tone="warning" size="md" className="lq-halo" />
        <div className="min-w-0 flex-1">
          <span className="text-label-lg text-primary-text">Último entrenamiento</span>
          <h2 id="gym-last" className="text-heading-lg">{latest.title}</h2>
          <p className="text-body-sm text-on-surface-light">{longDate(latest.date)}{latest.duration ? ` · ${latest.duration} min` : ''}</p>
        </div>
        <Badge variant="primary" size="lg" icon={Sparkles}>+{latest.xpEarned} XP</Badge>
      </div>
      <dl className="grid grid-cols-3 gap-3 md:gap-4">
        {([
          ['Duración', latest.duration ?? 0, (n: number) => (latest.duration ? `${Math.round(n)} min` : '—')],
          ['Volumen', workoutVolume(latest), kg],
          ['Series', workoutSets(latest), (n: number) => String(Math.round(n))],
        ] as const).map(([k, v, f], i) => (
          <motion.div
            key={k} className="rounded-2xl border border-border bg-surface p-3 md:p-4"
            initial={{ opacity: 0, y: -18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.6 }}
            transition={{ ...slam, delay: 0.1 + i * 0.08 }}
          >
            <dt className="text-body-sm text-on-surface-light">{k}</dt>
            <dd className="font-mono text-heading-sm font-bold tabular-nums md:text-heading-md"><AnimatedValue value={v} format={f} /></dd>
          </motion.div>
        ))}
      </dl>
      {latest.exercises.length > 0 && (
        <ul className="flex flex-col" aria-label="Ejercicios y peso máximo">
          {latest.exercises.map((ex, i) => {
            const done = ex.sets.filter((s) => s.completed);
            const top = latestTops[i];
            return (
              <li key={ex.id ?? i} className="group flex min-h-14 flex-col justify-center gap-2 border-b border-border py-2.5 last:border-0">
                <div className="flex items-center gap-4">
                  <span className="min-w-0 flex-1 truncate text-body-md transition-transform duration-300 ease-expo group-hover:translate-x-1">{ex.exerciseName}</span>
                  <span className="font-mono text-body-sm tabular-nums text-on-surface-light">{done.length} series</span>
                  <span className="w-20 text-right font-mono text-label-lg tabular-nums">{top ? `${top} kg` : '—'}</span>
                </div>
                {top > 0 && <LoadBar pct={top / latestTop} delay={i * 0.08} />}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );

  const routineRows = (list: Routine[]) => list.map((r, i) => (
    <li key={r.id} className="flex min-h-16 items-center gap-3 border-b border-border last:border-0">
      <IconChip icon={Dumbbell} tone={ROUTINE_TONES[i % ROUTINE_TONES.length]} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-label-lg">{r.name}</p>
        <p className="text-body-sm text-on-surface-light">{routineExerciseCount(r)} ejercicios{r.estimatedDuration ? ` · ${r.estimatedDuration} min` : ''}</p>
      </div>
      <Button variant="icon" aria-label={`Iniciar ${r.name}`} onClick={() => void startFromRoutine(r)} className="bg-primary/[var(--lq-soft-alpha)] text-primary-text hover:bg-primary/20">
        <Play aria-hidden className="size-[18px]" />
      </Button>
    </li>
  ));

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
      <SessionHeader title="Gimnasio" description="Forja tu cuerpo, héroe. Cada sesión suma XP y fortalece tu personaje." actions={startButtons} />

      <motion.div variants={item}>
        <Thud as="section" trigger={platesThisWeek} aria-label="Asistencia" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-5 rounded-2xl border border-border bg-surface p-4 shadow-sm md:p-6">
          <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-heading-sm">Asistencia de la semana</h2>
              <span className="flex items-center gap-1.5 text-body-sm text-warning-text">
                <Flame aria-hidden className="size-4" />
                <motion.span key={streak} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={slam} className="inline-block font-mono tabular-nums">{streak}</motion.span>
                {streak === 1 ? 'día seguido' : 'días seguidos'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Barbell plates={platesThisWeek} className="max-w-[220px]" />
              <span className="whitespace-nowrap font-mono text-label-md tabular-nums text-on-surface-light">{platesThisWeek}/7 discos</span>
            </div>
          </div>
          <ol className="flex w-full items-center justify-between gap-1 sm:w-auto sm:gap-2.5" aria-label="Asistencia de los últimos siete días">
            {attendanceDays.map((d, i) => (
              <li key={d.key} aria-label={d.aria} className="flex flex-col items-center gap-1.5">
                <motion.span
                  key={d.status} className="flex"
                  initial={{ opacity: 0, scale: d.status === 'done' ? 1.5 : 0.7, y: d.status === 'done' ? -10 : 0 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ ...slam, delay: 0.2 + i * 0.05, opacity: { duration: 0.15, delay: 0.2 + i * 0.05 } }}
                >
                  <DayDot status={d.status} label={d.label} />
                </motion.span>
                <span aria-hidden className="text-label-md text-on-surface-light">{d.label}</span>
              </li>
            ))}
          </ol>
          <Button size="md" disabled={attendedToday} loading={recordingAttendance} onClick={() => void recordAttendance()}>
            {attendedToday ? <><Check aria-hidden className="size-4" />Registrada hoy</> : 'Registrar asistencia'}
          </Button>
        </Thud>
      </motion.div>

      <motion.div variants={item} role="tablist" aria-label="Secciones del gimnasio" className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        onKeyDown={(e) => {
          const i = GYM_TABS.findIndex((t) => t.id === tab);
          const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          const next = GYM_TABS[(i + d + GYM_TABS.length) % GYM_TABS.length];
          changeTab(next.id);
          document.getElementById(`gym-tab-${next.id}`)?.focus();
        }}>
        {GYM_TABS.map(({ id, label, helper, icon, tone }) => {
          const on = tab === id;
          return (
            <button
              key={id} id={`gym-tab-${id}`} type="button" role="tab" aria-selected={on} aria-controls={`gym-panel-${id}`} tabIndex={on ? 0 : -1}
              onClick={() => changeTab(id)}
              className="lq-lift relative flex min-h-[72px] min-w-0 items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-left shadow-sm md:gap-3 md:p-4"
            >
              {/* La selección se desliza entre pestañas con peso */}
              {on && (
                <motion.span
                  layoutId="gym-tab-pill" aria-hidden transition={heavy}
                  className="pointer-events-none absolute -inset-px rounded-2xl border border-primary/50 bg-primary/[var(--lq-soft-alpha)]"
                />
              )}
              <IconChip icon={icon} tone={tone} size="sm" className="relative" />
              <span className="relative min-w-0 flex-1">
                <span className="block truncate text-label-lg">{label}</span>
                <span className={cn('block truncate text-body-sm transition-colors duration-300', on ? 'text-on-surface' : 'text-on-surface-light')}>{helper}</span>
              </span>
              <ChevronRight aria-hidden className={cn('relative hidden size-4 shrink-0 transition-[transform,color] duration-500 ease-expo lg:block', on ? 'translate-x-0.5 text-primary-text' : 'text-on-surface-light')} />
            </button>
          );
        })}
      </motion.div>

      <AnimatePresence mode="wait" initial={false} custom={tabDir.current}>
      <motion.div
        key={`${tab}-${state}`} id={`gym-panel-${tab}`} role="tabpanel" aria-labelledby={`gym-tab-${tab}`} className="flex flex-col gap-6 outline-none" tabIndex={-1}
        custom={tabDir.current}
        variants={{
          enter: (d: number) => ({ opacity: 0, x: d * 32 }),
          center: { opacity: 1, x: 0, transition: heavy },
          leave: (d: number) => ({ opacity: 0, x: d * -20, transition: { duration: 0.18, ease: expo } }),
        }}
        initial="enter" animate="center" exit="leave"
      >
        {state === 'loading' ? (
          <PageLoader label="Calentando motores…" words={LOADING_COPY.gym} />
        ) : state === 'error' ? (
          <ErrorState title="No pudimos cargar tu gimnasio" onRetry={() => void load()} />
        ) : tab === 'history' ? (
          workouts.length === 0 ? (
            <Card variant="elevated" padding="lg">
              <EmptyState
                icon={Dumbbell} tone="warning" title="El gimnasio está listo para ti"
                description="Registra ejercicios, pesos y repeticiones para convertir cada entrenamiento en progreso visible."
                action={<Button onClick={() => setShowStartModal(true)}><Play aria-hidden className="size-4" />Iniciar entrenamiento</Button>}
                className="py-6"
              />
            </Card>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <div className="flex min-w-0 flex-col gap-6">
                {lastCard}
                <Card as="section" padding="lg" aria-labelledby="gym-vol" className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="gym-vol" className="text-heading-sm">Volumen semanal</h2>
                    {weekly.delta !== null && (
                      <span className={cn('flex items-center gap-1.5 text-body-sm', weekly.delta >= 0 ? 'text-success-text' : 'text-warning-text')}>
                        <TrendingUp aria-hidden className={cn('size-4', weekly.delta < 0 && '-scale-y-100')} />{weekly.delta >= 0 ? '+' : ''}{weekly.delta}% vs. semana pasada
                      </span>
                    )}
                  </div>
                  <p className="-mt-3 text-body-sm text-on-surface-light">Kilos movidos cada día (peso × repeticiones). Pasa el cursor por una barra para ver el detalle.</p>
                  <LiftBars days={liftDays} label={`Volumen por día en kilos: ${weekly.days.map((d) => `${d.name} ${Math.round(d.vol)}`).join(', ')}`} />
                </Card>
                {workouts.length > 1 && (
                  <Card as="section" padding="lg" aria-labelledby="gym-prev" className="flex flex-col gap-2">
                    <h2 id="gym-prev" className="mb-2 text-heading-sm">Sesiones anteriores</h2>
                    <ul className="flex flex-col">
                      {workouts.slice(1, 9).map((w, i) => (
                        <motion.li
                          key={w.id}
                          initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.6 }}
                          transition={{ ...heavy, delay: i * 0.05 }}
                          className="group flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border py-2 last:border-0"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-label-lg">{w.title}</p>
                            <p className="text-body-sm text-on-surface-light">{new Date(w.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')}{w.duration ? ` · ${w.duration} min` : ''} · {w.kind === 'WALK' || w.kind === 'CARDIO' ? `${w.kind === 'WALK' ? 'Caminata' : 'Cardio'}${w.distanceKm ? ` · ${w.distanceKm} km` : ''}` : `${w.exercises?.length ?? 0} ejercicios`}</p>
                          </div>
                          <Badge variant="primary" icon={Sparkles}>+{w.xpEarned} XP</Badge>
                        </motion.li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
              <aside className="flex min-w-0 flex-col gap-6">
                <Card as="section" padding="lg" aria-labelledby="gym-routines" className="flex flex-col gap-2">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 id="gym-routines" className="text-heading-sm">Rutinas</h2>
                    {routines.length > 0 && <Button variant="ghost" size="sm" onClick={() => changeTab('routines')}>Ver todas</Button>}
                  </div>
                  {routines.length === 0 ? <p className="text-body-sm text-on-surface-light">Aún no tienes rutinas guardadas.</p> : <ul>{routineRows(routines.slice(0, 4))}</ul>}
                </Card>
                <Card as="section" padding="lg" aria-labelledby="gym-prs" className="flex flex-col gap-3">
                  <h2 id="gym-prs" className="text-heading-sm">Récords personales</h2>
                  {records.length === 0 ? <p className="text-body-sm text-on-surface-light">Completa series con peso para ver tus récords.</p> : records.map((p) => (
                    <div key={p.name} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between"><span className="text-body-md">{p.name}</span><span className="font-mono text-label-lg tabular-nums">{p.weight} kg</span></div>
                      <ProgressBar value={p.pct} tone="warning" shine label={`${p.name}: ${p.weight} kilos`} />
                    </div>
                  ))}
                </Card>
              </aside>
            </div>
          )
        ) : tab === 'routines' ? (
          routines.length === 0 ? (
            <Card variant="elevated" padding="lg">
              <EmptyState
                icon={ClipboardList} tone="forest" title="Aún no tienes una rutina guardada"
                description="Empieza una sesión libre y convierte tus ejercicios favoritos en una ruta fácil de repetir."
                action={<Button onClick={() => setShowStartModal(true)}>Iniciar sesión libre</Button>} className="py-6"
              />
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {routines.map((r, i) => (
                <Card key={r.id} as="article" padding="lg" interactive className="flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <IconChip icon={Dumbbell} tone={ROUTINE_TONES[i % ROUTINE_TONES.length]} />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-heading-sm">{r.name}</h2>
                      {r.description && <p className="text-body-sm text-on-surface-light">{r.description}</p>}
                    </div>
                  </div>
                  <p className="text-body-sm text-on-surface">
                    {r.days.length > 0
                      ? r.days.filter((day) => !day.isRestDay).map((day) => `${WEEKDAY_LABELS[day.weekday]}: ${day.exercises.map((x) => x.exercise.name).join(', ') || 'descanso'}`).join(' · ')
                      : r.exercises.map((x) => x.name).join(' · ')}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="font-mono text-body-sm tabular-nums text-on-surface-light">{routineExerciseCount(r)} ejercicios{r.estimatedDuration ? ` · ~${r.estimatedDuration} min` : ''}</span>
                    <Button size="md" onClick={() => void startFromRoutine(r)}><Play aria-hidden className="size-4" />Iniciar</Button>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : tab === 'analytics' ? (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <BodyWeightTracker />
            <div className="flex flex-col gap-6"><OneRMCalculator /><WeeklyVolumeWidget /></div>
          </div>
        ) : (
          <ProgressPhotos />
        )}
      </motion.div>
      </AnimatePresence>

      {showRestTimer && <RestTimer onClose={() => setShowRestTimer(false)} />}

      <Modal open={showStartModal} onClose={() => setShowStartModal(false)} title="Nuevo entrenamiento">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void startWorkout(); }}>
          <Field label="Nombre del entrenamiento">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Empuje, piernas…" autoFocus />
          </Field>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowStartModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={!newTitle.trim()}>¡Empezar!</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showCardioModal} onClose={() => setShowCardioModal(false)} title="Registrar cardio">
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void logCardio(); }}>
          <ChipGroup label="Tipo de actividad" options={CARDIO_OPTIONS} value={cardioKind} onChange={setCardioKind} />
          <Field label="Tiempo (minutos)">
            <Input type="number" inputMode="numeric" min={1} max={1440} step={1} value={cardioMinutes} onChange={(e) => setCardioMinutes(e.target.value)} placeholder="30" autoFocus />
          </Field>
          <Field label="Distancia (km, opcional)">
            <Input type="number" inputMode="decimal" min={0} max={1000} step={0.1} value={cardioKm} onChange={(e) => setCardioKm(e.target.value)} placeholder="3,5" />
          </Field>
          <div className="flex gap-3">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowCardioModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={cardioSaving || !(Number(cardioMinutes) >= 1)}>Guardar</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!summary} onClose={() => setSummary(null)} title="¡Sesión completada!" hideClose className="items-center text-center">
        {summary && (
          <>
            <Confetti />
            <motion.span className="mx-auto flex" initial={{ opacity: 0, scale: 0.4, y: -30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ ...slam, delay: 0.1 }}>
              <IconChip icon={Trophy} tone="success" size="lg" className="lq-halo rounded-full" />
            </motion.span>
            <SummaryXP xp={summary.xp} />
            <dl className="grid grid-cols-3 gap-2">
              {(summary.cardio
                ? [['Tiempo', formatClock(summary.seconds)], ['Distancia', summary.cardio.distanceKm ? `${summary.cardio.distanceKm} km` : '—'], ['Tipo', summary.cardio.label]]
                : [['Tiempo', formatClock(summary.seconds)], ['Series', String(summary.sets)], ['Volumen', kg(summary.volume)]]).map(([k, v], i) => (
                <motion.div
                  key={k} className="rounded-xl border border-border bg-surface px-2 py-3"
                  initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...slam, delay: 0.45 + i * 0.09 }}
                >
                  <dt className="text-label-md text-on-surface-light">{k}</dt>
                  <dd className="font-mono text-label-lg font-bold tabular-nums">{v}</dd>
                </motion.div>
              ))}
            </dl>
            <Button block onClick={() => setSummary(null)}>Continuar</Button>
          </>
        )}
      </Modal>
    </motion.div>
  );
}
