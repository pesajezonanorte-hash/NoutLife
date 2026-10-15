// Coliseo (antes Gimnasio): cualquier entrenamiento físico. Mapa de recuperación
// muscular, asistencia semanal, modo en vivo con descanso inteligente, resumen con
// confeti, tonelaje, rutinas, análisis de hipertrofia y récords. Los cálculos viven
// en lib/coliseo; la sesión en curso se guarda en el dispositivo hasta terminarla.
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera, Check, ChevronRight, ClipboardList, Dumbbell, Footprints, Flame, History,
  Play, Sparkles, Timer as TimerIcon, Trash2, Trophy, TrendingUp,
} from 'lucide-react';
import type { Workout, Routine } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { expo, heavy, item, slam, stagger, useCountUp } from '@/lib/motion';
import { muscleStates, pplBalance, tonnage, workoutTonnage } from '@/lib/coliseo';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useToast } from '../../hooks/useToast';
import { AnimatedValue, Badge, Button, Card, ChipGroup, Confetti, DayDot, EmptyState, ErrorState, Field, IconChip, Input, Modal, ProgressBar, formatClock, type DayStatus, type Tone, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import * as workoutService from '../../services/workout.service';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { BalanceCard, BodyWeightTracker, OneRMCalculator, PlateCalculator, ProgressPhotos, RestTimer, WeeklySets } from '../../components/coliseo/ColiseoExtras';
import { Barbell, DropTitle, LiftBars, LoadBar, Thud, type LiftDay } from '../../components/coliseo/ColiseoMotion';
import { MuscleMap } from '../../components/coliseo/MuscleMap';
import { LivePlayer, blankSet, elapsedMs, sessionTonnage, toWorkoutSets, type ActiveExercise, type ActiveWorkout, type UpdateWorkout } from '../../components/coliseo/LivePlayer';
import { CycleColiseoHint } from '../../components/cycle/CycleHints';

type ColiseoTab = 'history' | 'routines' | 'analytics' | 'photos';

const COLISEO_TABS: Array<{ id: ColiseoTab; label: string; helper: string; icon: typeof History; tone: Tone }> = [
  { id: 'history', label: 'Historial', helper: 'Tus sesiones', icon: History, tone: 'primary' },
  { id: 'routines', label: 'Rutinas', helper: 'Planes listos', icon: ClipboardList, tone: 'forest' },
  { id: 'analytics', label: 'Análisis', helper: 'Hipertrofia y fuerza', icon: TrendingUp, tone: 'info' },
  { id: 'photos', label: 'Progreso', helper: 'Fotos y cambios', icon: Camera, tone: 'success' },
];

const WEEKDAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DAY_MS = 86_400_000;
const ROUTINE_TONES: Tone[] = ['primary', 'forest', 'warning', 'success'];

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

const workoutSets = (w: Workout) => w.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).length, 0);

interface Summary { title: string; xp: number; gold: number; seconds: number; sets: number; volume: number; cardio?: { label: string; distanceKm?: number } }

type CardioKind = 'WALK' | 'CARDIO';
const CARDIO_LABEL: Record<CardioKind, string> = { WALK: 'Caminata', CARDIO: 'Cardio general' };
const CARDIO_OPTIONS: { value: CardioKind; label: string }[] = [
  { value: 'WALK', label: 'Caminata' },
  { value: 'CARDIO', label: 'Cardio general' },
];

/** La sesión en curso sobrevive a recargas y a que el móvil descarte la pestaña durante el descanso. */
const sessionKey = (userId?: string) => `coliseo.session:${userId ?? 'anon'}`;
function readSession(key: string): ActiveWorkout | null {
  try {
    const raw = localStorage.getItem(key);
    const w = raw ? (JSON.parse(raw) as ActiveWorkout) : null;
    return w && typeof w.id === 'string' && Array.isArray(w.exercises) ? w : null;
  } catch {
    return null;
  }
}

/**
 * Sesión minimizada: mini reproductor flotante (a la izquierda del FAB en móvil, abajo al
 * centro en escritorio) que vuelve al modo en vivo. Lleva su propio reloj para no
 * re-renderizar la página cada segundo.
 */
function SessionBar({ workout, onOpen }: { workout: ActiveWorkout; onOpen: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const done = workout.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).length, 0);
  const planned = workout.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const clock = formatClock(elapsedMs(workout, now) / 1000);
  return (
    <motion.button
      type="button" onClick={onOpen}
      aria-label={`Volver al entrenamiento en vivo: ${workout.title}, ${clock}, ${done} de ${planned} series`}
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={slam}
      className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 right-24 z-40 flex min-h-16 items-center gap-3 rounded-2xl border border-primary/40 bg-background px-4 text-left shadow-lg md:bottom-6 md:left-0 md:right-0 md:mx-auto md:w-[24rem]"
    >
      <span aria-hidden className="size-2.5 shrink-0 animate-pulse rounded-full bg-error [.reduce-motion_&]:animate-none" />
      <span aria-hidden className="min-w-0 flex-1">
        <span className="block truncate text-label-lg">{workout.title}</span>
        <span className="block font-mono text-body-sm tabular-nums text-on-surface-light">{clock} · {done}/{planned} series</span>
      </span>
      <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-strong text-on-primary">
        <Play className="size-5" />
      </span>
    </motion.button>
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

export default function ColiseoPage() {
  const { addFloatingXP, triggerLevelUp, showAchievementToast } = useUIStore();
  const { updateUser, user } = useAuthStore();
  const toast = useToast();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [attendances, setAttendances] = useState<workoutService.ColiseoAttendance[]>([]);
  const [recordingAttendance, setRecordingAttendance] = useState(false);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const storageKey = sessionKey(user?.id);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(() => readSession(storageKey));
  /** Modo en vivo abierto; minimizado queda un aviso para volver. */
  const [liveOpen, setLiveOpen] = useState(true);
  const updateSession = useCallback<UpdateWorkout>((fn) => setActiveWorkout((w) => (w ? fn(w) : w)), []);
  useEffect(() => {
    try {
      if (activeWorkout) localStorage.setItem(storageKey, JSON.stringify(activeWorkout));
      else localStorage.removeItem(storageKey);
    } catch {
      // Sin almacenamiento la sesión vive solo en memoria.
    }
  }, [activeWorkout, storageKey]);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [cardioKind, setCardioKind] = useState<CardioKind>('WALK');
  const [cardioMinutes, setCardioMinutes] = useState('');
  const [cardioKm, setCardioKm] = useState('');
  const [cardioSaving, setCardioSaving] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  /** Confirmación antes de borrar una rutina o un entrenamiento guardado. */
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'workout' | 'routine'; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<ColiseoTab>('history');
  /** Sentido del cambio de pestaña: el panel entra desde ese lado. */
  const tabDir = useRef(1);
  const changeTab = (next: ColiseoTab) => {
    tabDir.current = COLISEO_TABS.findIndex((t) => t.id === next) >= COLISEO_TABS.findIndex((t) => t.id === tab) ? 1 : -1;
    setTab(next);
  };
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [ws, rs, attendance] = await Promise.all([
        // ponytail: las 60 últimas cubren el tonelaje de 30 días y el balance de 4 semanas hasta 2 sesiones al día; pasar a rango de fechas si alguien entrena más.
        workoutService.fetchWorkouts(60),
        workoutService.fetchRoutines(),
        workoutService.fetchColiseoAttendances(),
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
      const attendance = await workoutService.recordColiseoAttendance();
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
      setLiveOpen(true);
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
      const exercises: ActiveExercise[] = routineDay
        ? routineDay.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          name: exercise.exercise.name,
          muscleGroup: exercise.exercise.muscleGroup,
          equipment: exercise.exercise.equipment,
          sets: (exercise.targetSets ?? []).map((set, index) => blankSet(index + 1, set.weight ? String(set.weight) : '', set.reps ? String(set.reps) : '')),
        }))
        : (routine.exercises as Array<{ exerciseId: string; name: string; sets: number; reps?: number }>).map((exercise) => ({
          exerciseId: exercise.exerciseId,
          name: exercise.name,
          sets: Array.from({ length: exercise.sets }, (_, index) => blankSet(index + 1, '', exercise.reps ? String(exercise.reps) : '')),
        }));
      setActiveWorkout({ id: w.id, title: w.title, startTime: Date.now(), exercises });
      setLiveOpen(true);
    } catch {
      toast.error('Error al iniciar rutina');
    }
  }

  /** Ejecuta la eliminación confirmada de una rutina o un entrenamiento guardado. */
  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    const { kind, id, name } = pendingDelete;
    setDeleting(true);
    try {
      if (kind === 'workout') {
        await workoutService.deleteWorkout(id);
        setWorkouts((current) => current.filter((w) => w.id !== id));
        toast.success('Entrenamiento eliminado', name);
      } else {
        await workoutService.deleteRoutine(id);
        setRoutines((current) => current.filter((r) => r.id !== id));
        toast.success('Rutina eliminada', name);
      }
      setPendingDelete(null);
    } catch {
      toast.error(kind === 'workout' ? 'No se pudo eliminar el entrenamiento' : 'No se pudo eliminar la rutina');
    } finally {
      setDeleting(false);
    }
  }

  async function finishWorkout(aw: ActiveWorkout) {
    const activeMs = elapsedMs(aw, Date.now());
    const duration = Math.round(activeMs / 60000);
    const exercises = aw.exercises.map((ex, i) => ({ exerciseId: ex.exerciseId, sets: toWorkoutSets(ex), order: i }));
    const sets = aw.exercises.reduce((a, ex) => a + ex.sets.filter((s) => s.completed).length, 0);
    const volume = sessionTonnage(aw);

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
      toast.error('Error al finalizar entrenamiento', 'Tu sesión sigue guardada en este dispositivo: vuelve a intentarlo.');
    }
  }

  /** Descarta la sesión en curso: borra el borrador (aún sin XP) y la copia local. */
  async function discardWorkout(aw: ActiveWorkout) {
    await workoutService.deleteWorkout(aw.id).catch(() => undefined);
    setActiveWorkout(null);
    toast.success('Sesión descartada', aw.title);
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

  // El borrador de la sesión en curso no es historial (y borrarlo rompería la sesión).
  const listed = useMemo(() => workouts.filter((w) => w.id !== activeWorkout?.id), [workouts, activeWorkout?.id]);

  // Fatiga por músculo, balance y tonelaje, recalculados con cada sesión terminada.
  const stats = useMemo(() => {
    const now = Date.now();
    return { now, muscles: muscleStates(workouts, now), balance: pplBalance(workouts, now), tons: tonnage(workouts, now) };
  }, [workouts]);
  const weekDelta = stats.tons.prevWeek > 0 ? Math.round(((stats.tons.week - stats.tons.prevWeek) / stats.tons.prevWeek) * 100) : null;

  // Tonelaje por día de los últimos 7 días.
  const weekly = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * DAY_MS);
      const key = calendarKey(d);
      const ws = listed.filter((w) => calendarKey(new Date(w.date)) === key);
      const vol = ws.reduce((a, w) => a + workoutTonnage(w), 0);
      const title = d.toLocaleDateString('es-ES', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'short' }).replace(/\./g, '');
      return {
        key, vol, sessions: ws.map((w) => w.title),
        title: title.charAt(0).toUpperCase() + title.slice(1),
        label: d.toLocaleDateString('es-ES', { timeZone: tz, weekday: 'narrow' }).toUpperCase(),
        name: d.toLocaleDateString('es-ES', { timeZone: tz, weekday: 'long' }),
      };
    });
    return { days };
  }, [listed, calendarKey, tz]);

  // TODO(api): no hay endpoint de récords históricos; se calculan sobre las últimas 60 sesiones.
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
  const latest = listed[0];

  const startButtons = (
    <>
      <SageContextButton message="¿Qué entreno hoy? Sugiere un workout basado en mi historial y los días que llevo sin entrenar." label="¿Qué entreno hoy?" />
      <Button variant="ghost" size="md" onClick={() => setShowRestTimer(true)}><TimerIcon aria-hidden className="size-4" />Descanso</Button>
      <Button variant="secondary" onClick={() => setShowCardioModal(true)} disabled={sessionOpen}><Footprints aria-hidden className="size-4" />Registrar cardio</Button>
      <Button onClick={() => setShowStartModal(true)} disabled={sessionOpen}><Play aria-hidden className="size-4" />Iniciar entrenamiento</Button>
    </>
  );

  const liftDays: LiftDay[] = weekly.days.map((d) => ({ key: d.key, label: d.label, title: d.title, value: d.vol, sessions: d.sessions }));
  const latestTops = latest ? latest.exercises.map((ex) => Math.max(0, ...ex.sets.filter((s) => s.completed).map((s) => s.weight ?? 0))) : [];
  const latestTop = Math.max(1, ...latestTops);
  const platesThisWeek = attendanceDays.filter((d) => d.status === 'done').length;

  const lastCard = latest && (
    <Card as="article" variant="elevated" padding="lg" aria-labelledby="coliseo-last" className="flex flex-col gap-6 md:p-8">
      <div className="flex flex-wrap items-center gap-5">
        <IconChip icon={Dumbbell} tone="warning" size="md" className="lq-halo" />
        <div className="min-w-0 flex-1">
          <span className="text-label-lg text-primary-text">Último entrenamiento</span>
          <h2 id="coliseo-last" className="text-heading-lg">{latest.title}</h2>
          <p className="text-body-sm text-on-surface-light">{longDate(latest.date)}{latest.duration ? ` · ${latest.duration} min` : ''}</p>
        </div>
        <Badge variant="primary" size="lg" icon={Sparkles}>+{latest.xpEarned} XP</Badge>
        <Button variant="icon" aria-label={`Eliminar entrenamiento ${latest.title}`} onClick={() => setPendingDelete({ kind: 'workout', id: latest.id, name: latest.title })}>
          <Trash2 aria-hidden className="size-[18px]" strokeWidth={1.75} />
        </Button>
      </div>
      <dl className="grid grid-cols-3 gap-3 md:gap-4">
        {([
          ['Duración', latest.duration ?? 0, (n: number) => (latest.duration ? `${Math.round(n)} min` : '—')],
          ['Tonelaje', workoutTonnage(latest), kg],
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
      <Button variant="icon" aria-label={`Eliminar rutina ${r.name}`} onClick={() => setPendingDelete({ kind: 'routine', id: r.id, name: r.name })}>
        <Trash2 aria-hidden className="size-[18px]" strokeWidth={1.75} />
      </Button>
      <Button variant="icon" aria-label={`Iniciar ${r.name}`} onClick={() => void startFromRoutine(r)} className="bg-primary/[var(--lq-soft-alpha)] text-primary-text hover:bg-primary/20">
        <Play aria-hidden className="size-[18px]" />
      </Button>
    </li>
  ));

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-8">
      <SessionHeader title="Coliseo" description="Pesas, cardio, deporte o una caminata: cada sesión suma XP y fortalece a tu personaje." actions={startButtons} />

      {/* Ciclo: intensidad sugerida para hoy (solo si la persona tiene la zona Ciclo) */}
      <motion.div variants={item}><CycleColiseoHint /></motion.div>

      {state === 'ready' && <motion.div variants={item}><MuscleMap states={stats.muscles} now={stats.now} /></motion.div>}

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

      <motion.div variants={item} role="tablist" aria-label="Secciones del Coliseo" className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        onKeyDown={(e) => {
          const i = COLISEO_TABS.findIndex((t) => t.id === tab);
          const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          const next = COLISEO_TABS[(i + d + COLISEO_TABS.length) % COLISEO_TABS.length];
          changeTab(next.id);
          document.getElementById(`coliseo-tab-${next.id}`)?.focus();
        }}>
        {COLISEO_TABS.map(({ id, label, helper, icon, tone }) => {
          const on = tab === id;
          return (
            <button
              key={id} id={`coliseo-tab-${id}`} type="button" role="tab" aria-selected={on} aria-controls={`coliseo-panel-${id}`} tabIndex={on ? 0 : -1}
              onClick={() => changeTab(id)}
              className="lq-lift relative flex min-h-[72px] min-w-0 items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-left shadow-sm md:gap-3 md:p-4"
            >
              {/* La selección se desliza entre pestañas con peso */}
              {on && (
                <motion.span
                  layoutId="coliseo-tab-pill" aria-hidden transition={heavy}
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
        key={`${tab}-${state}`} id={`coliseo-panel-${tab}`} role="tabpanel" aria-labelledby={`coliseo-tab-${tab}`} className="flex flex-col gap-6 outline-none" tabIndex={-1}
        custom={tabDir.current}
        variants={{
          enter: (d: number) => ({ opacity: 0, x: d * 32 }),
          center: { opacity: 1, x: 0, transition: heavy },
          leave: (d: number) => ({ opacity: 0, x: d * -20, transition: { duration: 0.18, ease: expo } }),
        }}
        initial="enter" animate="center" exit="leave"
      >
        {state === 'loading' ? (
          <PageLoader label="Calentando motores…" words={LOADING_COPY.coliseo} />
        ) : state === 'error' ? (
          <ErrorState title="No pudimos cargar tu Coliseo" onRetry={() => void load()} />
        ) : tab === 'history' ? (
          listed.length === 0 ? (
            <Card variant="elevated" padding="lg">
              <EmptyState
                icon={Dumbbell} tone="warning" title="El Coliseo está listo para ti"
                description="Registra ejercicios, pesos y repeticiones para convertir cada entrenamiento en progreso visible."
                action={<Button onClick={() => setShowStartModal(true)}><Play aria-hidden className="size-4" />Iniciar entrenamiento</Button>}
                className="py-6"
              />
            </Card>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <div className="flex min-w-0 flex-col gap-6">
                {lastCard}
                <Card as="section" padding="lg" aria-labelledby="coliseo-vol" className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="coliseo-vol" className="text-heading-sm">Tonelaje</h2>
                    {weekDelta !== null && (
                      <span className={cn('flex items-center gap-1.5 text-body-sm', weekDelta >= 0 ? 'text-success-text' : 'text-warning-text')}>
                        <TrendingUp aria-hidden className={cn('size-4', weekDelta < 0 && '-scale-y-100')} />{weekDelta >= 0 ? '+' : ''}{weekDelta}% vs. semana pasada
                      </span>
                    )}
                  </div>
                  <p className="-mt-3 text-body-sm text-on-surface-light">Kilos movidos: peso × repeticiones de cada serie completada.</p>
                  <dl className="grid grid-cols-3 gap-2 md:gap-3">
                    {([['Última sesión', stats.tons.session], ['7 días', stats.tons.week], ['30 días', stats.tons.month]] as const).map(([k, v]) => (
                      <div key={k} className="rounded-2xl border border-border bg-background p-3">
                        <dt className="text-body-sm text-on-surface-light">{k}</dt>
                        <dd className="font-mono text-label-lg font-bold tabular-nums md:text-heading-sm"><AnimatedValue value={v} format={kg} /></dd>
                      </div>
                    ))}
                  </dl>
                  <LiftBars days={liftDays} label={`Tonelaje por día en kilos: ${weekly.days.map((d) => `${d.name} ${Math.round(d.vol)}`).join(', ')}`} />
                </Card>
                {listed.length > 1 && (
                  <Card as="section" padding="lg" aria-labelledby="coliseo-prev" className="flex flex-col gap-2">
                    <h2 id="coliseo-prev" className="mb-2 text-heading-sm">Sesiones anteriores</h2>
                    <ul className="flex flex-col">
                      {listed.slice(1, 9).map((w, i) => (
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
                          <Button variant="icon" size="sm" aria-label={`Eliminar entrenamiento ${w.title}`} onClick={() => setPendingDelete({ kind: 'workout', id: w.id, name: w.title })}>
                            <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                          </Button>
                        </motion.li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
              <aside className="flex min-w-0 flex-col gap-6">
                <Card as="section" padding="lg" aria-labelledby="coliseo-routines" className="flex flex-col gap-2">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 id="coliseo-routines" className="text-heading-sm">Rutinas</h2>
                    {routines.length > 0 && <Button variant="ghost" size="sm" onClick={() => changeTab('routines')}>Ver todas</Button>}
                  </div>
                  {routines.length === 0 ? <p className="text-body-sm text-on-surface-light">Aún no tienes rutinas guardadas.</p> : <ul>{routineRows(routines.slice(0, 4))}</ul>}
                </Card>
                <Card as="section" padding="lg" aria-labelledby="coliseo-prs" className="flex flex-col gap-3">
                  <h2 id="coliseo-prs" className="text-heading-sm">Récords personales</h2>
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
                    <div className="flex items-center gap-2">
                      <Button variant="icon" aria-label={`Eliminar rutina ${r.name}`} onClick={() => setPendingDelete({ kind: 'routine', id: r.id, name: r.name })}>
                        <Trash2 aria-hidden className="size-[18px]" strokeWidth={1.75} />
                      </Button>
                      <Button size="md" onClick={() => void startFromRoutine(r)}><Play aria-hidden className="size-4" />Iniciar</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : tab === 'analytics' ? (
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-6"><WeeklySets states={stats.muscles} /><BalanceCard balance={stats.balance} /></div>
            <div className="flex min-w-0 flex-col gap-6"><OneRMCalculator /><PlateCalculator /><BodyWeightTracker /></div>
          </div>
        ) : (
          <ProgressPhotos />
        )}
      </motion.div>
      </AnimatePresence>

      {showRestTimer && <RestTimer onClose={() => setShowRestTimer(false)} />}

      <AnimatePresence>
        {activeWorkout && liveOpen && (
          <LivePlayer
            key="live" workout={activeWorkout} update={updateSession} playlistUrl={user?.coliseoPlaylistUrl}
            onMinimize={() => setLiveOpen(false)} onFinish={finishWorkout} onDiscard={discardWorkout}
          />
        )}
        {activeWorkout && !liveOpen && <SessionBar key="bar" workout={activeWorkout} onOpen={() => setLiveOpen(true)} />}
      </AnimatePresence>

      {/* Confirmación para no borrar por accidente una rutina o un entrenamiento */}
      <Modal open={!!pendingDelete} onClose={() => { if (!deleting) setPendingDelete(null); }} title={pendingDelete?.kind === 'routine' ? 'Eliminar rutina' : 'Eliminar entrenamiento'}>
        <div className="flex flex-col gap-4">
          <p className="text-body-md text-on-surface">
            ¿Seguro que quieres eliminar {pendingDelete?.kind === 'routine' ? 'la rutina' : 'el entrenamiento'}{' '}
            <span className="font-semibold">«{pendingDelete?.name}»</span>? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" disabled={deleting} onClick={() => setPendingDelete(null)}>Cancelar</Button>
            <Button variant="danger" className="flex-1" loading={deleting} onClick={() => void confirmDelete()}>Eliminar</Button>
          </div>
        </div>
      </Modal>

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
                : [['Tiempo', formatClock(summary.seconds)], ['Series', String(summary.sets)], ['Tonelaje', kg(summary.volume)]]).map(([k, v], i) => (
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
