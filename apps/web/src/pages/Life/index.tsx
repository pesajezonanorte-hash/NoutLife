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
import { useLifeChange } from '@/lib/lifeSync';
import { INTL_LOCALE, useLocale, useText, type Copy } from '@/lib/i18n';

type Tab = 'score' | 'correlations' | 'year';
type Bar = Exclude<Tone, 'muted' | 'secondary'>;

const COPY: Copy<{
  loading: string; eyebrow: string; title: string; description: string; view: string;
  tabs: Record<Tab, string>;
  areas: Record<string, string>;
  verdict: (total: number) => string;
  ofHundred: (n: number) => string;
  areasTitle: string; detailTitle: string; weightNote: string; weight: string;
  noScore: string; noScoreBody: string;
  noPatterns: string; noPatternsBody: string;
  yearWriting: string; yearWritingBody: string; yearInReview: string; bestMonth: (m: string) => string;
  xp: string; workouts: string; avgSleep: string; quests: string; journal: string; books: string; hoursShort: string;
  radarLabel: string; scoreLabel: string; areaLabel: (label: string, v: number) => string;
  error: string;
}> = {
  es: {
    loading: 'Calculando tu Life Score', eyebrow: 'Life Score', title: 'Tu vida, en una cifra',
    description: 'Una puntuación de 0 a 100 que combina tus hábitos, misiones, finanzas y el resto de tus zonas.',
    view: 'Vista', tabs: { score: 'Puntuación', correlations: 'Patrones', year: 'Tu año' },
    areas: { habits: 'Hábitos', finances: 'Finanzas', fitness: 'Fitness', quests: 'Misiones', learning: 'Aprendizaje', relationships: 'Relaciones', journal: 'Diario' },
    verdict: (total) => (total >= 75 ? 'Tu vida está en plena forma.' : total >= 50 ? 'Vas por buen camino: sigue sumando.' : 'Cada día cuenta: empieza por un hábito.'),
    ofHundred: (n) => `${n} de 100`,
    areasTitle: 'Áreas de vida', detailTitle: 'Detalle por área', weightNote: 'El peso indica cuánto cuenta cada área en el total.', weight: 'Peso',
    noScore: 'Aún no hay puntuación', noScoreBody: 'Registra hábitos, misiones o finanzas y tu Life Score aparecerá aquí.',
    noPatterns: 'Sin suficientes datos', noPatternsBody: 'Registra unos días más y detectaremos patrones entre tus zonas.',
    yearWriting: 'Tu año aún se está escribiendo', yearWritingBody: 'Vuelve cuando tengas algunas semanas de registros.',
    yearInReview: 'en revisión', bestMonth: (m) => `Tu mejor mes fue ${m}.`,
    xp: 'XP ganada', workouts: 'Entrenamientos', avgSleep: 'Sueño medio por noche', quests: 'Misiones completadas', journal: 'Entradas del diario', books: 'Libros y cursos',
    hoursShort: 'h', radarLabel: 'Puntuación por área de vida', scoreLabel: 'Life Score', areaLabel: (label, v) => `${label}: ${v} de 100`,
    error: 'No pudimos cargar tu Life Score',
  },
  en: {
    loading: 'Calculating your Life Score', eyebrow: 'Life Score', title: 'Your life, in one number',
    description: 'A score from 0 to 100 that combines your habits, goals, finances and the rest of your zones.',
    view: 'View', tabs: { score: 'Score', correlations: 'Patterns', year: 'Your year' },
    areas: { habits: 'Habits', finances: 'Finances', fitness: 'Fitness', quests: 'Goals', learning: 'Learning', relationships: 'Relationships', journal: 'Journal' },
    verdict: (total) => (total >= 75 ? 'Your life is in great shape.' : total >= 50 ? 'You are on the right track: keep adding up.' : 'Every day counts: start with one habit.'),
    ofHundred: (n) => `${n} of 100`,
    areasTitle: 'Life areas', detailTitle: 'Detail by area', weightNote: 'The weight shows how much each area counts toward the total.', weight: 'Weight',
    noScore: 'No score yet', noScoreBody: 'Log habits, goals or finances and your Life Score will appear here.',
    noPatterns: 'Not enough data yet', noPatternsBody: 'Log a few more days and we will spot patterns across your zones.',
    yearWriting: 'Your year is still being written', yearWritingBody: 'Come back when you have a few weeks of logs.',
    yearInReview: 'in review', bestMonth: (m) => `Your best month was ${m}.`,
    xp: 'XP earned', workouts: 'Workouts', avgSleep: 'Average sleep per night', quests: 'Goals completed', journal: 'Journal entries', books: 'Books and courses',
    hoursShort: 'h', radarLabel: 'Score by life area', scoreLabel: 'Life Score', areaLabel: (label, v) => `${label}: ${v} of 100`,
    error: "We couldn't load your Life Score",
  },
};

const AREA_META: Record<string, { weight: number; tone: Bar }> = {
  habits: { weight: 25, tone: 'primary' },
  finances: { weight: 20, tone: 'info' },
  fitness: { weight: 15, tone: 'success' },
  quests: { weight: 15, tone: 'forest' },
  learning: { weight: 10, tone: 'warning' },
  relationships: { weight: 10, tone: 'error' },
  journal: { weight: 5, tone: 'forest' },
};

export default function LifePage() {
  const t = useText(COPY);
  const locale = useLocale();
  const [lifeScore, setLifeScore] = useState<LifeScore | null>(null);
  const [correlations, setCorrelations] = useState<string[]>([]);
  const [yearReview, setYearReview] = useState<YearInReview | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('score');

  const load = useCallback((silent?: unknown) => {
    if (silent !== true) setState('loading');
    Promise.all([fetchLifeScore(), fetchCorrelations(), fetchYearInReview()])
      .then(([ls, cr, yr]) => { setLifeScore(ls); setCorrelations(cr); setYearReview(yr); setState('ready'); })
      .catch(() => setState('error'));
  }, []);

  useEffect(() => load(), [load]);
  useLifeChange(() => load(true));

  if (state === 'loading') return <PageLoader label={t.loading} />;
  if (state === 'error') return <ErrorState title={t.error} onRetry={load} />;

  const areas = lifeScore?.breakdown
    ? Object.entries(lifeScore.breakdown).map(([key, val]) => ({
        key,
        score: Math.round(val),
        label: t.areas[key] ?? key,
        weight: AREA_META[key]?.weight ?? 0,
        tone: AREA_META[key]?.tone ?? ('primary' as Bar),
      }))
    : [];
  const tabs = (['score', 'correlations', 'year'] as Tab[]).map((value) => ({ value, label: t.tabs[value] }));

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-8 md:gap-12">
      <PageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        aside={<div className="w-full max-w-[420px] sm:w-[400px]"><SegmentedControl label={t.view} value={tab} onChange={setTab} options={tabs} /></div>}
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
                <ProgressRing value={lifeScore.total} size={200} stroke={14} label={t.scoreLabel} valueText={t.ofHundred(lifeScore.total)}>
                  <span className="flex flex-col items-center">
                    <span className="font-mono text-display-md tabular-nums">{lifeScore.total}</span>
                    <span className="text-label-md uppercase tracking-[0.12em] text-on-surface-light">{locale === 'en' ? 'of 100' : 'de 100'}</span>
                  </span>
                </ProgressRing>
                <p className="max-w-xs text-body-lg text-on-surface">{t.verdict(lifeScore.total)}</p>
              </Card>

              <Card padding="lg" className="flex flex-col gap-4">
                <h2 className="text-heading-md">{t.areasTitle}</h2>
                <RadarChart label={t.radarLabel} tone="primary" axes={areas.map((a) => ({ label: a.label, value: a.score / 100 }))} />
              </Card>

              <Card padding="lg" className="flex flex-col gap-5 lg:col-span-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-heading-md">{t.detailTitle}</h2>
                  <span className="text-body-sm text-on-surface-light">{t.weightNote}</span>
                </div>
                <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
                  {areas.map((a) => (
                    <motion.li key={a.key} variants={item} className="flex flex-col gap-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-label-lg">{a.label}</span>
                        <span className="flex items-baseline gap-3 text-body-sm text-on-surface-light">
                          <span>{t.weight} <span className="font-mono tabular-nums">{a.weight}%</span></span>
                          <span className="font-mono text-label-lg tabular-nums text-on-background">{a.score}/100</span>
                        </span>
                      </div>
                      <ProgressBar value={a.score} tone={a.tone} label={t.areaLabel(a.label, a.score)} />
                    </motion.li>
                  ))}
                </motion.ul>
              </Card>
            </div>
          ) : (
            <Card><EmptyState icon={Sparkles} title={t.noScore} description={t.noScoreBody} /></Card>
          ))}

          {tab === 'correlations' && (correlations.length === 0 ? (
            <Card><EmptyState icon={Search} tone="forest" title={t.noPatterns} description={t.noPatternsBody} /></Card>
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
                  <h2 className="text-heading-md"><span className="font-mono tabular-nums">{yearReview.year}</span> {t.yearInReview}</h2>
                  {yearReview.bestMonth && <p className="text-body-md text-on-surface-light">{t.bestMonth(yearReview.bestMonth.month)}</p>}
                </div>
              </Card>
              <motion.ul variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {([
                  [Zap, 'secondary', yearReview.totalXp, t.xp],
                  [Dumbbell, 'success', yearReview.totalWorkouts, t.workouts],
                  [Moon, 'info', `${(Math.round(yearReview.avgSleepHours * 10) / 10).toLocaleString(INTL_LOCALE[locale])} ${t.hoursShort}`, t.avgSleep],
                  [Flag, 'forest', yearReview.totalQuestsCompleted, t.quests],
                  [NotebookPen, 'primary', yearReview.totalJournalEntries, t.journal],
                  [BookOpen, 'warning', yearReview.totalBooksCompleted, t.books],
                ] as Array<[LucideIcon, Tone, number | string, string]>).map(([icon, tone, value, label]) => (
                  <motion.li key={label} variants={item}><StatCard icon={icon} tone={tone} value={value} label={label} /></motion.li>
                ))}
              </motion.ul>
            </>
          ) : (
            <Card><EmptyState icon={CalendarDays} tone="forest" title={t.yearWriting} description={t.yearWritingBody} /></Card>
          ))}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
