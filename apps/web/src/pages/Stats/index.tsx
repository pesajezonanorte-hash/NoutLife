// Estadísticas (StatsDesktop): periodo Semana/Mes/3 meses/Año (la curva se vuelve
// a dibujar al cambiar), curva de XP con área, Life Score con doble anillo, zonas
// con estado, KPIs, dinero, descanso, fuerza, proyecciones, radar y constancia.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, Check, Dumbbell, Flag, Minus, Moon, RefreshCw, Share2, Sparkles, TrendingUp, Wallet, Zap, CheckCircle2,
} from 'lucide-react';
import { expo, item, stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';
import {
  getActivityRadar, getFinanceTrend, getGymProgression, getHabitHeatmap, getPredictions, getSleepScatter, getStatsSummary, getXpHistory,
  type FinanceTrendPoint, type GymProgression, type HeatmapPoint, type SleepTrendPoint, type StatsPredictions, type StatsSummary, type XpHistoryPoint,
} from '@/services/stats.service';
import { fetchDynamicLifeScore, fetchLifeScore, type DynamicLifeScoreData, type LifeScore } from '@/services/lifescore.service';
import { getCheckinHistory, type DailyCheckin } from '@/services/checkin.service';
import { useAuthStore } from '@/store/authStore';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  AnimatedValue, AreaChart, Badge, Button, Card, ChipGroup, Heatmap, IconChip, LineChart, MoodFace, ProgressBar, ProgressRing,
  RadarChart, SegmentedControl, Skeleton, SpotCard, StatCard, moodOf, type HeatLevel, type Tone,
} from '@/components/ui/lq';

type Period = 'week' | 'month' | '3months' | 'year';
const PERIODS: Array<{ value: Period; label: string; long: string }> = [
  { value: 'week', label: 'Semana', long: 'última semana' }, { value: 'month', label: 'Mes', long: 'mes actual' },
  { value: '3months', label: '3 meses', long: 'últimos 3 meses' }, { value: 'year', label: 'Año', long: 'año actual' },
];
const fmt = (n: number) => Math.round(n).toLocaleString('es-CO');
const money = (n: number, cur: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
const shortDate = (d: string) => new Date(d.length === 7 ? `${d}-01` : d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

/** Tarjeta PNG para compartir; los colores salen de los tokens (--lq-*). */
function useShareCard() {
  const ref = useRef<HTMLCanvasElement>(null);
  const share = (user: ReturnType<typeof useAuthStore.getState>['user'], score: LifeScore | null) => {
    const c = ref.current; const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const css = getComputedStyle(document.documentElement);
    const tok = (n: string, a = 1) => `rgb(${css.getPropertyValue(`--lq-${n}`).trim()} / ${a})`;
    c.width = 600; c.height = 380;
    ctx.fillStyle = tok('background'); ctx.fillRect(0, 0, 600, 380);
    ctx.strokeStyle = tok('primary', 0.5); ctx.lineWidth = 2; ctx.roundRect(4, 4, 592, 372, 16); ctx.stroke();
    ctx.fillStyle = tok('primary-text'); ctx.font = 'bold 28px Montserrat, system-ui'; ctx.fillText('Noutlife', 32, 56);
    ctx.fillStyle = tok('on-surface-light'); ctx.font = '16px Montserrat, system-ui'; ctx.fillText(user?.displayName ?? 'Héroe', 32, 84);
    ctx.fillStyle = tok('on-background'); ctx.font = 'bold 18px Montserrat, system-ui'; ctx.fillText(`Nivel ${user?.level ?? 1}`, 32, 128);
    if (score) {
      ctx.font = 'bold 72px Montserrat, system-ui'; ctx.fillText(String(score.total), 400, 160);
      ctx.fillStyle = tok('on-surface-light'); ctx.font = '18px Montserrat, system-ui'; ctx.fillText('Life Score', 400, 188);
    }
    ctx.fillStyle = tok('on-surface'); ctx.font = '15px Montserrat, system-ui';
    ctx.fillText(`Racha: ${user?.currentStreak ?? 0} días`, 32, 200);
    ctx.fillText(`XP: ${fmt(user?.xp ?? 0)}`, 32, 228);
    ctx.fillStyle = tok('on-surface-light'); ctx.font = '13px Montserrat, system-ui';
    ctx.fillText(new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }), 32, 340);
    const a = document.createElement('a');
    a.download = `noutlife-${new Date().toISOString().slice(0, 10)}.png`; a.href = c.toDataURL('image/png'); a.click();
  };
  return { ref, share };
}

/** 26 semanas de constancia (lunes → domingo) a partir de los conteos diarios. */
function toWeeks(points: HeatmapPoint[], weeks = 26): HeatLevel[][] {
  const byDay = new Map(points.map((p) => [p.date.slice(0, 10), p.count]));
  const max = Math.max(1, ...points.map((p) => p.count));
  const today = new Date();
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const day = new Date(monday); day.setDate(monday.getDate() + w * 7 + d);
    const n = byDay.get(day.toISOString().slice(0, 10)) ?? 0;
    return (n === 0 ? 0 : n >= max * 0.6 ? 2 : 1) as HeatLevel;
  }));
}

const zoneStatus = {
  active: { label: 'Con registros', variant: 'success' as const, icon: Check },
  empty: { label: 'Sin registros', variant: 'neutral' as const, icon: Minus },
  not_configured: { label: 'Sin configurar', variant: 'neutral' as const, icon: Minus },
};

export default function StatsPage() {
  const user = useAuthStore((s) => s.user);
  const currency = user?.currency ?? 'COP';
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(0);
  const [life, setLife] = useState<LifeScore | null>(null);
  const [dyn, setDyn] = useState<DynamicLifeScoreData | null>(null);
  const [xp, setXp] = useState<{ data: XpHistoryPoint[]; avg: number; activeDays: number; daysInPeriod: number; totalXp: number } | null>(null);
  const [radar, setRadar] = useState<Array<{ label: string; value: number; previous: number }>>([]);
  const [finance, setFinance] = useState<FinanceTrendPoint[]>([]);
  const [heat, setHeat] = useState<HeatmapPoint[]>([]);
  const [sleep, setSleep] = useState<SleepTrendPoint[]>([]);
  const [gym, setGym] = useState<GymProgression[]>([]);
  const [lift, setLift] = useState('');
  const [pred, setPred] = useState<StatsPredictions | null>(null);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const req = useRef(0);
  const { ref: canvasRef, share } = useShareCard();

  const load = useCallback(async (p: Period) => {
    const id = ++req.current;
    setLoading(true);
    const r = await Promise.allSettled([
      fetchLifeScore(), fetchDynamicLifeScore(p), getXpHistory(p), getActivityRadar(p), getFinanceTrend(p), getHabitHeatmap(),
      getSleepScatter(p), getGymProgression(p), getPredictions(), getCheckinHistory(30), getStatsSummary(p),
    ]);
    if (id !== req.current) return; // una respuesta lenta de otro periodo no pisa la actual
    const v = <T,>(x: PromiseSettledResult<T>, set: (val: T) => void, fallback?: T) => { if (x.status === 'fulfilled') set(x.value); else if (fallback !== undefined) set(fallback); };
    v(r[0], setLife); v(r[1], setDyn, null); v(r[2], setXp, null);
    if (r[3].status === 'fulfilled') {
      const prev = new Map(r[3].value.previous.map((i) => [i.subject, i.value]));
      setRadar(r[3].value.current.map((i) => ({ label: i.subject, value: i.value, previous: prev.get(i.subject) ?? 0 })));
    } else setRadar([]);
    v(r[4], setFinance, []); v(r[5], setHeat); v(r[6], setSleep, []); v(r[7], setGym, []); v(r[8], setPred); v(r[9], setCheckins); v(r[10], setSummary, null);
    setFailed(r.filter((x) => x.status === 'rejected').length);
    setLoading(false);
  }, []);
  useEffect(() => { void load(period); }, [load, period]);
  useEffect(() => { if (gym.length && !gym.some((g) => g.name === lift)) setLift(gym[0].name); }, [gym, lift]);

  const per = PERIODS.find((p) => p.value === period)!;
  const zones = dyn?.zones ?? [];
  const withData = zones.filter((z) => z.hasData).length;
  const coverage = zones.length ? Math.round((withData / zones.length) * 100) : 0;
  const lifeScore = dyn?.totalScore ?? life?.total ?? 0;
  const xpTotal = summary?.xp.value || xp?.totalXp || 0;
  const labels = useMemo(() => {
    const d = xp?.data ?? [];
    if (d.length < 2) return [];
    const idx = [0, Math.floor(d.length / 3), Math.floor((2 * d.length) / 3), d.length - 1];
    return [...new Set(idx)].map((i) => shortDate(d[i].date));
  }, [xp]);
  const fin = finance.reduce((a, f) => ({ inc: a.inc + f.income, exp: a.exp + f.expenses }), { inc: 0, exp: 0 });
  const finMax = Math.max(1, ...finance.map((f) => Math.max(f.income, f.expenses)));
  const liftData = gym.find((g) => g.name === lift)?.data.slice(-6) ?? [];
  const liftMax = Math.max(1, ...liftData.map((d) => d.weight));
  const sleepAvg = sleep.length ? sleep.reduce((a, s) => a + s.duration, 0) / sleep.length : 0;

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <canvas ref={canvasRef} className="hidden" aria-hidden />
      <PageHeader
        eyebrow="Estadísticas"
        title="Tu progreso, en claro"
        description="Todo calculado a partir de lo que registras de verdad."
        aside={<>
          <div className="w-full max-w-[460px] sm:w-[440px]"><SegmentedControl label="Periodo" value={period} onChange={setPeriod} options={PERIODS} /></div>
          <Button variant="secondary" size="md" onClick={() => share(user, life)}><Share2 aria-hidden className="size-4" strokeWidth={1.75} />Compartir</Button>
        </>}
      />

      {failed > 0 && !loading && (
        <motion.div variants={item} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-error/[var(--lq-soft-alpha)] px-4 py-3">
          <p className="flex items-center gap-2 text-body-md text-error-text"><AlertTriangle aria-hidden className="size-5" />{failed === 1 ? 'Una métrica no pudo actualizarse.' : `${failed} métricas no pudieron actualizarse.`}</p>
          <Button variant="secondary" size="sm" onClick={() => void load(period)}><RefreshCw aria-hidden className="size-4" />Reintentar</Button>
        </motion.div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <motion.div variants={item} className="min-w-0 flex-[2_1_520px]">
          <SpotCard aria-label="Progreso de XP" className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-label-lg text-on-surface"><Zap aria-hidden className="size-4 text-primary-text" />Progreso registrado · {per.long}</span>
              <span className="flex flex-wrap gap-2">
                <Badge variant="primary">Nivel {user?.level ?? 1}</Badge>
                {summary && <Badge variant={summary.xp.change >= 0 ? 'success' : 'warning'} icon={TrendingUp}>{summary.xp.change >= 0 ? '+' : ''}{Math.round(summary.xp.change)}% vs. anterior</Badge>}
              </span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-[3rem] font-bold leading-none tracking-[-2px] md:text-[4rem]"><AnimatedValue value={xpTotal} /></span>
              <span className="text-heading-md text-on-surface-light">XP</span>
            </div>
            {loading && !xp ? <Skeleton className="h-[220px] rounded-xl" /> : (
              <AreaChart values={(xp?.data ?? []).map((d) => d.cumulativeXp)} labels={labels} redrawKey={period}
                label={`XP acumulada en ${per.long}: ${fmt(xpTotal)}`} />
            )}
            <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
              <div><div className="text-body-sm text-on-surface-light">Promedio</div><div className="font-mono text-label-lg tabular-nums md:text-body-md md:font-semibold">{fmt(xp?.avg ?? 0)} XP/día</div></div>
              <div><div className="text-body-sm text-on-surface-light">Días con XP</div><div className="font-mono text-label-lg tabular-nums md:text-body-md md:font-semibold">{xp?.activeDays ?? 0} de {xp?.daysInPeriod ?? 0}</div></div>
              <div><div className="text-body-sm text-on-surface-light">Para subir de nivel</div><div className="font-mono text-label-lg tabular-nums md:text-body-md md:font-semibold">{fmt(Math.max(0, (user?.xpToNextLevel ?? 0) - (user?.xp ?? 0)))} XP</div></div>
            </div>
          </SpotCard>
        </motion.div>

        <motion.div variants={item} className="min-w-0 flex-[1_1_300px]">
          <SpotCard aria-label="Life Score" padding="md" className="flex flex-col items-center gap-4 text-center md:p-6">
            <div className="flex w-full items-center justify-between"><span className="text-label-lg">Life Score</span><Badge>{dyn?.trend === 'up' ? 'Subiendo' : dyn?.trend === 'down' ? 'Bajando' : 'Equilibrio'}</Badge></div>
            <div className="relative">
              <ProgressRing value={lifeScore} tone="warning" size={200} stroke={7} label="Life Score" valueText={`${lifeScore} de 100`}>
                <span className="font-mono text-[3rem] font-bold leading-none tabular-nums"><AnimatedValue value={lifeScore} /></span>
                <span className="text-body-sm text-on-surface-light">de 100</span>
              </ProgressRing>
              <ProgressRing value={coverage} tone="primary" size={150} stroke={5} label="Cobertura" valueText={`${coverage}%`}
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [&_span]:hidden" />
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-body-sm text-on-surface">
              <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-warning" />Score</span>
              <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-primary" />Cobertura {coverage}%</span>
            </div>
            <p className="text-body-sm text-on-surface-light">Se calcula solo con áreas configuradas y métricas con registros reales.</p>
          </SpotCard>
        </motion.div>
      </div>

      {zones.length > 0 && (
        <motion.section variants={item} className="flex flex-col gap-6" aria-labelledby="zones-t">
          <div><h2 id="zones-t" className="text-heading-lg">Zonas de vida</h2><p className="text-body-sm text-on-surface-light">{withData} con registros · {zones.filter((z) => z.isTracking).length} en seguimiento · {per.long}</p></div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul key={period} variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {zones.map((z) => {
                const st = zoneStatus[z.status] ?? zoneStatus.empty;
                return (
                  <motion.li key={z.id} variants={item}>
                    <Card interactive padding="md" className="flex h-full flex-col gap-3.5">
                      <div className="flex items-center gap-3">
                        <IconChip icon={Sparkles} tone={z.hasData ? 'primary' : 'muted'} size="sm" />
                        <div className="min-w-0 flex-1"><div className="truncate text-label-lg md:text-body-md md:font-semibold">{z.name}</div><div className="truncate text-body-sm text-on-surface-light">{z.activityLabel}</div></div>
                        <Badge variant={st.variant} icon={st.icon}>{st.label}</Badge>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between"><span className="text-body-sm text-on-surface-light">Ritmo</span><span className="font-mono text-label-lg tabular-nums">{z.scoreAvailable ? `${Math.round(z.score)}%` : '—'}</span></div>
                        <ProgressBar value={z.scoreAvailable ? z.score : 0} />
                      </div>
                    </Card>
                  </motion.li>
                );
              })}
            </motion.ul>
          </AnimatePresence>
        </motion.section>
      )}

      {summary && (
        <motion.section variants={item} aria-label="Totales" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
          <StatCard icon={Zap} tone="primary" value={summary.totals.xpEarned} label="XP histórica" />
          <StatCard icon={Flag} tone="secondary" value={summary.quests.completed} label={`Misiones en ${per.long}`} />
          <StatCard icon={CheckCircle2} tone="success" value={summary.totals.habitCompletions} label="Hábitos completados" />
          <StatCard icon={Dumbbell} tone="warning" value={summary.totals.workouts} label="Entrenamientos" />
        </motion.section>
      )}

      <motion.section variants={item} className="flex flex-col gap-6" aria-labelledby="detail-t">
        <div><h2 id="detail-t" className="text-heading-lg">Seguimiento detallado</h2><p className="text-body-sm text-on-surface-light">Series calculadas a partir de tus registros.</p></div>
        <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><IconChip icon={Wallet} tone="success" size="sm" /><div><h3 className="text-heading-sm">Flujo de dinero</h3><p className="text-body-sm text-on-surface-light">Ingresos y gastos · {per.long}</p></div></div>
            <div className="grid grid-cols-3 gap-2">
              {([['Ingresos', fin.inc, 'text-success-text'], ['Gastos', fin.exp, 'text-error-text'], ['Neto', fin.inc - fin.exp, '']] as const).map(([l, v, c]) => (
                <Card key={l} padding="sm" className="bg-background px-3"><div className="text-body-sm text-on-surface-light">{l}</div><div className={cn('truncate font-mono text-label-lg tabular-nums', c)}>{money(v, currency)}</div></Card>
              ))}
            </div>
            {finance.length === 0 ? <p className="text-body-sm text-on-surface-light">Sin movimientos en este periodo.</p> : (
              <>
                <div role="img" aria-label="Ingresos y gastos por tramo del periodo" className="flex h-40 items-end gap-3">
                  {finance.slice(-8).map((f, i) => (
                    <div key={f.month} className="flex h-full flex-1 items-end gap-1">
                      {[[f.income, 'bg-success'], [f.expenses, 'bg-error/75']].map(([val, cls], k) => (
                        <motion.span key={k} className={cn('block h-full flex-1 origin-bottom rounded-t-lg rounded-b-sm', cls as string)}
                          initial={{ scaleY: 0 }} animate={{ scaleY: (val as number) / finMax }} transition={{ duration: 1, ease: expo, delay: 0.2 + i * 0.07 + k * 0.05 }} />
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-body-sm text-on-surface">
                  <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-success" />Ingresos</span>
                  <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-error/75" />Gastos</span>
                  <span className="text-on-surface-light">{shortDate(finance.slice(-8)[0].month)} – {shortDate(finance[finance.length - 1].month)}</span>
                </div>
              </>
            )}
          </Card>

          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><IconChip icon={Moon} tone="secondary" size="sm" /><div><h3 className="text-heading-sm">Descanso</h3><p className="text-body-sm text-on-surface-light">Horas por noche · promedio {sleepAvg ? `${Math.floor(sleepAvg)} h ${String(Math.round((sleepAvg % 1) * 60)).padStart(2, '0')}` : '—'}</p></div></div>
            {sleep.length < 2 ? <p className="text-body-sm text-on-surface-light">Registra al menos dos noches para ver la tendencia.</p> : (
              <LineChart key={period} tone="secondary" min={4} max={10} goal={{ value: 7, label: 'Meta 7 h' }}
                data={sleep.slice(-7).map((s) => ({ label: new Date(s.date).toLocaleDateString('es-ES', { weekday: 'narrow' }), value: s.duration, tip: `${shortDate(s.date)} · ${s.duration.toFixed(1)} h` }))}
                label="Horas de sueño por noche" />
            )}
          </Card>

          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><IconChip icon={Dumbbell} tone="warning" size="sm" /><div><h3 className="text-heading-sm">Progresión de fuerza</h3><p className="text-body-sm text-on-surface-light">Peso máximo por sesión</p></div></div>
            {gym.length === 0 ? <p className="text-body-sm text-on-surface-light">Sin entrenamientos con peso en este periodo.</p> : (
              <>
                <ChipGroup label="Ejercicio" value={lift} onChange={setLift} options={gym.slice(0, 4).map((g) => ({ value: g.name, label: g.name }))} />
                <div role="img" aria-label={`${lift}: ${liftData.map((d) => `${d.weight} kg`).join(', ')}`} className="flex h-36 items-end gap-3">
                  {liftData.map((d, i) => (
                    <motion.span key={`${lift}-${d.date}`} className={cn('block h-full flex-1 origin-bottom rounded-t-lg rounded-b-sm', i === liftData.length - 1 ? 'bg-warning' : 'bg-warning/[var(--lq-soft-alpha)]')}
                      initial={{ scaleY: 0 }} animate={{ scaleY: d.weight / liftMax }} transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.15 + i * 0.07 }} />
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card padding="lg" className="flex flex-col gap-4">
            <div className="flex items-center gap-3"><IconChip icon={TrendingUp} tone="info" size="sm" /><div><h3 className="text-heading-sm">Proyecciones</h3><p className="text-body-sm text-on-surface-light">Basadas en tu ritmo reciente</p></div></div>
            <div className="grid grid-cols-2 gap-2">
              <Card padding="sm" className="bg-background"><div className="text-body-sm text-on-surface-light">Siguiente nivel</div><div className="font-mono text-heading-md">{pred?.daysToNextLevel != null ? `${pred.daysToNextLevel} días` : '—'}</div><div className="text-body-sm text-on-surface-light">a {fmt(pred?.avgDailyXp ?? 0)} XP/día</div></Card>
              {pred?.goalPredictions[0] ? (
                <Card padding="sm" className="bg-background"><div className="truncate text-body-sm text-on-surface-light">{pred.goalPredictions[0].title}</div><div className="font-mono text-heading-md">{pred.goalPredictions[0].months != null ? `${pred.goalPredictions[0].months} meses` : '—'}</div><div className="text-body-sm text-on-surface-light">faltan {money(pred.goalPredictions[0].remaining, currency)}</div></Card>
              ) : <Card padding="sm" className="bg-background"><div className="text-body-sm text-on-surface-light">Metas de ahorro</div><div className="text-body-sm text-on-surface">Sin metas activas</div></Card>}
            </div>
            {(pred?.habitRisks.length ?? 0) > 0 && (
              <>
                <span className="text-label-lg text-on-surface">Constancia de hábitos</span>
                <ul className="flex flex-col">
                  {pred!.habitRisks.slice(0, 5).map((h) => {
                    const v = h.risk === 'high' ? { label: 'En riesgo', variant: 'error' as const, icon: AlertTriangle } : h.risk === 'medium' ? { label: 'Atención', variant: 'warning' as const, icon: AlertTriangle } : { label: 'En ritmo', variant: 'success' as const, icon: Check };
                    return (
                      <li key={h.title} className="flex min-h-10 items-center gap-3">
                        <span className="min-w-0 flex-1 truncate text-body-md">{h.title}</span>
                        <span className="w-11 text-right font-mono text-label-lg tabular-nums">{Math.round(h.completionRate)}%</span>
                        <Badge variant={v.variant} icon={v.icon} className="w-28 justify-center">{v.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Card>
        </div>
      </motion.section>

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        {radar.length > 0 && (
          <motion.div variants={item}>
            <SpotCard padding="md" className="flex flex-col gap-4 md:p-6">
              <div><h2 className="text-heading-sm">Ritmo por área</h2><p className="text-body-sm text-on-surface-light">Periodo actual frente al anterior</p></div>
              <RadarChart key={period} axes={radar.map((r) => ({ label: r.label, value: r.value / 100, previous: r.previous / 100 }))}
                label={radar.map((r) => `${r.label} ${Math.round(r.value)}%`).join(', ')} />
              <div className="flex flex-wrap justify-center gap-5 text-body-sm text-on-surface">
                <span className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-3.5 bg-warning" />Este periodo</span>
                <span className="flex items-center gap-1.5"><span aria-hidden className="w-3.5 border-t-2 border-dashed border-on-surface-light" />Anterior</span>
              </div>
            </SpotCard>
          </motion.div>
        )}
        <motion.div variants={item}>
          <Card padding="lg" className="flex h-full flex-col gap-4">
            <div><h2 className="text-heading-sm">Constancia de hábitos</h2><p className="text-body-sm text-on-surface-light">Últimas 26 semanas · <span className="font-mono">{fmt(heat.reduce((a, h) => a + h.count, 0))}</span> hábitos completados</p></div>
            <Heatmap weeks={toWeeks(heat)} label="Mapa de calor de hábitos de las últimas 26 semanas" className="max-w-none [&_.grid]:gap-1" />
          </Card>
        </motion.div>
      </div>

      {checkins.length > 0 && (
        <motion.section variants={item}>
          <Card padding="lg" className="flex flex-col gap-4">
            <div><h2 className="text-heading-sm">Ánimo del mes</h2><p className="text-body-sm text-on-surface-light">Tus check-ins relacionan tu ánimo con tus hábitos y descanso.</p></div>
            <ul className="flex flex-wrap gap-1.5" aria-label="Ánimo por día">
              {[...checkins].reverse().map((c) => {
                const m = moodOf(c.mood);
                const tone: Tone = m.tone;
                return (
                  <li key={c.id} title={`${shortDate(c.date)} · ${m.name}`} aria-label={`${shortDate(c.date)}: ${m.name}`}
                    className={cn('flex size-9 items-center justify-center rounded-lg', { primary: 'bg-primary/[var(--lq-soft-alpha)] text-primary-text', success: 'bg-success/[var(--lq-soft-alpha)] text-success-text', warning: 'bg-warning/[var(--lq-soft-alpha)] text-warning-text', error: 'bg-error/[var(--lq-soft-alpha)] text-error-text', info: 'bg-info/[var(--lq-soft-alpha)] text-info-text', secondary: 'bg-secondary/[var(--lq-soft-alpha)] text-secondary-text', muted: 'bg-surface-variant text-on-surface-light' }[tone])}>
                    <MoodFace mood={c.mood} className="size-5" />
                  </li>
                );
              })}
            </ul>
          </Card>
        </motion.section>
      )}
    </motion.div>
  );
}
