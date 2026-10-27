// Estadísticas (StatsDesktop): periodo Semana/Mes/3 meses/Año (la curva se vuelve
// a dibujar al cambiar), curva de XP con área, Life Score con doble anillo, zonas
// con estado, KPIs, dinero, descanso, fuerza, proyecciones, radar y constancia.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, Check, Dumbbell, Flag, Minus, Moon, RefreshCw, Share2, Sparkles, TrendingUp, Wallet, Zap, CheckCircle2,
} from 'lucide-react';
import { blurFrom, blurTo, expo, item, stagger, useMotionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';
import {
  getActivityRadar, getFinanceTrend, getColiseoProgression, getHabitHeatmap, getPredictions, getSleepScatter, getStatsSummary, getXpHistory,
  type FinanceTrendPoint, type ColiseoProgression, type HeatmapPoint, type SleepTrendPoint, type StatsPredictions, type StatsSummary, type XpHistoryPoint,
} from '@/services/stats.service';
import { fetchDynamicLifeScore, fetchLifeScore, type DynamicLifeScoreData, type LifeScore } from '@/services/lifescore.service';
import { getCheckinHistory, type DailyCheckin } from '@/services/checkin.service';
import { useAuthStore } from '@/store/authStore';
import { track } from '@/lib/analytics';
import { usePlanStore } from '@/store/planStore';
import { LiteNotice } from '@/components/billing/LiteNotice';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  AnimatedValue, Badge, Button, Card, ChipGroup, IconChip, MoodFace, ProgressBar, ProgressRing,
  SegmentedControl, Skeleton, SpotCard, StatCard, moodOf, type Tone,
} from '@/components/ui/lq';
import { GroupedBars, HabitHeatmap, RadarPlus, TipHead, TipRow, TrendChart } from '@/components/stats/InteractiveCharts';
import { SLEEP_GOAL_H, hm, quality } from '@/components/sleep/sleepMeta';
import { useLifeChange } from '@/lib/lifeSync';

type Period = 'week' | 'month' | '3months' | 'year';

const es = {
  periods: { week: 'Semana', month: 'Mes', '3months': '3 meses', year: 'Año' } as Record<Period, string>,
  periodsLong: { week: 'última semana', month: 'mes actual', '3months': 'últimos 3 meses', year: 'año actual' } as Record<Period, string>,
  period: 'Periodo',
  eyebrow: 'Estadísticas',
  title: 'Tu progreso, en claro',
  description: 'Todo calculado a partir de lo que registras de verdad.',
  share: 'Compartir',
  liteNotice: 'En NoutLife Lite ves la última semana. Con Pro, tus estadísticas de meses y años.',
  oneMetric: 'Una métrica no pudo actualizarse.',
  manyMetrics: (n: number): string => `${n} métricas no pudieron actualizarse.`,
  retry: 'Reintentar',
  xpProgress: 'Progreso de XP',
  xpRecorded: (p: string): string => `Progreso registrado · ${p}`,
  level: (n: number): string => `Nivel ${n}`,
  vsPrev: (n: string): string => `${n}% vs. anterior`,
  noXp: 'Aún no hay XP en este periodo.',
  xpAccum: (p: string, v: string): string => `XP acumulada en ${p}: ${v}`,
  xpTip: (d: string, xpText: string, acc: string): string => `${d}: ${xpText}, ${acc} XP acumulada`,
  xpDayTip: (v: string): string => `+${v} XP ese día`,
  noXpDay: 'sin XP',
  bestDay: 'Tu mejor día del periodo',
  earnedThatDay: 'Ganada ese día',
  accumulated: 'Acumulada',
  vsAvg: 'vs. tu promedio',
  legendAccum: 'XP acumulada',
  legendEachDay: 'XP de cada día',
  legendBest: 'Mejor día',
  hoverHint: 'Pasa el cursor para ver cada día',
  average: 'Promedio',
  xpPerDay: 'XP/día',
  daysWithXp: 'Días con XP',
  toNextLevel: 'Para subir de nivel',
  xpUnit: 'XP',
  lifeScore: 'Life Score',
  rising: 'Subiendo',
  falling: 'Bajando',
  balance: 'Equilibrio',
  of100: 'de 100',
  coverage: 'Cobertura',
  scoreLegend: 'Score',
  coveragePct: (n: number): string => `Cobertura ${n}%`,
  lifeNote: 'Se calcula solo con áreas configuradas y métricas con registros reales.',
  zonesTitle: 'Zonas de vida',
  zonesSummary: (withData: number, tracking: number, p: string): string => `${withData} con registros · ${tracking} en seguimiento · ${p}`,
  zoneWithRecords: 'Con registros',
  zoneEmpty: 'Sin registros',
  zoneNotConfigured: 'Sin configurar',
  pace: 'Ritmo',
  totals: 'Totales',
  xpHistory: 'XP histórica',
  questsIn: (p: string): string => `Misiones en ${p}`,
  habitsDone: 'Hábitos completados',
  workouts: 'Entrenamientos',
  detailed: 'Seguimiento detallado',
  detailedHint: 'Series calculadas a partir de tus registros.',
  moneyFlow: 'Flujo de dinero',
  incomeExpenses: (p: string): string => `Ingresos y gastos · ${p}`,
  income: 'Ingresos',
  expenses: 'Gastos',
  net: 'Neto',
  noMoney: 'Sin movimientos en este periodo.',
  byMonth: 'mes',
  byDay: 'día',
  incomesAndExpenses: (by: string): string => `Ingresos y gastos por ${by}`,
  tipIncomeExpense: (d: string, inc: string, exp: string, net: string): string => `${d}: ingresos ${inc}, gastos ${exp}, neto ${net}`,
  saved: 'Ahorraste',
  overspent: 'Gastaste de más',
  sleep: 'Descanso',
  sleepHint: 'Horas dormidas cada noche · promedio',
  noSleep: 'Registra tus noches para ver la tendencia.',
  sleepGoal: (h: number): string => `Meta ${h} h`,
  sleepLabel: 'Horas de sueño por noche',
  sleptLabel: 'Dormiste',
  qualityLabel: 'Calidad',
  goalMet: (diff: string): string => `✓ Meta cumplida (+${diff})`,
  goalMissed: (diff: string): string => `Faltaron ${diff} para la meta`,
  logAnotherNight: 'Registra otra noche para ver la tendencia.',
  strength: 'Progresión de fuerza',
  strengthHint: 'El peso más alto que levantaste en cada sesión de un ejercicio',
  noStrength: 'Sin entrenamientos con peso en este periodo.',
  exercise: 'Ejercicio',
  record: 'Récord',
  lastSession: 'Última sesión',
  progress: 'Progreso',
  sinceFirst: 'desde la 1.ª',
  sinceFirstSession: 'desde la 1.ª sesión',
  sessions: 'Sesiones',
  maxWeight: 'Peso máximo',
  vsPrevSession: 'vs. sesión anterior',
  yourPeriodRecord: '★ Tu récord del periodo',
  firstSession: 'Primera sesión del periodo',
  strengthMore: (lift: string): string => `Registra otra sesión de ${lift} para ver si estás subiendo de peso.`,
  liftLabel: (lift: string): string => `${lift}: peso máximo por sesión`,
  projections: 'Proyecciones',
  projectionsHint: 'Basadas en tu ritmo reciente',
  nextLevel: 'Siguiente nivel',
  days: (n: number): string => `${n} días`,
  perDay: (n: string): string => `a ${n} XP/día`,
  savingGoals: 'Metas de ahorro',
  noGoals: 'Sin metas activas',
  months: (n: number): string => `${n} meses`,
  missing: (v: string): string => `faltan ${v}`,
  habitConsistency: 'Constancia de hábitos',
  atRisk: 'En riesgo',
  attention: 'Atención',
  onPace: 'En ritmo',
  daysDone: 'días cumplidos',
  streak: 'racha',
  ritmoArea: 'Ritmo por área',
  areaHint: 'Cuánto registraste en cada área frente al periodo anterior. Toca un vértice para ver el detalle.',
  thisPeriod: 'Este periodo',
  previous: 'Anterior',
  habitsConsistencyHint: 'Últimas 26 semanas',
  habitsCompleted: 'hábitos completados',
  moodMonth: 'Ánimo del mes',
  moodHint: 'Tus check-ins relacionan tu ánimo con tus hábitos y descanso.',
  moodByDay: 'Ánimo por día',
  moodNames: 'Ánimo',
  shareTitle: 'Mi semana en NoutLife',
  cardTitle: 'Mi semana',
  activeOf: (days: number, active: string): string => `de ${days} ${active}`,
  activeDay: 'día activo',
  activeDays: 'días activos',
  habitDone: 'hábito cumplido',
  habitsDoneCard: 'hábitos cumplidos',
  streakCard: (n: number, unit: string): string => `Racha de ${n} ${unit}`,
  tagline1: 'Tu rutina, tu mente y tus ideas',
  tagline2: 'en un solo lugar.',
  ofWord: 'de',
  dayWord: 'día',
  daysWord: 'días',
};

const en: typeof es = {
  periods: { week: 'Week', month: 'Month', '3months': '3 months', year: 'Year' } as Record<Period, string>,
  periodsLong: { week: 'last week', month: 'current month', '3months': 'last 3 months', year: 'current year' } as Record<Period, string>,
  period: 'Period',
  eyebrow: 'Stats',
  title: 'Your progress, clearly',
  description: 'Everything is calculated from what you actually log.',
  share: 'Share',
  liteNotice: 'In NoutLife Lite you see the last week. With Pro, your months and years of stats.',
  oneMetric: 'One metric could not be updated.',
  manyMetrics: (n: number): string => `${n} metrics could not be updated.`,
  retry: 'Try again',
  xpProgress: 'XP progress',
  xpRecorded: (p: string): string => `Logged progress · ${p}`,
  level: (n: number): string => `Level ${n}`,
  vsPrev: (n: string): string => `${n}% vs. previous`,
  noXp: 'No XP yet in this period.',
  xpAccum: (p: string, v: string): string => `XP accumulated in ${p}: ${v}`,
  xpTip: (d: string, xpText: string, acc: string): string => `${d}: ${xpText}, ${acc} XP accumulated`,
  xpDayTip: (v: string): string => `+${v} XP that day`,
  noXpDay: 'no XP',
  bestDay: 'Your best day of the period',
  earnedThatDay: 'Earned that day',
  accumulated: 'Accumulated',
  vsAvg: 'vs. your average',
  legendAccum: 'Accumulated XP',
  legendEachDay: 'XP each day',
  legendBest: 'Best day',
  hoverHint: 'Hover to see each day',
  average: 'Average',
  xpPerDay: 'XP/day',
  daysWithXp: 'Days with XP',
  toNextLevel: 'To level up',
  xpUnit: 'XP',
  lifeScore: 'Life Score',
  rising: 'Rising',
  falling: 'Falling',
  balance: 'Balanced',
  of100: 'of 100',
  coverage: 'Coverage',
  scoreLegend: 'Score',
  coveragePct: (n: number): string => `Coverage ${n}%`,
  lifeNote: 'Calculated only from configured areas and metrics with real records.',
  zonesTitle: 'Life zones',
  zonesSummary: (withData: number, tracking: number, p: string): string => `${withData} with records · ${tracking} tracked · ${p}`,
  zoneWithRecords: 'With records',
  zoneEmpty: 'No records',
  zoneNotConfigured: 'Not set up',
  pace: 'Pace',
  totals: 'Totals',
  xpHistory: 'Lifetime XP',
  questsIn: (p: string): string => `Quests in ${p}`,
  habitsDone: 'Habits completed',
  workouts: 'Workouts',
  detailed: 'Detailed tracking',
  detailedHint: 'Series calculated from your records.',
  moneyFlow: 'Money flow',
  incomeExpenses: (p: string): string => `Income and expenses · ${p}`,
  income: 'Income',
  expenses: 'Expenses',
  net: 'Net',
  noMoney: 'No transactions in this period.',
  byMonth: 'month',
  byDay: 'day',
  incomesAndExpenses: (by: string): string => `Income and expenses by ${by}`,
  tipIncomeExpense: (d: string, inc: string, exp: string, net: string): string => `${d}: income ${inc}, expenses ${exp}, net ${net}`,
  saved: 'You saved',
  overspent: 'You overspent',
  sleep: 'Sleep',
  sleepHint: 'Hours slept each night · average',
  noSleep: 'Log your nights to see the trend.',
  sleepGoal: (h: number): string => `Goal ${h} h`,
  sleepLabel: 'Hours of sleep per night',
  sleptLabel: 'You slept',
  qualityLabel: 'Quality',
  goalMet: (diff: string): string => `✓ Goal met (+${diff})`,
  goalMissed: (diff: string): string => `${diff} short of the goal`,
  logAnotherNight: 'Log another night to see the trend.',
  strength: 'Strength progress',
  strengthHint: 'The heaviest weight you lifted in each session of an exercise',
  noStrength: 'No weighted workouts in this period.',
  exercise: 'Exercise',
  record: 'Record',
  lastSession: 'Last session',
  progress: 'Progress',
  sinceFirst: 'since the 1st',
  sinceFirstSession: 'since the 1st session',
  sessions: 'Sessions',
  maxWeight: 'Top weight',
  vsPrevSession: 'vs. previous session',
  yourPeriodRecord: '★ Your record for the period',
  firstSession: 'First session of the period',
  strengthMore: (lift: string): string => `Log another ${lift} session to see if you are getting stronger.`,
  liftLabel: (lift: string): string => `${lift}: top weight per session`,
  projections: 'Projections',
  projectionsHint: 'Based on your recent pace',
  nextLevel: 'Next level',
  days: (n: number): string => `${n} days`,
  perDay: (n: string): string => `at ${n} XP/day`,
  savingGoals: 'Savings goals',
  noGoals: 'No active goals',
  months: (n: number): string => `${n} months`,
  missing: (v: string): string => `${v} to go`,
  habitConsistency: 'Habit consistency',
  atRisk: 'At risk',
  attention: 'Watch out',
  onPace: 'On track',
  daysDone: 'days done',
  streak: 'streak',
  ritmoArea: 'Pace by area',
  areaHint: 'How much you logged in each area compared with the previous period. Tap a corner to see the detail.',
  thisPeriod: 'This period',
  previous: 'Previous',
  habitsConsistencyHint: 'Last 26 weeks',
  habitsCompleted: 'habits completed',
  moodMonth: 'Mood this month',
  moodHint: 'Your check-ins link your mood with your habits and rest.',
  moodByDay: 'Mood by day',
  moodNames: 'Mood',
  shareTitle: 'My week in NoutLife',
  cardTitle: 'My week',
  activeOf: (days: number, active: string): string => `of ${days} ${active}`,
  activeDay: 'active day',
  activeDays: 'active days',
  habitDone: 'habit done',
  habitsDoneCard: 'habits done',
  streakCard: (n: number, unit: string): string => `${n} ${unit} streak`,
  tagline1: 'Your routine, your mind and your ideas',
  tagline2: 'in one place.',
  ofWord: 'of',
  dayWord: 'day',
  daysWord: 'days',
};

/** Nombre del evento de analítica (no se traduce). */
const SHARE_EVENT = 'share_card_shared';

const COPY: Copy<typeof es> = { es, en };

// Las fechas llegan como YYYY-MM-DD (o YYYY-MM): se leen a mediodía local para no saltar de día por la zona horaria.
const parseDay = (d: string) => new Date(`${d.length === 7 ? `${d}-01` : d.slice(0, 10)}T12:00:00`);

/** Sección que entra con blur-in al aparecer en pantalla (no al montar). */
function Reveal({ children, className, as = 'section', ...rest }: { children: React.ReactNode; className?: string; as?: 'section' | 'div'; 'aria-labelledby'?: string; 'aria-label'?: string }) {
  const Tag = as === 'div' ? motion.div : motion.section;
  return <Tag variants={item} initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.12 }} className={className} {...rest}>{children}</Tag>;
}

/** Datos de la tarjeta «Mi semana». */
interface WeekCard { name: string; activeDays: number; days: number; habits: number; streak: number; period: string }

/**
 * Tarjeta «Mi semana»: PNG vertical de 1080 × 1920 (Historias de Instagram y Estados de
 * WhatsApp) con la estética Aurora: fondo del tema, vidrio suave y tipografía de la marca.
 * Los colores salen de los tokens (--lq-*). Se comparte con el menú nativo del teléfono y,
 * donde no existe, se descarga.
 */
function useShareCard(t: typeof es, locale: Locale) {
  const ref = useRef<HTMLCanvasElement>(null);
  const share = async (d: WeekCard) => {
    const c = ref.current; const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const W = 1080, H = 1920;
    const css = getComputedStyle(document.documentElement);
    const tok = (n: string, a = 1) => `rgb(${css.getPropertyValue(`--lq-${n}`).trim()} / ${a})`;
    const font = (px: number, w = 500) => `${w} ${px}px Montserrat, system-ui, sans-serif`;
    c.width = W; c.height = H;
    ctx.fillStyle = tok('background'); ctx.fillRect(0, 0, W, H);
    // Luz jade suave arriba, como el cielo de la ventana de Inicio.
    const glow = ctx.createRadialGradient(W * 0.75, 260, 20, W * 0.75, 260, 760);
    glow.addColorStop(0, tok('primary', 0.28)); glow.addColorStop(1, tok('primary', 0));
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 1100);
    // Panel de vidrio.
    ctx.fillStyle = tok('surface', 0.72); ctx.strokeStyle = tok('border', 1); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(80, 520, W - 160, 900, 56); ctx.fill(); ctx.stroke();
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = tok('on-background'); ctx.font = font(64, 700); ctx.fillText('noutlife', 80, 190);
    ctx.fillStyle = tok('on-surface-light'); ctx.font = font(44); ctx.fillText(t.cardTitle, 80, 330);
    ctx.fillStyle = tok('on-background'); ctx.font = font(76, 700); ctx.fillText(d.name.slice(0, 22), 80, 430);
    // Cifra principal: días activos.
    ctx.fillStyle = tok('primary-text'); ctx.font = font(300, 700); ctx.fillText(String(d.activeDays), 150, 880);
    ctx.fillStyle = tok('on-surface-light'); ctx.font = font(56);
    ctx.fillText(t.activeOf(d.days, d.days === 1 ? t.activeDay : t.activeDays), 150, 970);
    // Puntos de la semana.
    for (let i = 0; i < Math.min(d.days, 7); i++) {
      ctx.fillStyle = i < d.activeDays ? tok('primary') : tok('border-strong', 0.6);
      ctx.beginPath(); ctx.arc(170 + i * 120, 1060, 32, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = tok('on-background'); ctx.font = font(60, 600);
    ctx.fillText(`${d.habits} ${d.habits === 1 ? t.habitDone : t.habitsDoneCard}`, 150, 1200);
    ctx.fillStyle = tok('on-surface-light'); ctx.font = font(52);
    ctx.fillText(t.streakCard(d.streak, d.streak === 1 ? t.dayWord : t.daysWord), 150, 1290);
    ctx.fillStyle = tok('on-surface-light'); ctx.font = font(40); ctx.fillText(d.period, 80, 1520);
    ctx.fillStyle = tok('on-background'); ctx.font = font(52, 600); ctx.fillText(t.tagline1, 80, 1700);
    ctx.fillText(t.tagline2, 80, 1770);
    ctx.fillStyle = tok('primary-text'); ctx.font = font(44, 600); ctx.fillText('noutlife.site', 80, 1850);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `mi-semana-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: t.shareTitle }); track(SHARE_EVENT, { target: 'native' }); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.download = file.name; a.href = URL.createObjectURL(blob); a.click();
    URL.revokeObjectURL(a.href);
    track(SHARE_EVENT, { target: 'download' });
  };
  return { ref, share };
}

export default function StatsPage() {
  const t = useText(COPY);
  const locale = useLocale();
  const nf = INTL_LOCALE[locale];
  const fmt = (n: number) => Math.round(n).toLocaleString(nf);
  const money = (n: number, cur: string) => new Intl.NumberFormat(nf, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
  const shortDate = (d: string) => d.length === 7
    ? parseDay(d).toLocaleDateString(nf, { month: 'short' })
    : parseDay(d).toLocaleDateString(nf, { day: 'numeric', month: 'short' });
  const longDate = (d: string) => d.length === 7
    ? parseDay(d).toLocaleDateString(nf, { month: 'long', year: 'numeric' })
    : parseDay(d).toLocaleDateString(nf, { weekday: 'long', day: 'numeric', month: 'long' });
  const kg = (n: number) => `${n.toLocaleString(nf, { maximumFractionDigits: 1 })} kg`;
  const signed = (n: number, unit = '') => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toLocaleString(nf, { maximumFractionDigits: 1 })}${unit}`;
  const PERIODS: Array<{ value: Period; label: string; long: string }> = (['week', 'month', '3months', 'year'] as Period[]).map((value) => ({
    value, label: t.periods[value], long: t.periodsLong[value],
  }));
  const zoneStatus = {
    active: { label: t.zoneWithRecords, variant: 'success' as const, icon: Check },
    empty: { label: t.zoneEmpty, variant: 'neutral' as const, icon: Minus },
    not_configured: { label: t.zoneNotConfigured, variant: 'neutral' as const, icon: Minus },
  };

  const user = useAuthStore((s) => s.user);
  const currency = user?.currency ?? 'COP';
  // NoutLife Lite: la API entrega la última semana; los periodos largos abren el diálogo de Pro.
  const lite = user?.subscription?.plan === 'lite';
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  const [period, setPeriodState] = useState<Period>(lite ? 'week' : 'month');
  const setPeriod = (next: Period) => (lite && next !== 'week' ? openUpgrade('history') : setPeriodState(next));
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(0);
  const [life, setLife] = useState<LifeScore | null>(null);
  const [dyn, setDyn] = useState<DynamicLifeScoreData | null>(null);
  const [xp, setXp] = useState<{ data: XpHistoryPoint[]; avg: number; activeDays: number; daysInPeriod: number; totalXp: number } | null>(null);
  const [radar, setRadar] = useState<Array<{ label: string; value: number; previous: number }>>([]);
  const [finance, setFinance] = useState<FinanceTrendPoint[]>([]);
  const [heat, setHeat] = useState<HeatmapPoint[]>([]);
  const [sleep, setSleep] = useState<SleepTrendPoint[]>([]);
  const [coliseo, setColiseo] = useState<ColiseoProgression[]>([]);
  const [lift, setLift] = useState('');
  const [pred, setPred] = useState<StatsPredictions | null>(null);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const req = useRef(0);
  const motionReduced = useMotionReduced();
  const { ref: canvasRef, share } = useShareCard(t, locale);

  const load = useCallback(async (p: Period, silent = false) => {
    const id = ++req.current;
    if (!silent) setLoading(true);
    const r = await Promise.allSettled([
      fetchLifeScore(), fetchDynamicLifeScore(p), getXpHistory(p), getActivityRadar(p), getFinanceTrend(p), getHabitHeatmap(),
      getSleepScatter(p), getColiseoProgression(p), getPredictions(), getCheckinHistory(30), getStatsSummary(p),
    ]);
    if (id !== req.current) return; // una respuesta lenta de otro periodo no pisa la actual
    const v = <T,>(x: PromiseSettledResult<T>, set: (val: T) => void, fallback?: T) => { if (x.status === 'fulfilled') set(x.value); else if (fallback !== undefined) set(fallback); };
    v(r[0], setLife); v(r[1], setDyn, null); v(r[2], setXp, null);
    if (r[3].status === 'fulfilled') {
      const prev = new Map(r[3].value.previous.map((i) => [i.subject, i.value]));
      setRadar(r[3].value.current.map((i) => ({ label: i.subject, value: i.value, previous: prev.get(i.subject) ?? 0 })));
    } else setRadar([]);
    v(r[4], setFinance, []); v(r[5], setHeat); v(r[6], setSleep, []); v(r[7], setColiseo, []); v(r[8], setPred); v(r[9], setCheckins); v(r[10], setSummary, null);
    setFailed(r.filter((x) => x.status === 'rejected').length);
    setLoading(false);
  }, []);
  useEffect(() => { void load(period); }, [load, period]);
  // Un registro en cualquier zona (botón rápido, Sabio, paleta…) se refleja aquí sin recargar la página.
  useLifeChange(() => void load(period, true));
  useEffect(() => { if (coliseo.length && !coliseo.some((g) => g.name === lift)) setLift(coliseo[0].name); }, [coliseo, lift]);

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
  const compactMoney = (n: number) => new Intl.NumberFormat(nf, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const liftData = coliseo.find((g) => g.name === lift)?.data ?? [];
  const liftBest = Math.max(0, ...liftData.map((d) => d.weight));
  const liftFirst = liftData[0]?.weight ?? 0, liftLast = liftData[liftData.length - 1]?.weight ?? 0;
  const liftBestDay = liftData.find((d) => d.weight === liftBest)?.date;
  const sleepAvg = sleep.length ? sleep.reduce((a, s) => a + s.duration, 0) / sleep.length : 0;
  const heatCounts = useMemo(() => new Map(heat.map((h) => [h.date.slice(0, 10), h.count])), [heat]);

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <canvas ref={canvasRef} className="hidden" aria-hidden />
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        aside={<>
          <div className="w-full max-w-[460px] sm:w-[440px]"><SegmentedControl label={t.period} value={period} onChange={setPeriod} options={PERIODS} /></div>
          <Button variant="secondary" size="md" onClick={() => void share({ name: user?.displayName || 'NoutLife', activeDays: xp?.activeDays ?? 0, days: xp?.daysInPeriod ?? 7, habits: summary?.totals.habitCompletions ?? 0, streak: user?.currentStreak ?? 0, period: per.long })}><Share2 aria-hidden className="size-4" strokeWidth={1.75} />{t.share}</Button>
        </>}
      />

      {lite && (
        <motion.div variants={item}>
          <LiteNotice feature="history">{t.liteNotice}</LiteNotice>
        </motion.div>
      )}

      {failed > 0 && !loading && (
        <motion.div variants={item} role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-error/[var(--lq-soft-alpha)] px-4 py-3">
          <p className="flex items-center gap-2 text-body-md text-error-text"><AlertTriangle aria-hidden className="size-5" />{failed === 1 ? t.oneMetric : t.manyMetrics(failed)}</p>
          <Button variant="secondary" size="sm" onClick={() => void load(period)}><RefreshCw aria-hidden className="size-4" />{t.retry}</Button>
        </motion.div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <motion.div variants={item} className="min-w-0 flex-[2_1_520px]">
          <SpotCard aria-label={t.xpProgress} className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-label-lg text-on-surface"><Zap aria-hidden className="size-4 text-primary-text" />{t.xpRecorded(per.long)}</span>
              <span className="flex flex-wrap gap-2">
                <Badge variant="primary">{t.level(user?.level ?? 1)}</Badge>
                {summary && <Badge variant={summary.xp.change >= 0 ? 'success' : 'warning'} icon={TrendingUp}>{summary.xp.change >= 0 ? '+' : ''}{t.vsPrev(String(Math.round(summary.xp.change)))}</Badge>}
              </span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-[3rem] font-bold leading-none tracking-[-2px] md:text-[4rem]"><AnimatedValue value={xpTotal} /></span>
              <span className="text-heading-md text-on-surface-light">{t.xpUnit}</span>
            </div>
            {loading && !xp ? <Skeleton className="h-[240px] rounded-xl" /> : xpData.length === 0 ? (
              <p className="py-10 text-center text-body-md text-on-surface-light">{t.noXp}</p>
            ) : (
              <>
                <TrendChart key={period} values={xpData.map((d) => d.cumulativeXp)} bars={xpData.map((d) => d.xp)}
                  xLabels={xpData.map((d) => shortDate(d.date))} yFormat={(n) => fmt(n)} height={250}
                  mark={(i) => xpData[i].xp > 0 && xpData[i].xp === xpBest}
                  label={t.xpAccum(per.long, fmt(xpTotal))}
                  tipText={(i) => t.xpTip(longDate(xpData[i].date), xpData[i].xp ? t.xpDayTip(fmt(xpData[i].xp)) : t.noXpDay, fmt(xpData[i].cumulativeXp))}
                  tip={(i) => {
                    const d = xpData[i];
                    return (
                      <>
                        <TipHead sub={d.xp > 0 && d.xp === xpBest ? t.bestDay : undefined}>{longDate(d.date)}</TipHead>
                        <div className="flex flex-col gap-1">
                          <TipRow tone="primary" label={t.earnedThatDay} value={d.xp ? `+${fmt(d.xp)} XP` : '0 XP'} strong />
                          <TipRow label={t.accumulated} value={`${fmt(d.cumulativeXp)} XP`} />
                          {xp && xp.avg > 0 && <TipRow label={t.vsAvg} value={signed(Math.round(d.xp - xp.avg), ' XP')} />}
                        </div>
                      </>
                    );
                  }} />
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-body-sm text-on-surface-light">
                  <span className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-4 rounded-full bg-primary" />{t.legendAccum}</span>
                  <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-primary/30" />{t.legendEachDay}</span>
                  <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-secondary" />{t.legendBest}</span>
                  <span className="ml-auto hidden sm:inline">{t.hoverHint}</span>
                </div>
              </>
            )}
            <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
              <div><div className="text-body-sm text-on-surface-light">{t.average}</div><div className="font-mono text-label-lg tabular-nums md:text-body-md md:font-semibold">{fmt(xp?.avg ?? 0)} {t.xpPerDay}</div></div>
              <div><div className="text-body-sm text-on-surface-light">{t.daysWithXp}</div><div className="font-mono text-label-lg tabular-nums md:text-body-md md:font-semibold">{xp?.activeDays ?? 0} {t.ofWord} {xp?.daysInPeriod ?? 0}</div></div>
              <div><div className="text-body-sm text-on-surface-light">{t.toNextLevel}</div><div className="font-mono text-label-lg tabular-nums md:text-body-md md:font-semibold">{fmt(Math.max(0, (user?.xpToNextLevel ?? 0) - (user?.xp ?? 0)))} {t.xpUnit}</div></div>
            </div>
          </SpotCard>
        </motion.div>

        <motion.div variants={item} className="min-w-0 flex-[1_1_300px]">
          <SpotCard aria-label={t.lifeScore} padding="md" className="flex flex-col items-center gap-4 text-center md:p-6">
            <div className="flex w-full items-center justify-between"><span className="text-label-lg">{t.lifeScore}</span><Badge>{dyn?.trend === 'up' ? t.rising : dyn?.trend === 'down' ? t.falling : t.balance}</Badge></div>
            <div className="relative">
              <ProgressRing value={lifeScore} tone="warning" size={200} stroke={7} label={t.lifeScore} valueText={`${lifeScore} ${t.of100}`}>
                <span className="font-mono text-[3rem] font-bold leading-none tabular-nums"><AnimatedValue value={lifeScore} /></span>
                <span className="text-body-sm text-on-surface-light">{t.of100}</span>
              </ProgressRing>
              <ProgressRing value={coverage} tone="primary" size={150} stroke={5} label={t.coverage} valueText={`${coverage}%`}
                className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [&_span]:hidden" />
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-body-sm text-on-surface">
              <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-warning" />{t.scoreLegend}</span>
              <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-full bg-primary" />{t.coveragePct(coverage)}</span>
            </div>
            <p className="text-body-sm text-on-surface-light">{t.lifeNote}</p>
          </SpotCard>
        </motion.div>
      </div>

      {zones.length > 0 && (
        <Reveal className="flex flex-col gap-6" aria-labelledby="zones-t">
          <div><h2 id="zones-t" className="text-heading-lg">{t.zonesTitle}</h2><p className="text-body-sm text-on-surface-light">{t.zonesSummary(withData, zones.filter((z) => z.isTracking).length, per.long)}</p></div>
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
                        <div className="flex justify-between"><span className="text-body-sm text-on-surface-light">{t.pace}</span><span className="font-mono text-label-lg tabular-nums">{z.scoreAvailable ? <AnimatedValue value={Math.round(z.score)} format={(n) => `${Math.round(n)}%`} /> : '—'}</span></div>
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
        <Reveal aria-label={t.totals} className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
          <StatCard icon={Zap} tone="primary" value={summary.totals.xpEarned} label={t.xpHistory} />
          <StatCard icon={Flag} tone="forest" value={summary.quests.completed} label={t.questsIn(per.long)} />
          <StatCard icon={CheckCircle2} tone="success" value={summary.totals.habitCompletions} label={t.habitsDone} />
          <StatCard icon={Dumbbell} tone="warning" value={summary.totals.workouts} label={t.workouts} />
        </Reveal>
      )}

      <Reveal className="flex flex-col gap-6" aria-labelledby="detail-t">
        <div><h2 id="detail-t" className="text-heading-lg">{t.detailed}</h2><p className="text-body-sm text-on-surface-light">{t.detailedHint}</p></div>
        <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><IconChip icon={Wallet} tone="success" size="sm" /><div><h3 className="text-heading-sm">{t.moneyFlow}</h3><p className="text-body-sm text-on-surface-light">{t.incomeExpenses(per.long)}</p></div></div>
            <div className="grid grid-cols-3 gap-2">
              {([[t.income, fin.inc, 'text-success-text'], [t.expenses, fin.exp, 'text-error-text'], [t.net, fin.inc - fin.exp, '']] as const).map(([l, v, c]) => (
                <Card key={l} padding="sm" className="bg-background px-3"><div className="text-body-sm text-on-surface-light">{l}</div><div className={cn('truncate font-mono text-label-lg tabular-nums', c)}>{money(v, currency)}</div></Card>
              ))}
            </div>
            {finData.length === 0 ? <p className="text-body-sm text-on-surface-light">{t.noMoney}</p> : (
              <>
                <GroupedBars key={period} height={220} yFormat={compactMoney}
                  series={[{ name: t.income, tone: 'success' }, { name: t.expenses, tone: 'error' }]}
                  groups={finData.map((f) => ({ label: shortDate(f.month), values: [f.income, f.expenses] }))}
                  label={t.incomesAndExpenses(finData[0].month.length === 7 ? t.byMonth : t.byDay)}
                  tipText={(i) => { const f = finData[i]; return t.tipIncomeExpense(longDate(f.month), money(f.income, currency), money(f.expenses, currency), money(f.income - f.expenses, currency)); }}
                  tip={(i) => {
                    const f = finData[i], net = f.income - f.expenses;
                    return (
                      <>
                        <TipHead>{longDate(f.month)}</TipHead>
                        <div className="flex flex-col gap-1">
                          <TipRow tone="success" label={t.income} value={money(f.income, currency)} />
                          <TipRow tone="error" label={t.expenses} value={money(f.expenses, currency)} />
                          <div className="my-1 border-t border-border" />
                          <TipRow label={net >= 0 ? t.saved : t.overspent} value={<span className={net >= 0 ? 'text-success-text' : 'text-error-text'}>{money(net, currency)}</span>} strong />
                        </div>
                      </>
                    );
                  }} />
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-body-sm text-on-surface">
                  <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-success" />{t.income}</span>
                  <span className="flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-sm bg-error" />{t.expenses}</span>
                  <span className="ml-auto text-on-surface-light">{shortDate(finData[0].month)} – {shortDate(finData[finData.length - 1].month)}</span>
                </div>
              </>
            )}
          </Card>

          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><IconChip icon={Moon} tone="info" size="sm" /><div><h3 className="text-heading-sm">{t.sleep}</h3><p className="text-body-sm text-on-surface-light">{t.sleepHint} <span className="font-mono">{sleepAvg ? hm(sleepAvg) : '—'}</span></p></div></div>
            {sleep.length === 0 ? <p className="text-body-sm text-on-surface-light">{t.noSleep}</p> : (
              <>
                <TrendChart key={period} tone="info" zeroBased={false} goal={{ value: SLEEP_GOAL_H, label: t.sleepGoal(SLEEP_GOAL_H) }} height={220}
                  values={sleep.map((s) => s.duration)} xLabels={sleep.map((s) => shortDate(s.date))} yFormat={(n) => `${n} h`}
                  label={t.sleepLabel}
                  tipText={(i) => `${longDate(sleep[i].date)}: ${hm(sleep[i].duration)}, ${t.qualityLabel.toLowerCase()} ${quality(sleep[i].quality, locale).name}`}
                  tip={(i) => {
                    const s = sleep[i], diff = s.duration - SLEEP_GOAL_H;
                    return (
                      <>
                        <TipHead>{longDate(s.date)}</TipHead>
                        <div className="flex flex-col gap-1">
                          <TipRow tone="info" label={t.sleptLabel} value={hm(s.duration)} strong />
                          <TipRow label={t.qualityLabel} value={`${quality(s.quality, locale).name} · ${Math.round(s.quality)}/5`} />
                          <div className={cn('mt-1 text-label-md', diff >= 0 ? 'text-success-text' : 'text-warning-text')}>
                            {diff >= 0 ? t.goalMet(hm(diff)) : t.goalMissed(hm(-diff))}
                          </div>
                        </div>
                      </>
                    );
                  }} />
                {sleep.length === 1 && <p className="text-body-sm text-on-surface-light">{t.logAnotherNight}</p>}
              </>
            )}
          </Card>

          <Card padding="lg" className="flex flex-col gap-5">
            <div className="flex items-center gap-3"><IconChip icon={Dumbbell} tone="warning" size="sm" /><div><h3 className="text-heading-sm">{t.strength}</h3><p className="text-body-sm text-on-surface-light">{t.strengthHint}</p></div></div>
            {coliseo.length === 0 ? <p className="text-body-sm text-on-surface-light">{t.noStrength}</p> : (
              <>
                <ChipGroup label={t.exercise} value={lift} onChange={setLift} options={coliseo.slice(0, 8).map((g) => ({ value: g.name, label: g.name }))} />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={lift} className="flex flex-col gap-4"
                    initial={motionReduced ? { opacity: 0 } : { opacity: 0, y: 10, ...blurFrom(4) }}
                    animate={motionReduced ? { opacity: 1 } : { opacity: 1, y: 0, ...blurTo() }}
                    exit={motionReduced ? { opacity: 0, transition: { duration: 0.15 } } : { opacity: 0, y: -6, transition: { duration: 0.15 } }} transition={{ duration: motionReduced ? 0.15 : 0.45, ease: expo }}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {([
                        [t.record, kg(liftBest), liftBestDay ? shortDate(liftBestDay) : ''],
                        [t.lastSession, kg(liftLast), liftData.length ? shortDate(liftData[liftData.length - 1].date) : ''],
                        [t.progress, liftData.length > 1 ? signed(liftLast - liftFirst, ' kg') : '—', liftData.length > 1 && liftFirst > 0 ? `${signed(Math.round(((liftLast - liftFirst) / liftFirst) * 100), ' %')} ${t.sinceFirst}` : t.sinceFirstSession],
                        [t.sessions, String(liftData.length), per.long],
                      ] as const).map(([l, v, s]) => (
                        <div key={l} className="rounded-md border border-border bg-background px-3 py-2.5">
                          <div className="text-caption text-on-surface-light">{l}</div>
                          <div className={cn('truncate font-mono text-label-lg tabular-nums', l === t.progress && liftData.length > 1 && (liftLast >= liftFirst ? 'text-success-text' : 'text-error-text'))}>{v}</div>
                          <div className="truncate text-caption text-on-surface-light">{s}</div>
                        </div>
                      ))}
                    </div>
                    <TrendChart tone="warning" zeroBased={false} height={200} values={liftData.map((d) => d.weight)} xLabels={liftData.map((d) => shortDate(d.date))}
                      yFormat={(n) => `${n} kg`} mark={(i) => liftData.length > 1 && liftData[i].weight === liftBest}
                      label={t.liftLabel(lift)}
                      tipText={(i) => `${longDate(liftData[i].date)}: ${kg(liftData[i].weight)}`}
                      tip={(i) => {
                        const d = liftData[i], prev = liftData[i - 1];
                        const diff = prev ? d.weight - prev.weight : null;
                        return (
                          <>
                            <TipHead sub={lift}>{longDate(d.date)}</TipHead>
                            <div className="flex flex-col gap-1">
                              <TipRow tone="warning" label={t.maxWeight} value={kg(d.weight)} strong />
                              {diff != null && <TipRow label={t.vsPrevSession} value={<span className={diff > 0 ? 'text-success-text' : diff < 0 ? 'text-error-text' : ''}>{signed(diff, ' kg')}</span>} />}
                              {liftData.length > 1 && d.weight === liftBest && <div className="mt-1 text-label-md text-secondary-text">{t.yourPeriodRecord}</div>}
                              {diff == null && <div className="mt-1 text-caption text-on-surface-light">{t.firstSession}</div>}
                            </div>
                          </>
                        );
                      }} />
                    {liftData.length === 1 && <p className="text-body-sm text-on-surface-light">{t.strengthMore(lift)}</p>}
                  </motion.div>
                </AnimatePresence>
              </>
            )}
          </Card>

          <Card padding="lg" className="flex flex-col gap-4">
            <div className="flex items-center gap-3"><IconChip icon={TrendingUp} tone="info" size="sm" /><div><h3 className="text-heading-sm">{t.projections}</h3><p className="text-body-sm text-on-surface-light">{t.projectionsHint}</p></div></div>
            <div className="grid grid-cols-2 gap-2">
              <Card padding="sm" className="bg-background"><div className="text-body-sm text-on-surface-light">{t.nextLevel}</div><div className="font-mono text-heading-md">{pred?.daysToNextLevel != null ? t.days(pred.daysToNextLevel) : '—'}</div><div className="text-body-sm text-on-surface-light">{t.perDay(fmt(pred?.avgDailyXp ?? 0))}</div></Card>
              {pred?.goalPredictions[0] ? (
                <Card padding="sm" className="bg-background"><div className="truncate text-body-sm text-on-surface-light">{pred.goalPredictions[0].title}</div><div className="font-mono text-heading-md">{pred.goalPredictions[0].months != null ? t.months(pred.goalPredictions[0].months) : '—'}</div><div className="text-body-sm text-on-surface-light">{t.missing(money(pred.goalPredictions[0].remaining, currency))}</div></Card>
              ) : <Card padding="sm" className="bg-background"><div className="text-body-sm text-on-surface-light">{t.savingGoals}</div><div className="text-body-sm text-on-surface">{t.noGoals}</div></Card>}
            </div>
            {(pred?.habitRisks.length ?? 0) > 0 && (
              <>
                <span className="text-label-lg text-on-surface">{t.habitConsistency}</span>
                <ul className="flex flex-col">
                  {pred!.habitRisks.slice(0, 5).map((h) => {
                    const v = h.risk === 'high' ? { label: t.atRisk, variant: 'error' as const, icon: AlertTriangle } : h.risk === 'medium' ? { label: t.attention, variant: 'warning' as const, icon: AlertTriangle } : { label: t.onPace, variant: 'success' as const, icon: Check };
                    return (
                      <li key={h.title} className="flex min-h-12 items-center gap-3 rounded-md px-2 -mx-2 transition-colors hover:bg-surface-variant/60">
                        <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-body-md">{h.title}</span><span className="text-caption text-on-surface-light"><span className="font-mono">{h.completedDays}/{h.scheduledDays}</span> {t.daysDone} · {t.streak} <span className="font-mono">{h.currentStreak}</span></span></span>
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
              <div><h2 className="text-heading-sm">{t.ritmoArea}</h2><p className="text-body-sm text-on-surface-light">{t.areaHint}</p></div>
              <RadarPlus key={period} axes={radar} label={radar.map((r) => `${r.label} ${Math.round(r.value)}%`).join(', ')} />
              <div className="flex flex-wrap justify-center gap-5 text-body-sm text-on-surface">
                <span className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-3.5 bg-primary" />{t.thisPeriod}</span>
                <span className="flex items-center gap-1.5"><span aria-hidden className="w-3.5 border-t-2 border-dashed border-on-surface-light" />{t.previous}</span>
              </div>
            </SpotCard>
          </Reveal>
        )}
        <Reveal as="div">
          <Card padding="lg" className="flex h-full flex-col gap-4">
            <div><h2 className="text-heading-sm">{t.habitConsistency}</h2><p className="text-body-sm text-on-surface-light">{t.habitsConsistencyHint} · <span className="font-mono">{fmt(heat.reduce((a, h) => a + h.count, 0))}</span> {t.habitsCompleted}</p></div>
            <HabitHeatmap counts={heatCounts} />
          </Card>
        </Reveal>
      </div>

      {checkins.length > 0 && (
        <Reveal>
          <Card padding="lg" className="flex flex-col gap-4">
            <div><h2 className="text-heading-sm">{t.moodMonth}</h2><p className="text-body-sm text-on-surface-light">{t.moodHint}</p></div>
            <ul className="flex flex-wrap gap-1.5" aria-label={t.moodByDay}>
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
