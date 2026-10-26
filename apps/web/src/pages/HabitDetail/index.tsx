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
import { useLoadingCopy } from '@/lib/loadingCopy';
import { resolveGlyph } from '@/components/ui/glyphs';
import { HabitFormDialog } from '@/components/habits/HabitFormDialog';
import * as habitService from '@/services/habit.service';
import type { Habit, HeatmapEntry } from '@/services/habit.service';
import { Lettering } from '@/components/layout/Lettering';
import { INTL_LOCALE, useLocale, type Copy, type Locale } from '@/lib/i18n';

const es = {
  dayLetters: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
  loading: 'Cargando tu hábito…',
  loadFailed: 'No pudimos cargar este hábito',
  notFound: 'Este hábito no existe',
  notFoundBody: 'Puede que lo hayas eliminado.',
  seeHabits: 'Ver mis hábitos',
  backToHabits: 'Volver a Hábitos',
  edit: 'Editar hábito',
  editBtn: 'Editar',
  deleteBtn: 'Eliminar',
  since: (date: string) => `desde el ${date}`,
  xpPerDay: (xp: number) => `+${xp} XP / día`,
  doneToday: 'Hecho hoy',
  restToday: 'Descanso hoy',
  undoToday: 'Desmarcar hoy',
  completeToday: 'Completar hoy',
  restDay: 'Día de descanso',
  stats: 'Estadísticas',
  streakDays: 'Días de racha',
  streak: 'Racha',
  completed: 'Completados',
  completedWindow: (n: number) => `Completados (${n} d)`,
  successRate: 'Tasa de éxito',
  success: 'Éxito',
  daysOf: (c: number, p: number) => `${c} de ${p} días`,
  last12: 'Últimas 12 semanas',
  heatLabel: (done: number) => `Mapa de calor: ${done} de 84 días completados en las últimas 12 semanas`,
  weekHistory: 'Historial semanal',
  vsPrev: (sign: string, n: number) => `${sign}${n}% vs. 4 semanas anteriores`,
  weekChart: (values: string) => `Días completados por semana: ${values}`,
  last7: 'Últimos 7 días',
  completedA: 'completado',
  unregistered: 'sin registrar',
  details: 'Detalles',
  frequency: 'Frecuencia',
  reminder: 'Recordatorio',
  noReminder: 'Sin recordatorio',
  bestStreak: 'Mejor racha',
  xpWindow: (n: number) => `XP (${n} días)`,
  coliseoNote: 'Cuenta como asistencia al Coliseo.',
  deleteQ: '¿Eliminar este hábito?',
  deleteLoss: (n: number) => `Perderás la racha de ${n} ${n === 1 ? 'día' : 'días'}. `,
  deleteBody: 'Dejará de aparecer en tus hábitos y en tu agenda.',
  cancel: 'Cancelar',
  deleted: (title: string) => `"${title}" eliminado`,
  deleteFailed: 'No se pudo eliminar el hábito',
  saved: 'Cambios guardados',
  frequencyWord: 'desde',
  lastWeekDays: 'días',
  dayWord: (n: number): string => (n === 1 ? 'día' : 'días'),
  statusCompleted: 'completado',
  statusUnrecorded: 'sin registrar',
  today: 'Hoy',
};

const en: typeof es = {
  dayLetters: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  loading: 'Loading your habit…',
  loadFailed: "We couldn't load this habit",
  notFound: 'This habit does not exist',
  notFoundBody: 'It may have been deleted.',
  seeHabits: 'See my habits',
  backToHabits: 'Back to Habits',
  edit: 'Edit habit',
  editBtn: 'Edit',
  deleteBtn: 'Delete',
  since: (date) => `since ${date}`,
  xpPerDay: (xp) => `+${xp} XP / day`,
  doneToday: 'Done today',
  restToday: 'Rest day today',
  undoToday: 'Undo today',
  completeToday: 'Complete today',
  restDay: 'Rest day',
  stats: 'Stats',
  streakDays: 'Streak days',
  streak: 'Streak',
  completed: 'Completed',
  completedWindow: (n) => `Completed (${n} d)`,
  successRate: 'Success rate',
  success: 'Success',
  daysOf: (c, p) => `${c} of ${p} days`,
  last12: 'Last 12 weeks',
  heatLabel: (done) => `Heat map: ${done} of 84 days completed in the last 12 weeks`,
  weekHistory: 'Weekly history',
  vsPrev: (sign, n) => `${sign}${n}% vs. the previous 4 weeks`,
  weekChart: (values) => `Days completed per week: ${values}`,
  last7: 'Last 7 days',
  completedA: 'completed',
  unregistered: 'not logged',
  details: 'Details',
  frequency: 'Frequency',
  reminder: 'Reminder',
  noReminder: 'No reminder',
  bestStreak: 'Best streak',
  xpWindow: (n) => `XP (${n} days)`,
  coliseoNote: 'Counts as Coliseum attendance.',
  deleteQ: 'Delete this habit?',
  deleteLoss: (n) => `You'll lose your ${n}-day streak. `,
  deleteBody: 'It will stop showing up in your habits and your agenda.',
  cancel: 'Cancel',
  deleted: (title) => `“${title}” deleted`,
  deleteFailed: "We couldn't delete the habit",
  saved: 'Changes saved',
  frequencyWord: 'since',
  lastWeekDays: 'days',
  dayWord: (n: number): string => (n === 1 ? 'day' : 'days'),
  statusCompleted: 'completed',
  statusUnrecorded: 'not logged',
  today: 'Today',
};

const COPY: Copy<typeof es> = { es, en };

const WINDOW_DAYS = 90;

function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/** ¿Tocaba hacer el hábito ese día según su frecuencia? */
function scheduled(h: Habit, d: Date) {
  return h.frequency?.type !== 'days_per_week' || h.frequency.days.length === 0 || h.frequency.days.includes(d.getDay());
}

function useStats(habit: Habit | null, entries: HeatmapEntry[], todayDone: boolean, locale: Locale, t: typeof es) {
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
      return { label: `S${i + 1}`, value: v, highlight: i === arr.length - 1, tip: locale === 'en' ? `${v} of 7 days` : `${v} de 7 días` };
    });
    const prev4 = weekly.slice(0, 4).reduce((s, b) => s + b.value, 0);
    const last4 = weekly.slice(4).reduce((s, b) => s + b.value, 0);
    const trend = prev4 ? Math.round(((last4 - prev4) / prev4) * 100) : null;

    // Últimos 7 días.
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      const key = dayKey(d);
      return { key, letter: t.dayLetters[d.getDay()], name: d.toLocaleDateString(INTL_LOCALE[locale], { weekday: 'long' }), done: Boolean(doneOn(key)) };
    });

    return { completed, possible, rate, weeks, heatDone, weekly, trend, last7, xp: completed * habit.xpReward };
  }, [habit, entries, todayDone, locale, t]);
}

export default function HabitDetailPage() {
  const locale = useLocale();
  const t = COPY[locale];
  const loadingCopy = useLoadingCopy();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [habit, setHabit] = useState<Habit | null>(null);
  const [entries, setEntries] = useState<HeatmapEntry[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'notfound' | 'ready'>('loading');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { complete, undo, pending, burst } = useHabitCompletion();
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
  const stats = useStats(habit, entries, todayDone, locale, t);

  async function log(status: 'completed' | 'skipped') {
    if (!habit) return;
    const result = await complete(habit, status);
    if (!result) return;
    setHabit((h) => h && { ...h, todayStatus: status, todayCompleted: status === 'completed', currentStreak: result.currentStreak, longestStreak: result.longestStreak });
  }

  async function toggleToday() {
    if (!habit) return;
    if (!todayDone) { await log('completed'); return; }
    const result = await undo(habit);
    if (!result?.undone) return;
    setHabit((h) => h && { ...h, todayStatus: result.log?.status ?? 'pending', todayCompleted: false, currentStreak: result.currentStreak, longestStreak: result.longestStreak });
    if (result.log) {
      const key = result.log.date.slice(0, 10);
      setEntries((prev) => prev.some((entry) => entry.date.slice(0, 10) === key)
        ? prev.map((entry) => entry.date.slice(0, 10) === key ? { ...entry, status: 'pending', completed: false } : entry)
        : [...prev, { date: key, status: 'pending', completed: false }]);
    }
  }

  async function handleDelete() {
    if (!habit) return;
    setDeleting(true);
    try {
      await habitService.archiveHabit(habit.id);
      useToastStore.getState().success(t.deleted(habit.title));
      navigate('/habits', { replace: true });
    } catch {
      useToastStore.getState().error(t.deleteFailed);
      setDeleting(false);
    }
  }

  async function handleEdit(payload: habitService.CreateHabitPayload) {
    if (!habit) return;
    const updated = await habitService.updateHabit(habit.id, payload);
    setHabit((h) => (h ? { ...h, ...updated } : updated));
    setEditing(false);
    useToastStore.getState().success(t.saved);
  }

  const back = (
    <div className="-ml-2 -mt-2 flex items-center justify-between md:hidden">
      <Link to="/habits" aria-label={t.backToHabits} className="flex size-11 items-center justify-center rounded-full text-on-surface hover:bg-surface-variant">
        <ArrowLeft aria-hidden className="size-6" strokeWidth={1.75} />
      </Link>
      {habit && (
        <Button variant="icon" aria-label={t.edit} onClick={() => setEditing(true)}>
          <Pencil aria-hidden className="size-5" strokeWidth={1.75} />
        </Button>
      )}
    </div>
  );

  if (state === 'loading') return <div className="flex flex-col gap-4">{back}<PageLoader label={t.loading} words={loadingCopy.habits} /></div>;
  if (state === 'error') return <div className="flex flex-col gap-4">{back}<ErrorState title={t.loadFailed} onRetry={() => void load()} /></div>;
  if (state === 'notfound' || !habit || !stats) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <EmptyState
          icon={SearchX}
          tone="muted"
          title={t.notFound}
          description={t.notFoundBody}
          action={<Link to="/habits" className="font-semibold text-primary-text underline-offset-2 hover:underline">{t.seeHabits}</Link>}
          className="py-16"
        />
      </div>
    );
  }

  const meta = categoryMeta(habit.category, locale);
  const Icon = resolveGlyph(habit.icon);
  const since = new Date(habit.createdAt).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'long' });
  const freq = frequencyLabel(habit.frequency, locale);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-6 md:gap-12">
      {back}

      {/* Hero */}
      <motion.section variants={item} className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-8">
        <span className="relative w-fit">
          <IconChip icon={Icon} tone={meta.tone} size="lg" className="md:size-28 md:rounded-[32px] md:[&>svg]:size-14 md:animate-float [.reduce-motion_&]:animate-none" />
        </span>
        <div className="flex min-w-0 flex-col gap-2 md:flex-[1_1_360px]">
          <span className="hidden text-label-lg text-primary-text md:block">{meta.label} · {freq.toLowerCase()} {t.since(since)}</span>
          <h1 className="text-display-sm md:text-display-lg"><Lettering text={habit.title} /></h1>
          <p className="text-body-md text-on-surface-light md:hidden">{freq} · {t.since(since)}</p>
          {habit.description && <p className="max-w-xl text-body-md text-on-surface">{habit.description}</p>}
          <div className="flex flex-wrap gap-2">
            <Badge variant={meta.tone} className="md:hidden">{meta.label}</Badge>
            <Badge variant="success" icon={Sparkles} size="lg">{t.xpPerDay(habit.xpReward)}</Badge>
            {todayDone && <Badge variant="success" icon={CheckCircle2} size="lg">{t.doneToday}</Badge>}
            {habit.todayStatus === 'skipped' && <Badge variant="neutral" icon={SkipForward} size="lg">{t.restToday}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {todayDone ? (
            <Button variant="secondary" onClick={() => void toggleToday()} loading={pending === habit.id}>
              <Check aria-hidden className="size-5" strokeWidth={2} />{t.undoToday}
            </Button>
          ) : !habit.todayStatus || habit.todayStatus === 'pending' ? (
            <>
              <Button onClick={() => void toggleToday()} loading={pending === habit.id}>
                <Check aria-hidden className="size-5" strokeWidth={2} />{t.completeToday}
              </Button>
              <Button variant="ghost" onClick={() => void log('skipped')} disabled={pending === habit.id}>{t.restDay}</Button>
            </>
          ) : null}
          <span className="hidden gap-3 md:flex">
            <Button variant="secondary" size="md" onClick={() => setEditing(true)}><Pencil aria-hidden className="size-4" strokeWidth={1.75} />{t.editBtn}</Button>
            <Button variant="danger" size="md" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />{t.deleteBtn}</Button>
          </span>
        </div>
      </motion.section>

      {/* KPIs */}
      <motion.section variants={item} aria-label={t.stats} className="grid grid-cols-3 gap-3 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] md:gap-6">
        <StatCard icon={Flame} tone="warning" value={habit.currentStreak} label={isDesktop ? t.streakDays : t.streak} size={isDesktop ? 'lg' : 'md'} className="max-md:p-3" />
        <StatCard icon={CheckCircle2} tone="success" value={stats.completed} label={isDesktop ? t.completedWindow(WINDOW_DAYS) : t.completed} size={isDesktop ? 'lg' : 'md'} className="max-md:p-3" />
        <Card padding="lg" interactive className="flex flex-col items-start gap-3 max-md:p-3 md:flex-row md:items-center md:gap-6">
          <ProgressRing value={stats.rate} tone="primary" size={72} stroke={8} label={t.successRate} valueText={`${stats.rate}%`} className="md:hidden">
            <span className="text-label-lg font-mono tabular-nums">{stats.rate}%</span>
          </ProgressRing>
          <ProgressRing value={stats.rate} tone="primary" size={96} stroke={10} label={t.successRate} valueText={`${stats.rate}%`} className="hidden md:flex">
            <span className="text-heading-sm font-mono tabular-nums">{stats.rate}%</span>
          </ProgressRing>
          <div>
            <div className="text-heading-sm max-md:text-body-sm max-md:text-on-surface-light">{t.success}</div>
            <div className="hidden text-body-sm text-on-surface-light font-mono tabular-nums md:block">{t.daysOf(stats.completed, stats.possible)}</div>
          </div>
        </Card>
      </motion.section>

      <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card as="section" padding="lg" className="flex flex-col gap-6" aria-labelledby="heat-title">
            <h2 id="heat-title" className="text-heading-md md:text-heading-lg">{t.last12}</h2>
            <Heatmap weeks={stats.weeks} label={t.heatLabel(stats.heatDone)} />
          </Card>
          <Card as="section" padding="lg" className="flex flex-col gap-6" aria-labelledby="hist-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="hist-title" className="text-heading-md md:text-heading-lg">{t.weekHistory}</h2>
              {stats.trend !== null && (
                <span className={cn('text-body-sm', stats.trend >= 0 ? 'text-success-text' : 'text-error-text')}>
                  {t.vsPrev(stats.trend >= 0 ? '+' : '', stats.trend)}
                </span>
              )}
            </div>
            <BarChart
              data={stats.weekly}
              label={t.weekChart(stats.weekly.map((w) => w.value).join(', '))}
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
              <h2 id="last7-title" className="text-heading-sm">{t.last7}</h2>
              <span className="text-body-sm text-on-surface-light font-mono tabular-nums">{stats.last7.filter((d) => d.done).length} / 7</span>
            </div>
            <ol className="grid grid-cols-7 gap-1">
              {stats.last7.map((d, i) => (
                <motion.li
                  key={d.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  aria-label={`${d.name}: ${d.done ? t.statusCompleted : t.statusUnrecorded}`}
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
            <h2 id="det-title" className="mb-2 text-heading-sm">{t.details}</h2>
            {[
              [t.frequency, freq],
              [t.reminder, habit.reminderTime || t.noReminder],
              [t.bestStreak, `${habit.longestStreak} ${t.dayWord(habit.longestStreak)}`],
              [t.xpWindow(WINDOW_DAYS), `${stats.xp.toLocaleString(INTL_LOCALE[locale])} XP`],
            ].map(([k, v], i, arr) => (
              <div key={k} className={cn('flex min-h-10 items-center justify-between gap-4', i < arr.length - 1 && 'border-b border-border')}>
                <span className="text-body-md text-on-surface-light">{k}</span>
                <span className={cn('text-label-lg font-mono tabular-nums', i === arr.length - 1 && 'text-primary-text')}>{v}</span>
              </div>
            ))}
            {habit.createsColiseoAttendance && <p className="mt-2 text-body-sm text-on-surface-light">{t.coliseoNote}</p>}
          </Card>
        </aside>
      </motion.div>

      <motion.section variants={item} className="grid grid-cols-2 gap-3 md:hidden">
        <Button variant="secondary" onClick={() => setEditing(true)}><Pencil aria-hidden className="size-4" strokeWidth={1.75} />{t.editBtn}</Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 aria-hidden className="size-4" strokeWidth={1.75} />{t.deleteBtn}</Button>
      </motion.section>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t.deleteQ} hideClose>
        <IconChip icon={Trash2} tone="error" className="-order-1" />
        <p className="text-body-md text-on-surface">
          {habit.currentStreak > 0 ? t.deleteLoss(habit.currentStreak) : ''}
          {t.deleteBody}
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" data-autofocus onClick={() => setConfirmDelete(false)}>{t.cancel}</Button>
          <Button size="md" className="bg-error-text text-background hover:bg-error-text hover:opacity-90" loading={deleting} onClick={() => void handleDelete()}>
            {t.deleteBtn}
          </Button>
        </div>
      </Modal>

      <HabitFormDialog open={editing} habit={habit} onClose={() => setEditing(false)} onSubmit={handleEdit} />
      {burst > 0 && <Confetti burst={burst} />}
    </motion.div>
  );
}
