import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, CalendarDays, Dumbbell, Flag, Moon, NotebookPen, Search, Sparkles, Trophy, Zap, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Card, EmptyState, ErrorState, IconChip, PageLoader, ProgressBar, ProgressRing, RadarChart, SegmentedControl, StatCard,
  type Tone,
} from '@/components/ui/lq';
import { fetchCorrelations, fetchLifeScore, fetchYearInReview } from '@/services/lifescore.service';
import type { LifeScore, YearInReview } from '@/services/lifescore.service';
import { item, stagger } from '@/lib/motion';

type Tab = 'score' | 'correlations' | 'year';
type Bar = Exclude<Tone, 'muted' | 'secondary'>;

const TABS = [
  { value: 'score' as const, label: 'Puntuación' },
  { value: 'correlations' as const, label: 'Patrones' },
  { value: 'year' as const, label: 'Tu año' },
];

const AREAS: Record<string, { label: string; weight: number; tone: Bar }> = {
  habits: { label: 'Hábitos', weight: 25, tone: 'primary' },
  finances: { label: 'Finanzas', weight: 20, tone: 'info' },
  fitness: { label: 'Fitness', weight: 15, tone: 'success' },
  quests: { label: 'Misiones', weight: 15, tone: 'forest' },
  learning: { label: 'Aprendizaje', weight: 10, tone: 'warning' },
  relationships: { label: 'Relaciones', weight: 10, tone: 'error' },
  journal: { label: 'Diario', weight: 5, tone: 'forest' },
};

const verdict = (total: number) =>
  total >= 75 ? 'Tu vida está en plena forma.' : total >= 50 ? 'Vas por buen camino: sigue sumando.' : 'Cada día cuenta: empieza por un hábito.';

export default function LifePage() {
  const [lifeScore, setLifeScore] = useState<LifeScore | null>(null);
  const [correlations, setCorrelations] = useState<string[]>([]);
  const [yearReview, setYearReview] = useState<YearInReview | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('score');

  const load = useCallback(() => {
    setState('loading');
    Promise.all([fetchLifeScore(), fetchCorrelations(), fetchYearInReview()])
      .then(([ls, cr, yr]) => { setLifeScore(ls); setCorrelations(cr); setYearReview(yr); setState('ready'); })
      .catch(() => setState('error'));
  }, []);

  useEffect(load, [load]);

  if (state === 'loading') return <PageLoader label="Calculando tu Life Score" />;
  if (state === 'error') return <ErrorState onRetry={load} />;

  const areas = lifeScore?.breakdown
    ? Object.entries(lifeScore.breakdown).map(([key, val]) => ({
        key, score: Math.round(val), ...(AREAS[key] ?? { label: key, weight: 0, tone: 'primary' as Bar }),
      }))
    : [];

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <PageHeader
        eyebrow="Life Score"
        title="Tu vida, en una cifra"
        description="Una puntuación de 0 a 100 que combina tus hábitos, misiones, finanzas y el resto de tus zonas."
        aside={<div className="w-full max-w-[420px] sm:w-[400px]"><SegmentedControl label="Vista" value={tab} onChange={setTab} options={TABS} /></div>}
      />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6"
        >
          {tab === 'score' && (lifeScore ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <Card padding="lg" className="flex flex-col items-center gap-5 text-center">
                <ProgressRing value={lifeScore.total} size={200} stroke={14} label="Life Score" valueText={`${lifeScore.total} de 100`}>
                  <span className="flex flex-col items-center">
                    <span className="font-mono text-display-md tabular-nums">{lifeScore.total}</span>
                    <span className="text-label-md uppercase tracking-[0.12em] text-on-surface-light">de 100</span>
                  </span>
                </ProgressRing>
                <p className="max-w-xs text-body-lg text-on-surface">{verdict(lifeScore.total)}</p>
              </Card>

              <Card padding="lg" className="flex flex-col gap-4">
                <h2 className="text-heading-md">Áreas de vida</h2>
                <RadarChart label="Puntuación por área de vida" tone="primary" axes={areas.map((a) => ({ label: a.label, value: a.score / 100 }))} />
              </Card>

              <Card padding="lg" className="flex flex-col gap-5 lg:col-span-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-heading-md">Detalle por área</h2>
                  <span className="text-body-sm text-on-surface-light">El peso indica cuánto cuenta cada área en el total.</span>
                </div>
                <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
                  {areas.map((a) => (
                    <motion.li key={a.key} variants={item} className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-label-lg">{a.label}</span>
                        <span className="flex items-baseline gap-3 text-body-sm text-on-surface-light">
                          <span>Peso <span className="font-mono tabular-nums">{a.weight}%</span></span>
                          <span className="font-mono text-label-lg tabular-nums text-on-background">{a.score}/100</span>
                        </span>
                      </div>
                      <ProgressBar value={a.score} tone={a.tone} label={`${a.label}: ${a.score} de 100`} />
                    </motion.li>
                  ))}
                </motion.ul>
              </Card>
            </div>
          ) : (
            <Card><EmptyState icon={Sparkles} title="Aún no hay puntuación" description="Registra hábitos, misiones o finanzas y tu Life Score aparecerá aquí." /></Card>
          ))}

          {tab === 'correlations' && (correlations.length === 0 ? (
            <Card><EmptyState icon={Search} tone="forest" title="Sin suficientes datos" description="Registra unos días más y detectaremos patrones entre tus zonas." /></Card>
          ) : (
            <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {correlations.map((c, i) => (
                <motion.li key={i} variants={item}>
                  <Card className="flex h-full items-start gap-4">
                    <IconChip icon={Sparkles} tone="forest" size="sm" />
                    <p className="text-body-lg">{c}</p>
                  </Card>
                </motion.li>
              ))}
            </motion.ul>
          ))}

          {tab === 'year' && (yearReview ? (
            <>
              <Card padding="lg" className="flex flex-wrap items-center gap-4">
                <IconChip icon={Trophy} tone="secondary" />
                <div className="flex flex-col">
                  <h2 className="text-heading-md"><span className="font-mono tabular-nums">{yearReview.year}</span> en revisión</h2>
                  {yearReview.bestMonth && <p className="text-body-md text-on-surface-light">Tu mejor mes fue {yearReview.bestMonth.month}.</p>}
                </div>
              </Card>
              <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  [Zap, 'secondary', yearReview.totalXp, 'XP ganada'],
                  [Dumbbell, 'success', yearReview.totalWorkouts, 'Entrenamientos'],
                  [Moon, 'info', `${(Math.round(yearReview.avgSleepHours * 10) / 10).toLocaleString('es-CO')} h`, 'Sueño medio por noche'],
                  [Flag, 'forest', yearReview.totalQuestsCompleted, 'Misiones completadas'],
                  [NotebookPen, 'primary', yearReview.totalJournalEntries, 'Entradas del diario'],
                  [BookOpen, 'warning', yearReview.totalBooksCompleted, 'Libros y cursos'],
                ] as Array<[LucideIcon, Tone, number | string, string]>).map(([icon, tone, value, label]) => (
                  <motion.li key={label} variants={item}><StatCard icon={icon} tone={tone} value={value} label={label} /></motion.li>
                ))}
              </motion.ul>
            </>
          ) : (
            <Card><EmptyState icon={CalendarDays} tone="forest" title="Tu año aún se está escribiendo" description="Vuelve cuando tengas algunas semanas de registros." /></Card>
          ))}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
