import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Clock3,
  Dumbbell,
  Flame,
  ListTodo,
  Moon,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FlowButton } from '../ui/flow-button';
import { fetchTodayPlan, type TodayPlan as TodayPlanData, type TodayPlanItem } from '../../services/dashboard.service';

interface Props {
  /** Keeps reward, XP and user-state handling in the dashboard ownership layer. */
  onHabitComplete: (habitId: string) => Promise<boolean>;
}

const ITEM_META: Record<TodayPlanItem['type'], { label: string; Icon: LucideIcon; color: string }> = {
  habit: { label: 'Hábito', Icon: Flame, color: 'var(--accent-green)' },
  quest: { label: 'Misión', Icon: Target, color: 'var(--accent-gold)' },
  event: { label: 'Agenda', Icon: CalendarDays, color: 'var(--accent-blue)' },
};

const ADVICE_TONES: Record<TodayPlanData['advice']['tone'], { color: string; background: string }> = {
  neutral: { color: 'var(--text-secondary)', background: 'var(--bg-panel-light)' },
  calm: { color: 'var(--accent-cyan)', background: 'color-mix(in oklab, var(--accent-cyan) 8%, var(--bg-panel-light))' },
  warning: { color: 'var(--accent-gold)', background: 'color-mix(in oklab, var(--accent-gold) 9%, var(--bg-panel-light))' },
  momentum: { color: 'var(--accent-green)', background: 'color-mix(in oklab, var(--accent-green) 9%, var(--bg-panel-light))' },
};

function todayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(date)
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatSleep(duration: number) {
  const hours = Math.floor(duration);
  const minutes = Math.round((duration - hours) * 60);
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function workoutLabel(workout: TodayPlanData['wellbeing']['workout']) {
  if (!workout) return 'Sin registro';
  if (workout.completedToday) return 'Hecho hoy';
  if (workout.daysAgo === 1) return 'Hace 1 día';
  return `Hace ${workout.daysAgo ?? 0} días`;
}

function urgencyLabel(urgency: TodayPlanItem['urgency']) {
  if (urgency === 'critical') return 'Prioridad';
  if (urgency === 'soon') return 'Pronto';
  return null;
}

function Metric({ icon: Icon, label, value, tone = 'var(--text-primary)', action }: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: string;
  action?: () => void;
}) {
  const content = (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-panel)]" style={{ color: tone }}>
        <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--text-muted)]">{label}</span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--text-primary)]">{value}</span>
      </span>
    </>
  );

  const className = 'flex min-w-0 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-2.5 py-2 text-left transition-colors';
  if (!action) return <div className={className}>{content}</div>;

  return (
    <button
      type="button"
      onClick={action}
      className={`${className} hover:border-[var(--accent-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]`}
    >
      {content}
    </button>
  );
}

function PlanSkeleton() {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]" aria-label="Cargando plan de hoy">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="h-4 w-36 animate-pulse rounded bg-[var(--bg-panel-light)]" />
        <div className="h-28 animate-pulse rounded-xl bg-[var(--bg-panel-light)]" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-[var(--bg-panel-light)]" />)}
        </div>
      </div>
    </section>
  );
}

/**
 * The dashboard's daily landing surface. It keeps habits, missions and agenda
 * distinct, while surfacing the three next meaningful actions in one place.
 */
export function TodayPlan({ onHabitComplete }: Props) {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<TodayPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingHabitId, setCompletingHabitId] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  const loadPlan = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchTodayPlan();
      setPlan(data);
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  async function completeHabit(item: TodayPlanItem) {
    if (completingHabitId || item.type !== 'habit') return;
    setCompletingHabitId(item.id);
    try {
      const completed = await onHabitComplete(item.id);
      if (completed) await loadPlan(true);
    } finally {
      setCompletingHabitId(null);
    }
  }

  function openItem(item: TodayPlanItem) {
    navigate(item.route);
  }

  function scrollToCheckin() {
    document.getElementById('daily-checkin')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (loading) return <PlanSkeleton />;

  if (!plan || hasError) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-panel-light)] text-[var(--text-secondary)]">
            <RefreshCw size={17} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">No pudimos preparar tu plan</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">Tus datos siguen seguros. Intenta cargar de nuevo cuando estés listo.</p>
          </div>
          <FlowButton tone="ghost" size="sm" withArrows={false} onClick={() => { void loadPlan(true); }}>
            Reintentar
          </FlowButton>
        </div>
      </section>
    );
  }

  const primary = plan.priorities.primary;
  const habitProgress = plan.habits.total > 0 ? Math.round((plan.habits.completed / plan.habits.total) * 100) : 0;
  const adviceStyle = ADVICE_TONES[plan.advice.tone];
  const nextEvent = plan.calendar.nextEvent;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 30, mass: 0.7 }}
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]"
      aria-labelledby="today-plan-heading"
    >
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] text-[var(--accent-gold)]">
            <ListTodo size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--accent-gold)]">Plan de hoy</p>
            <h2 id="today-plan-heading" className="mt-0.5 truncate text-sm font-semibold text-[var(--text-primary)]">{todayLabel(plan.date)}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {plan.calendar.connected && (
            <span className="hidden rounded-full border border-[var(--border)] bg-[var(--bg-panel-light)] px-2.5 py-1 text-xs text-[var(--text-secondary)] sm:inline-flex">
              Calendar conectado
            </span>
          )}
          <span className="rounded-full bg-[var(--accent-gold)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--accent-gold)]">+{plan.xp.earned} XP</span>
          <button
            type="button"
            aria-label="Actualizar plan de hoy"
            title="Actualizar plan"
            onClick={() => { void loadPlan(true); }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-panel-light)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] sm:h-7 sm:w-7"
          >
            <RefreshCw size={14} strokeWidth={1.8} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-5">
        {primary ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
            <article
              className="rounded-xl border p-4"
              style={{
                borderColor: primary.urgency === 'critical'
                  ? 'color-mix(in oklab, var(--accent-gold) 58%, var(--border))'
                  : 'var(--border)',
                background: primary.urgency === 'critical'
                  ? 'linear-gradient(135deg, color-mix(in oklab, var(--accent-gold) 10%, var(--bg-panel-light)), var(--bg-panel))'
                  : 'var(--bg-panel-light)',
              }}
            >
              <div className="flex items-start gap-3">
                {(() => {
                  const { Icon, color } = ITEM_META[primary.type];
                  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel)]" style={{ color }}><Icon size={17} strokeWidth={1.9} aria-hidden="true" /></span>;
                })()}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Enfoque principal</p>
                    {urgencyLabel(primary.urgency) && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold ${primary.urgency === 'critical' ? 'bg-[var(--accent-gold)]/12 text-[var(--accent-gold)]' : 'bg-[var(--bg-panel)] text-[var(--text-secondary)]'}`}>
                        {primary.urgency === 'critical' && <AlertCircle size={11} strokeWidth={2} aria-hidden="true" />}
                        {urgencyLabel(primary.urgency)}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1.5 text-base font-semibold leading-6 text-[var(--text-primary)]">{primary.title}</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{primary.detail}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {primary.xp > 0 && <span className="text-xs font-semibold text-[var(--accent-gold)]">+{primary.xp} XP al completar</span>}
                {primary.type === 'habit' ? (
                  <FlowButton
                    tone="green"
                    size="sm"
                    withArrows={false}
                    disabled={completingHabitId === primary.id}
                    onClick={() => { void completeHabit(primary); }}
                    className="ml-auto gap-1.5"
                  >
                    <Check size={14} strokeWidth={2.1} aria-hidden="true" />
                    {completingHabitId === primary.id ? 'Guardando…' : 'Completar'}
                  </FlowButton>
                ) : (
                  <FlowButton
                    tone="ghost"
                    size="sm"
                    withArrows={false}
                    onClick={() => openItem(primary)}
                    className="ml-auto gap-1.5"
                  >
                    {primary.type === 'event' ? 'Ver agenda' : 'Abrir misión'}
                    <ChevronRight size={14} strokeWidth={1.9} aria-hidden="true" />
                  </FlowButton>
                )}
              </div>
            </article>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)]/50 p-2">
              <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-0.5">
                <p className="text-sm font-medium text-[var(--text-secondary)]">Después</p>
                <span className="text-xs text-[var(--text-muted)]">{plan.priorities.totalOpen} pendientes</span>
              </div>
              {plan.priorities.secondary.length > 0 ? (
                <div className="space-y-1">
                  {plan.priorities.secondary.map((item) => {
                    const { Icon, color } = ITEM_META[item.type];
                    return (
                      <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--bg-panel)]">
                        <button
                          type="button"
                          onClick={() => openItem(item)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
                        >
                          <Icon size={14} strokeWidth={1.8} style={{ color }} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-[var(--text-primary)]">{item.title}</span>
                            <span className="mt-0.5 block truncate text-xs text-[var(--text-secondary)]">{item.detail}</span>
                          </span>
                        </button>
                        {item.type === 'habit' ? (
                          <button
                            type="button"
                            onClick={() => { void completeHabit(item); }}
                            disabled={completingHabitId === item.id}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--accent-green)] transition-colors hover:border-[var(--accent-green)] hover:bg-[var(--accent-green)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] disabled:opacity-50"
                            aria-label={`Completar ${item.title}`}
                          >
                            <Check size={14} strokeWidth={2} aria-hidden="true" />
                          </button>
                        ) : (
                          <ChevronRight size={14} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-2 py-4 text-center text-xs leading-5 text-[var(--text-secondary)]">No hay más prioridades urgentes después de esta.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-panel-light)]/50 px-5 py-9 text-center">
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--accent-gold)]"><CheckCircle2 size={19} strokeWidth={1.8} aria-hidden="true" /></span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tu plan está despejado</h3>
            <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">No hay hábitos, misiones ni eventos pendientes para priorizar ahora.</p>
            <FlowButton tone="primary" size="sm" withArrows={false} onClick={() => navigate('/quests')} className="mt-4 gap-1.5">
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              Nueva misión
            </FlowButton>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric
            icon={Zap}
            label="Energía"
            value={plan.wellbeing.energy === null ? 'Registrar check-in' : `${plan.wellbeing.energy}/10`}
            tone="var(--accent-cyan)"
            action={plan.wellbeing.energy === null ? scrollToCheckin : undefined}
          />
          <Metric
            icon={Moon}
            label="Descanso"
            value={plan.wellbeing.sleep ? formatSleep(plan.wellbeing.sleep.duration) : 'Sin registro'}
            tone="var(--accent-blue)"
          />
          <Metric
            icon={Dumbbell}
            label="Entrenamiento"
            value={workoutLabel(plan.wellbeing.workout)}
            tone="var(--accent-red)"
          />
          <Metric
            icon={Sparkles}
            label="Hábitos"
            value={plan.habits.total ? `${plan.habits.completed}/${plan.habits.total} hoy` : 'Sin hábitos hoy'}
            tone="var(--accent-green)"
          />
        </div>

        {plan.habits.total > 0 && (
          <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)]/50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--text-secondary)]"><Flame size={13} strokeWidth={1.8} className="text-[var(--accent-green)]" aria-hidden="true" />Constancia del día</span>
              <span className="tabular-nums text-[var(--text-secondary)]">{habitProgress}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-deep)]">
              <motion.div className="h-full rounded-full bg-[var(--accent-green)]" initial={{ width: 0 }} animate={{ width: `${habitProgress}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2 rounded-xl px-3 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: adviceStyle.background }}>
          <div className="flex min-w-0 items-start gap-2">
            <Sparkles size={15} strokeWidth={1.8} className="mt-0.5 shrink-0" style={{ color: adviceStyle.color }} aria-hidden="true" />
            <p className="text-xs leading-5 text-[var(--text-secondary)]"><span className="font-semibold" style={{ color: adviceStyle.color }}>El Sabio sugiere: </span>{plan.advice.message}</p>
          </div>
          {nextEvent ? (
            <button
              type="button"
              onClick={() => navigate('/agenda')}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg px-2 py-1 text-left text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] sm:self-auto"
            >
              <Clock3 size={13} strokeWidth={1.8} className="text-[var(--accent-blue)]" aria-hidden="true" />
              <span className="max-w-36 truncate">{nextEvent.title}</span>
            </button>
          ) : !plan.calendar.connected ? (
            <button
              type="button"
              onClick={() => navigate('/agenda')}
              className="shrink-0 self-start rounded-lg px-2 py-1 text-xs font-medium text-[var(--accent-blue)] transition-colors hover:bg-[var(--bg-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] sm:self-auto"
            >
              Conectar Calendar
            </button>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
