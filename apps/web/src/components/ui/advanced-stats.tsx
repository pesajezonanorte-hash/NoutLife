import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  CircleDollarSign,
  Dumbbell,
  Heart,
  HeartPulse,
  Library,
  Map,
  Moon,
  Salad,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { resolveGlyph } from '@/components/ui/glyphs';
import { cn } from '@/lib/utils';
import { ClippedAreaChart, type XpChartDatum } from './advanced-stats-utils/charts';
import { TimelineAnimation } from './advanced-stats-utils/timeline-animation';

export type AdvancedStatsZoneStatus = 'active' | 'empty' | 'not_configured';

export interface AdvancedStatsZone {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  score: number;
  scoreAvailable?: boolean;
  hasData?: boolean;
  isTracking?: boolean;
  status?: AdvancedStatsZoneStatus;
  activityCount?: number;
  activityLabel?: string;
}

export interface AdvancedStatsTotals {
  xpEarned: number;
  questsCompleted: number;
  habitCompletions: number;
  workouts: number;
}

export interface AdvancedStatsData {
  /** Human-friendly label selected by the parent period control. */
  periodLabel: string;
  level?: number;
  currentXp?: number;
  xpToNextLevel?: number;
  xpHistory: XpChartDatum[];
  xpPeriod: number;
  xpAverage?: number;
  xpActiveDays?: number;
  xpDaysInPeriod?: number;
  xpChange?: number;
  questsInPeriod: number;
  questsChange?: number;
  lifeScore?: number | null;
  lifeScoreTrend?: string;
  zones?: AdvancedStatsZone[];
  currentStreak?: number;
  bestStreak?: number;
  /** Historical totals remain available for consumers; period cards use real selected-period records. */
  totals?: Partial<AdvancedStatsTotals>;
}

interface AdvancedStatsProps {
  data: AdvancedStatsData;
  loading?: boolean;
  className?: string;
}

const numberFormatter = new Intl.NumberFormat('es-CO');

const ZONE_ICONS: Record<string, LucideIcon> = {
  quests: Swords,
  habits: HeartPulse,
  gym: Dumbbell,
  finances: CircleDollarSign,
  sleep: Moon,
  learning: Library,
  journal: BookOpen,
  mirror: Sparkles,
  nutrition: Salad,
  relationships: Heart,
};

function formatNumber(value: number) {
  return numberFormatter.format(Math.max(0, Math.round(value)));
}

function signedPercent(value?: number) {
  if (value === undefined || value === null || value === 0) return null;
  return `${value > 0 ? '+' : ''}${value}%`;
}

function changeVariant(value?: number): 'success' | 'destructive' | 'outline' {
  if (!value) return 'outline';
  return value > 0 ? 'success' : 'destructive';
}

function changeIcon(value?: number) {
  if (!value) return null;
  const Icon = value > 0 ? TrendingUp : TrendingDown;
  return <Icon aria-hidden="true" className="h-3 w-3" />;
}

function zoneStateLabel(zone: AdvancedStatsZone): string {
  if (zone.status === 'not_configured') return 'Sin configurar';
  if (zone.status === 'empty') return 'Sin registros';
  return 'Con registros';
}

function zoneStateClass(zone: AdvancedStatsZone): string {
  if (zone.status === 'not_configured') return 'border-[var(--border)] text-[var(--text-muted)]';
  if (zone.status === 'empty') return 'border-[var(--border)] text-[var(--text-secondary)]';
  return 'border-[color-mix(in_oklab,var(--accent-gold)_48%,var(--border))] text-[var(--text-secondary)]';
}

function ZoneLedger({ zones, periodLabel, loading = false }: { zones: AdvancedStatsZone[]; periodLabel: string; loading?: boolean }) {
  const registered = zones.filter((zone) => zone.hasData).length;
  const tracking = zones.filter((zone) => zone.isTracking).length;

  return (
    <TimelineAnimation animationNum={3}>
      <article className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-pixel sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              <Activity className="h-3.5 w-3.5 text-[var(--text-secondary)]" aria-hidden="true" />
              Zonas de vida
            </div>
            <h2 className="mt-1.5 text-base font-semibold text-[var(--text-primary)]">Cobertura completa del periodo</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{loading ? `Calculando cobertura · ${periodLabel}` : `${registered} con registros · ${tracking} en seguimiento · ${periodLabel}`}</p>
          </div>
          <p className="max-w-xs text-right text-[11px] leading-4 text-[var(--text-muted)]">
            Cada área permanece visible aunque no tenga actividad. Las barras solo usan registros y metas reales.
          </p>
        </div>

        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {zones.map((zone) => {
            const Icon = ZONE_ICONS[zone.id] ?? (zone.icon ? resolveGlyph(zone.icon) : Map);
            const hasScore = zone.scoreAvailable ?? (zone.status !== 'not_configured');
            const value = Math.max(0, Math.min(100, zone.score));
            const accent = zone.color ?? 'var(--accent-gold)';

            return (
              <div key={zone.id} className="min-w-0 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-muted)]/35 p-3.5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-panel)]"
                      style={{ color: accent }}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{zone.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{zone.activityLabel ?? 'Sin registros en este periodo'}</p>
                    </div>
                  </div>
                  <span className={cn('max-w-[7.5rem] shrink-0 whitespace-normal rounded-md border px-1.5 py-0.5 text-right text-[10px] font-semibold leading-4', zoneStateClass(zone))}>
                    {zoneStateLabel(zone)}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                    <span className="text-[var(--text-muted)]">{hasScore ? 'Ritmo medible' : 'Sin meta medible'}</span>
                    <span className="font-semibold tabular-nums text-[var(--text-secondary)]">{hasScore ? `${formatNumber(value)}%` : '—'}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-panel)]" {...(hasScore ? {
                    role: 'progressbar',
                    'aria-valuemin': 0,
                    'aria-valuemax': 100,
                    'aria-valuenow': value,
                    'aria-label': `Ritmo de ${zone.name}`,
                  } : {})}>
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: hasScore ? `${value}%` : '0%', background: accent, opacity: zone.hasData ? 1 : 0.42 }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {zones.length === 0 ? (
          <p className="mt-5 rounded-xl border border-dashed border-[var(--border-soft)] px-4 py-5 text-center text-xs leading-5 text-[var(--text-muted)]">
            {loading ? 'Calculando las áreas que tienen registros en este periodo…' : 'No se pudieron cargar las zonas de vida. Intenta actualizar las estadísticas.'}
          </p>
        ) : null}
      </article>
    </TimelineAnimation>
  );
}

/**
 * Analytics overview backed by LifeQuest records. The parent owns fetching so
 * changing the period updates the chart, zone ledger and every headline together.
 */
export default function AdvancedStats({ data, loading = false, className }: AdvancedStatsProps) {
  const zones = useMemo(() => data.zones ?? [], [data.zones]);
  const score = data.lifeScore ?? null;
  const scoreValue = Math.max(0, Math.min(100, score ?? 0));
  const hasPeriodActivity = (data.xpActiveDays ?? data.xpHistory.filter((point) => point.xp !== 0).length) > 0;
  const activeDays = data.xpActiveDays ?? data.xpHistory.filter((point) => point.xp !== 0).length;
  const habitZone = zones.find((zone) => zone.id === 'habits');
  const gymZone = zones.find((zone) => zone.id === 'gym');

  const statCards = [
    {
      label: 'XP registrada',
      value: `${formatNumber(data.xpPeriod)} XP`,
      detail: data.periodLabel,
      change: signedPercent(data.xpChange),
      changeValue: data.xpChange,
      icon: Zap,
      accent: 'var(--accent-gold)',
    },
    {
      label: 'Misiones completadas',
      value: formatNumber(data.questsInPeriod),
      detail: `${data.periodLabel} · ${formatNumber(data.totals?.questsCompleted ?? 0)} históricas`,
      change: signedPercent(data.questsChange),
      changeValue: data.questsChange,
      icon: Swords,
      accent: 'var(--text-secondary)',
    },
    {
      label: 'Hábitos completados',
      value: formatNumber(habitZone?.activityCount ?? 0),
      detail: habitZone?.activityLabel ?? `Racha actual: ${formatNumber(data.currentStreak ?? 0)} días`,
      icon: HeartPulse,
      accent: 'var(--accent-green)',
    },
    {
      label: 'Entrenamientos',
      value: formatNumber(gymZone?.activityCount ?? 0),
      detail: gymZone?.activityLabel ?? `Mejor racha: ${formatNumber(data.bestStreak ?? 0)} días`,
      icon: Dumbbell,
      accent: 'var(--text-secondary)',
    },
  ];

  const lifeTrendIsPositive = data.lifeScoreTrend?.trim().startsWith('+');
  const lifeTrendIsNegative = data.lifeScoreTrend?.trim().startsWith('-');

  return (
    <section aria-label="Resumen avanzado de estadísticas" className={cn('min-w-0 space-y-4', className)}>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(270px,0.36fr)]">
        <TimelineAnimation animationNum={0}>
          <article className="relative min-w-0 h-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-pixel sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  <Zap className="h-3.5 w-3.5 text-[var(--accent-gold)]" aria-hidden="true" />
                  Progreso registrado
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <h2 className="text-3xl font-bold tracking-tight tabular-nums text-[var(--text-primary)] sm:text-4xl">
                    {formatNumber(data.xpPeriod)} <span className="text-base font-semibold text-[var(--text-secondary)]">XP</span>
                  </h2>
                  <p className="pb-1 text-xs text-[var(--text-muted)]">{data.periodLabel}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {data.level !== undefined ? (
                  <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-[11px]">
                    <Trophy className="h-3 w-3 text-[var(--accent-gold)]" aria-hidden="true" />
                    Nivel {data.level}
                  </Badge>
                ) : null}
                {signedPercent(data.xpChange) !== null ? (
                  <Badge variant={changeVariant(data.xpChange)} className="px-2.5 py-1 text-[11px]">
                    {changeIcon(data.xpChange)}
                    {signedPercent(data.xpChange)} vs. periodo anterior
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="relative mt-5">
              <ClippedAreaChart data={data.xpHistory} className="min-h-[190px] min-w-0 sm:min-h-[245px]" />
              {!loading && !hasPeriodActivity ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-8 text-center">
                  <div className="max-w-xs rounded-lg bg-[color-mix(in_oklab,var(--bg-panel)_90%,transparent)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    <p>Aún no hay XP registrada en este periodo. Tu primera misión completada encenderá este gráfico.</p>
                    <Link to="/quests" className="mt-2 inline-flex min-h-11 items-center font-semibold text-[var(--accent-gold)] hover:text-[var(--text-primary)]">
                      Ir a Misiones
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-[var(--border-soft)] pt-3 text-xs text-[var(--text-muted)]">
              <span>Promedio del periodo: <strong className="font-semibold tabular-nums text-[var(--text-secondary)]">{formatNumber(data.xpAverage ?? 0)} XP/día</strong></span>
              <span>{formatNumber(activeDays)} {activeDays === 1 ? 'día con XP' : 'días con XP'}{data.xpDaysInPeriod ? ` de ${formatNumber(data.xpDaysInPeriod)}` : ''}</span>
              {data.currentXp !== undefined && data.xpToNextLevel !== undefined ? (
                <span>{formatNumber(data.currentXp)} / {formatNumber(data.xpToNextLevel)} XP para subir</span>
              ) : null}
            </div>
          </article>
        </TimelineAnimation>

        <TimelineAnimation animationNum={1}>
          <article className="min-w-0 h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-pixel sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Life Score</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Equilibrio del periodo</h3>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] text-[var(--accent-gold)]">
                <Target className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>

            <div className="mt-5 flex items-end justify-between gap-4">
              <p className="text-3xl font-bold tracking-tight tabular-nums text-[var(--text-primary)]">
                {score === null ? '—' : formatNumber(score)}<span className="text-base font-semibold text-[var(--text-muted)]">/100</span>
              </p>
              {data.lifeScoreTrend ? (
                <Badge
                  variant={lifeTrendIsPositive ? 'success' : lifeTrendIsNegative ? 'destructive' : 'outline'}
                  className="max-w-[11rem] whitespace-normal px-2 py-1 text-right leading-4"
                >
                  {lifeTrendIsPositive ? <TrendingUp className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
                  {lifeTrendIsNegative ? <TrendingDown className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
                  {data.lifeScoreTrend}
                </Badge>
              ) : null}
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Áreas con métrica disponible</span>
                <span className="font-medium tabular-nums text-[var(--text-secondary)]">100</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={scoreValue} aria-label="Life Score del periodo">
                <div className="h-full rounded-full bg-[var(--accent-gold)] transition-[width] duration-500" style={{ width: `${scoreValue}%` }} />
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">Se calcula solo con áreas configuradas y métricas que sí tienen registros o un denominador real.</p>
          </article>
        </TimelineAnimation>
      </div>

      <ZoneLedger zones={zones} periodLabel={data.periodLabel} loading={loading} />

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, detail, change, changeValue, icon: Icon, accent }, index) => (
          <TimelineAnimation key={label} animationNum={index + 4}>
            <article className="min-w-0 h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-4 shadow-pixel">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]" style={{ color: accent }}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {change ? (
                  <Badge variant={changeVariant(changeValue)} className="shrink-0">
                    {changeIcon(changeValue)}
                    {change}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-4 text-2xl font-bold tracking-tight tabular-nums text-[var(--text-primary)]">{value}</p>
              <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">{label}</p>
              <p className="mt-1.5 text-[11px] leading-4 text-[var(--text-muted)]">{detail}</p>
            </article>
          </TimelineAnimation>
        ))}
      </div>
    </section>
  );
}

export { AdvancedStats };
