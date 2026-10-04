// Detalle de hábito — HabitDetail.dc.html / HabitDetailDesktop.dc.html.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Flame, Minus, Pencil, SearchX, SkipForward, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { categoryMeta, dayKey, frequencyLabel } from '@/lib/lifeMeta';
import { usePageCrumb } from '@/store/shellStore';
import { useHabitCompletion } from '@/hooks/useHabitCompletion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useToastStore } from '@/hooks/useToast';
import { Badge, BarChart, Button, Card, Confetti, EmptyState, ErrorState, Heatmap, IconChip, Modal, ProgressRing, StatCard, type BarDatum, type HeatLevel, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { resolveGlyph } from '@/components/ui/glyphs';
import { HabitFormDialog } from '@/components/habits/HabitFormDialog';
import * as habitService from '@/services/habit.service';
import type { Habit, HeatmapEntry } from '@/services/habit.service';

const WINDOW_DAYS = 90;
const DAY_LETTERS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/** ¿Tocaba hacer el hábito ese día según su frecuencia? */
function scheduled(h: Habit, d: Date) {
  return h.frequency?.type !== 'days_per_week' || h.frequency.days.length === 0 || h.frequency.days.includes(d.getDay());
}

function useStats(habit: Habit | null, entries: HeatmapEntry[], todayDone: boolean) {
  return useMemo(() => {
    if (!habit) return null;
    const today = new Date();
    const todayKey = dayKey(today);
    const byDay = new Map(entries.map((e) => [e.date.slice(0, 10), e]));
    const doneOn = (key: string) => byDay.get(key)?.completed || (key === todayKey && todayDone);
    const created = new Date(habit.createdAt);

    // Ventana para éxito: desde la creación (o 90 días) hasta hoy, solo días programados.
    let possible = 0;
    let completed = 0;
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const d = addDays(today, -i);
      if (d < new Date(created.getFullYear(), created.getMonth(), created.getDate())) break;
      const key = dayKey(d);
      if (doneOn(key)) completed++;
      if (scheduled(habit, d)) possible++;
    }
    const rate = possible ? Math.min(100, Math.round((completed / possible) * 100)) : 0;

    // Heatmap 12 semanas (lunes→domingo), la última es la semana actual.
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    const start = addDays(monday, -7 * 11);
    const weeks: HeatLevel[][] = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => {
      const day = addDays(start, w * 7 + d);
      const key = dayKey(day);
      if (day > today) return 0;
      if (doneOn(key)) return 2;
      const status = byDay.get(key)?.status;
      return status === 'skipped' ? 1 : 0;
    }));
    const heatDone = weeks.flat().filter((l) => l === 2).length;

    // Historial: días completados por semana, últimas 8 semanas.
    const weekly: BarDatum[] = weeks.slice(-8).map((wk, i, arr) => {
      const v = wk.filter((l) => l === 2).length;
      return { label: `S${i + 1}`, value: v, highlight: i === arr.length - 1, tip: `${v} de 7 días` };
    });
    const prev4 = weekly.slice(0, 4).reduce((s, b) => s + b.value, 0);
    const last4 = weekly.slice(4).reduce((s, b) => s + b.value, 0);
    const trend = prev4 ? Math.round(((last4 - prev4) / prev4) * 100) : null;

    // Últimos 7 días.
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      const key = dayKey(d);
      return { key, letter: DAY_LETTERS[d.getDay()], name: d.toLocaleDateString('es-ES', { weekday: 'long' }), done: Boolean(doneOn(key)) };
    });

    return { completed, possible, rate, weeks, heatDone, weekly, trend, last7, xp: completed * habit.xpReward };
  }, [habit, entries, todayDone]);
}

function DetailSkeleton() {
  return <PageLoader label="Cargando tu hábito…" words={LOADING_COPY.habits} />;
}

export default function HabitDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [entries, setEntries] = useState<HeatmapEntry[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'notfound' | 'ready'>('loading');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { complete, pending, burst } = useHabitCompletion();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  usePageCrumb(habit?.title);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [h, heat] = await Promise.all([
        habitService.fetchHabit(id),
        habitService.fetchHabitHeatmap(id, WINDOW_DAYS).catch(() => [] as HeatmapEntry[]),
      ]);
      setHabit(h);
      setEntries(heat);
      setState('ready');
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setState(status === 404 ? 'notfound' : 'error');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const todayDone = Boolean(habit?.todayCompleted) || habit?.todayStatus === 'completed';
  const stats = useStats(habit, entries, todayDone);

  async function log(status: 'completed' | 'skipped') {
    if (!habit) return;
    const result = await complete(habit, status);
    if (!result) return;
    setHabit((h) => h && { ...h, todayStatus: status, todayCompleted: status === 'completed', currentStreak: result.currentStreak, longestStreak: result.longestStreak });
  }

  async function handleDelete() {
    if (!habit) return;
    setDeleting(true);
    try {
      await habitService.archiveHabit(habit.id);
      useToastStore.getState().success(`"${habit.title}" eliminado`);
      navigate('/habits', { replace: true });
    } catch {
      useToastStore.getState().error('No se pudo eliminar el hábito');
      setDeleting(false);
    }
  }

  async function handleEdit(payload: habitService.CreateHabitPayload) {
    if (!habit) return;
    const updated = await habitService.updateHabit(habit.id, payload);
    setHabit((h) => (h ? { ...h, ...updated } : updated));
    setEditing(false);
    useToastStore.getState().success('Cambios guardados');
  }

  const back = (
    <div className="-ml-2 -mt-2 flex items-center justify-between md:hidden">
      <Link to="/habits" aria-label="Volver a Hábitos" className="flex size-11 items-center justify-center rounded-full text-on-surface hover:bg-surface-variant">
        <ArrowLeft aria-hidden className="size-6" strokeWidth={1.75} />
      </Link>
      {habit && (
        <Button variant="icon" aria-label="Editar hábito" onClick={() => setEditing(true)}>
          <Pencil aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      )}
    </div>
  );

  if (state === 'loading') return <div className="flex flex-col gap-4">{back}<DetailSkeleton /></div>;
  if (state === 'error') return <div className="flex flex-col gap-4">{back}<ErrorState title="No pudimos cargar este hábito" onRetry={() => void load()} /></div>;
  if (state === 'notfound' || !habit || !stats) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <EmptyState
          icon={SearchX}
          tone="muted"
          title="Este hábito no existe"
          description="Puede que lo hayas eliminado."
          action={<Link to="/habits" className="font-semibold text-primary-text underline-offset-2 hover:underline">Ver mis hábitos</Link>}
          className="py-16"
        />
      </div>
    );
  }

  const meta = categoryMeta(habit.category);
  const Icon = resolveGlyph(habit.icon);
  const since = new Date(habit.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  const freq = frequencyLabel(habit.frequency);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-12">
      {back}

      {/* Hero */}
      <motion.section variants={item} className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-8">
        <span className="relative w-fit">
          <IconChip icon={Icon} tone={meta.tone} size="lg" className="md:size-28 md:rounded-[32px] md:[&>svg]:size-14 md:animate-float motion-reduce:animate-none" />
        </span>
        <div className="flex min-w-0 flex-col gap-2 md:flex-[1_1_360px]">
          <span className="hidden text-label-lg text-primary-text md:block">{meta.label} · {freq.toLowerCase()} desde el {since}</span>
          <h1 className="text-display-sm md:text-display-lg">{habit.title}</h1>
          <p className="text-body-md text-on-surface-light md:hidden">{freq} · desde el {since}</p>
          {habit.description && <p className="max-w-xl text-body-md text-on-surface">{habit.description}</p>}
          <div className="flex flex-wrap gap-2">
            <Badge variant={meta.tone} className="md:hidden">{meta.label}</Badge>
            <Badge variant="success" icon={Sparkles} size="lg">+{habit.xpReward} XP / día</Badge>
            {todayDone && <Badge variant="success" icon={CheckCircle2} size="lg">Hecho hoy</Badge>}
            {habit.todayStatus === 'skipped' && <Badge variant="neutral" icon={SkipForward} size="lg">Omitido hoy</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {!habit.todayStatus && (
            <>
              <Button onClick={() => void log('completed')} loading={pending === habit.id}>
                <Check aria-hidden className="size-5" strokeWidth={2} />Completar hoy
              </Button>
              <Button variant="ghost" onClick={() => void log('skipped')} disabled={pending === habit.id}>Omitir hoy</Button>
            </>
          )}
          <span className="hidden gap-3 md:flex">
            <Button variant="secondary" size="md" onClick={() => setEditing(true)}><Pencil aria-hidden className="size-4" strokeWidth={1.75} />Editar</Button>
            <Button variant="danger" size="md" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />Eliminar</Button>
          </span>
        </div>
      </motion.section>

      {/* KPIs */}
      <motion.section variants={item} aria-label="Estadísticas" className="grid grid-cols-3 gap-3 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] md:gap-6">
        <StatCard icon={Flame} tone="warning" value={habit.currentStreak} label={isDesktop ? 'Días de racha' : 'Racha'} size={isDesktop ? 'lg' : 'md'} className="max-md:p-3" />
        <StatCard icon={CheckCircle2} tone="success" value={stats.completed} label={isDesktop ? `Completados (${WINDOW_DAYS} d)` : 'Completados'} size={isDesktop ? 'lg' : 'md'} className="max-md:p-3" />
        <Card padding="lg" interactive className="flex flex-col items-start gap-3 max-md:p-3 md:flex-row md:items-center md:gap-6">
          <ProgressRing value={stats.rate} tone="primary" size={72} stroke={8} label="Tasa de éxito" valueText={`${stats.rate}%`} className="md:hidden">
            <span className="text-label-lg tabular-nums">{stats.rate}%</span>
          </ProgressRing>
          <ProgressRing value={stats.rate} tone="primary" size={96} stroke={10} label="Tasa de éxito" valueText={`${stats.rate}%`} className="hidden md:flex">
            <span className="text-heading-sm tabular-nums">{stats.rate}%</span>
          </ProgressRing>
          <div>
            <div className="text-heading-sm max-md:text-body-sm max-md:text-on-surface-light">Éxito</div>
            <div className="hidden text-body-sm text-on-surface-light tabular-nums md:block">{stats.completed} de {stats.possible} días</div>
          </div>
        </Card>
      </motion.section>

      <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card as="section" padding="lg" className="flex flex-col gap-6" aria-labelledby="heat-title">
            <h2 id="heat-title" className="text-heading-md md:text-heading-lg">Últimas 12 semanas</h2>
            <Heatmap weeks={stats.weeks} label={`Mapa de calor: ${stats.heatDone} de 84 días completados en las últimas 12 semanas`} />
          </Card>
          <Card as="section" padding="lg" className="flex flex-col gap-6" aria-labelledby="hist-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="hist-title" className="text-heading-md md:text-heading-lg">Historial semanal</h2>
              {stats.trend !== null && (
                <span className={cn('text-body-sm', stats.trend >= 0 ? 'text-success-text' : 'text-error-text')}>
                  {stats.trend >= 0 ? '+' : ''}{stats.trend}% vs. 4 semanas anteriores
                </span>
              )}
            </div>
            <BarChart
              data={stats.weekly}
              label={`Días completados por semana: ${stats.weekly.map((w) => w.value).join(', ')}`}
              tone="primary"
              highlightTone="primary"
              max={7}
              height={200}
              showValues
            />
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Card as="section" padding="lg" className="flex flex-col gap-4" aria-labelledby="last7-title">
            <div className="flex items-center justify-between">
              <h2 id="last7-title" className="text-heading-sm">Últimos 7 días</h2>
              <span className="text-body-sm text-on-surface-light tabular-nums">{stats.last7.filter((d) => d.done).length} / 7</span>
            </div>
            <ol className="grid grid-cols-7 gap-1">
              {stats.last7.map((d, i) => (
                <motion.li
                  key={d.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  aria-label={`${d.name}: ${d.done ? 'completado' : 'sin registrar'}`}
                  className="flex flex-col items-center gap-2"
                >
                  <span aria-hidden className="text-label-md text-on-surface-light">{d.letter}</span>
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full sm:size-10',
                      d.done ? 'bg-success text-on-primary' : 'border border-border bg-surface-variant text-on-surface-light',
                    )}
                  >
                    {d.done ? <Check className="size-5" strokeWidth={2.25} /> : <Minus className="size-4" strokeWidth={2} />}
                  </span>
                </motion.li>
              ))}
            </ol>
          </Card>
          <Card as="section" padding="lg" className="flex flex-col gap-1" aria-labelledby="det-title">
            <h2 id="det-title" className="mb-2 text-heading-sm">Detalles</h2>
            {[
              ['Frecuencia', freq],
              ['Recordatorio', habit.reminderTime || 'Sin recordatorio'],
              ['Mejor racha', `${habit.longestStreak} ${habit.longestStreak === 1 ? 'día' : 'días'}`],
              [`XP (${WINDOW_DAYS} días)`, `${stats.xp.toLocaleString('es-CO')} XP`],
            ].map(([k, v], i, arr) => (
              <div key={k} className={cn('flex min-h-10 items-center justify-between gap-4', i < arr.length - 1 && 'border-b border-border')}>
                <span className="text-body-md text-on-surface-light">{k}</span>
                <span className={cn('text-label-lg tabular-nums', i === arr.length - 1 && 'text-primary-text')}>{v}</span>
              </div>
            ))}
            {habit.createsGymAttendance && <p className="mt-2 text-body-sm text-on-surface-light">Cuenta como asistencia al gimnasio.</p>}
          </Card>
        </aside>
      </motion.div>

      <motion.section variants={item} className="grid grid-cols-2 gap-3 md:hidden">
        <Button variant="secondary" onClick={() => setEditing(true)}><Pencil aria-hidden className="size-4" strokeWidth={1.75} />Editar</Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />Eliminar</Button>
      </motion.section>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="¿Eliminar este hábito?" hideClose>
        <IconChip icon={Trash2} tone="error" className="-order-1" />
        <p className="text-body-md text-on-surface">
          {habit.currentStreak > 0 ? `Perderás la racha de ${habit.currentStreak} ${habit.currentStreak === 1 ? 'día' : 'días'}. ` : ''}
          Dejará de aparecer en tus hábitos y en tu agenda.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" data-autofocus onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          <Button size="md" className="bg-error-text text-background hover:bg-error-text hover:opacity-90" loading={deleting} onClick={() => void handleDelete()}>
            Eliminar
          </Button>
        </div>
      </Modal>

      <HabitFormDialog open={editing} habit={habit} onClose={() => setEditing(false)} onSubmit={handleEdit} />
      {burst > 0 && <Confetti burst={burst} />}
    </motion.div>
  );
}
