// Hábitos — Habits.dc.html (móvil) / HabitsDesktop.dc.html (desktop).
// Zona ambientada: una libreta de registro. La lista es una hoja con margen y
// líneas; cada hábito se escribe en su línea, el check es una ficha 3D que encaja
// y la racha se lleva con marcas de conteo. Al lado, el tótem de racha (cristal 3D
// que crece con los días seguidos) y el resumen de la semana en una nota adhesiva.
// Completar el último hábito del día cierra la página con confeti.
// La libreta tiene tres separadores: Hábitos, Obstáculos (lo que quieres dejar) y
// Rituales (secuencias de pasos con modo guiado). Los dos últimos antes eran zonas
// aparte: /obstaculos y /rituals llegan aquí.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Flame, ListChecks, Plus, ShieldAlert, ShieldCheck, Sun } from 'lucide-react';
import { item, stagger, zoneExit } from '@/lib/motion';
import { dayKey, longDate } from '@/lib/lifeMeta';
import { useAuthStore } from '@/store/authStore';
import { useHabitCompletion } from '@/hooks/useHabitCompletion';
import { useToastStore } from '@/hooks/useToast';
import { Badge, BarChart, Button, Card, Confetti, EmptyState, ErrorState, IconChip, ProgressBar, ProgressRing, SegmentedControl, type BarDatum, PageLoader } from '@/components/ui/lq';
import { StreakTotemCard } from '@/components/habits/StreakTotemCard';
import { useLoadingCopy } from '@/lib/loadingCopy';
import { HabitNotebookRow } from '@/components/habits/HabitNotebookRow';
import { NotebookSheet, NotebookTabs, StickyNote } from '@/components/habits/NotebookSheet';
import { ObstacleFormDialog, ObstaclesSheet, obstaclePeriodsFor, type ObstaclePeriod } from '@/components/habits/ObstaclesSheet';
import { RitualsSheet } from '@/components/habits/RitualsSheet';
import * as ritualsService from '@/services/rituals.service';
import type { Ritual } from '@/services/rituals.service';
import { SketchUnderline, ZoneAmbience } from '@/components/ambience';
import { HabitFormDialog } from '@/components/habits/HabitFormDialog';
import { CycleHabitsHint } from '@/components/cycle/CycleHints';
import * as habitService from '@/services/habit.service';
import type { Habit } from '@/services/habit.service';
import * as antiHabits from '@/services/antiHabit.service';
import type { AntiHabit } from '@/services/antiHabit.service';
import { Lettering } from '@/components/layout/Lettering';
import { StreakRevival } from '@/components/habits/StreakRevival';
import { LiteNotice } from '@/components/billing/LiteNotice';
import { LITE_LIMITS, isProRequired } from '@/lib/plan';
import { usePlanStore } from '@/store/planStore';
import { INTL_LOCALE, useLocale, type Copy } from '@/lib/i18n';

const es = {
  filters: { all: 'Todos', active: 'Activos', done: 'Completados' } as Record<Filter, string>,
  filter: 'Filtro',
  habit: 'hábito',
  habits: 'hábitos',
  headline: 'Hábitos',
  intro: 'Pequeñas acciones y rituales, todos los días. Cada hábito completado suma XP a tu personaje.',
  doneToday: (done: number, total: number) => `de ${total} completados hoy`,
  doneOf: (done: number, total: number) => `${done} de ${total}`,
  ringLabel: 'Hábitos completados hoy',
  today: 'hoy',
  globalStreak: (n: number) => `Racha global ${n} días`,
  xpToday: (xp: number) => `+${xp} XP ganados hoy`,
  loadFailed: 'No pudimos cargar tus hábitos',
  savedNote: 'Tus hábitos siguen guardados.',
  noneYet: 'Sin hábitos aún',
  emptyBody: 'Tu aventura empieza con un hábito pequeño. Cada día completado te da XP.',
  newHabit: 'Nuevo hábito',
  nothingHere: 'Nada por aquí',
  notDoneYet: 'Aún no completas hábitos hoy.',
  allToday: '¡Completaste todo lo de hoy!',
  notebook: 'Tu libreta de hábitos',
  thisWeek: 'Esta semana',
  weekChart: (detail: string) => `Hábitos completados por día esta semana: ${detail}`,
  summary: (period: string) => `Resumen · ${period}`,
  resisted: 'Resistidas',
  falls: 'Caídas',
  triggerNote: 'Anota el detonante de cada obstáculo: saber qué te hace caer ayuda a esquivarlo.',
  ritualsTitle: 'Uno detrás de otro',
  ritualsBefore: 'Pulsa ',
  ritualsStart: 'Comenzar',
  ritualsAfter: ' y sigue cada paso con su cronómetro. Al terminar el último, el ritual suma su recompensa del día.',
  loadingHabits: 'Cargando tus hábitos…',
  pending: 'pendiente',
  of: 'de',
  sections: 'Secciones de la libreta',
  tabHabits: 'Hábitos',
  tabObstacles: 'Obstáculos',
  tabRituals: 'Rituales',
  ritualDone: 'Ritual completado',
  stepFailed: 'No se pudo marcar el paso',
  created: 'Hábito creado',
  createdHint: 'Complétalo hoy para empezar tu racha',
  liteOver: (max: number, n: number) => `NoutLife Lite admite ${max} hábitos activos. Tus ${n} hábitos siguen aquí; para crear más, pasa a Pro.`,
  liteCount: (n: number, max: number, atLimit: boolean) => `Tienes ${n} de ${max} hábitos activos de NoutLife Lite.${atLimit ? ' Con Pro, sin límite.' : ''}`,
  weekdays: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
};

const en: typeof es = {
  filters: { all: 'All', active: 'Active', done: 'Completed' },
  filter: 'Filter',
  habit: 'habit',
  habits: 'habits',
  headline: 'Habits',
  intro: 'Small actions and rituals, every day. Every habit you complete adds XP to your character.',
  doneToday: (done, total) => `of ${total} completed today`,
  doneOf: (done, total) => `${done} of ${total}`,
  ringLabel: 'Habits completed today',
  today: 'today',
  globalStreak: (n) => `Global streak ${n} days`,
  xpToday: (xp) => `+${xp} XP earned today`,
  loadFailed: "We couldn't load your habits",
  savedNote: 'Your habits are still saved.',
  noneYet: 'No habits yet',
  emptyBody: 'Your adventure starts with one small habit. Every completed day earns you XP.',
  newHabit: 'New habit',
  nothingHere: 'Nothing here',
  notDoneYet: "You haven't completed any habits today yet.",
  allToday: 'You completed everything for today!',
  notebook: 'Your habit notebook',
  thisWeek: 'This week',
  weekChart: (detail) => `Habits completed per day this week: ${detail}`,
  summary: (period) => `Summary · ${period}`,
  resisted: 'Resisted',
  falls: 'Slips',
  triggerNote: 'Note the trigger of each obstacle: knowing what makes you slip helps you avoid it.',
  ritualsTitle: 'One after another',
  ritualsBefore: 'Tap ',
  ritualsStart: 'Start',
  ritualsAfter: ' and follow each step with its timer. When you finish the last one, the ritual adds its reward for the day.',
  loadingHabits: 'Loading your habits…',
  pending: 'pending',
  of: 'of',
  sections: 'Notebook sections',
  tabHabits: 'Habits',
  tabObstacles: 'Obstacles',
  tabRituals: 'Rituals',
  ritualDone: 'Ritual completed',
  stepFailed: "Couldn't mark the step",
  created: 'Habit created',
  createdHint: 'Complete it today to start your streak',
  liteOver: (max, n) => `NoutLife Lite includes ${max} active habits. Your ${n} habits are still here; to create more, go Pro.`,
  liteCount: (n, max, atLimit) => `You have ${n} of ${max} active NoutLife Lite habits.${atLimit ? ' With Pro, no limit.' : ''}`,
  weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
};

const COPY: Copy<typeof es> = { es, en };

type Filter = 'all' | 'active' | 'done';
const FILTER_VALUES: Filter[] = ['all', 'active', 'done'];

type SheetId = 'habitos' | 'obstaculos' | 'rituales';
const sheetId = (s: SheetId) => `habits-sheet-${s}`;

const isDone = (h: Habit) => Boolean(h.todayCompleted) || h.todayStatus === 'completed';

/** Días de los últimos 7 (hoy al final) y de la semana actual (lunes→domingo). */
function useDays() {
  return useMemo(() => {
    const today = new Date();
    const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (6 - i)); return dayKey(d); });
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return dayKey(d); });
    return { todayKey: dayKey(today), last7, week };
  }, []);
}

export default function HabitsPage() {
  const locale = useLocale();
  const t = COPY[locale];
  const loadingCopy = useLoadingCopy();
  const user = useAuthStore((s) => s.user);
  const [habits, setHabits] = useState<Habit[]>([]);
  const habitsRef = useRef(habits);
  habitsRef.current = habits;
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [history, setHistory] = useState<Record<string, Set<string>>>({});
  const [form, setForm] = useState<{ open: boolean; habit: Habit | null }>({ open: false, habit: null });
  const [searchParams, setSearchParams] = useSearchParams();
  const { complete, undo, pending } = useHabitCompletion();
  /** Sube solo cuando se completa el último hábito del día (página cerrada). */
  const [dayDone, setDayDone] = useState(0);
  /** Hábito recién completado: el tótem de racha lo enfoca y celebra el día. */
  const [focusId, setFocusId] = useState<string | null>(null);
  const { todayKey, last7, week } = useDays();
  // NoutLife Lite: hasta 3 hábitos activos. Al llegar al tope, «Nuevo hábito» abre el diálogo de Pro.
  const lite = user?.subscription?.plan === 'lite';
  const atLiteLimit = lite && habits.length >= LITE_LIMITS.activeHabits;
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  const openNew = () => (atLiteLimit ? openUpgrade('habits') : setForm({ open: true, habit: null }));

  // Separador abierto (?tab=obstaculos | rituales): así los enlaces y las rutas antiguas llegan a su hoja.
  const tabParam = searchParams.get('tab');
  const sheet: SheetId = tabParam === 'obstaculos' || tabParam === 'rituales' ? tabParam : 'habitos';
  const openSheet = (next: SheetId) => setSearchParams((p) => {
    if (next === 'habitos') p.delete('tab'); else p.set('tab', next);
    return p;
  }, { replace: true });

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const data = await habitService.fetchHabits();
      setHabits(data);
      // Últimos 7 días por hábito (puntos semanales y gráfico "Esta semana").
      const entries = await Promise.all(
        data.map((h) => habitService.fetchHabitHeatmap(h.id, 7).then((e) => [h.id, e] as const).catch(() => [h.id, []] as const)),
      );
      setHistory(Object.fromEntries(entries.map(([id, e]) => [id, new Set(e.filter((x) => x.completed).map((x) => x.date.slice(0, 10)))])));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  // Espejo puede cambiar estos hábitos (rutinas de Higiene Personal): al volver a la pestaña se relee la lista.
  useEffect(() => {
    const onFocus = () => { void habitService.fetchHabits().then(setHabits).catch(() => null); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Obstáculos: se leen al entrar para que su separador muestre cuántos hay.
  const [obstacles, setObstacles] = useState<AntiHabit[]>([]);
  const [obstacleState, setObstacleState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [period, setPeriod] = useState<ObstaclePeriod>('week');
  const [obstacleForm, setObstacleForm] = useState<{ open: boolean; obstacle: AntiHabit | null }>({ open: false, obstacle: null });
  const loadObstacles = useCallback(async () => {
    try { setObstacles(await antiHabits.listAntiHabits()); setObstacleState('ready'); }
    catch { setObstacleState('error'); }
  }, []);
  useEffect(() => { void loadObstacles(); }, [loadObstacles]);

  // Rituales: igual, para el contador de su separador.
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [ritualState, setRitualState] = useState<'loading' | 'error' | 'ready'>('loading');
  const loadRituals = useCallback(async () => {
    try { setRituals(await ritualsService.listRituals()); setRitualState('ready'); }
    catch { setRitualState('error'); }
  }, []);
  useEffect(() => { void loadRituals(); }, [loadRituals]);

  // ?new=1 (FAB, Topbar, paleta): abre el formulario de nuevo hábito.
  useEffect(() => {
    if (searchParams.get('new') !== '1' || loading) return;
    openNew();
    setSearchParams((p) => { p.delete('new'); return p; }, { replace: true });
    // openNew solo depende de la lista ya cargada.
  }, [searchParams, setSearchParams, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleComplete(h: Habit) {
    const result = await complete(h);
    if (!result) return;
    // ¿Era el último pendiente del día? (lista más reciente, no la del render que lanzó el toque)
    const latest = habitsRef.current;
    if (latest.length && !latest.every(isDone) && latest.every((x) => x.id === h.id || isDone(x))) setDayDone((n) => n + 1);
    setFocusId(h.id);
    setHabits((prev) => prev.map((x) => (x.id === h.id
      ? { ...x, todayStatus: 'completed', todayCompleted: true, currentStreak: result.currentStreak, longestStreak: result.longestStreak }
      : x)));
    setHistory((prev) => ({ ...prev, [h.id]: new Set([...(prev[h.id] ?? []), todayKey]) }));
  }

  async function handleToggle(h: Habit) {
    if (!isDone(h)) {
      await handleComplete(h);
      return;
    }
    const result = await undo(h);
    if (!result) return;
    setHabits((prev) => prev.map((x) => (x.id === h.id
      ? { ...x, todayStatus: result.log?.status ?? null, todayCompleted: result.log?.completed ?? false, currentStreak: result.currentStreak, longestStreak: result.longestStreak }
      : x)));
    setHistory((prev) => {
      const days = new Set(prev[h.id] ?? []);
      days.delete(todayKey);
      return { ...prev, [h.id]: days };
    });
  }

  /** Marca un paso del ritual de hoy. Con todos los pasos, el ritual se completa y suma recompensa. */
  async function handleStep(h: Habit, stepId: string, completed: boolean) {
    try {
      const r = await habitService.toggleHabitStep(h.id, stepId, completed);
      setHabits((prev) => prev.map((x) => (x.id === h.id
        ? { ...x, todayStepIds: r.stepIds, todayCompleted: r.completed, todayStatus: r.completed ? 'completed' : x.todayStatus === 'completed' ? 'pending' : x.todayStatus }
        : x)));
      if (r.completed && !isDone(h)) useToastStore.getState().success(t.ritualDone, h.title);
      void habitService.fetchHabits().then(setHabits).catch(() => null);
    } catch {
      useToastStore.getState().error(t.stepFailed);
    }
  }

  /** Descanso de hoy (lo sugiere Ciclo): no suma XP ni rompe la racha. */
  async function handleRest(h: Habit) {
    await habitService.logHabit(h.id, 'skipped');
    setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, todayStatus: 'skipped' } : x)));
  }

  async function handleCreate(payload: habitService.CreateHabitPayload) {
    try {
      await habitService.createHabit(payload);
    } catch (error) {
      // Tope de Lite: se cierra el formulario y queda solo el diálogo de Pro (lo abre api.ts).
      if (isProRequired(error)) { setForm({ open: false, habit: null }); return; }
      throw error;
    }
    setForm({ open: false, habit: null });
    useToastStore.getState().success(t.created, t.createdHint);
    await load();
  }

  const doneCount = habits.filter(isDone).length;
  const total = habits.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  const xpToday = habits.filter(isDone).reduce((s, h) => s + h.xpReward, 0);
  const shown = habits.filter((h) => filter === 'all' || (filter === 'done' ? isDone(h) : !isDone(h)));

  const weekBars: BarDatum[] = week.map((key, i) => {
    const future = key > todayKey;
    const value = future ? 0 : habits.filter((h) => history[h.id]?.has(key) || (key === todayKey && isDone(h))).length;
    return { label: t.weekdays[i], value, highlight: key === todayKey, muted: future, tip: future ? `${t.weekdays[i]} · ${t.pending}` : `${value} ${t.of} ${total}` };
  });
  const elapsed = weekBars.filter((b) => !b.muted);
  const weekRate = total && elapsed.length ? Math.round((elapsed.reduce((s, b) => s + b.value, 0) / (total * elapsed.length)) * 100) : 0;

  const weekOf = (h: Habit) => last7.map((k) => Boolean(history[h.id]?.has(k)) || (k === todayKey && isDone(h)));

  const obstacleTotals = obstacles.reduce((acc, o) => ({ falls: acc.falls + o.metrics[period].falls, resisted: acc.resisted + o.metrics[period].resisted }), { falls: 0, resisted: 0 });
  const periodLabel = obstaclePeriodsFor(locale).find((p) => p.value === period)?.label.toLowerCase() ?? '';

  const header = (
    <motion.section variants={item} className="flex flex-wrap items-center justify-between gap-6 lg:gap-8">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1 md:gap-2">
        <span className="hidden text-label-lg text-primary-text md:block">{longDate(new Date(), locale)}</span>
        <h1 className="relative self-start text-display-sm md:text-display-md lg:text-display-lg">
          <Lettering text={t.headline} />
          <SketchUnderline className="absolute -bottom-1.5 left-0 w-full text-warning md:-bottom-2.5" delay={0.75} />
        </h1>
        <p className="hidden max-w-[520px] text-body-lg text-on-surface-light md:block">
          {t.intro}
        </p>
        {!loading && !failed && total > 0 && (
          <p className="text-body-md text-on-surface-light md:hidden" aria-live="polite">
            <span className="font-mono tabular-nums">{doneCount}</span> {t.doneToday(doneCount, total)}
          </p>
        )}
      </div>
      {!loading && !failed && total > 0 && (
        <div className="hidden items-center gap-6 md:flex">
          <ProgressRing value={pct} tone="success" size={132} stroke={12} label={t.ringLabel} valueText={t.doneOf(doneCount, total)}>
            <span className="text-heading-lg font-mono tabular-nums" aria-live="polite">{doneCount}/{total}</span>
            <span className="text-body-sm text-on-surface-light">{t.today}</span>
          </ProgressRing>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-label-lg text-warning-text">
              <Flame aria-hidden className="size-4" strokeWidth={1.75} />
              {t.globalStreak(user?.currentStreak ?? 0)}
            </span>
            <span className="text-body-sm text-on-surface-light font-mono tabular-nums">{t.xpToday(xpToday)}</span>
          </div>
        </div>
      )}
    </motion.section>
  );

  let habitsContent;
  if (loading) {
    habitsContent = <PageLoader size="sm" label={t.loadingHabits} words={loadingCopy.habits} />;
  } else if (failed) {
    habitsContent = <ErrorState title={t.loadFailed} description={t.savedNote} onRetry={() => void load()} />;
  } else if (total === 0) {
    habitsContent = (
      <EmptyState
        icon={ListChecks}
        title={t.noneYet}
        description={t.emptyBody}
        action={<Button onClick={openNew}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.newHabit}</Button>}
        className="py-16"
      />
    );
  } else if (shown.length === 0) {
    habitsContent = (
      <EmptyState
        icon={filter === 'done' ? CheckCircle2 : ListChecks}
        tone="muted"
        title={t.nothingHere}
        description={filter === 'done' ? t.notDoneYet : t.allToday}
        className="py-12"
      />
    );
  } else {
    habitsContent = (
      <motion.ul key={filter} variants={stagger} initial="initial" animate="animate" className="flex flex-col">
        {shown.map((h, i) => (
          <HabitNotebookRow
            key={h.id}
            index={i}
            habit={h}
            pending={pending === h.id}
            week={weekOf(h)}
            onComplete={() => void handleToggle(h)}
            onStep={(stepId, completed) => void handleStep(h, stepId, completed)}
          />
        ))}
      </motion.ul>
    );
  }

  const habitsSheet = (
    <NotebookSheet
      id={`${sheetId('habitos')}-panel`} labelledBy={`${sheetId('habitos')}-tab`} tabbed
      header={total > 0 ? (
        <>
          <SegmentedControl
            label={t.filter}
            value={filter}
            onChange={setFilter}
            options={FILTER_VALUES.map((value) => ({ value, label: t.filters[value] }))}
            className="w-full md:max-w-[420px]"
          />
          <span className="hidden text-body-sm text-on-surface-light md:block" aria-live="polite">
            {shown.length} {shown.length === 1 ? t.habit : t.habits}
          </span>
        </>
      ) : <span className="text-body-md text-on-surface-light">{t.notebook}</span>}
    >
      {habitsContent}
    </NotebookSheet>
  );

  const habitsAside = total > 0 && !loading && (
    <>
      <StreakTotemCard habits={habits} weekOf={weekOf} focusId={focusId} />
      <StickyNote tilt={-0.8} delay={0.35}>
        <Card as="section" padding="lg" className="flex flex-col gap-4" aria-labelledby="week-title">
          <div className="flex items-center justify-between">
            <h2 id="week-title" className="text-heading-sm">{t.thisWeek}</h2>
            <Badge variant="success">{weekRate}%</Badge>
          </div>
          <BarChart
            data={weekBars}
            label={t.weekChart(elapsed.map((b) => `${b.label} ${b.value}`).join(', '))}
            tone="primary"
            highlightTone="primary"
            max={Math.max(1, total)}
          />
        </Card>
      </StickyNote>
    </>
  );

  const obstaclesAside = obstacleState === 'ready' && obstacles.length > 0 && (
    <StickyNote tilt={-0.6} delay={0.2}>
      <Card as="section" padding="lg" className="flex flex-col gap-3" aria-labelledby="obstacles-summary">
        <h2 id="obstacles-summary" className="text-heading-sm">{t.summary(periodLabel)}</h2>
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <dt className="flex items-center gap-1.5 text-body-sm text-success-text"><ShieldCheck aria-hidden className="size-4" strokeWidth={1.75} />{t.resisted}</dt>
            <dd className="font-mono text-heading-lg tabular-nums">{obstacleTotals.resisted}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="flex items-center gap-1.5 text-body-sm text-error-text"><ShieldAlert aria-hidden className="size-4" strokeWidth={1.75} />{t.falls}</dt>
            <dd className="font-mono text-heading-lg tabular-nums">{obstacleTotals.falls}</dd>
          </div>
        </dl>
        <p className="text-body-sm text-on-surface-light">{t.triggerNote}</p>
      </Card>
    </StickyNote>
  );

  const ritualsAside = ritualState === 'ready' && rituals.length > 0 && (
    <StickyNote tilt={0.6} delay={0.2}>
      <Card as="section" padding="lg" className="flex flex-col gap-3" aria-labelledby="rituals-summary">
        <IconChip icon={Sun} tone="warning" />
        <h2 id="rituals-summary" className="text-heading-sm">{t.ritualsTitle}</h2>
        <p className="text-body-md text-on-surface">{t.ritualsBefore}<b>{t.ritualsStart}</b>{t.ritualsAfter}</p>
      </Card>
    </StickyNote>
  );

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" exit={zoneExit} className="relative">
      {/* Mesa de trabajo: una lámpara cálida muy tenue sobre la libreta */}
      <ZoneAmbience zone="habits">
        <span className="lq-amb-breathe absolute -left-[10%] -top-[8%] block h-[70vh] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-warning)/.07),transparent)] [--d:14s] [--hi:1] [--lo:.6] dark:bg-[radial-gradient(closest-side,rgb(var(--lq-jade-200)/.05),transparent)]" />
      </ZoneAmbience>
      <div className="relative flex flex-col gap-6 md:gap-12">
      {header}
      {lite && !loading && (
        <motion.div variants={item}>
          <LiteNotice feature="habits">
            {habits.length > LITE_LIMITS.activeHabits
              ? t.liteOver(LITE_LIMITS.activeHabits, habits.length)
              : t.liteCount(habits.length, LITE_LIMITS.activeHabits, atLiteLimit)}
          </LiteNotice>
        </motion.div>
      )}
      <StreakRevival scope="habits" onRevived={() => void load()} />
      {!loading && <CycleHabitsHint habits={habits} onRest={handleRest} />}
      <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {sheet === 'habitos' && total > 0 && !loading && <ProgressBar value={pct} tone="success" className="md:hidden" />}
          <div className="flex flex-col">
            <NotebookTabs
              label={t.sections} value={sheet} onChange={openSheet} idOf={sheetId}
              tabs={[
                { value: 'habitos', label: t.tabHabits, icon: CheckCircle2, count: loading ? undefined : total },
                { value: 'obstaculos', label: t.tabObstacles, icon: ShieldAlert, count: obstacleState === 'ready' ? obstacles.length : undefined },
                { value: 'rituales', label: t.tabRituals, icon: Sun, count: ritualState === 'ready' ? rituals.length : undefined },
              ]}
            />
            {sheet === 'habitos' ? habitsSheet : sheet === 'rituales' ? (
              <RitualsSheet
                list={rituals} state={ritualState} onReload={loadRituals}
                panelId={`${sheetId('rituales')}-panel`} labelledBy={`${sheetId('rituales')}-tab`}
              />
            ) : (
              <ObstaclesSheet
                list={obstacles} state={obstacleState} period={period} onPeriod={setPeriod} onReload={loadObstacles}
                onNew={() => setObstacleForm({ open: true, obstacle: null })}
                onEdit={(o) => setObstacleForm({ open: true, obstacle: o })}
                panelId={`${sheetId('obstaculos')}-panel`} labelledBy={`${sheetId('obstaculos')}-tab`}
              />
            )}
          </div>
        </div>
        <aside className="flex min-w-0 flex-col gap-8 pt-2 lg:pt-12">
          {sheet === 'habitos' ? habitsAside : sheet === 'obstaculos' ? obstaclesAside : ritualsAside}
        </aside>
      </motion.div>
      </div>
      {dayDone > 0 && <Confetti burst={dayDone} />}
      <HabitFormDialog
        open={form.open}
        habit={form.habit}
        onClose={() => setForm({ open: false, habit: null })}
        onSubmit={handleCreate}
      />
      <ObstacleFormDialog
        open={obstacleForm.open}
        obstacle={obstacleForm.obstacle}
        onClose={() => setObstacleForm({ open: false, obstacle: null })}
        onSaved={loadObstacles}
      />
    </motion.div>
  );
}
