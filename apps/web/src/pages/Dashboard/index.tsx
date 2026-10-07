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
import { useAuthStore } from '@/store/authStore';
import { useShellStore } from '@/store/shellStore';
import { useUIStore } from '@/store/uiStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useHabitCompletion } from '@/hooks/useHabitCompletion';
import { useToastStore } from '@/hooks/useToast';
import { refreshUser } from '@/hooks/useAuth';
import { Badge, Button, Card, Confetti, EmptyState, ErrorState, IconChip, ProgressBar, ProgressRing, StatCard, buttonClasses, type Tone, PageLoader } from '@/components/ui/lq';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { HabitListItem } from '@/components/habits/HabitListItem';
import { questProgress } from '@/components/quests/questMeta';
import { ClassSelectionModal } from '@/components/character/ClassSelectionModal';
import { MorningBriefing } from '@/components/dashboard/MorningBriefing';
import { StreakRevival } from '@/components/habits/StreakRevival';
import { SocialPortal } from '@/components/social/SocialEntry';
import { completeGuideDay, dismissGuide, fetchDashboard } from '@/services/user.service';
import { fetchLifeScore, type LifeScore } from '@/services/lifescore.service';
import { fetchUpcoming, type AgendaEvent } from '@/services/agenda.service';

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

function daysLeft(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d <= 0 ? 'termina hoy' : d === 1 ? 'queda 1 día' : `quedan ${d} días`;
}

const isDone = (h: HabitSummary) => Boolean(h.todayCompleted) || h.todayStatus === 'completed';

function DashboardSkeleton() {
  return <PageLoader label="Cargando tu aventura…" words={LOADING_COPY.page} />;
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
  const { complete, pending, burst } = useHabitCompletion();
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

  if (!user) return null;

  async function handleComplete(h: HabitSummary) {
    const result = await complete(h);
    if (!result) return;
    setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, todayStatus: 'completed', todayCompleted: true, currentStreak: result.currentStreak } : x)));
    void load(true);
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
        useToastStore.getState().success(`Día ${r.day} completado`, r.rewards?.xpEarned ? `+${r.rewards.xpEarned} XP` : undefined);
        void refreshUser();
        await load(true);
      }
    } catch {
      useToastStore.getState().error('No se pudo actualizar la guía');
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
  const fmt = (n: number) => n.toLocaleString('es-CO');

  const levelCard = (
    <Card as="section" variant="elevated" padding="lg" aria-label="Nivel" className="flex min-w-0 flex-col gap-4 md:max-w-[500px]">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/[var(--lq-soft-alpha)] text-heading-md text-primary-text font-mono tabular-nums">
          {user.level}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-heading-sm">Nivel {user.level} · {getLevelTitle(user.level)}</div>
          <div className="text-body-sm text-on-surface-light font-mono tabular-nums">
            {fmt(user.xp)} / {fmt(user.xpToNextLevel)} XP<span className="hidden md:inline"> · faltan {fmt(missing)}</span>
          </div>
        </div>
      </div>
      <ProgressBar value={xpPct} size="lg" shine label="Experiencia" valueText={`${fmt(user.xp)} de ${fmt(user.xpToNextLevel)} XP`} />
      <div className="flex items-center gap-1.5 text-body-sm text-on-surface md:hidden">
        <Sparkles aria-hidden className="size-4 text-primary-text" strokeWidth={1.75} />
        {fmt(missing)} XP para el nivel {user.level + 1}
      </div>
    </Card>
  );

  const left = habits.filter((h) => !isDone(h)).length;
  const calm = habits.length === 0
    ? 'Tu casa está lista. Empieza con algo pequeño.'
    : left === 0 ? 'Todo listo por hoy. Ponte cómodo.' : `Te ${left === 1 ? 'espera 1 hábito' : `esperan ${left} hábitos`} hoy, sin prisa.`;

  // En casa: la ventana con el cielo de esta hora y, al lado, el saludo escrito con la letra de la marca.
  const header = (
    <motion.section variants={item} className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] md:gap-10">
      <HomeWindow now={now} className="md:order-2" />
      <div className="flex min-w-0 flex-col gap-5 md:order-1">
        <div className="flex flex-col gap-1.5">
          <p className="hidden text-body-md text-on-surface-light md:block">{longDate(now)}</p>
          <h1 className="text-display-sm [text-wrap:balance] md:text-display-md lg:text-display-lg">
            <Lettering text={`${isEmpty ? 'Bienvenido a casa' : greeting(now)}, ${first}`} delay={0.2} />
          </h1>
          <p className="text-body-lg text-on-surface">{calm}</p>
        </div>
        {levelCard}
      </div>
    </motion.section>
  );

  if (state === 'loading') return <DashboardSkeleton />;
  if (state === 'error') {
    return (
      <ErrorState
        title="No pudimos cargar tu panel"
        description="Revisa tu conexión."
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
            title="Sin hábitos aún"
            description="Tu aventura empieza con un hábito pequeño. Cada día completado te da XP."
            action={<Link to="/habits?new=1" className={buttonClasses('primary', 'lg')}><Plus aria-hidden className="size-5" strokeWidth={2} />Nuevo hábito</Link>}
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
      <motion.section variants={item} aria-label="Resumen" className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] md:gap-6">
        <StatCard icon={CheckCircle2} tone="success" value={`${done}/${habits.length}`} label="Hábitos hoy" to="/habits" size={statSize} />
        <StatCard icon={Flag} tone="primary" value={quests.length} label="Misiones activas" to="/quests" size={statSize} />
        <StatCard icon={Wallet} tone="info" value={data?.monthBalance ?? 0} format={(n) => formatMoney(n, user.currency, true)} label="Saldo del mes" to="/finances" size={statSize} />
        <StatCard icon={Flame} tone="warning" value={user.currentStreak} label="Días de racha" to="/achievements" size={statSize} />
      </motion.section>

      {/* Hábitos + Misiones */}
      <motion.div variants={item} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <section aria-labelledby="dash-habits" className="flex min-w-0 flex-col gap-4 md:rounded-2xl md:border md:border-border md:bg-surface md:p-6 md:shadow-sm">
          <SectionHead id="dash-habits" title={isDesktop ? 'Hábitos de hoy' : 'Pendiente hoy'} to="/habits" linkLabel="Ver todo" />
          {(isDesktop ? habits : pendingHabits).length > 0 ? (
            <motion.ul variants={stagger} initial="initial" animate="animate" className="flex flex-col gap-3 md:gap-0 md:divide-y md:divide-border">
              {(isDesktop ? habits : pendingHabits).slice(0, 6).map((h) => (
                <HabitListItem
                  key={h.id}
                  habit={h}
                  variant={isDesktop ? 'row' : 'card'}
                  pending={pending === h.id}
                  onComplete={() => void handleComplete(h)}
                />
              ))}
            </motion.ul>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-success/[var(--lq-soft-alpha)] p-4" role="status">
              <CheckCircle2 aria-hidden className="size-6 shrink-0 text-success-text" strokeWidth={1.75} />
              <p className="text-body-md text-on-surface">¡Todo listo por hoy! Completaste tus {habits.length} hábitos.</p>
            </div>
          )}
        </section>

        <Card as="section" padding="lg" aria-labelledby="dash-quests" className="flex flex-col gap-4">
          <SectionHead id="dash-quests" title="Misiones" to="/quests" linkLabel="Ver todas" />
          {quests.length > 0 ? (
            <ul className="flex flex-col">
              {quests.slice(0, 3).map((q, i) => {
                const p = questProgress(q);
                const cat = categoryMeta(q.category);
                return (
                  <li key={q.id} className={cn('relative flex flex-col gap-2 py-4 first:pt-0 last:pb-0', i > 0 && 'border-t border-border')}>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={cat.tone}>{cat.label}</Badge>
                      <span className="text-label-lg text-primary-text font-mono tabular-nums">+{q.xpReward} XP</span>
                    </div>
                    <Link to="/quests" className="text-heading-sm lq-stretch after:absolute after:inset-0 after:content-[''] hover:underline">{q.title}</Link>
                    <ProgressBar value={p.pct} tone={p.pct >= 100 ? 'success' : 'primary'} label={`Progreso de ${q.title}`} valueText={p.text} />
                    <span className="text-body-sm text-on-surface-light">{p.text}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Flag}
              tone="muted"
              title="Sin misiones para hoy"
              description="Crea una misión para tus objetivos grandes."
              action={<Link to="/quests?new=1" className={buttonClasses('secondary', 'md')}><Plus aria-hidden className="size-4" strokeWidth={2} />Nueva misión</Link>}
              className="py-6"
            />
          )}
        </Card>
      </motion.div>

      {/* Avisos accionables (sin prototipo: Card + IconChip + ProgressBar) */}
      {(recovery || guide) && (
        <motion.div variants={item} className="grid gap-6 md:grid-cols-2">
          {recovery && (
            <Card as="section" padding="lg" aria-labelledby="dash-recovery" className="flex flex-col gap-3 border-warning/40">
              <div className="flex items-start gap-3">
                <IconChip icon={RotateCcw} tone="warning" />
                <div className="min-w-0 flex-1">
                  <h2 id="dash-recovery" className="text-heading-sm">Recupera tu racha</h2>
                  <p className="text-body-sm text-on-surface-light">
                    Completa “{recovery.habitTitle}” {recovery.requiredDays} días seguidos para recuperar {recovery.lostStreak} días de racha.
                  </p>
                </div>
                <Badge variant="warning">+{recovery.bonusXp} XP</Badge>
              </div>
              <ProgressBar value={(recovery.currentDays / recovery.requiredDays) * 100} tone="warning" label="Progreso de recuperación" valueText={`${recovery.currentDays} de ${recovery.requiredDays} días`} />
              <span className="text-body-sm text-on-surface-light font-mono tabular-nums">
                {recovery.currentDays} de {recovery.requiredDays} días · {daysLeft(recovery.expiresAt)}
              </span>
            </Card>
          )}
          {guide && (
            <Card as="section" padding="lg" aria-labelledby="dash-guide" className="flex flex-col gap-3 border-primary/35">
              <div className="flex items-start gap-3">
                <IconChip icon={Zap} tone="primary" />
                <div className="min-w-0 flex-1">
                  <span className="text-label-md uppercase text-primary-text">Semana del héroe · día {guide.currentDay}/{guide.totalDays}</span>
                  <h2 id="dash-guide" className="text-heading-sm">{guide.task.title}</h2>
                  <p className="text-body-sm text-on-surface-light">En {guide.task.zone} · +{guide.task.xpBonus} XP</p>
                </div>
                <Button variant="icon" aria-label="Ocultar la guía" onClick={() => void handleGuide('dismiss')} disabled={guideBusy}>
                  <X aria-hidden className="size-5" strokeWidth={1.75} />
                </Button>
              </div>
              <ProgressBar value={(guide.completedDays.length / guide.totalDays) * 100} label="Progreso de la guía" valueText={`${guide.completedDays.length} de ${guide.totalDays} días`} />
              <div className="flex flex-wrap gap-2">
                <Link to={guide.task.route} className={buttonClasses('secondary', 'md')}>Ir a {guide.task.zone}</Link>
                <Button size="md" loading={guideBusy} onClick={() => void handleGuide('complete')}>Marcar como hecho</Button>
              </div>
            </Card>
          )}
        </motion.div>
      )}

      {/* Tu día */}
      <motion.section variants={item} aria-labelledby="dash-day" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="dash-day" className="text-heading-sm md:text-heading-lg">Tu día</h2>
          <div className="flex flex-wrap gap-2">
            {!playerClass && user.level >= 10 && (
              <Button variant="secondary" size="sm" onClick={() => setModal('class')}><Zap aria-hidden className="size-4" strokeWidth={1.75} />Elige tu clase</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setModal('briefing')}><ClipboardList aria-hidden className="size-4" strokeWidth={1.75} />Briefing del día</Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => openQuickAction('checkin')}
            className="lq-lift flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/[var(--lq-soft-alpha)] p-4 text-left"
          >
            <IconChip icon={HeartPulse} tone="primary" size="sm" className="bg-background" />
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg text-primary-text">Check-in diario</span>
              <span className="block text-body-sm text-on-surface">¿Cómo llegas hoy? Bonus de XP diario.</span>
            </span>
          </button>
          <MiniStat icon={Moon} tone="info" label="Sueño · media 7 días" value={data?.sleepAvg7d ? `${data.sleepAvg7d.toFixed(1)} h` : 'Sin datos'} to="/sleep" />
          <MiniStat icon={Dumbbell} tone="success" label="Último entrenamiento" value={data?.recentWorkout ? relativeTime(data.recentWorkout.date) : 'Sin registro'} to="/gym" />
          {lifeScore && (
            <Link to="/life" className="lq-lift flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <ProgressRing value={lifeScore.total} size={48} stroke={5} label="Life Score" valueText={`${lifeScore.total} de 100`}>
                <span className="text-label-md font-mono tabular-nums">{lifeScore.total}</span>
              </ProgressRing>
              <span className="min-w-0 flex-1">
                <span className="block text-body-sm text-on-surface-light">Life Score</span>
                <span className="block text-heading-sm font-mono tabular-nums">{lifeScore.total}/100</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => openSage('¿En qué me recomiendas enfocarme hoy?')}
            className="lq-lift flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm"
          >
            <IconChip icon={Sparkles} tone="forest" size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-label-lg text-on-background">Consejo del Sabio</span>
              <span className="block text-body-sm text-on-surface-light">Pregúntale en qué enfocarte hoy.</span>
            </span>
          </button>
        </div>
      </motion.section>

      {(events.length > 0 || (data?.recentAchievements?.length ?? 0) > 0 || data?.latestWeeklySummary) && (
        <motion.div variants={item} className="grid items-start gap-6 lg:grid-cols-2">
          {events.length > 0 && (
            <Card as="section" padding="lg" aria-labelledby="dash-agenda" className="flex flex-col gap-4">
              <SectionHead id="dash-agenda" title="Próximo en tu agenda" to="/agenda" linkLabel="Agenda" />
              <ul className="flex flex-col gap-3">
                {events.map((e) => (
                  <li key={e.id} className="flex items-center gap-3">
                    <IconChip icon={CalendarDays} tone="info" size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label-lg text-on-background">{e.title}</span>
                      <span className="block text-body-sm text-on-surface-light">
                        {new Date(e.startDate).toLocaleString('es-ES', e.isAllDay ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {(data?.recentAchievements?.length ?? 0) > 0 && (
            <Card as="section" padding="lg" aria-labelledby="dash-ach" className="flex flex-col gap-4">
              <SectionHead id="dash-ach" title="Logros recientes" to="/achievements" linkLabel="Ver logros" />
              <ul className="flex flex-col gap-3">
                {data!.recentAchievements.slice(0, 3).map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <IconChip icon={Trophy} tone="warning" size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-label-lg text-on-background">{a.title}</span>
                      <span className="block truncate text-body-sm text-on-surface-light">{a.description}</span>
                    </span>
                    <span className="text-caption text-on-surface-light">{relativeTime(a.unlockedAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {data?.latestWeeklySummary && (
            <Card as="section" padding="lg" aria-labelledby="dash-week" className="flex flex-col gap-3 lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h2 id="dash-week" className="text-heading-sm md:text-heading-lg">Tu última semana</h2>
                <Badge variant="primary">Life Score {data.latestWeeklySummary.lifeScore}/100</Badge>
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
