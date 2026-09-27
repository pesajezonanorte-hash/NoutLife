import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BedDouble,
  CircleDollarSign,
  Dumbbell,
  Gauge,
  Goal,
  ShieldCheck,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  FinanceTrendPoint,
  GymProgression,
  SleepTrendPoint,
  StatsPredictions,
} from '@/services/stats.service';

const numberFormat = new Intl.NumberFormat('es-CO');

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return new Intl.DateTimeFormat('es-CO', options).format(date);
}

function formatCurrency(value: number, currency = 'COP') {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$ ${numberFormat.format(value)}`;
  }
}

function PanelHeader({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof CircleDollarSign;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] text-[var(--text-secondary)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{detail}</p>
      </div>
    </div>
  );
}

function EmptyPanel({ children }: { children: string }) {
  return <p className="flex min-h-[180px] items-center justify-center px-6 text-center text-xs leading-5 text-[var(--text-muted)]">{children}</p>;
}

function formatFinanceBucket(value: string, options: Intl.DateTimeFormatOptions) {
  return formatDate(value.length === 10 ? value : `${value}-01`, options);
}

function FinanceTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const values = Object.fromEntries(payload.map((item) => [item.dataKey ?? '', Number(item.value ?? 0)]));

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 shadow-pixel">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label ? formatFinanceBucket(label, label.length === 10 ? { day: 'numeric', month: 'long' } : { month: 'long', year: 'numeric' }) : 'Periodo'}
      </p>
      <div className="mt-1.5 space-y-1 text-xs">
        <p className="flex justify-between gap-5 text-[var(--accent-green)]"><span>Ingresos</span><strong className="tabular-nums">{formatCurrency(values.income ?? 0, currency)}</strong></p>
        <p className="flex justify-between gap-5 text-[var(--accent-red)]"><span>Gastos</span><strong className="tabular-nums">{formatCurrency(values.expenses ?? 0, currency)}</strong></p>
        <p className="flex justify-between gap-5 border-t border-[var(--border-soft)] pt-1 text-[var(--text-secondary)]"><span>Flujo acumulado</span><strong className="tabular-nums">{formatCurrency(values.balance ?? 0, currency)}</strong></p>
      </div>
    </div>
  );
}

export function FinanceTrendCard({
  data,
  currency = 'COP',
  periodLabel,
  loading = false,
}: {
  data: FinanceTrendPoint[];
  currency?: string;
  periodLabel: string;
  loading?: boolean;
}) {
  const hasActivity = data.some((point) => point.income !== 0 || point.expenses !== 0);

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-pixel">
      <PanelHeader icon={CircleDollarSign} title="Flujo de dinero" detail={`Ingresos, gastos y flujo acumulado · ${periodLabel}.`} />
      {hasActivity ? (
        <div className="mt-4 h-[235px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => formatFinanceBucket(value, value.length === 10 ? { day: 'numeric', month: 'short' } : { month: 'short' })} />
              <YAxis hide />
              <Tooltip content={<FinanceTooltip currency={currency} />} cursor={{ fill: 'var(--bg-muted)' }} />
              <Bar dataKey="income" name="Ingresos" fill="var(--accent-green)" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="expenses" name="Gastos" fill="var(--accent-red)" fillOpacity={0.72} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Line type="monotone" dataKey="balance" name="Flujo acumulado" stroke="var(--accent-gold)" strokeWidth={2} dot={{ r: 2.5, fill: 'var(--accent-gold)' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyPanel>{loading ? 'Cargando tu flujo financiero…' : `Aún no hay transacciones registradas en ${periodLabel.toLowerCase()}.`}</EmptyPanel>
      )}
    </article>
  );
}

function SleepTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const values = Object.fromEntries(payload.map((item) => [item.dataKey ?? '', Number(item.value ?? 0)]));
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 shadow-pixel">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label ? formatDate(label, { day: 'numeric', month: 'short' }) : 'Noche'}
      </p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]"><strong className="tabular-nums text-[var(--text-primary)]">{(values.duration ?? 0).toFixed(1)} h</strong> de sueño</p>
      <p className="mt-0.5 text-xs text-[var(--text-secondary)]"><strong className="tabular-nums text-[var(--text-primary)]">{values.quality ?? 0}/5</strong> de calidad</p>
    </div>
  );
}

export function SleepTrendCard({
  data,
  periodLabel,
  loading = false,
}: {
  data: SleepTrendPoint[];
  periodLabel: string;
  loading?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-pixel">
      <PanelHeader icon={BedDouble} title="Descanso registrado" detail={`Horas y calidad de sueño · ${periodLabel}.`} />
      {data.length ? (
        <div className="mt-4 h-[235px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={38} tickFormatter={(value) => formatDate(value, { day: 'numeric', month: 'short' })} />
              <YAxis yAxisId="hours" hide domain={[0, 12]} />
              <YAxis yAxisId="quality" hide orientation="right" domain={[0, 5]} />
              <Tooltip content={<SleepTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 4' }} />
              <Line yAxisId="hours" type="monotone" dataKey="duration" name="Horas" stroke="var(--accent-gold)" strokeWidth={2.25} dot={{ r: 2.5, fill: 'var(--accent-gold)' }} activeDot={{ r: 4 }} />
              <Line yAxisId="quality" type="monotone" dataKey="quality" name="Calidad" stroke="var(--text-secondary)" strokeWidth={1.75} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyPanel>{loading ? 'Cargando tus noches registradas…' : 'Aún no hay noches registradas para este periodo.'}</EmptyPanel>
      )}
    </article>
  );
}

function GymTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 shadow-pixel">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label ? formatDate(label, { day: 'numeric', month: 'short' }) : 'Sesión'}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-[var(--text-primary)]">{numberFormat.format(Number(payload[0]?.value ?? 0))} kg</p>
    </div>
  );
}

export function GymProgressionCard({
  data,
  periodLabel,
  loading = false,
}: {
  data: GymProgression[];
  periodLabel: string;
  loading?: boolean;
}) {
  const initialExercise = data[0]?.name ?? '';
  const [selectedName, setSelectedName] = useState(initialExercise);

  useEffect(() => {
    if (!data.some((exercise) => exercise.name === selectedName)) setSelectedName(data[0]?.name ?? '');
  }, [data, selectedName]);

  const selected = useMemo(
    () => data.find((exercise) => exercise.name === selectedName) ?? data[0],
    [data, selectedName],
  );

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-pixel">
      <PanelHeader icon={Dumbbell} title="Progresión de fuerza" detail={`Peso máximo por ejercicio terminado · ${periodLabel}.`} />
      {selected ? (
        <>
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {data.map((exercise) => (
              <button
                key={exercise.name}
                type="button"
                onClick={() => setSelectedName(exercise.name)}
                className={[
                  'shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  selected.name === exercise.name
                    ? 'border-[var(--accent-gold)] bg-[color-mix(in_oklab,var(--accent-gold)_12%,transparent)] text-[var(--text-primary)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]',
                ].join(' ')}
              >
                {exercise.name}
              </button>
            ))}
          </div>
          <div className="mt-2 h-[198px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={selected.data} margin={{ top: 12, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={38} tickFormatter={(value) => formatDate(value, { day: 'numeric', month: 'short' })} />
                <YAxis hide domain={[0, 'dataMax + 5']} />
                <Tooltip content={<GymTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 4' }} />
                <Line type="monotone" dataKey="weight" name="Peso máximo" stroke="var(--accent-gold)" strokeWidth={2.25} dot={{ r: 3, fill: 'var(--accent-gold)' }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <EmptyPanel>{loading ? 'Cargando tu progresión de fuerza…' : 'Finaliza un entrenamiento con series registradas para seguir tu progresión de fuerza.'}</EmptyPanel>
      )}
    </article>
  );
}

function RiskBadge({ risk }: { risk: 'low' | 'medium' | 'high' }) {
  const variants = {
    low: { label: 'En ritmo', className: 'border-[color-mix(in_oklab,var(--accent-green)_38%,var(--border))] bg-[color-mix(in_oklab,var(--accent-green)_10%,transparent)] text-[var(--accent-green)]', Icon: ShieldCheck },
    medium: { label: 'Atención', className: 'border-[color-mix(in_oklab,var(--accent-gold)_42%,var(--border))] bg-[color-mix(in_oklab,var(--accent-gold)_10%,transparent)] text-[var(--accent-gold)]', Icon: Gauge },
    high: { label: 'En riesgo', className: 'border-[color-mix(in_oklab,var(--accent-red)_38%,var(--border))] bg-[color-mix(in_oklab,var(--accent-red)_10%,transparent)] text-[var(--accent-red)]', Icon: AlertTriangle },
  } as const;
  const { label, className, Icon } = variants[risk];
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${className}`}><Icon className="h-3 w-3" aria-hidden="true" />{label}</span>;
}

export function PredictionsCard({
  data,
  currency = 'COP',
  loading = false,
}: {
  data: StatsPredictions | null;
  currency?: string;
  loading?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-pixel">
      <PanelHeader icon={TrendingUp} title="Proyecciones con tus datos" detail="Estimaciones basadas en tu XP, flujo mensual y cumplimiento reciente." />
      {!data ? (
        <EmptyPanel>{loading ? 'Calculando tus proyecciones…' : 'Aún no hay suficientes registros para generar proyecciones.'}</EmptyPanel>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-muted)] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]"><Zap className="h-3.5 w-3.5 text-[var(--accent-gold)]" aria-hidden="true" />Siguiente nivel</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-[var(--text-primary)]">
                {data.daysToNextLevel === null ? 'Sin ritmo aún' : `${data.daysToNextLevel} ${data.daysToNextLevel === 1 ? 'día' : 'días'}`}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">{numberFormat.format(data.avgDailyXp)} XP/día en los últimos 30 días</p>
            </div>
            <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-muted)] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]"><Goal className="h-3.5 w-3.5 text-[var(--accent-green)]" aria-hidden="true" />Metas financieras</p>
              <p className="mt-2 text-xl font-bold tabular-nums text-[var(--text-primary)]">{data.goalPredictions.length}</p>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">metas activas con una estimación</p>
            </div>
          </div>

          {data.goalPredictions.length ? (
            <div className="space-y-2 border-t border-[var(--border-soft)] pt-3">
              {data.goalPredictions.map((goal) => (
                <div key={goal.title} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-medium text-[var(--text-secondary)]">{goal.title}</span>
                  <span className="shrink-0 text-right text-[var(--text-muted)]">
                    {goal.months === null ? 'Sin ahorro neto aún' : `${goal.months} ${goal.months === 1 ? 'mes' : 'meses'}`}
                    <span className="ml-1 tabular-nums">· {formatCurrency(goal.remaining, currency)}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {data.habitRisks.length ? (
            <div className="space-y-2 border-t border-[var(--border-soft)] pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Constancia de hábitos · 7 días</p>
              {data.habitRisks.map((habit) => (
                <div key={habit.title} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--text-secondary)]">{habit.title}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{habit.completedDays}/{habit.scheduledDays} días · racha {habit.currentStreak}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">{habit.completionRate}%</span>
                    <RiskBadge risk={habit.risk} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}

export { formatCurrency };
