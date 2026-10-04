import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Coins, Flag, MinusCircle, Repeat, XCircle, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { BarChart, Card, EmptyState, ErrorState, PageLoader, ProgressBar, SegmentedControl, StatCard } from '@/components/ui/lq';
import { fetchDayDetail, fetchHistory } from '@/services/history.service';
import type { DayDetail, HistorySummary } from '@/services/history.service';
import { item, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';

type View = 'calendar' | 'charts';

const VIEWS = [
  { value: 'calendar' as const, label: 'Calendario' },
  { value: 'charts' as const, label: 'Gráficas' },
];

const CATEGORY_LABELS: Record<string, string> = {
  FITNESS: 'Fitness', HEALTH: 'Salud', FINANCE: 'Finanzas', LEARNING: 'Aprendizaje',
  LOVE: 'Amor', SOCIAL: 'Social', PERSONAL: 'Personal', CREATIVE: 'Creativo',
};

// Intensidad del día: jade al 15 / 45 / 100 % según la productividad.
const LEVELS = [
  { min: 70, cls: 'bg-primary text-on-primary', label: 'Excelente' },
  { min: 40, cls: 'bg-primary/45 text-on-background', label: 'Bien' },
  { min: 1, cls: 'bg-primary/15 text-on-background', label: 'Poco' },
  { min: 0, cls: 'bg-surface-variant text-on-surface-light', label: 'Sin actividad' },
];
const levelOf = (score: number) => LEVELS.find((l) => score >= l.min) ?? LEVELS[3];

const isoDay = (d: Date) => d.toISOString().split('T')[0];

export default function HistoryPage() {
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [view, setView] = useState<View>('calendar');

  const load = useCallback(() => {
    setState('loading');
    const to = isoDay(new Date());
    const from = isoDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    fetchHistory(from, to)
      .then((s) => { setSummary(s); setState('ready'); })
      .catch(() => setState('error'));
  }, []);

  useEffect(load, [load]);

  async function handleDayClick(date: string, score: number) {
    if (score === 0) return;
    setSelectedDay(date);
    setDayDetail(await fetchDayDetail(date).catch(() => null));
  }

  if (state === 'loading') return <PageLoader label="Cargando tu historial" />;
  if (state === 'error') return <ErrorState onRetry={load} />;

  const today = new Date();
  const todayIso = isoDay(today);
  const calendarDays = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (29 - i));
    return isoDay(date);
  });
  const days = summary?.days ?? [];
  const cats = summary?.categoryDistribution ?? [];
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const xpData = days.map((d) => ({ label: d.date.slice(8), value: d.xpGained, tip: `${d.date.slice(5)} · +${d.xpGained} XP` }));
  const catTotal = cats.reduce((s, c) => s + c.count, 0);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <PageHeader
        eyebrow="Historial"
        title="Tus últimos 30 días"
        description="Cada día, lo que completaste y lo que ganaste."
        aside={<div className="w-full max-w-[320px] sm:w-[300px]"><SegmentedControl label="Vista" value={view} onChange={setView} options={VIEWS} /></div>}
      />

      {summary && (
        <motion.ul variants={stagger} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <motion.li variants={item}><StatCard icon={Zap} tone="secondary" value={summary.totalXp} label="XP ganada" /></motion.li>
          <motion.li variants={item}><StatCard icon={Flag} tone="forest" value={summary.totalQuestsCompleted} label="Misiones" /></motion.li>
          <motion.li variants={item}><StatCard icon={Repeat} tone="primary" value={summary.totalHabitsCompleted} label="Hábitos" /></motion.li>
          <motion.li variants={item}><StatCard icon={Coins} tone="secondary" value={summary.totalGold} label="Oro" /></motion.li>
        </motion.ul>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {view === 'calendar' ? (
            <Card padding="lg" className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-heading-md">Actividad diaria</h2>
                <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Leyenda">
                  {LEVELS.map((l) => (
                    <li key={l.label} className="flex items-center gap-1.5 text-body-sm text-on-surface-light">
                      <span aria-hidden className={cn('size-3 rounded-sm', l.cls)} />{l.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {calendarDays.map((date, i) => {
                  const day = dayMap.get(date);
                  const score = day?.productivityScore ?? 0;
                  const lvl = levelOf(score);
                  const selected = date === selectedDay;
                  return (
                    <motion.button
                      key={date}
                      type="button"
                      onClick={() => void handleDayClick(date, score)}
                      disabled={score === 0}
                      aria-pressed={selected}
                      aria-label={`${new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' })}: ${day ? `${score} puntos, ${day.questsCompleted} misiones, ${day.habitsCompleted} hábitos` : 'sin actividad'}`}
                      initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 24, delay: i * 0.012 }}
                      whileHover={score ? { y: -2 } : undefined} whileTap={score ? { scale: 0.94 } : undefined}
                      className={cn(
                        'flex aspect-square min-h-11 items-center justify-center rounded-md font-mono text-label-lg tabular-nums transition-shadow disabled:cursor-default',
                        lvl.cls,
                        date === todayIso && 'ring-2 ring-primary-text ring-offset-2 ring-offset-surface',
                        selected && 'shadow-md ring-2 ring-on-background ring-offset-2 ring-offset-surface',
                      )}
                    >
                      {new Date(date).getUTCDate()}
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence>
                {selectedDay && dayDetail && (
                  <motion.section
                    key={selectedDay}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col gap-4 border-t border-border pt-5"
                    aria-live="polite"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="text-heading-sm first-letter:uppercase">
                        {new Date(selectedDay).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
                      </h3>
                      <span className="flex gap-4 font-mono text-label-lg tabular-nums text-secondary-text">
                        <span>+{dayDetail.totalXp} XP</span><span>+{dayDetail.totalGold} oro</span>
                      </span>
                    </div>
                    {dayDetail.questsCompleted.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <p className="text-label-md uppercase tracking-[0.08em] text-on-surface-light">Misiones completadas</p>
                        <ul className="flex flex-col gap-1">
                          {dayDetail.questsCompleted.map((q) => (
                            <li key={q.questId} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-variant/60">
                              <CheckCircle2 aria-hidden className="size-5 shrink-0 text-success-text" strokeWidth={1.75} />
                              <span className="min-w-0 flex-1 truncate text-body-md">{q.title}</span>
                              <span className="font-mono text-label-lg tabular-nums text-on-surface-light">+{q.xpEarned} XP</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {dayDetail.habitLogs.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <p className="text-label-md uppercase tracking-[0.08em] text-on-surface-light">Hábitos</p>
                        <ul className="flex flex-col gap-1">
                          {dayDetail.habitLogs.map((l) => {
                            const done = l.status === 'completed', failed = l.status === 'failed';
                            const Icon = done ? CheckCircle2 : failed ? XCircle : MinusCircle;
                            return (
                              <li key={l.habitId} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-variant/60">
                                <Icon aria-hidden className={cn('size-5 shrink-0', done ? 'text-success-text' : failed ? 'text-error-text' : 'text-on-surface-light')} strokeWidth={1.75} />
                                <span className="min-w-0 flex-1 truncate text-body-md">{l.title}</span>
                                <span className={cn('text-label-lg', done ? 'text-success-text' : failed ? 'text-error-text' : 'text-on-surface-light')}>
                                  {done ? 'Hecho' : failed ? 'Fallido' : 'Parcial'}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </motion.section>
                )}
              </AnimatePresence>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <Card padding="lg" className="flex flex-col gap-4">
                <h2 className="text-heading-md">XP por día</h2>
                {xpData.length ? (
                  <BarChart data={xpData} label="XP ganada por día en los últimos 30 días" tone="primary" height={200} grid />
                ) : (
                  <EmptyState icon={Zap} title="Sin XP registrada" description="Completa hábitos y misiones para ver tu progreso." className="py-4" />
                )}
              </Card>
              <Card padding="lg" className="flex flex-col gap-5">
                <h2 className="text-heading-md">Por categoría</h2>
                {catTotal > 0 ? (
                  <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-4">
                    {[...cats].sort((a, b) => b.count - a.count).map((c) => {
                      const pct = Math.round((c.count / catTotal) * 100);
                      const name = CATEGORY_LABELS[c.category] ?? c.category;
                      return (
                        <motion.li key={c.category} variants={item} className="flex flex-col gap-2">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-label-lg">{name}</span>
                            <span className="font-mono text-body-sm tabular-nums text-on-surface-light">{pct}%</span>
                          </div>
                          <ProgressBar value={pct} tone="forest" label={`${name}: ${pct}%`} />
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                ) : (
                  <EmptyState icon={CalendarDays} tone="forest" title="Sin misiones aún" description="Cuando completes misiones verás aquí su reparto." className="py-4" />
                )}
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
