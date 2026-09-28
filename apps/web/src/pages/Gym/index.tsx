import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { LifeQuestFlipCard } from '../../components/ui/lifequest-flip-card';
import { PixelButton } from '../../components/ui/PixelButton';
import type { Workout, Exercise, Routine } from '@lifequest/shared';
import * as workoutService from '../../services/workout.service';
import { SageContextButton } from '../../components/sage/SageContextButton';
import { BodyWeightTracker, OneRMCalculator, WeeklyVolumeWidget, ProgressPhotos, RestTimer } from '../../components/gym/GymExtras';
import { E } from '@/components/ui/glyphs';

const MUSCLE_GROUPS = ['Todos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Core', 'Cardio'];

type GymTab = 'history' | 'routines' | 'analytics' | 'photos';

const GYM_TABS: Array<{ id: GymTab; label: string; helper: string; icon: string }> = [
  { id: 'history', label: 'Historial', helper: 'Tus sesiones', icon: '📜' },
  { id: 'routines', label: 'Rutinas', helper: 'Planes listos', icon: '📋' },
  { id: 'analytics', label: 'Análisis', helper: 'Tu rendimiento', icon: '📈' },
  { id: 'photos', label: 'Progreso', helper: 'Fotos y cambios', icon: '📸' },
];

interface ActiveSet {
  id: string;
  weight: string;
  reps: string;
  completed: boolean;
}

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
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m ${s % 60}s`;
}

function WorkoutTimer({ startTime }: { startTime: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-pixel text-accent-gold" style={{ fontSize: '11px' }}>
      ⏱ {formatDuration(Date.now() - startTime)}
    </span>
  );
}

function GymEmptySurface({
  eyebrow,
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <PixelPanel className="relative overflow-hidden p-0">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background: 'radial-gradient(circle at 86% 15%, color-mix(in srgb, var(--accent-gold) 18%, transparent), transparent 31%), linear-gradient(135deg, color-mix(in srgb, var(--accent-gold) 7%, var(--bg-panel)), var(--bg-panel) 55%)',
          }}
        />
        <div className="relative flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent-gold)]/45 bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] shadow-lg">
            <E e={icon} s={28} strokeWidth={1.65} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent-gold)]">{eyebrow}</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">{title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">{description}</p>
          </div>
          <PixelButton variant="primary" size="lg" onClick={onAction} className="w-full sm:w-auto">
            <E e="⚔" s={16} /> {actionLabel}
          </PixelButton>
        </div>
      </PixelPanel>
    </motion.div>
  );
}

// ▲▼ stepper
function NumericStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  const num = parseFloat(value) || 0;
  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(String(Math.max(min, num - step)))}
        className="h-11 w-11 border border-border-pixel text-text-secondary hover:text-accent-gold hover:border-accent-gold transition-colors font-pixel disabled:opacity-30 md:h-10 md:w-5"
        style={{ fontSize: '8px' }}
      >▼</button>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? '0'}
        disabled={disabled}
        className="h-11 w-12 bg-bg-deep border border-border-pixel text-text-primary font-vt text-lg text-center py-1 focus:border-accent-gold outline-none disabled:opacity-50 md:h-10"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(String(num + step))}
        className="h-11 w-11 border border-border-pixel text-text-secondary hover:text-accent-gold hover:border-accent-gold transition-colors font-pixel disabled:opacity-30 md:h-10 md:w-5"
        style={{ fontSize: '8px' }}
      >▲</button>
    </div>
  );
}

function ExerciseSearchModal({
  onSelect,
  onClose,
}: {
  onSelect: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('Todos');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    workoutService
      .fetchExercises(search || undefined, muscleFilter !== 'Todos' ? muscleFilter : undefined)
      .then(data => {
        setExercises(data);
        setLoading(false);
      });
  }, [search, muscleFilter]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-0 md:items-center md:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        className="flex max-h-[86dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-2 border-border-pixel bg-bg-panel pb-[env(safe-area-inset-bottom)] md:max-h-[80vh] md:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-3 border-b-2 border-border-pixel space-y-2">
          <p className="font-pixel text-accent-gold" style={{ fontSize: '9px' }}>AGREGAR EJERCICIO</p>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ejercicio..."
            autoFocus
            className="w-full bg-bg-deep border-2 border-border-pixel text-text-primary font-vt text-base px-3 py-2 focus:border-accent-gold outline-none"
          />
          {/* Muscle group filter */}
          <div className="flex gap-1 flex-wrap">
            {MUSCLE_GROUPS.map(mg => (
              <button
                key={mg}
                onClick={() => setMuscleFilter(mg)}
                className={`min-h-11 px-2 font-pixel border transition-colors ${
                  muscleFilter === mg
                    ? 'border-accent-gold text-accent-gold bg-accent-gold/10'
                    : 'border-border-pixel text-text-secondary hover:border-accent-gold/50'
                }`}
                style={{ fontSize: '6px' }}
              >
                {mg}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <p className="font-vt text-text-secondary text-center py-4 text-lg">Buscando...</p>
          ) : exercises.length === 0 ? (
            <p className="font-vt text-text-secondary text-center py-4 text-lg">Sin resultados</p>
          ) : (
            exercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => onSelect(ex)}
                className="min-h-11 w-full text-left px-3 py-2 hover:bg-bg-panel-light border-b border-border-pixel/30 transition-colors"
              >
                <p className="font-vt text-text-primary text-lg">{ex.name}</p>
                {(ex.muscleGroup || ex.equipment) && (
                  <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>
                    {[ex.muscleGroup, ex.equipment].filter(Boolean).join(' · ')}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ActiveWorkoutView({
  workout,
  onFinish,
}: {
  workout: ActiveWorkout;
  onUpdate: (w: ActiveWorkout) => void;
  onFinish: (w: ActiveWorkout) => void;
}) {
  const [activeWorkout, setActiveWorkout] = useState(workout);
  const [showExSearch, setShowExSearch] = useState(false);
  const [restTimer, setRestTimer] = useState<number | null>(null);
  const [newPRs, setNewPRs] = useState<Set<string>>(new Set()); // "exIdx-setIdx"

  useEffect(() => {
    if (restTimer === null || restTimer <= 0) return;
    const id = setTimeout(() => setRestTimer(t => (t !== null ? t - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [restTimer]);

  function addExercise(ex: Exercise) {
    setActiveWorkout(prev => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        {
          exerciseId: ex.id,
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          sets: [{ id: '1', weight: '', reps: '', completed: false }],
          prevBest: null,
          personalRecord: 0,
        },
      ],
    }));
  }

  function addSet(exIdx: number) {
    setActiveWorkout(prev => {
      const exercises = [...prev.exercises];
      const ex = exercises[exIdx];
      // pre-fill with last set values
      const lastSet = ex.sets[ex.sets.length - 1];
      exercises[exIdx] = {
        ...ex,
        sets: [
          ...ex.sets,
          {
            id: String(ex.sets.length + 1),
            weight: lastSet?.weight ?? '',
            reps: lastSet?.reps ?? '',
            completed: false,
          },
        ],
      };
      return { ...prev, exercises };
    });
  }

  function updateSet(
    exIdx: number,
    setIdx: number,
    field: 'weight' | 'reps' | 'completed',
    value: string | boolean,
  ) {
    setActiveWorkout(prev => {
      const exercises = [...prev.exercises];
      const ex = exercises[exIdx];
      const sets = [...ex.sets];
      sets[setIdx] = { ...sets[setIdx], [field]: value };

      // Check for PR when completing a set
      if (field === 'completed' && value === true) {
        setRestTimer(90);
        const w = parseFloat(sets[setIdx].weight) || 0;
        const r = parseFloat(sets[setIdx].reps) || 0;
        const volume = w * r;
        if (volume > 0 && volume > (ex.personalRecord ?? 0)) {
          exercises[exIdx] = { ...ex, sets, personalRecord: volume };
          setNewPRs(prs => new Set([...prs, `${exIdx}-${setIdx}`]));
          return { ...prev, exercises };
        }
      }

      exercises[exIdx] = { ...ex, sets };
      return { ...prev, exercises };
    });
  }

  const totalSets = activeWorkout.exercises.reduce(
    (a, ex) => a + ex.sets.filter(s => s.completed).length,
    0,
  );

  const totalVolume = activeWorkout.exercises.reduce((a, ex) => {
    return (
      a +
      ex.sets
        .filter(s => s.completed)
        .reduce((b, s) => b + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 1), 0)
    );
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-pixel text-accent-gold" style={{ fontSize: '11px' }}>
            {activeWorkout.title}
          </p>
          <WorkoutTimer startTime={activeWorkout.startTime} />
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <span className="font-vt text-text-secondary text-base">{totalSets} sets</span>
          {totalVolume > 0 && (
            <span className="font-vt text-accent-gold text-base">
              Vol: {totalVolume.toLocaleString('es-CO')} kg
            </span>
          )}
          <PixelButton variant="primary" onClick={() => onFinish(activeWorkout)}>
            <E e="✓" /> FINALIZAR
          </PixelButton>
        </div>
      </div>

      {restTimer !== null && restTimer > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-accent-cyan/10 border-2 border-accent-cyan p-3 text-center"
        >
          <p className="font-pixel text-accent-cyan" style={{ fontSize: '9px' }}>
            DESCANSO
          </p>
          <p className="font-pixel text-accent-gold text-2xl">{restTimer}s</p>
          <button
            onClick={() => setRestTimer(null)}
            className="font-vt text-text-secondary text-base"
          >
            Saltar
          </button>
        </motion.div>
      )}

      {activeWorkout.exercises.map((ex, exIdx) => {
        const allSetsCompleted =
          ex.sets.length > 0 && ex.sets.every(s => s.completed);
        return (
          <PixelPanel key={exIdx} className="p-3 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-vt text-text-primary text-xl">{ex.name}</p>
                  {allSetsCompleted && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-accent-green text-lg"
                    >
                      <E e="✅" />
                    </motion.span>
                  )}
                </div>
                {ex.muscleGroup && (
                  <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>
                    {ex.muscleGroup}
                  </p>
                )}
              </div>
              {ex.prevBest && (
                <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>
                  MEJOR: {ex.prevBest.weight}kg × {ex.prevBest.reps} reps
                </p>
              )}
            </div>

            <div className="space-y-2 md:hidden">
              {ex.sets.map((set, setIdx) => {
                const isPR = newPRs.has(`${exIdx}-${setIdx}`);
                return (
                  <div key={set.id} className={`rounded-xl border border-border-pixel bg-bg-deep p-3 ${set.completed ? 'opacity-60' : ''}`}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="font-pixel text-text-secondary" style={{ fontSize: '8px' }}>SET {setIdx + 1}</span>
                      <span className="min-w-0 truncate font-pixel text-text-muted" style={{ fontSize: '7px' }}>
                        ANTERIOR: {ex.prevBest ? `${ex.prevBest.weight}×${ex.prevBest.reps}` : '—'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="min-w-0">
                        <span className="mb-1 block font-pixel text-text-secondary" style={{ fontSize: '7px' }}>KG</span>
                        <NumericStepper
                          value={set.weight}
                          onChange={v => updateSet(exIdx, setIdx, 'weight', v)}
                          step={2.5}
                          disabled={set.completed}
                        />
                      </label>
                      <label className="min-w-0">
                        <span className="mb-1 block font-pixel text-text-secondary" style={{ fontSize: '7px' }}>REPS</span>
                        <NumericStepper
                          value={set.reps}
                          onChange={v => updateSet(exIdx, setIdx, 'reps', v)}
                          step={1}
                          disabled={set.completed}
                        />
                      </label>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() => updateSet(exIdx, setIdx, 'completed', !set.completed)}
                      className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 border-2 font-pixel transition-colors ${
                        set.completed
                          ? 'border-accent-green bg-accent-green text-bg-deep'
                          : 'border-border-pixel text-text-secondary hover:border-accent-green'
                      }`}
                      style={{ fontSize: '8px' }}
                    >
                      {set.completed ? '✓ SET COMPLETADO' : 'MARCAR SET COMPLETO'}
                      {isPR && <span className="text-accent-gold"><E e="🏆" /> PR</span>}
                    </motion.button>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-center">
                <thead>
                  <tr className="border-b border-border-pixel">
                    {['SET', 'KG', 'REPS', 'ANTERIOR', '✓'].map(h => (
                      <th
                        key={h}
                        className="font-pixel text-text-secondary pb-1 px-1"
                        style={{ fontSize: '7px' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ex.sets.map((set, setIdx) => {
                    const isPR = newPRs.has(`${exIdx}-${setIdx}`);
                    return (
                      <tr
                        key={set.id}
                        className={set.completed ? 'opacity-60' : ''}
                      >
                        <td
                          className="font-pixel text-text-secondary py-1 px-1"
                          style={{ fontSize: '8px' }}
                        >
                          {setIdx + 1}
                        </td>
                        <td className="py-1 px-1">
                          <NumericStepper
                            value={set.weight}
                            onChange={v => updateSet(exIdx, setIdx, 'weight', v)}
                            step={2.5}
                            disabled={set.completed}
                          />
                        </td>
                        <td className="py-1 px-1">
                          <NumericStepper
                            value={set.reps}
                            onChange={v => updateSet(exIdx, setIdx, 'reps', v)}
                            step={1}
                            disabled={set.completed}
                          />
                        </td>
                        <td
                          className="font-pixel text-text-muted px-1"
                          style={{ fontSize: '7px', whiteSpace: 'nowrap' }}
                        >
                          {ex.prevBest
                            ? `${ex.prevBest.weight}×${ex.prevBest.reps}`
                            : '—'}
                        </td>
                        <td className="py-1 px-2">
                          <div className="flex flex-col items-center gap-0.5">
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={() =>
                                updateSet(exIdx, setIdx, 'completed', !set.completed)
                              }
                              className={`w-8 h-8 border-2 flex items-center justify-center transition-colors ${
                                set.completed
                                  ? 'border-accent-green bg-accent-green text-bg-deep'
                                  : 'border-border-pixel text-text-secondary hover:border-accent-green'
                              }`}
                            >
                              {set.completed ? '✓' : ''}
                            </motion.button>
                            {isPR && (
                              <motion.span
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="font-pixel text-accent-gold"
                                style={{ fontSize: '6px' }}
                              >
                                <E e="🏆" />PR
                              </motion.span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => addSet(exIdx)}
                className="min-h-11 px-2 font-pixel text-text-secondary hover:text-accent-gold transition-colors"
                style={{ fontSize: '8px' }}
              >
                + SET
              </button>
              {ex.sets.filter(s => s.completed).length > 0 && (
                <span className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}>
                  Volumen:{' '}
                  {ex.sets
                    .filter(s => s.completed)
                    .reduce(
                      (a, s) =>
                        a + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 1),
                      0,
                    )
                    .toLocaleString('es-CO')}
                  kg
                </span>
              )}
            </div>
          </PixelPanel>
        );
      })}

      <PixelButton
        variant="secondary"
        onClick={() => setShowExSearch(true)}
        className="w-full"
      >
        + AGREGAR EJERCICIO
      </PixelButton>

      <AnimatePresence>
        {showExSearch && (
          <ExerciseSearchModal
            onSelect={ex => {
              addExercise(ex);
              setShowExSearch(false);
            }}
            onClose={() => setShowExSearch(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GymPage() {
  const { addFloatingXP, triggerLevelUp } = useUIStore();
  const { updateUser, user } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToast();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [tab, setTab] = useState<GymTab>('history');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ws, rs] = await Promise.all([
        workoutService.fetchWorkouts(10),
        workoutService.fetchRoutines(),
      ]);
      setWorkouts(ws);
      setRoutines(rs);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      const w = await workoutService.createWorkout({ title: routine.name });
      const exercises = (routine.exercises as Array<{
        exerciseId: string;
        name: string;
        sets: number;
        reps?: number;
      }>).map(re => ({
        exerciseId: re.exerciseId,
        name: re.name,
        muscleGroup: undefined as string | undefined,
        sets: Array.from({ length: re.sets }, (_, i) => ({
          id: String(i + 1),
          weight: '',
          reps: re.reps ? String(re.reps) : '',
          completed: false,
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
    const duration = Math.round((Date.now() - aw.startTime) / 60000);
    const exercises = aw.exercises.map((ex, i) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets.map(s => ({
        weight: Number(s.weight) || 0,
        reps: Number(s.reps) || 0,
        completed: s.completed,
      })),
      order: i,
    }));

    try {
      const result = await workoutService.finishWorkout(aw.id, { duration, exercises });
      setActiveWorkout(null);
      updateUser(result.user as never);
      addFloatingXP(
        (result.rewards as { xpGained: number }).xpGained ?? 50,
        window.innerWidth / 2,
        200,
      );
      if ((result.rewards as { leveledUp: boolean }).leveledUp) {
        triggerLevelUp({
          oldLevel: (result.rewards as { oldLevel: number }).oldLevel,
          newLevel: (result.rewards as { newLevel: number }).newLevel,
          xpEarned: (result.rewards as { xpGained: number }).xpGained,
          goldEarned: (result.rewards as { goldGained: number }).goldGained,
          statIncreases: {},
        });
      }
      toast.success(
        '¡Entrenamiento completado!',
        `+${(result.rewards as { xpGained: number }).xpGained} XP`,
      );
      await load();
    } catch {
      toast.error('Error al finalizar entrenamiento');
    }
  }

  if (activeWorkout) {
    return (
      <div className="space-y-3">
        {/* Spotify quick-open */}
        {user?.gymPlaylistUrl && (
          <div className="flex items-center justify-between bg-bg-panel border border-accent-green/40 px-3 py-2">
            <p className="font-vt text-text-secondary text-base"><E e="🎵" /> Playlist de entrenamiento</p>
            <div className="flex gap-2">
              <a
                href={user.gymPlaylistUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-pixel text-accent-green border border-accent-green px-2 py-1 hover:bg-accent-green hover:text-bg-deep transition-colors"
                style={{ fontSize: '8px' }}
              >
                ▶ ABRIR SPOTIFY
              </a>
              <button
                onClick={() => navigate('/settings')}
                className="font-pixel text-text-muted hover:text-text-secondary"
                style={{ fontSize: '8px' }}
              >
                <E e="✏" />
              </button>
            </div>
          </div>
        )}
        {!user?.gymPlaylistUrl && (
          <div className="flex items-center justify-between bg-bg-panel border border-border-pixel px-3 py-2 opacity-60">
            <p className="font-pixel text-text-secondary" style={{ fontSize: '7px' }}><E e="🎵" /> Sin playlist configurada</p>
            <button
              onClick={() => navigate('/settings')}
              className="font-pixel text-accent-gold hover:text-text-primary"
              style={{ fontSize: '7px' }}
            >
              + CONFIGURAR →
            </button>
          </div>
        )}
        <ActiveWorkoutView
          workout={activeWorkout}
          onUpdate={setActiveWorkout}
          onFinish={finishWorkout}
        />
      </div>
    );
  }

  const featuredRoutine = routines[0];
  const latestWorkout = workouts[0];

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-sm)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent-gold)]/45 bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]">
              <E e="⚔" s={24} strokeWidth={1.7} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent-gold)]">Zona de entrenamiento</p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[var(--text-primary)]">El Coliseo</h1>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Forja tu cuerpo, héroe.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <SageContextButton
              message="¿Qué entreno hoy? Sugiere un workout basado en mi historial y los días que llevo sin entrenar."
              label="¿Qué entreno hoy?"
              className="col-span-2 min-h-11 w-full justify-center px-3.5 text-sm sm:w-auto"
            />
            <PixelButton variant="ghost" size="lg" onClick={() => setShowRestTimer(true)} className="w-full sm:w-auto">
              <E e="⏱" s={16} /> Descanso
            </PixelButton>
            <PixelButton variant="primary" size="lg" onClick={() => setShowStartModal(true)} className="w-full sm:w-auto">
              <E e="⚔" s={16} /> Iniciar
            </PixelButton>
          </div>
        </div>
      </section>

      <div
        role="tablist"
        aria-label="Secciones del Coliseo"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-2 sm:grid-cols-4"
      >
        {GYM_TABS.map(({ id, label, helper, icon }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              id={`gym-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`gym-panel-${id}`}
              onClick={() => setTab(id)}
              className={`flex min-h-14 min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-[border-color,background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-deep)] ${
                isActive
                  ? 'border-[var(--accent-gold)]/60 bg-[var(--accent-gold)]/12 text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                  : 'border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                isActive
                  ? 'border-[var(--accent-gold)]/45 bg-[var(--accent-gold)]/12 text-[var(--accent-gold)]'
                  : 'border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)]'
              }`}>
                <E e={icon} s={16} strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-4">{label}</span>
                <span className="mt-0.5 block truncate text-[11px] leading-4 text-[var(--text-muted)]">{helper}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div id={`gym-panel-${tab}`} role="tabpanel" aria-labelledby={`gym-tab-${tab}`}>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : tab === 'history' ? (
        workouts.length === 0 ? (
          <GymEmptySurface
            eyebrow="Tu primera sesión"
            title="El Coliseo está listo para ti"
            description="Registra ejercicios, pesos y repeticiones para convertir cada entrenamiento en progreso visible."
            icon="⚔"
            actionLabel="Iniciar entrenamiento"
            onAction={() => setShowStartModal(true)}
          />
        ) : (
          <div className="space-y-3">
            {latestWorkout && (
              <LifeQuestFlipCard
                eyebrow="Último entrenamiento"
                title={latestWorkout.title}
                description={`${new Date(latestWorkout.date).toLocaleDateString('es-CO', { weekday: 'long', month: 'long', day: 'numeric' })}${latestWorkout.duration ? ` · ${latestWorkout.duration} min` : ''}.`}
                visual={<span className="text-6xl" aria-hidden="true"><E e="🏋️" s={64} /></span>}
                visualLabel={`Último entrenamiento: ${latestWorkout.title}`}
                badge="Historial"
                frontFooter={<p className="text-xs font-semibold [color:var(--flip-accent)]">+{latestWorkout.xpEarned} XP · {latestWorkout.exercises?.length ?? 0} ejercicios</p>}
                backDescription={<p>Este registro ya no se repite abajo. Úsalo como referencia y abre una nueva sesión cuando quieras volver al Coliseo.</p>}
                metrics={[
                  { label: 'Duración', value: latestWorkout.duration ? `${latestWorkout.duration} min` : '—' },
                  { label: 'XP', value: `+${latestWorkout.xpEarned}` },
                  { label: 'Gold', value: `+${latestWorkout.goldEarned}` },
                ]}
                actionLabel="Iniciar entrenamiento"
                onAction={() => setShowStartModal(true)}
                accent="var(--accent-gold)"
              />
            )}
            <AnimatePresence>
              {workouts.slice(1).map((w, i) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <PixelPanel className="p-3 hover:border-accent-gold/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-vt text-text-primary text-xl">{w.title}</p>
                        <p
                          className="font-pixel text-text-secondary"
                          style={{ fontSize: '7px' }}
                        >
                          {new Date(w.date).toLocaleDateString('es-CO', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                          {w.duration ? ` · ${w.duration}min` : ''}
                          {' · '}
                          {w.exercises?.length ?? 0} ejercicios
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-vt text-accent-gold text-lg">+{w.xpEarned} XP</p>
                        <p className="font-vt text-accent-gold text-base">
                          +{w.goldEarned} <E e="🪙" />
                        </p>
                      </div>
                    </div>
                    {w.exercises?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {w.exercises.map((ex, idx) => (
                          <span
                            key={idx}
                            className="font-pixel text-text-secondary border border-border-pixel px-2 py-0.5"
                            style={{ fontSize: '7px' }}
                          >
                            {ex.exerciseName}
                          </span>
                        ))}
                      </div>
                    )}
                  </PixelPanel>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      ) : tab === 'routines' ? (
        // Routines tab
        <div className="space-y-3">
          {routines.length === 0 ? (
            <GymEmptySurface
              eyebrow="Rutinas"
              title="Aún no tienes una rutina guardada"
              description="Empieza una sesión libre y convierte tus ejercicios favoritos en una ruta fácil de repetir."
              icon="📋"
              actionLabel="Iniciar sesión libre"
              onAction={() => setShowStartModal(true)}
            />
          ) : (
            <>
              {featuredRoutine && (
                <LifeQuestFlipCard
                  eyebrow="Rutina preparada"
                  title={featuredRoutine.name}
                  description={featuredRoutine.description ?? 'Una secuencia lista para que empieces sin decidir cada ejercicio desde cero.'}
                  visual={<span className="text-6xl" aria-hidden="true"><E e="🏋️" s={64} /></span>}
                  visualLabel={`Rutina preparada: ${featuredRoutine.name}`}
                  badge="Rutina destacada"
                  frontFooter={<p className="text-xs font-semibold [color:var(--flip-accent)]">{(featuredRoutine.exercises as Array<unknown>).length} ejercicios preparados</p>}
                  backDescription={<p>Esta rutina sustituye su fila plana en la lista. Iníciala desde el reverso para cargar sus series en el entrenamiento activo.</p>}
                  metrics={[
                    { label: 'Ejercicios', value: (featuredRoutine.exercises as Array<unknown>).length },
                    { label: 'Duración', value: featuredRoutine.estimatedDuration ? `${featuredRoutine.estimatedDuration} min` : '—' },
                    { label: 'Rutinas', value: routines.length },
                  ]}
                  actionLabel="Iniciar rutina"
                  onAction={() => void startFromRoutine(featuredRoutine)}
                  accent="var(--accent-gold)"
                />
              )}
              {routines.slice(1).map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <PixelPanel className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-vt text-text-primary text-xl">{r.name}</p>
                      {r.description && (
                        <p
                          className="font-pixel text-text-secondary"
                          style={{ fontSize: '7px' }}
                        >
                          {r.description}
                        </p>
                      )}
                      <p
                        className="font-pixel text-text-muted mt-1"
                        style={{ fontSize: '7px' }}
                      >
                        {(r.exercises as { name: string }[])
                          .map(e => e.name)
                          .join(' · ')}
                      </p>
                    </div>
                    <PixelButton
                      variant="primary"
                      onClick={() => startFromRoutine(r)}
                      className="flex-shrink-0"
                    >
                      ▶ INICIAR
                    </PixelButton>
                  </div>
                  {r.estimatedDuration && (
                    <p
                      className="font-pixel text-text-secondary mt-2"
                      style={{ fontSize: '7px' }}
                    >
                      ~{r.estimatedDuration} min
                    </p>
                  )}
                </PixelPanel>
              </motion.div>
              ))}
            </>
          )}
        </div>
      ) : null}

      {tab === 'analytics' && (
        <div className="space-y-4">
          <BodyWeightTracker />
          <OneRMCalculator />
          <WeeklyVolumeWidget />
        </div>
      )}

      {tab === 'photos' && (
        <ProgressPhotos />
      )}
      </div>

      {/* Rest Timer Modal */}
      <AnimatePresence>
        {showRestTimer && <RestTimer onClose={() => setShowRestTimer(false)} />}
      </AnimatePresence>

      {/* Start workout modal */}
      <AnimatePresence>
        {showStartModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/70 p-0 md:items-center md:p-4"
            onClick={() => setShowStartModal(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="w-full max-w-sm space-y-4 rounded-t-2xl border-2 border-border-pixel bg-bg-panel p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:rounded-2xl md:p-5"
              onClick={e => e.stopPropagation()}
            >
              <p className="font-pixel text-accent-gold" style={{ fontSize: '10px' }}>
                NUEVO ENTRENAMIENTO
              </p>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && startWorkout()}
                placeholder="Nombre del entrenamiento..."
                autoFocus
                className="min-h-[44px] w-full bg-bg-deep border-2 border-border-pixel px-3 py-2 font-vt text-base text-text-primary outline-none focus:border-accent-gold"
              />
              <div className="flex gap-2">
                <PixelButton
                  variant="ghost"
                  onClick={() => setShowStartModal(false)}
                  className="min-h-[44px] flex-1"
                >
                  Cancelar
                </PixelButton>
                <PixelButton
                  variant="primary"
                  onClick={() => startWorkout()}
                  className="min-h-[44px] flex-1"
                  disabled={!newTitle.trim()}
                >
                  ¡Empezar!
                </PixelButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
