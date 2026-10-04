// Hábitos — Habits.dc.html (móvil) / HabitsDesktop.dc.html (desktop).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Flame, ListChecks, Plus, Trophy } from 'lucide-react';
import { item, stagger } from '@/lib/motion';
import { dayKey, longDate } from '@/lib/lifeMeta';
import { useAuthStore } from '@/store/authStore';
import { useHabitCompletion } from '@/hooks/useHabitCompletion';
import { useToastStore } from '@/hooks/useToast';
import { Badge, BarChart, Button, Card, Confetti, EmptyState, ErrorState, IconChip, ProgressBar, ProgressRing, SegmentedControl, type BarDatum, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { HabitListItem } from '@/components/habits/HabitListItem';
import { HabitFormDialog } from '@/components/habits/HabitFormDialog';
import * as habitService from '@/services/habit.service';
import type { Habit } from '@/services/habit.service';

type Filter = 'all' | 'active' | 'done';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todos' }, { value: 'active', label: 'Activos' }, { value: 'done', label: 'Completados' },
];
const WEEK_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MILESTONES = [7, 14, 21, 30, 60, 100, 180, 365];

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

function HabitsSkeleton() {
  return <PageLoader label="Cargando tus hábitos…" words={LOADING_COPY.habits} />;
}

export default function HabitsPage() {
  const user = useAuthStore((s) => s.user);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [history, setHistory] = useState<Record<string, Set<string>>>({});
  const [form, setForm] = useState<{ open: boolean; habit: Habit | null }>({ open: false, habit: null });
  const [searchParams, setSearchParams] = useSearchParams();
  const { complete, pending, burst } = useHabitCompletion();
  const { todayKey, last7, week } = useDays();

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

  // ?new=1 (FAB, Topbar, paleta): abre el formulario de nuevo hábito.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setForm({ open: true, habit: null });
    setSearchParams((p) => { p.delete('new'); return p; }, { replace: true });
  }, [searchParams, setSearchParams]);

  async function handleComplete(h: Habit) {
    const result = await complete(h);
    if (!result) return;
    setHabits((prev) => prev.map((x) => (x.id === h.id
      ? { ...x, todayStatus: 'completed', todayCompleted: true, currentStreak: result.currentStreak, longestStreak: result.longestStreak }
      : x)));
    setHistory((prev) => ({ ...prev, [h.id]: new Set([...(prev[h.id] ?? []), todayKey]) }));
  }

  async function handleCreate(payload: habitService.CreateHabitPayload) {
    await habitService.createHabit(payload);
    setForm({ open: false, habit: null });
    useToastStore.getState().success('Hábito creado', 'Complétalo hoy para empezar tu racha');
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
    return { label: WEEK_LABELS[i], value, highlight: key === todayKey, muted: future, tip: future ? `${WEEK_LABELS[i]} · pendiente` : `${value} de ${total}` };
  });
  const elapsed = weekBars.filter((b) => !b.muted);
  const weekRate = total && elapsed.length ? Math.round((elapsed.reduce((s, b) => s + b.value, 0) / (total * elapsed.length)) * 100) : 0;

  const best = habits.reduce<Habit | null>((b, h) => (!b || h.currentStreak > b.currentStreak ? h : b), null);
  const nextMilestone = best ? MILESTONES.find((m) => m > best.currentStreak) ?? best.currentStreak + 30 : 0;

  const header = (
    <motion.section variants={item} className="flex flex-wrap items-center justify-between gap-6 lg:gap-8">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1 md:gap-2">
        <span className="hidden text-label-lg text-primary-text md:block">{longDate()}</span>
        <h1 className="text-display-sm md:text-display-md lg:text-display-lg">Hábitos</h1>
        <p className="hidden max-w-[520px] text-body-lg text-on-surface-light md:block">
          Pequeñas acciones, todos los días. Cada hábito completado suma XP a tu personaje.
        </p>
        {!loading && !failed && total > 0 && (
          <p className="text-body-md text-on-surface-light md:hidden" aria-live="polite">
            <span className="tabular-nums">{doneCount}</span> de {total} completados hoy
          </p>
        )}
      </div>
      {!loading && !failed && total > 0 && (
        <div className="hidden items-center gap-6 md:flex">
          <ProgressRing value={pct} tone="success" size={132} stroke={12} label="Hábitos completados hoy" valueText={`${doneCount} de ${total}`}>
            <span className="text-heading-lg tabular-nums" aria-live="polite">{doneCount}/{total}</span>
            <span className="text-body-sm text-on-surface-light">hoy</span>
          </ProgressRing>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-label-lg text-warning-text">
              <Flame aria-hidden className="size-4" strokeWidth={1.75} />
              Racha global {user?.currentStreak ?? 0} días
            </span>
            <span className="text-body-sm text-on-surface-light tabular-nums">+{xpToday} XP ganados hoy</span>
          </div>
        </div>
      )}
    </motion.section>
  );

  let body;
  if (loading) {
    body = <HabitsSkeleton />;
  } else if (failed) {
    body = <ErrorState title="No pudimos cargar tus hábitos" description="Tus hábitos siguen guardados." onRetry={() => void load()} />;
  } else if (total === 0) {
    body = (
      <EmptyState
        icon={ListChecks}
        title="Sin hábitos aún"
        description="Tu aventura empieza con un hábito pequeño. Cada día completado te da XP."
        action={<Button onClick={() => setForm({ open: true, habit: null })}><Plus aria-hidden className="size-4" strokeWidth={2} />Nuevo hábito</Button>}
        className="py-16"
      />
    );
  } else {
    body = (
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <section aria-label="Lista de hábitos" className="flex min-w-0 flex-col gap-4 md:gap-6">
          <ProgressBar value={pct} tone="success" className="md:hidden" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SegmentedControl label="Filtro" value={filter} onChange={setFilter} options={FILTERS} className="w-full md:max-w-[420px]" />
            <span className="hidden text-body-sm text-on-surface-light md:block" aria-live="polite">
              {shown.length} {shown.length === 1 ? 'hábito' : 'hábitos'}
            </span>
          </div>
          {shown.length > 0 ? (
            <motion.ul key={filter} variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3">
              {shown.map((h) => (
                <HabitListItem
                  key={h.id}
                  habit={h}
                  pending={pending === h.id}
                  week={last7.map((k) => history[h.id]?.has(k) || (k === todayKey && isDone(h)))}
                  onComplete={() => void handleComplete(h)}
                />
              ))}
            </motion.ul>
          ) : (
            <EmptyState
              icon={filter === 'done' ? CheckCircle2 : ListChecks}
              tone="muted"
              title="Nada por aquí"
              description={filter === 'done' ? 'Aún no completas hábitos hoy.' : '¡Completaste todo lo de hoy!'}
              className="py-12"
            />
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6">
          <Card as="section" padding="lg" className="flex flex-col gap-4" aria-labelledby="week-title">
            <div className="flex items-center justify-between">
              <h2 id="week-title" className="text-heading-sm">Esta semana</h2>
              <Badge variant="success">{weekRate}%</Badge>
            </div>
            <BarChart
              data={weekBars}
              label={`Hábitos completados por día esta semana: ${elapsed.map((b) => `${b.label} ${b.value}`).join(', ')}`}
              tone="primary"
              highlightTone="primary"
              max={Math.max(1, total)}
            />
          </Card>
          {best && best.currentStreak > 0 && (
            <Card as="section" padding="lg" className="flex flex-col gap-3">
              <IconChip icon={Trophy} tone="warning" className="animate-float motion-reduce:animate-none" />
              <h2 className="text-heading-sm">Mejor racha</h2>
              <p className="text-body-md text-on-surface">
                <b>{best.title}</b> lleva {best.currentStreak} {best.currentStreak === 1 ? 'día' : 'días'}. {nextMilestone - best.currentStreak} más para llegar a {nextMilestone}.
              </p>
              <ProgressBar
                value={(best.currentStreak / nextMilestone) * 100}
                tone="warning"
                shine
                label={`Progreso hacia ${nextMilestone} días`}
                valueText={`${best.currentStreak} de ${nextMilestone} días`}
              />
            </Card>
          )}
        </aside>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-12">
      {header}
      <motion.div variants={item}>{body}</motion.div>
      {burst > 0 && <Confetti burst={burst} />}
      <HabitFormDialog
        open={form.open}
        habit={form.habit}
        onClose={() => setForm({ open: false, habit: null })}
        onSubmit={handleCreate}
      />
    </motion.div>
  );
}
