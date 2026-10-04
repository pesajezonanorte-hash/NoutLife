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
  AnimatedValue, Badge, Button, Card, ChipGroup, IconChip, MoodFace, ProgressBar, ProgressRing,
  SegmentedControl, Skeleton, SpotCard, StatCard, moodOf, type Tone,
} from '@/components/ui/lq';
import { GroupedBars, HabitHeatmap, RadarPlus, TipHead, TipRow, TrendChart } from '@/components/stats/InteractiveCharts';
import { SLEEP_GOAL_H, hm, quality } from '@/components/sleep/sleepMeta';

type Period = 'week' | 'month' | '3months' | 'year';
const PERIODS: Array<{ value: Period; label: string; long: string }> = [
  { value: 'week', label: 'Semana', long: 'última semana' }, { value: 'month', label: 'Mes', long: 'mes actual' },
  { value: '3months', label: '3 meses', long: 'últimos 3 meses' }, { value: 'year', label: 'Año', long: 'año actual' },
];
const fmt = (n: number) => Math.round(n).toLocaleString('es-CO');
const money = (n: number, cur: string) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
// Las fechas llegan como YYYY-MM-DD (o YYYY-MM): se leen a mediodía local para no saltar de día por la zona horaria.
const parseDay = (d: string) => new Date(`${d.length === 7 ? `${d}-01` : d.slice(0, 10)}T12:00:00`);
const shortDate = (d: string) => d.length === 7
  ? parseDay(d).toLocaleDateString('es-ES', { month: 'short' })
  : parseDay(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const longDate = (d: string) => d.length === 7
  ? parseDay(d).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  : parseDay(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const kg = (n: number) => `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg`;
const signed = (n: number, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toLocaleString('es-CO', { maximumFractionDigits: 1 })}${unit}`;

/** Sección que entra con blur-in al aparecer en pantalla (no al montar). */
function Reveal({ children, className, as = 'section', ...rest }: { children: React.ReactNode; className?: string; as?: 'section' | 'div'; 'aria-labelledby'?: string; 'aria-label'?: string }) {
  const Tag = as === 'div' ? motion.div : motion.section;
  return <Tag variants={item} initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.12 }} className={className} {...rest}>{children}</Tag>;
}

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
  const xpData = xp?.data ?? [];
  const xpBest = Math.max(0, ...xpData.map((d) => d.xp));
  const fin = finance.reduce((a, f) => ({ inc: a.inc + f.income, exp: a.exp + f.expenses }), { inc: 0, exp: 0 });
  const finData = finance.slice(-14);
  const compactMoney = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const liftData = gym.find((g) => g.name === lift)?.data ?? [];
  const liftBest = Math.max(0, ...liftData.map((d) => d.weight));
  const liftFirst = liftData[0]?.weight ?? 0, liftLast = liftData[liftData.length - 1]?.weight ?? 0;
  const liftBestDay = liftData.find((d) => d.weight === liftBest)?.date;
  const sleepAvg = sleep.length ? sleep.reduce((a, s) => a + s.duration, 0) / sleep.length : 0;
  const heatCounts = useMemo(() => new Map(heat.map((h) => [h.date.slice(0, 10), h.count])), [heat]);

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
            {loading && !xp ? <Skeleton className="h-[240px] rounded-xl" /> : xpData.length === 0 ? (
              <p className="py-10 text-center text-body-md text-on-surface-light">Aún no hay XP en este periodo.</p>
            ) : (
              <>
                <TrendChart key={period} values={xpData.map((d) => d.cumulativeXp)} bars={xpData.map((d) => d.xp)}
                  xLabels={xpData.map((d) => shortDate(d.date))} yFormat={(n) => fmt(n)} height={250}
                  mark={(i) => xpData[i].xp > 0 && xpData[i].xp === xpBest}
                  label={`XP acumulada en ${per.long}: ${fmt(xpTotal)}`}
                  tipText={(i) => `${longDate(xpData[i].date)}: ${xpData[i].xp ? `+${fmt(xpData[i].xp)} XP ese día` : 'sin XP'}, ${fmt(xpData[i].cumulativeXp)} XP acumulada`}
                  tip={(i) => {
                    const d = xpData[i];
                    return (
                      <>
                        <TipHead sub={d.xp > 0 && d.xp === xpBest ? 'Tu mejor día del periodo' : undefined}>{longDate(d.date)}</TipHead>
                        <div className="flex flex-col gap-1">
                          <TipRow tone="primary" label="Ganada ese día" value={d.xp ? `+${fmt(d.xp)} XP` : '0 XP'} strong />
                          <TipRow label="Acumulada" value={`${fmt(d.cumulativeXp)} XP`} />
                          {xp && xp.avg > 0 && <TipRow label="vs. tu promedio" value={signed(Math.round(d.xp - xp.avg), ' XP')} />}
                        </div>
                      </>
                    );
                  }} />
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-on-surface-light">
                  <span className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-4 rounded-full bg-primary" />XP acumulada</span>
                  <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-primary/30" />XP de cada día</span>
                  <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-secondary" />Mejor día</span>
                  <span className="ml-auto hidden sm:inline">Pasa el cursor para ver cada día</span>
                </div>
              </>
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
        <Reveal className="flex flex-col gap-6" aria-labelledby="zones-t">
          <div><h2 id="zones-t" className="text-heading-lg">Zonas de vida</h2><p className="text-body-sm text-on-surface-light">{withData} con registros · {zones.filter((z) => z.isTracking).length} en seguimiento · {per.long}</p></div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul key={period} variants={stagger} initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.1 }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {zones.map((z) => {
                const st = zoneStatus[z.status] ?? zoneStatus.empty;
                return (
                  <motion.li key={z.id} variants={item}>
                    <Card interactive padding="md" className="flex h-full flex-col gap-3.5">
                      <div className="flex items-center gap-3">
                        <IconChip icon={Sparkles} tone={z.hasData ? 'primary' : 'muted'} size="sm" />
                        <div className="min-w-0 flex-1" title={`${z.name} · ${z.activityLabel}`}><div className="truncate text-label-lg md:text-body-md md:font-semibold">{z.name}</div><div className="line-clamp-2 text-body-sm text-on-surface-light">{z.activityLabel}</div></div>
                        <Badge variant={st.variant} icon={st.icon}>{st.label}</Badge>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between"><span className="text-body-sm text-on-surface-light">Ritmo</span><span className="font-mono text-label-lg tabular-nums">{z.scoreAvailable ? <AnimatedValue value={Math.round(z.score)} format={(n) => `${Math.round(n)}%`} /> : '—'}</span></div>
                        <ProgressBar value={z.scoreAvailable ? z.score : 0} />
                      </div>
                    </Card>
                  </motion.li>
                );
              })}
            </motion.ul>
          </AnimatePresence>
        </Reveal>
      )}

      {summary && (
        <Reveal aria-label="Totales" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
          <StatCard icon={Zap} tone="primary" value={summary.totals.xpEarned} label="XP histórica" />
          <StatCard icon={Flag} tone="forest" value={summary.quests.completed} label={`Misiones en ${per.long}`} />
          <StatCard icon={CheckCircle2} tone="success" value={summary.totals.habitCompletions} label="Hábitos completados" />
          <StatCard icon={Dumbbell} tone="warning" value={summary.totals.workouts} label="Entrenamientos" />
        </Reveal>
      )}

      <Reveal className="flex flex-col gap-6" aria-labelledby="detail-t">
        <div><h2 id="detail-t" className="text-heading-lg">Seguimiento detallado</h2><p className="text-body-sm text-on-surface-light">Series calculadas a partir de tus registros.</p></div>
        <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><IconChip icon={Wallet} tone="success" size="sm" /><div><h3 className="text-heading-sm">Flujo de dinero</h3><p className="text-body-sm text-on-surface-light">Ingresos y gastos · {per.long}</p></div></div>
            <div className="grid grid-cols-3 gap-2">
              {([['Ingresos', fin.inc, 'text-success-text'], ['Gastos', fin.exp, 'text-error-text'], ['Neto', fin.inc - fin.exp, '']] as const).map(([l, v, c]) => (
                <Card key={l} padding="sm" className="bg-background px-3"><div className="text-body-sm text-on-surface-light">{l}</div><div className={cn('truncate font-mono text-label-lg tabular-nums', c)}>{money(v, currency)}</div></Card>
              ))}
            </div>
            {finData.length === 0 ? <p className="text-body-sm text-on-surface-light">Sin movimientos en este periodo.</p> : (
              <>
                <GroupedBars key={period} height={220} yFormat={compactMoney}
                  series={[{ name: 'Ingresos', tone: 'success' }, { name: 'Gastos', tone: 'error' }]}
                  groups={finData.map((f) => ({ label: shortDate(f.month), values: [f.income, f.expenses] }))}
                  label={`Ingresos y gastos por ${finData[0].month.length === 7 ? 'mes' : 'día'}`}
                  tipText={(i) => { const f = finData[i]; return `${longDate(f.month)}: ingresos ${money(f.income, currency)}, gastos ${money(f.expenses, currency)}, neto ${money(f.income - f.expenses, currency)}`; }}
                  tip={(i) => {
                    const f = finData[i], net = f.income - f.expenses;
                    return (
                      <>
                        <TipHead>{longDate(f.month)}</TipHead>
                        <div className="flex flex-col gap-1">
                          <TipRow tone="success" label="Ingresos" value={money(f.income, currency)} />
                          <TipRow tone="error" label="Gastos" value={money(f.expenses, currency)} />
                          <div className="my-1 border-t border-border" />
                          <TipRow label={net >= 0 ? 'Ahorraste' : 'Gastaste de más'} value={<span className={net >= 0 ? 'text-success-text' : 'text-error-text'}>{money(net, currency)}</span>} strong />
                        </div>
                      </>
                    );
                  }} />
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-body-sm text-on-surface">
                  <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-success" />Ingresos</span>
                  <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-error" />Gastos</span>
                  <span className="ml-auto text-on-surface-light">{shortDate(finData[0].month)} – {shortDate(finData[finData.length - 1].month)}</span>
                </div>
              </>
            )}
          </Card>

          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><IconChip icon={Moon} tone="info" size="sm" /><div><h3 className="text-heading-sm">Descanso</h3><p className="text-body-sm text-on-surface-light">Horas dormidas cada noche · promedio <span className="font-mono">{sleepAvg ? hm(sleepAvg) : '—'}</span></p></div></div>
            {sleep.length === 0 ? <p className="text-body-sm text-on-surface-light">Registra tus noches para ver la tendencia.</p> : (
              <>
                <TrendChart key={period} tone="info" zeroBased={false} goal={{ value: SLEEP_GOAL_H, label: `Meta ${SLEEP_GOAL_H} h` }} height={220}
                  values={sleep.map((s) => s.duration)} xLabels={sleep.map((s) => shortDate(s.date))} yFormat={(n) => `${n} h`}
                  label="Horas de sueño por noche"
                  tipText={(i) => `${longDate(sleep[i].date)}: ${hm(sleep[i].duration)}, calidad ${quality(sleep[i].quality).name}`}
                  tip={(i) => {
                    const s = sleep[i], diff = s.duration - SLEEP_GOAL_H;
                    return (
                      <>
                        <TipHead>{longDate(s.date)}</TipHead>
                        <div className="flex flex-col gap-1">
                          <TipRow tone="info" label="Dormiste" value={hm(s.duration)} strong />
                          <TipRow label="Calidad" value={`${quality(s.quality).name} · ${Math.round(s.quality)}/5`} />
                          <div className={cn('mt-1 text-label-md', diff >= 0 ? 'text-success-text' : 'text-warning-text')}>
                            {diff >= 0 ? `✓ Meta cumplida (+${hm(diff)})` : `Faltaron ${hm(-diff)} para la meta`}
                          </div>
                        </div>
                      </>
                    );
                  }} />
                {sleep.length === 1 && <p className="text-body-sm text-on-surface-light">Registra otra noche para ver la tendencia.</p>}
              </>
            )}
          </Card>

          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><IconChip icon={Dumbbell} tone="warning" size="sm" /><div><h3 className="text-heading-sm">Progresión de fuerza</h3><p className="text-body-sm text-on-surface-light">El peso más alto que levantaste en cada sesión de un ejercicio</p></div></div>
            {gym.length === 0 ? <p className="text-body-sm text-on-surface-light">Sin entrenamientos con peso en este periodo.</p> : (
              <>
                <ChipGroup label="Ejercicio" value={lift} onChange={setLift} options={gym.slice(0, 8).map((g) => ({ value: g.name, label: g.name }))} />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={lift} className="flex flex-col gap-4"
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
                    exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }} transition={{ duration: 0.45, ease: expo }}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {([
                        ['Récord', kg(liftBest), liftBestDay ? shortDate(liftBestDay) : ''],
                        ['Última sesión', kg(liftLast), liftData.length ? shortDate(liftData[liftData.length - 1].date) : ''],
                        ['Progreso', liftData.length > 1 ? signed(liftLast - liftFirst, ' kg') : '—', liftData.length > 1 && liftFirst > 0 ? `${signed(Math.round(((liftLast - liftFirst) / liftFirst) * 100), ' %')} desde la 1.ª` : 'desde la 1.ª sesión'],
                        ['Sesiones', String(liftData.length), per.long],
                      ] as const).map(([l, v, s]) => (
                        <div key={l} className="rounded-md border border-border bg-background px-3 py-2.5">
                          <div className="text-caption text-on-surface-light">{l}</div>
                          <div className={cn('truncate font-mono text-label-lg tabular-nums', l === 'Progreso' && liftData.length > 1 && (liftLast >= liftFirst ? 'text-success-text' : 'text-error-text'))}>{v}</div>
                          <div className="truncate text-caption text-on-surface-light">{s}</div>
                        </div>
                      ))}
                    </div>
                    <TrendChart tone="warning" zeroBased={false} height={200} values={liftData.map((d) => d.weight)} xLabels={liftData.map((d) => shortDate(d.date))}
                      yFormat={(n) => `${n} kg`} mark={(i) => liftData.length > 1 && liftData[i].weight === liftBest}
                      label={`${lift}: peso máximo por sesión`}
                      tipText={(i) => `${longDate(liftData[i].date)}: ${kg(liftData[i].weight)}`}
                      tip={(i) => {
                        const d = liftData[i], prev = liftData[i - 1];
                        const diff = prev ? d.weight - prev.weight : null;
                        return (
                          <>
                            <TipHead sub={lift}>{longDate(d.date)}</TipHead>
                            <div className="flex flex-col gap-1">
                              <TipRow tone="warning" label="Peso máximo" value={kg(d.weight)} strong />
                              {diff != null && <TipRow label="vs. sesión anterior" value={<span className={diff > 0 ? 'text-success-text' : diff < 0 ? 'text-error-text' : ''}>{signed(diff, ' kg')}</span>} />}
                              {liftData.length > 1 && d.weight === liftBest && <div className="mt-1 text-label-md text-secondary-text">★ Tu récord del periodo</div>}
                              {diff == null && <div className="mt-1 text-caption text-on-surface-light">Primera sesión del periodo</div>}
                            </div>
                          </>
                        );
                      }} />
                    {liftData.length === 1 && <p className="text-body-sm text-on-surface-light">Registra otra sesión de {lift} para ver si estás subiendo de peso.</p>}
                  </motion.div>
                </AnimatePresence>
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
                      <li key={h.title} className="flex min-h-12 items-center gap-3 rounded-md px-2 -mx-2 transition-colors hover:bg-surface-variant/60">
                        <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-body-md">{h.title}</span><span className="text-caption text-on-surface-light"><span className="font-mono">{h.completedDays}/{h.scheduledDays}</span> días cumplidos · racha <span className="font-mono">{h.currentStreak}</span></span></span>
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
      </Reveal>

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        {radar.length > 0 && (
          <Reveal as="div">
            <SpotCard padding="md" className="flex flex-col gap-4 md:p-6">
              <div><h2 className="text-heading-sm">Ritmo por área</h2><p className="text-body-sm text-on-surface-light">Cuánto registraste en cada área frente al periodo anterior · pasa el cursor por un vértice</p></div>
              <RadarPlus key={period} axes={radar} label={radar.map((r) => `${r.label} ${Math.round(r.value)}%`).join(', ')} />
              <div className="flex flex-wrap justify-center gap-5 text-body-sm text-on-surface">
                <span className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-3.5 bg-primary" />Este periodo</span>
                <span className="flex items-center gap-1.5"><span aria-hidden className="w-3.5 border-t-2 border-dashed border-on-surface-light" />Anterior</span>
              </div>
            </SpotCard>
          </Reveal>
        )}
        <Reveal as="div">
          <Card padding="lg" className="flex h-full flex-col gap-4">
            <div><h2 className="text-heading-sm">Constancia de hábitos</h2><p className="text-body-sm text-on-surface-light">Últimas 26 semanas · <span className="font-mono">{fmt(heat.reduce((a, h) => a + h.count, 0))}</span> hábitos completados</p></div>
            <HabitHeatmap counts={heatCounts} />
          </Card>
        </Reveal>
      </div>

      {checkins.length > 0 && (
        <Reveal>
          <Card padding="lg" className="flex flex-col gap-4">
            <div><h2 className="text-heading-sm">Ánimo del mes</h2><p className="text-body-sm text-on-surface-light">Tus check-ins relacionan tu ánimo con tus hábitos y descanso.</p></div>
            <ul className="flex flex-wrap gap-1.5" aria-label="Ánimo por día">
              {[...checkins].reverse().map((c) => {
                const m = moodOf(c.mood);
                const tone: Tone = m.tone;
                return (
                  <li key={c.id} title={`${shortDate(c.date)} · ${m.name}`} aria-label={`${shortDate(c.date)}: ${m.name}`}
                    className={cn('flex size-9 items-center justify-center rounded-md', { primary: 'bg-primary/[var(--lq-soft-alpha)] text-primary-text', success: 'bg-success/[var(--lq-soft-alpha)] text-success-text', warning: 'bg-warning/[var(--lq-soft-alpha)] text-warning-text', error: 'bg-error/[var(--lq-soft-alpha)] text-error-text', info: 'bg-info/[var(--lq-soft-alpha)] text-info-text', secondary: 'bg-secondary/[var(--lq-soft-alpha)] text-secondary-text', forest: 'bg-forest/[var(--lq-soft-alpha)] text-forest-text', muted: 'bg-surface-variant text-on-surface-light' }[tone])}>
                    <MoodFace mood={c.mood} className="size-5" />
                  </li>
                );
              })}
            </ul>
          </Card>
        </Reveal>
      )}
    </motion.div>
  );
}
