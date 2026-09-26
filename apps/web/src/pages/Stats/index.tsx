import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Download,
  Flame,
  RefreshCw,
  HeartPulse,
} from 'lucide-react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import type { User } from '@lifequest/shared';
import { FlowButton } from '@/components/ui/flow-button';
import AdvancedStats, { type AdvancedStatsData } from '@/components/ui/advanced-stats';
import {
  FinanceTrendCard,
  GymProgressionCard,
  PredictionsCard,
  SleepTrendCard,
} from '@/components/ui/advanced-stats-utils/analytics-details';
import {
  getActivityRadar,
  getFinanceTrend,
  getGymProgression,
  getHabitHeatmap,
  getPredictions,
  getSleepScatter,
  getStatsSummary,
  getXpHistory,
  type FinanceTrendPoint,
  type GymProgression,
  type HeatmapPoint,
  type SleepTrendPoint,
  type StatsPredictions,
  type StatsSummary,
} from '../../services/stats.service';
import {
  fetchDynamicLifeScore,
  fetchLifeScore,
  type DynamicLifeScoreData,
  type LifeScore,
} from '../../services/lifescore.service';
import { getCheckinHistory, type DailyCheckin } from '../../services/checkin.service';
import { useAuthStore } from '../../store/authStore';

type Period = 'week' | 'month' | '3months' | 'year';

const PERIODS: Array<{ id: Period; label: string; summaryLabel: string }> = [
  { id: 'week', label: 'Semana', summaryLabel: 'Última semana' },
  { id: 'month', label: 'Mes', summaryLabel: 'Mes actual' },
  { id: '3months', label: '3 meses', summaryLabel: 'Últimos 3 meses' },
  { id: 'year', label: 'Año', summaryLabel: 'Año actual' },
];

interface RadarComparisonPoint {
  subject: string;
  current: number;
  previous: number;
}

function HeatmapCell({ count }: { count: number }) {
  const opacity = count === 0 ? 0.07 : count < 3 ? 0.3 : count < 6 ? 0.6 : 1;
  return (
    <div
      className="h-3 w-3 rounded-sm"
      style={{ background: `rgba(154, 123, 28, ${opacity})` }}
      title={`${count} hábitos completados`}
    />
  );
}

function ActivityHeatmap({ data }: { data: HeatmapPoint[] }) {
  const weeks: HeatmapPoint[][] = [];
  const activityByDay = new Map(data.map((entry) => [entry.date.split('T')[0], entry.count]));
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 363);
  start.setDate(start.getDate() - start.getDay());

  const cursor = new Date(start);
  while (cursor <= today) {
    const week: HeatmapPoint[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = cursor.toISOString().split('T')[0];
      week.push({ date, count: activityByDay.get(date) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-[3px]" aria-label="Mapa anual de actividad de hábitos">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[3px]">
            {week.map((day) => <HeatmapCell key={day.date} count={day.count} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

const MOOD_COLORS = ['', '#b5453a', '#a8a8b0', '#8a8a92', '#6cb98a', '#3f7a55'];

function MoodHeatmap({ checkins }: { checkins: DailyCheckin[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const moodsByDay = new Map(checkins.map((checkin) => [new Date(checkin.date).getDate(), checkin.mood]));
  const cells: Array<number | null> = [];

  for (let index = 0; index < firstDay; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--text-muted)]">
        {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          const mood = day ? moodsByDay.get(day) : undefined;
          const isToday = day === now.getDate();
          return (
            <div
              key={`${day ?? 'empty'}-${index}`}
              className="flex aspect-square items-center justify-center rounded-md text-[10px] font-medium text-[var(--text-secondary)]"
              style={{
                background: day ? (mood ? `${MOOD_COLORS[mood]}88` : 'var(--bg-muted)') : 'transparent',
                border: isToday ? '1px solid var(--accent-gold)' : '1px solid transparent',
              }}
            >
              {day ?? ''}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
        <span>Ánimo:</span>
        {MOOD_COLORS.slice(1).map((color, index) => (
          <span key={color} className="h-3 w-3 rounded-sm" style={{ background: `${color}88` }} title={`${index + 1}/5`} />
        ))}
        <span className="ml-1">bajo → alto</span>
      </div>
    </div>
  );
}

function ShareButton({ user, score }: { user: User | null; score: LifeScore | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function generate() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    canvas.width = 600;
    canvas.height = 380;
    const gradient = context.createLinearGradient(0, 0, 600, 380);
    gradient.addColorStop(0, '#141416');
    gradient.addColorStop(1, '#0c0c0e');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 600, 380);

    context.strokeStyle = '#d9b44a66';
    context.lineWidth = 2;
    context.roundRect(4, 4, 592, 372, 16);
    context.stroke();

    context.fillStyle = '#d9b44a';
    context.font = 'bold 28px Montserrat, system-ui';
    context.fillText('LifeQuest', 32, 56);
    context.fillStyle = '#9ca3af';
    context.font = '16px Montserrat, system-ui';
    context.fillText(user?.displayName ?? 'Héroe', 32, 84);

    context.fillStyle = '#d9b44a22';
    context.roundRect(32, 104, 110, 36, 8);
    context.fill();
    context.fillStyle = '#d9b44a';
    context.font = 'bold 18px Montserrat, system-ui';
    context.fillText(`Nivel ${user?.level ?? 1}`, 50, 128);

    if (score) {
      context.fillStyle = '#ffffff';
      context.font = 'bold 72px Montserrat, system-ui';
      context.fillText(score.total.toString(), 400, 160);
      context.fillStyle = '#9ca3af';
      context.font = '18px Montserrat, system-ui';
      context.fillText('Life Score', 400, 188);
    }

    context.fillStyle = '#e5e7eb';
    context.font = '15px Montserrat, system-ui';
    context.fillText(`Racha: ${user?.currentStreak ?? 0} días`, 32, 200);
    context.fillText(`XP actual: ${(user?.xp ?? 0).toLocaleString('es-CO')}`, 32, 228);
    context.fillText(`STR ${user?.strength ?? 1} | INT ${user?.intelligence ?? 1} | CHA ${user?.charisma ?? 1}`, 32, 256);

    context.fillStyle = '#6b7280';
    context.font = '13px Montserrat, system-ui';
    context.fillText(new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }), 32, 340);
    context.fillText('lifequest.app', 450, 340);

    const link = document.createElement('a');
    link.download = `lifequest-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <FlowButton onClick={generate} tone="ghost" size="sm" withArrows={false} className="gap-1.5 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5" aria-hidden="true" /> Compartir</span>
      </FlowButton>
    </>
  );
}

export default function StatsPage() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<Period>('month');
  const [lifeScore, setLifeScore] = useState<LifeScore | null>(null);
  const [dynamicScore, setDynamicScore] = useState<DynamicLifeScoreData | null>(null);
  const [xpHistory, setXpHistory] = useState<Array<{ date: string; xp: number }>>([]);
  const [xpAverage, setXpAverage] = useState(0);
  const [radarData, setRadarData] = useState<RadarComparisonPoint[]>([]);
  const [financeTrend, setFinanceTrend] = useState<FinanceTrendPoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [sleepTrend, setSleepTrend] = useState<SleepTrendPoint[]>([]);
  const [gymProgression, setGymProgression] = useState<GymProgression[]>([]);
  const [predictions, setPredictions] = useState<StatsPredictions | null>(null);
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (selectedPeriod: Period) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [
        score,
        dynamic,
        xp,
        radar,
        finance,
        habits,
        sleep,
        gym,
        prediction,
        checkinHistory,
        stats,
      ] = await Promise.allSettled([
        fetchLifeScore(),
        fetchDynamicLifeScore(),
        getXpHistory(selectedPeriod),
        getActivityRadar(),
        getFinanceTrend(),
        getHabitHeatmap(),
        getSleepScatter(selectedPeriod),
        getGymProgression(selectedPeriod),
        getPredictions(),
        getCheckinHistory(30),
        getStatsSummary(selectedPeriod),
      ]);

      if (score.status === 'fulfilled') setLifeScore(score.value);
      if (dynamic.status === 'fulfilled') setDynamicScore(dynamic.value);
      if (xp.status === 'fulfilled') {
        setXpHistory(xp.value.data);
        setXpAverage(xp.value.avg);
      }
      if (radar.status === 'fulfilled') {
        const previousBySubject = new Map(radar.value.previous.map((item) => [item.subject, item.value]));
        setRadarData(radar.value.current.map((item) => ({
          subject: item.subject,
          current: item.value,
          previous: previousBySubject.get(item.subject) ?? 0,
        })));
      }
      if (finance.status === 'fulfilled') setFinanceTrend(finance.value);
      if (habits.status === 'fulfilled') setHeatmap(habits.value);
      if (sleep.status === 'fulfilled') setSleepTrend(sleep.value);
      if (gym.status === 'fulfilled') setGymProgression(gym.value);
      if (prediction.status === 'fulfilled') setPredictions(prediction.value);
      if (checkinHistory.status === 'fulfilled') setCheckins(checkinHistory.value);
      if (stats.status === 'fulfilled') setSummary(stats.value);

      const failedRequests = [score, dynamic, xp, radar, finance, habits, sleep, gym, prediction, checkinHistory, stats]
        .filter((result) => result.status === 'rejected').length;
      if (failedRequests > 0) {
        setLoadError(
          failedRequests === 1
            ? 'Una métrica no pudo actualizarse. Puedes volver a intentarlo.'
            : `${failedRequests} métricas no pudieron actualizarse. Puedes volver a intentarlo.`,
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(period); }, [load, period]);

  const selectedPeriod = PERIODS.find((item) => item.id === period) ?? PERIODS[1];
  const advancedData: AdvancedStatsData = {
    periodLabel: selectedPeriod.summaryLabel,
    level: user?.level,
    currentXp: user?.xp,
    xpToNextLevel: user?.xpToNextLevel,
    xpHistory,
    xpPeriod: summary?.xp.value ?? 0,
    xpAverage,
    xpChange: summary?.xp.change,
    questsInPeriod: summary?.quests.completed ?? 0,
    questsChange: summary?.quests.change,
    lifeScore: dynamicScore?.totalScore ?? lifeScore?.total ?? null,
    lifeScoreTrend: dynamicScore?.trend,
    zones: dynamicScore?.zones.map((zone) => ({ id: zone.id, name: zone.name, score: zone.score })),
    currentStreak: summary?.currentStreak ?? user?.currentStreak,
    bestStreak: summary?.bestStreak ?? user?.longestStreak,
    totals: summary?.totals,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--accent-gold)] shadow-pixel">
              <BarChart3 className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Estadísticas</h1>
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Tu progreso real, acumulado y organizado por periodo.</p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <ShareButton user={user} score={lifeScore} />
          <div className="flex rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] p-1" role="group" aria-label="Periodo de estadísticas">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                aria-pressed={period === item.id}
                className={[
                  'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3',
                  period === item.id
                    ? 'bg-[var(--text-primary)] text-[var(--bg-deep)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
                ].join(' ')}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <AdvancedStats data={advancedData} loading={loading} />

      {loadError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--accent-red)_40%,var(--border))] bg-[color-mix(in_srgb,var(--accent-red)_8%,var(--bg-panel))] px-4 py-3">
          <p className="text-sm text-[var(--text-secondary)]">{loadError}</p>
          <FlowButton onClick={() => void load(period)} tone="ghost" size="sm" withArrows={false} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Reintentar
          </FlowButton>
        </div>
      ) : null}

      <section aria-label="Seguimiento detallado" className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Seguimiento detallado</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Todas las series se calculan a partir de registros reales de LifeQuest.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <FinanceTrendCard data={financeTrend} currency={user?.currency ?? 'COP'} loading={loading} />
          <SleepTrendCard data={sleepTrend} periodLabel={selectedPeriod.summaryLabel} loading={loading} />
          <GymProgressionCard data={gymProgression} periodLabel={selectedPeriod.summaryLabel} loading={loading} />
          <PredictionsCard data={predictions} currency={user?.currency ?? 'COP'} loading={loading} />
        </div>
      </section>

      <section aria-label="Detalles de actividad" className="grid gap-4 xl:grid-cols-2">
        {radarData.length > 0 ? (
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-pixel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Activity className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                  Ritmo por área
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Semana actual frente a la anterior.</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Últimas 2 semanas</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={88}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Semana anterior" dataKey="previous" stroke="var(--text-muted)" fill="var(--text-muted)" fillOpacity={0.07} strokeWidth={1.25} />
                <Radar name="Semana actual" dataKey="current" stroke="var(--accent-gold)" fill="var(--accent-gold)" fillOpacity={0.18} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </article>
        ) : null}

        {heatmap.length > 0 ? (
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-pixel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <Flame className="h-4 w-4 text-[var(--accent-gold)]" aria-hidden="true" />
                  Constancia de hábitos
                </h2>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Cada bloque representa hábitos completados durante el último año.</p>
              </div>
              <CalendarDays className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
            </div>
            <div className="mt-6">
              <ActivityHeatmap data={heatmap} />
            </div>
          </article>
        ) : null}

        {checkins.length > 0 ? (
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-pixel xl:col-span-2">
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)] sm:items-center">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <HeartPulse className="h-4 w-4 text-[var(--accent-red)]" aria-hidden="true" />
                  Estado emocional del mes
                </h2>
                <p className="mt-1 max-w-lg text-xs leading-5 text-[var(--text-muted)]">Tus check-ins ayudan a relacionar tu ánimo con el ritmo de tus hábitos, misiones y descanso.</p>
              </div>
              <MoodHeatmap checkins={checkins} />
            </div>
          </article>
        ) : null}
      </section>
    </div>
  );
}
