// Inicio — Dashboard.dc.html (móvil), DashboardTablet.dc.html, DashboardDesktop.dc.html.
// Además del prototipo, conserva (rediseñados) los datos que ya da /dashboard:
// reto de recuperación, guía de 7 días, resumen semanal, sueño, entrenamiento,
// Life Score, agenda y logros recientes.
// Zona ambientada: la casa. Un lugar tranquilo: el saludo escrito con la letra de
// la marca, una ventana con el cielo de la hora real (cortinas que se abren y se
// mecen, planta y taza humeante en el alféizar) y su luz cayendo en la sala; de
// noche, la lámpara. Lo demás entra con calma, sin prisa.
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { Quest } from '@noutlife/shared';
import {
  CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Dumbbell, Flag, Flame, HeartPulse, ListChecks, Moon, Plus,
  RotateCcw, Sparkles, Trophy, Wallet, X, Zap, type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { item, stagger } from '@/lib/motion';
import { ZoneShell } from '@/components/ambience';
import { HomeWindow, RoomLight, useNow } from '@/components/dashboard/HomeWindow';
import { Lettering } from '@/components/layout/Lettering';
import { categoryMeta, formatMoney, greeting, longDate } from '@/lib/lifeMeta';
import { getLevelTitle } from '@/lib/gameProgress';
import { relativeTime } from '@/lib/time';
import { INTL_LOCALE, useLocale, type Copy, type Locale } from '@/lib/i18n';
import { useAuthStore } from '@/store/authStore';
import { useShellStore } from '@/store/shellStore';
import { useUIStore } from '@/store/uiStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useHabitCompletion } from '@/hooks/useHabitCompletion';
import { useToastStore } from '@/hooks/useToast';
import { refreshUser } from '@/hooks/useAuth';
import { Badge, Button, Card, Confetti, EmptyState, ErrorState, IconChip, ProgressBar, ProgressRing, StatCard, buttonClasses, type Tone, PageLoader } from '@/components/ui/lq';
import { useLoadingCopy } from '@/lib/loadingCopy';
import { HabitListItem } from '@/components/habits/HabitListItem';
import { questProgress } from '@/components/quests/questMeta';
import { ClassSelectionModal } from '@/components/character/ClassSelectionModal';
import { MorningBriefing } from '@/components/dashboard/MorningBriefing';
import { StreakRevival } from '@/components/habits/StreakRevival';
import { SocialPortal } from '@/components/social/SocialEntry';
import { completeGuideDay, dismissGuide, fetchDashboard } from '@/services/user.service';
import { fetchLifeScore, type LifeScore } from '@/services/lifescore.service';
import { fetchUpcoming, type AgendaEvent } from '@/services/agenda.service';
import { useLifeChange } from '@/lib/lifeSync';

const es = {
  loading: 'Cargando tu aventura…',
  errorTitle: 'No pudimos cargar tu panel',
  errorBody: 'Revisa tu conexión.',
  level: 'Nivel',
  levelNamed: (level: number, title: string) => `Nivel ${level} · ${title}`,
  missing: (n: string) => `faltan ${n}`,
  xpFor: (n: string, level: number) => `${n} XP para el nivel ${level}`,
  experience: 'Experiencia',
  xpOf: (xp: string, next: string) => `${xp} de ${next} XP`,
  welcomeHome: 'Bienvenido a casa',
  calmEmpty: 'Tu casa está lista. Empieza con algo pequeño.',
  calmDone: 'Todo listo por hoy. Ponte cómodo.',
  calmLeft: (n: number) => (n === 1 ? 'Te espera 1 hábito hoy, sin prisa.' : `Te esperan ${n} hábitos hoy, sin prisa.`),
  sinceEmptyTitle: 'Sin hábitos aún',
  sinceEmptyBody: 'Tu aventura empieza con un hábito pequeño. Cada día completado te da XP.',
  newHabit: 'Nuevo hábito',
  summary: 'Resumen',
  habitsToday: 'Hábitos hoy',
  activeGoals: 'Misiones activas',
  monthBalance: 'Saldo del mes',
  streakDays: 'Días de racha',
  habitsTodayTitle: 'Hábitos de hoy',
  pendingToday: 'Pendiente hoy',
  seeAll: 'Ver todo',
  allDoneHabits: (n: number) => `¡Todo listo por hoy! Completaste tus ${n} hábitos.`,
  missions: 'Misiones',
  seeAllMissions: 'Ver todas',
  noMissionsToday: 'Sin misiones para hoy',
  noMissionsBody: 'Crea una misión para tus objetivos grandes.',
  newMission: 'Nueva misión',
  progressOf: (title: string) => `Progreso de ${title}`,
  recoverStreak: 'Recupera tu racha',
  recoverBody: (habit: string, required: number, lost: number) => `Completa “${habit}” ${required} días seguidos para recuperar ${lost} días de racha.`,
  recoveryProgress: 'Progreso de recuperación',
  daysOf: (current: number, required: number) => `${current} de ${required} días`,
  expiresToday: 'termina hoy',
  oneDayLeft: 'queda 1 día',
  daysLeft: (n: number) => `quedan ${n} días`,
  heroWeek: (day: number, total: number) => `Semana del héroe · día ${day}/${total}`,
  inZone: (zone: string, xp: number) => `En ${zone} · +${xp} XP`,
  hideGuide: 'Ocultar la guía',
  guideProgress: 'Progreso de la guía',
  guideDays: (done: number, total: number) => `${done} de ${total} días`,
  goZone: (zone: string) => `Ir a ${zone}`,
  markDone: 'Marcar como hecho',
  guideDone: (day: number) => `Día ${day} completado`,
  guideFailed: 'No se pudo actualizar la guía',
  yourDay: 'Tu día',
  chooseClass: 'Elige tu clase',
  briefing: 'Briefing del día',
  checkinTitle: 'Check-in diario',
  checkinBody: '¿Cómo llegas hoy? Bonus de XP diario.',
  sleepAvg: 'Sueño · media 7 días',
  noData: 'Sin datos',
  lastWorkout: 'Último entrenamiento',
  noRecord: 'Sin registro',
  ofHundred: (n: number) => `${n} de 100`,
  sageTitle: 'Consejo del Sabio',
  sageBody: 'Pregúntale en qué enfocarte hoy.',
  sageQuestion: '¿En qué me recomiendas enfocarme hoy?',
  nextInAgenda: 'Próximo en tu agenda',
  agenda: 'Agenda',
  recentAchievements: 'Logros recientes',
  seeAchievements: 'Ver logros',
  lastWeek: 'Tu última semana',
  day: 'día',
  days: 'días',
  lifeScore: 'Life Score',
};

const en: typeof es = {
  loading: 'Loading your adventure…',
  errorTitle: "We couldn't load your dashboard",
  errorBody: 'Check your connection.',
  level: 'Level',
  levelNamed: (level, title) => `Level ${level} · ${title}`,
  missing: (n: string) => `${n} to go`,
  xpFor: (n: string, level: number) => `${n} XP to level ${level}`,
  experience: 'Experience',
  xpOf: (xp: string, next: string) => `${xp} of ${next} XP`,
  welcomeHome: 'Welcome home',
  calmEmpty: 'Your home is ready. Start with something small.',
  calmDone: 'All set for today. Make yourself comfortable.',
  calmLeft: (n) => (n === 1 ? 'You have 1 habit today, no rush.' : `You have ${n} habits today, no rush.`),
  sinceEmptyTitle: 'No habits yet',
  sinceEmptyBody: 'Your adventure starts with one small habit. Every completed day earns you XP.',
  newHabit: 'New habit',
  summary: 'Summary',
  habitsToday: 'Habits today',
  activeGoals: 'Active goals',
  monthBalance: 'Balance this month',
  streakDays: 'Streak days',
  habitsTodayTitle: "Today's habits",
  pendingToday: 'Pending today',
  seeAll: 'See all',
  allDoneHabits: (n) => `All set for today! You completed your ${n} habits.`,
  missions: 'Goals',
  seeAllMissions: 'See all',
  noMissionsToday: 'No goals for today',
  noMissionsBody: 'Create a goal for your big objectives.',
  newMission: 'New goal',
  progressOf: (title) => `Progress of ${title}`,
  recoverStreak: 'Recover your streak',
  recoverBody: (habit, required, lost) => `Complete “${habit}” ${required} days in a row to recover ${lost} days of streak.`,
  recoveryProgress: 'Recovery progress',
  daysOf: (current, required) => `${current} of ${required} days`,
  expiresToday: 'ends today',
  oneDayLeft: '1 day left',
  daysLeft: (n) => `${n} days left`,
  heroWeek: (day, total) => `Hero week · day ${day}/${total}`,
  inZone: (zone, xp) => `In ${zone} · +${xp} XP`,
  hideGuide: 'Hide the guide',
  guideProgress: 'Guide progress',
  guideDays: (done, total) => `${done} of ${total} days`,
  goZone: (zone) => `Go to ${zone}`,
  markDone: 'Mark as done',
  guideDone: (day) => `Day ${day} completed`,
  guideFailed: "We couldn't update the guide",
  yourDay: 'Your day',
  chooseClass: 'Choose your class',
  briefing: 'Daily briefing',
  checkinTitle: 'Daily check-in',
  checkinBody: 'How are you arriving today? Daily XP bonus.',
  sleepAvg: 'Sleep · 7-day average',
  noData: 'No data',
  lastWorkout: 'Last workout',
  noRecord: 'No record',
  ofHundred: (n) => `${n} of 100`,
  sageTitle: 'Advice from the Sage',
  sageBody: 'Ask what to focus on today.',
  sageQuestion: 'What do you recommend I focus on today?',
  nextInAgenda: 'Up next in your agenda',
  agenda: 'Agenda',
  recentAchievements: 'Recent achievements',
  seeAchievements: 'See achievements',
  lastWeek: 'Your last week',
  day: 'day',
  days: 'days',
  lifeScore: 'Life Score',
};

const COPY: Copy<typeof es> = { es, en };

interface HabitSummary {
  id: string;
  title: string;
  icon: string;
  color: string;
  currentStreak: number;
  xpReward: number;
  todayStatus: string | null;
  todayCompleted: boolean | null;
  category?: string;
}

interface DashboardData {
  todayQuests: Quest[];
  todayHabits: HabitSummary[];
  sleepAvg7d: number;
  monthBalance: number;
  recentWorkout: { date: string } | null;
  daysSinceJoin: number;
  recentAchievements: { id: string; title: string; description: string; xpReward: number; unlockedAt: string }[];
  latestWeeklySummary: { id: string; summary: string; lifeScore: number; weekStart: string; weekEnd: string } | null;
  recoveryChallenge: {
    id: string; habitTitle: string; lostStreak: number; requiredDays: number; currentDays: number; bonusXp: number; expiresAt: string;
  } | null;
  sevenDayGuide: {
    currentDay: number; totalDays: number; completedDays: number[];
    task: { day: number; title: string; zone: string; route: string; xpBonus: number };
  } | null;
  firstSteps: { questCount: number; habitCount: number; hasJournalEntry: boolean };
}

function daysLeft(iso: string, t: typeof es) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d <= 0 ? t.expiresToday : d === 1 ? t.oneDayLeft : t.daysLeft(d);
}

const isDone = (h: HabitSummary) => Boolean(h.todayCompleted) || h.todayStatus === 'completed';

function DashboardSkeleton({ label, words }: { label: string; words: readonly string[] }) {
  return <PageLoader label={label} words={words} />;
}

function SectionHead({ title, to, linkLabel, id }: { title: string; to: string; linkLabel: string; id: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 id={id} className="text-heading-sm md:text-heading-lg">{title}</h2>
      <Link to={to} className="flex min-h-11 items-center gap-1 text-label-lg text-primary-text hover:underline">
        {linkLabel}<ChevronRight aria-hidden className="size-4" strokeWidth={2} />
      </Link>
    </div>
  );
}

/** Tarjeta compacta de "Tu día" (sin prototipo: patrón StatCard horizontal). */
function MiniStat({ icon, tone, label, value, to }: { icon: LucideIcon; tone: Tone; label: string; value: string; to: string }) {
  return (
    <Link to={to} className="lq-lift flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <IconChip icon={icon} tone={tone} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-body-sm text-on-surface-light">{label}</span>
        <span className="block truncate text-heading-sm font-mono tabular-nums">{value}</span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
    </Link>
  );
}

export default function DashboardPage() {
  const locale: Locale = useLocale();
  const t = COPY[locale];
  const loading = useLoadingCopy();
  const user = useAuthStore((s) => s.user);
  const openQuickAction = useShellStore((s) => s.openQuickAction);
  const openSage = useUIStore((s) => s.openSage);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [data, setData] = useState<DashboardData | null>(null);
  const [habits, setHabits] = useState<HabitSummary[]>([]);
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [lifeScore, setLifeScore] = useState<LifeScore | null>(null);
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [modal, setModal] = useState<'class' | 'briefing' | null>(null);
  const [guideBusy, setGuideBusy] = useState(false);
  const { complete, undo, pending, burst } = useHabitCompletion();
  const now = useNow();

  const load = useCallback(async (silent = false) => {
    if (!silent) setState('loading');
    try {
      const d = (await fetchDashboard()) as DashboardData;
      setData(d);
      setHabits(d.todayHabits ?? []);
      setState('ready');
    } catch {
      if (!silent) setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
    fetchLifeScore().then(setLifeScore).catch(() => null);
    fetchUpcoming().then((e) => setEvents(e.slice(0, 3))).catch(() => null);
  }, [load]);

  // Inicio resume todas las zonas: cualquier registro (aquí, en el botón rápido o
  // desde el Sabio) lo actualiza en silencio, también el Life Score.
  useLifeChange(() => {
    void load(true);
    fetchLifeScore().then(setLifeScore).catch(() => null);
  });

  if (!user) return null;

  async function handleComplete(h: HabitSummary) {
    const result = await complete(h);
    if (!result) return;
    setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, todayStatus: 'completed', todayCompleted: true, currentStreak: result.currentStreak } : x)));
  }

  async function handleToggle(h: HabitSummary) {
    if (!isDone(h)) { await handleComplete(h); return; }
    const result = await undo(h);
    if (!result?.undone) { if (result) void load(true); return; }
    setHabits((prev) => prev.map((x) => (x.id === h.id ? {
      ...x, todayStatus: result.log?.status ?? 'pending', todayCompleted: false, currentStreak: result.currentStreak,
    } : x)));
  }

  async function handleGuide(action: 'complete' | 'dismiss') {
    if (!data?.sevenDayGuide) return;
    setGuideBusy(true);
    try {
      if (action === 'dismiss') {
        await dismissGuide();
        setData((d) => d && { ...d, sevenDayGuide: null });
      } else {
        const r = await completeGuideDay(data.sevenDayGuide.task.day);
        useToastStore.getState().success(t.guideDone(r.day), r.rewards?.xpEarned ? `+${r.rewards.xpEarned} XP` : undefined);
        void refreshUser();
        await load(true);
      }
    } catch {
      useToastStore.getState().error(t.guideFailed);
    } finally {
      setGuideBusy(false);
    }
  }

  const first = user.displayName.split(' ')[0];
  const xpPct = user.xpToNextLevel > 0 ? (user.xp / user.xpToNextLevel) * 100 : 0;
  const missing = Math.max(0, user.xpToNextLevel - user.xp);
  const done = habits.filter(isDone).length;
  const pendingHabits = habits.filter((h) => !isDone(h));
  const quests = (data?.todayQuests ?? []).filter((q) => q.status === 'ACTIVE');
  const playerClass = (user as unknown as { playerClass?: string }).playerClass;
  const isEmpty = state === 'ready' && habits.length === 0 && (data?.firstSteps?.habitCount ?? 0) === 0;
  const fmt = (n: number) => n.toLocaleString(INTL_LOCALE[locale]);

  const levelCard = (
    <Card as="section" variant="elevated" padding="lg" aria-label={t.level} className="flex min-w-0 flex-col gap-4 md:max-w-[500px]">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/[var(--lq-soft-alpha)] text-heading-md text-primary-text font-mono tabular-nums">
          {user.level}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-heading-sm">{t.levelNamed(user.level, getLevelTitle(user.level, locale))}</div>
          <div className="text-body-sm text-on-surface-light font-mono tabular-nums">
            {fmt(user.xp)} / {fmt(user.xpToNextLevel)} XP<span className="hidden md:inline"> · {t.missing(fmt(missing))}</span>
          </div>
        </div>
      </div>
      <ProgressBar value={xpPct} size="lg" shine label={t.experience} valueText={t.xpOf(fmt(user.xp), fmt(user.xpToNextLevel))} />
      <div className="flex items-center gap-1.5 text-body-sm text-on-surface md:hidden">
        <Sparkles aria-hidden className="size-4 text-primary-text" strokeWidth={1.75} />
        {t.xpFor(fmt(missing), user.level + 1)}
      </div>
    </Card>
  );

  const left = habits.filter((h) => !isDone(h)).length;
  const calm = habits.length === 0
    ? t.calmEmpty
    : left === 0 ? t.calmDone : t.calmLeft(left);

  // En casa: la ventana con el cielo de esta hora y, al lado, el saludo escrito con la letra de la marca.
  const header = (
    <motion.section variants={item} className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] md:gap-10">
      <HomeWindow now={now} className="md:order-2" />
      <div className="flex min-w-0 flex-col gap-5 md:order-1">
        <div className="flex flex-col gap-1.5">
          <p className="hidden text-body-md text-on-surface-light md:block">{longDate(now, locale)}</p>
          <h1 className="text-display-sm [text-wrap:balance] md:text-display-md lg:text-display-lg">
            <Lettering text={`${isEmpty ? t.welcomeHome : greeting(now, locale)}, ${first}`} delay={0.2} />
          </h1>
          <p className="text-body-lg text-on-surface">{calm}</p>
        </div>
        {levelCard}
      </div>
    </motion.section>
  );

  if (state === 'loading') return <DashboardSkeleton label={t.loading} words={loading.page} />;
  if (state === 'error') {
    return (
      <ErrorState
        title={t.errorTitle}
        description={t.errorBody}
        onRetry={() => void load()}
        className="py-24 md:py-32"
      />
    );
  }

  if (isEmpty) {
    return (
      <ZoneShell zone="home" ambience={<RoomLight now={now} />}>
        {header}
        <motion.div variants={item}>
          <EmptyState
            icon={ListChecks}
            title={t.sinceEmptyTitle}
            description={t.sinceEmptyBody}
            action={<Link to="/habits?new=1" className={buttonClasses('primary', 'lg')}><Plus aria-hidden className="size-5" strokeWidth={2} />{t.newHabit}</Link>}
            className="py-12"
          />
        </motion.div>
      </ZoneShell>
    );
  }

  const statSize = isDesktop ? 'lg' : 'md';
  const recovery = data?.recoveryChallenge;
  const guide = data?.sevenDayGuide;

  return (
    <ZoneShell zone="home" ambience={<RoomLight now={now} />}>
      {header}

      {/* Rachas apagadas hace poco: se pueden revivir con oro */}
      <StreakRevival onRevived={() => void load(true)} />

      {/* Portal a la red social */}
      <motion.div variants={item}><SocialPortal /></motion.div>

      {/* Resumen: 4 StatCards con count-up */}
      <motion.section variants={item} aria-label={t.summary} className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] md:gap-6">
        <StatCard icon={CheckCircle2} tone="success" value={`${done}/${habits.length}`} label={t.habitsToday} to="/habits" size={statSize} />
        <StatCard icon={Flag} tone="primary" value={quests.length} label={t.activeGoals} to="/quests" size={statSize} />
        <StatCard icon={Wallet} tone="info" value={data?.monthBalance ?? 0} format={(n) => formatMoney(n, user.currency, true, locale)} label={t.monthBalance} to="/finances" size={statSize} />
        <StatCard icon={Flame} tone="warning" value={user.currentStreak} label={t.streakDays} to="/achievements" size={statSize} />
      </motion.section>

      {/* Hábitos + Misiones */}
      <motion.div variants={item} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <section aria-labelledby="dash-habits" className="flex min-w-0 flex-col gap-4 md:rounded-2xl md:border md:border-border md:bg-surface md:p-6 md:shadow-sm">
          <SectionHead id="dash-habits" title={isDesktop ? t.habitsTodayTitle : t.pendingToday} to="/habits" linkLabel={t.seeAll} />
          {(isDesktop ? habits : pendingHabits).length > 0 ? (
            <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3 md:gap-0 md:divide-y md:divide-border">
              {(isDesktop ? habits : pendingHabits).slice(0, 6).map((h) => (
                <HabitListItem
                  key={h.id}
                  habit={h}
                  variant={isDesktop ? 'row' : 'card'}
                  pending={pending === h.id}
                  onComplete={() => void handleToggle(h)}
                />
              ))}
            </motion.ul>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-success/[var(--lq-soft-alpha)] p-4" role="status">
              <CheckCircle2 aria-hidden className="size-6 shrink-0 text-success-text" strokeWidth={1.75} />
              <p className="text-body-md text-on-surface">{t.allDoneHabits(habits.length)}</p>
            </div>
          )}
        </section>

        <Card as="section" padding="lg" aria-labelledby="dash-quests" className="flex flex-col gap-4">
          <SectionHead id="dash-quests" title={t.missions} to="/quests" linkLabel={t.seeAllMissions} />
          {quests.length > 0 ? (
            <ul className="flex flex-col">
              {quests.slice(0, 3).map((q, i) => {
                const p = questProgress(q, locale);
                const cat = categoryMeta(q.category, locale);
                return (
                  <li key={q.id} className={cn('relative flex flex-col gap-2 py-4 first:pt-0 last:pb-0', i > 0 && 'border-t border-border')}>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={cat.tone}>{cat.label}</Badge>
                      <span className="text-label-lg text-primary-text font-mono tabular-nums">+{q.xpReward} XP</span>
                    </div>
                    <Link to="/quests" className="text-heading-sm lq-stretch after:absolute after:inset-0 after:content-[''] hover:underline">{q.title}</Link>
                    <ProgressBar value={p.pct} tone={p.pct >= 100 ? 'success' : 'primary'} label={t.progressOf(q.title)} valueText={p.text} />
                    <span className="text-body-sm text-on-surface-light">{p.text}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Flag}
              tone="muted"
              title={t.noMissionsToday}
              description={t.noMissionsBody}
              action={<Link to="/quests?new=1" className={buttonClasses('secondary', 'md')}><Plus aria-hidden className="size-4" strokeWidth={2} />{t.newMission}</Link>}
              className="py-6"
            />
          )}
        </Card>
      </motion.div>

      {/* Avisos accionables (sin prototipo: Card + IconChip + ProgressBar) */}
      {(recovery || guide) && (
        <motion.div variants={item} className="grid grid-cols-1 gap-6 md:grid-cols-2 [&>*]:min-w-0">
          {recovery && (
            <Card as="section" padding="lg" aria-labelledby="dash-recovery" className="flex flex-col gap-3 border-warning/40">
              <div className="flex items-start gap-3">
                <IconChip icon={RotateCcw} tone="warning" />
                <div className="min-w-0 flex-1">
                  <h2 id="dash-recovery" className="text-heading-sm">{t.recoverStreak}</h2>
                  <p className="text-body-sm text-on-surface-light">
                    {t.recoverBody(recovery.habitTitle, recovery.requiredDays, recovery.lostStreak)}
                  </p>
                </div>
                <Badge variant="warning">+{recovery.bonusXp} XP</Badge>
              </div>
              <ProgressBar value={(recovery.currentDays / recovery.requiredDays) * 100} tone="warning" label={t.recoveryProgress} valueText={t.daysOf(recovery.currentDays, recovery.requiredDays)} />
              <span className="text-body-sm text-on-surface-light font-mono tabular-nums">
                {t.daysOf(recovery.currentDays, recovery.requiredDays)} · {daysLeft(recovery.expiresAt, t)}
              </span>
            </Card>
          )}
          {guide && (
            <Card as="section" padding="lg" aria-labelledby="dash-guide" className="flex flex-col gap-3 border-primary/35">
              <div className="flex items-start gap-3">
                <IconChip icon={Zap} tone="primary" />
                <div className="min-w-0 flex-1">
                  <span className="text-label-md uppercase text-primary-text">{t.heroWeek(guide.currentDay, guide.totalDays)}</span>
                  <h2 id="dash-guide" className="text-heading-sm">{guide.task.title}</h2>
                  <p className="text-body-sm text-on-surface-light">{t.inZone(guide.task.zone, guide.task.xpBonus)}</p>
                </div>
                <Button variant="icon" aria-label={t.hideGuide} onClick={() => void handleGuide('dismiss')} disabled={guideBusy}>
                  <X aria-hidden className="size-5" strokeWidth={1.75} />
                </Button>
              </div>
              <ProgressBar value={(guide.completedDays.length / guide.totalDays) * 100} label={t.guideProgress} valueText={t.guideDays(guide.completedDays.length, guide.totalDays)} />
              <div className="flex flex-wrap gap-2">
                <Link to={guide.task.route} className={buttonClasses('secondary', 'md')}>{t.goZone(guide.task.zone)}</Link>
                <Button size="md" loading={guideBusy} onClick={() => void handleGuide('complete')}>{t.markDone}</Button>
              </div>
            </Card>
          )}
        </motion.div>
      )}

      {/* Tu día */}
      <motion.section variants={item} aria-labelledby="dash-day" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="dash-day" className="text-heading-sm md:text-heading-lg">{t.yourDay}</h2>
          <div className="flex flex-wrap gap-2">
            {!playerClass && user.level >= 10 && (
              <Button variant="secondary" size="sm" onClick={() => setModal('class')}><Zap aria-hidden className="size-4" strokeWidth={1.75} />{t.chooseClass}</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setModal('briefing')}><ClipboardList aria-hidden className="size-4" strokeWidth={1.75} />{t.briefing}</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
          <button
            type="button"
            onClick={() => openQuickAction('checkin')}
            className="lq-lift flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/[var(--lq-soft-alpha)] p-4 text-left"
          >
            <IconChip icon={HeartPulse} tone="primary" size="sm" className="bg-background" />
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg text-primary-text">{t.checkinTitle}</span>
              <span className="block text-body-sm text-on-surface">{t.checkinBody}</span>
            </span>
          </button>
          <MiniStat icon={Moon} tone="info" label={t.sleepAvg} value={data?.sleepAvg7d ? `${data.sleepAvg7d.toFixed(1)} h` : t.noData} to="/sleep" />
          <MiniStat icon={Dumbbell} tone="success" label={t.lastWorkout} value={data?.recentWorkout ? relativeTime(data.recentWorkout.date, locale) : t.noRecord} to="/coliseo" />
          {lifeScore && (
            <Link to="/life" className="lq-lift flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <ProgressRing value={lifeScore.total} size={48} stroke={5} label={t.lifeScore} valueText={t.ofHundred(lifeScore.total)}>
                <span className="text-label-md font-mono tabular-nums">{lifeScore.total}</span>
              </ProgressRing>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm text-on-surface-light">{t.lifeScore}</span>
                <span className="block text-heading-sm font-mono tabular-nums">{lifeScore.total}/100</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => openSage(t.sageQuestion)}
            className="lq-lift flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm"
          >
            <IconChip icon={Sparkles} tone="forest" size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg text-on-background">{t.sageTitle}</span>
              <span className="block text-body-sm text-on-surface-light">{t.sageBody}</span>
            </span>
          </button>
        </div>
      </motion.section>

      {(events.length > 0 || (data?.recentAchievements?.length ?? 0) > 0 || data?.latestWeeklySummary) && (
        <motion.div variants={item} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          {events.length > 0 && (
            <Card as="section" padding="lg" aria-labelledby="dash-agenda" className="flex flex-col gap-4">
              <SectionHead id="dash-agenda" title={t.nextInAgenda} to="/agenda" linkLabel={t.agenda} />
              <ul className="flex flex-col gap-3">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <IconChip icon={CalendarDays} tone="info" size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label-lg text-on-background">{e.title}</span>
                      <span className="block text-body-sm text-on-surface-light">
                        {new Date(e.startDate).toLocaleString(INTL_LOCALE[locale], e.isAllDay ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {(data?.recentAchievements?.length ?? 0) > 0 && (
            <Card as="section" padding="lg" aria-labelledby="dash-ach" className="flex flex-col gap-4">
              <SectionHead id="dash-ach" title={t.recentAchievements} to="/achievements" linkLabel={t.seeAchievements} />
              <ul className="flex flex-col gap-3">
                {data!.recentAchievements.slice(0, 3).map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <IconChip icon={Trophy} tone="warning" size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label-lg text-on-background">{a.title}</span>
                      <span className="block truncate text-body-sm text-on-surface-light">{a.description}</span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-caption text-on-surface-light">{relativeTime(a.unlockedAt, locale)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {data?.latestWeeklySummary && (
            <Card as="section" padding="lg" aria-labelledby="dash-week" className="flex flex-col gap-3 lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h2 id="dash-week" className="text-heading-sm md:text-heading-lg">{t.lastWeek}</h2>
                <Badge variant="primary">{t.lifeScore} {data.latestWeeklySummary.lifeScore}/100</Badge>
              </div>
              <p className="text-body-md text-on-surface">{data.latestWeeklySummary.summary}</p>
            </Card>
          )}
        </motion.div>
      )}

      {burst > 0 && <Confetti burst={burst} />}
      <ClassSelectionModal open={modal === 'class'} onClose={() => setModal(null)} />
      <MorningBriefing
        open={modal === 'briefing'}
        onClose={() => setModal(null)}
        name={first}
        habitsDone={done}
        habitsTotal={habits.length}
        quests={quests.length}
        streak={user.currentStreak}
      />
    </ZoneShell>
  );
}
