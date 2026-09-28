import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, CalendarDays, Check, ClipboardList, Coins, Dumbbell, Flame, HeartHandshake, Moon, NotebookPen, Swords, Trophy, Utensils, Wallet, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Quest } from '@lifequest/shared';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { LifeQuestFlipCard } from '../../components/ui/lifequest-flip-card';
import { AvatarDisplay } from '../../components/character/AvatarDisplay';
import { GreetingHeader } from '../../components/dashboard/GreetingHeader';
import { TodayQuestsWidget } from '../../components/dashboard/TodayQuestsWidget';
import { QuickStatsWidget } from '../../components/dashboard/QuickStatsWidget';
import { ZoneCard } from '../../components/dashboard/ZoneCard';
import { StreakFlame } from '../../components/habits/StreakFlame';
import { MorningBriefing } from '../../components/dashboard/MorningBriefing';
import {
  fetchCharacter,
  fetchDashboard,
} from '../../services/user.service';
import { logHabit } from '../../services/habit.service';
import { fetchLifeScore } from '../../services/lifescore.service';
import type { LifeScore } from '../../services/lifescore.service';
import { xpProgressPercent } from '../../lib/xp';
import { BossWidget } from '../../components/dashboard/BossWidget';
import { fetchUpcoming } from '../../services/agenda.service';
import type { AgendaEvent } from '../../services/agenda.service';
import { ClassSelectionModal } from '../../components/character/ClassSelectionModal';
import { DailyCheckinWidget } from '../../components/dashboard/DailyCheckinWidget';
import { SageScrollsWidget } from '../../components/dashboard/SageScrollsWidget';
import { SageDailyTip } from '../../components/dashboard/SageDailyTip';
import { FirstStepsWidget } from '../../components/dashboard/FirstStepsWidget';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { ProgressRings } from '../../components/ui/ProgressRings';
import { SageProactiveCard } from '../../components/dashboard/SageProactiveCard';
import { TodayPlan } from '../../components/dashboard/TodayPlan';
import { getLevelTitle } from '../../lib/gameProgress';
import { E } from '@/components/ui/glyphs';

interface HabitSummary {
  id: string;
  title: string;
  icon: string;
  color: string;
  currentStreak: number;
  xpReward: number;
  todayStatus: string | null;
  todayCompleted: boolean | null;
}

interface RecentAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
  unlockedAt: string;
}

interface WeeklySummaryCardData {
  id: string;
  summary: string;
  lifeScore: number;
  weekStart: string;
  weekEnd: string;
}

interface RecoveryChallengeData {
  id: string;
  habitId: string;
  habitTitle: string;
  habitIcon: string;
  lostStreak: number;
  requiredDays: number;
  currentDays: number;
  bonusXp: number;
  expiresAt: string;
}

interface SevenDayGuideData {
  currentDay: number;
  totalDays: number;
  completedDays: number[];
  task: {
    day: number;
    title: string;
    zone: string;
    route: string;
    xpBonus: number;
    celebration?: boolean;
    suggestedReady?: boolean;
  };
}

interface DashboardData {
  todayQuests: Quest[];
  todayHabits: HabitSummary[];
  sleepAvg7d: number;
  monthBalance: number;
  recentWorkout: { date: string } | null;
  daysSinceJoin: number;
  recentAchievements: RecentAchievement[];
  visualState: {
    mood: number;
    daysAway: number;
    hpPercent: number;
    hpLabel: string;
    hpLow: boolean;
    hpRecovery: boolean;
  };
  latestWeeklySummary: WeeklySummaryCardData | null;
  recoveryChallenge: RecoveryChallengeData | null;
  sevenDayGuide: SevenDayGuideData | null;
  firstSteps: {
    questCount: number;
    habitCount: number;
    hasJournalEntry: boolean;
  };
}

const ZONES = [
  { Icon: Dumbbell, label: 'Gym', sublabel: 'Coliseo', to: '/gym', color: 'var(--accent-red)', badge: undefined },
  { Icon: Wallet, label: 'Finanzas', sublabel: 'La Bóveda', to: '/finances', color: 'var(--accent-gold)', badge: undefined },
  { Icon: BookOpen, label: 'Aprendizaje', sublabel: 'Biblioteca', to: '/learning', color: 'var(--accent-blue)', badge: undefined },
  { Icon: Utensils, label: 'Comida', sublabel: 'La Posada', to: '/food', color: 'var(--accent-green)', badge: undefined },
  { Icon: Moon, label: 'Sueño', sublabel: 'La Torre', to: '/sleep', color: 'var(--accent-cyan)', badge: undefined },
  { Icon: HeartHandshake, label: 'Amor', sublabel: 'El Jardín', to: '/love', color: 'var(--accent-pink)', badge: undefined },
] as const;

const DASHBOARD_SHORTCUTS = [
  { label: 'Nueva Quest', Icon: Swords,      to: '/quests',   color: 'var(--primary)' },
  { label: 'Gasto',       Icon: Wallet,      to: '/finances', color: 'var(--text-2)' },
  { label: 'Hábitos',     Icon: Flame,       to: '/habits',   color: 'var(--primary)' },
  { label: 'Diario',      Icon: NotebookPen, to: '/journal',  color: 'var(--text-2)' },
] as const;

const CLASS_TITLES: Record<string, string> = {
  warrior: 'Guerrero',
  mage: 'Mago',
  merchant: 'Mercader',
  paladin: 'Paladín',
};

function LifeScoreWidget({ score }: { score: LifeScore }) {
  const quests = Math.round(score.breakdown.quests ?? 0);
  const habits = Math.round(score.breakdown.habits ?? 0);
  const finances = Math.round(score.breakdown.finances ?? 0);
  const rows = [
    { label: 'Misiones', value: quests, color: '#2a2a2e' },
    { label: 'Hábitos', value: habits, color: '#8a8a92' },
    { label: 'Finanzas', value: finances, color: '#a8871e' },
  ];

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 22, boxShadow: 'var(--shadow-rest)' }}>
      <div className="flex items-center gap-3 mb-4">
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in oklab, var(--primary) 14%, transparent)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Trophy size={17} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--primary)' }}>Life Score</div>
          <div className="text-[13px] mt-0.5 font-medium" style={{ color: 'var(--text)' }}>tu balance entre misiones, hábitos y finanzas</div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <ProgressRings
          size={210}
          stroke={14}
          gap={4}
          centerLabel={score.total}
          centerSubLabel="/ 100"
          rings={[
            { progress: rows[0].value, color: rows[0].color },
            { progress: rows[1].value, color: rows[1].color },
            { progress: rows[2].value, color: rows[2].color },
          ]}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-2" style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--bg-soft)', border: '1px solid var(--border-soft)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: row.color, boxShadow: `0 0 6px ${row.color}80` }} />
              <span className="flex-1 text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>{row.label}</span>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: 'var(--text)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeeklySummaryCard({ summary }: { summary: WeeklySummaryCardData }) {
  const weekLabel = `${new Date(summary.weekStart).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${new Date(summary.weekEnd).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`;

  return (
    <PixelPanel className="p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-gold)]"><E e="📊" /> Resumen semanal</p>
          <p className="text-xs text-[var(--text-secondary)]">{weekLabel}</p>
        </div>
        <div className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'rgba(217,180,74,0.12)', color: 'var(--accent-gold)' }}>
          {summary.lifeScore}/100
        </div>
      </div>
      <p className="text-sm leading-6 whitespace-pre-line text-[var(--text-primary)]">{summary.summary}</p>
    </PixelPanel>
  );
}

function RecoveryChallengeCard({ challenge }: { challenge: RecoveryChallengeData }) {
  const expires = new Date(challenge.expiresAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const progress = Math.min(100, (challenge.currentDays / challenge.requiredDays) * 100);

  return (
    <PixelPanel
      className="p-4"
      style={{
        border: '1px solid rgba(217,180,74,0.5)',
        boxShadow: '0 0 0 1px rgba(217,180,74,0.15), 0 16px 36px rgba(217,180,74,0.12)',
        background: 'linear-gradient(145deg, rgba(217,180,74,0.12), rgba(15,17,23,0.02))',
      }}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">{challenge.habitIcon}</div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent-gold)]">Reto de recuperación</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{challenge.habitTitle}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Completa {challenge.requiredDays} días seguidos → {challenge.bonusXp} XP bonus + racha restaurada parcialmente.
          </p>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1 text-[var(--text-secondary)]">
              <span>{challenge.currentDays}/{challenge.requiredDays} días</span>
              <span>vence {expires}</span>
            </div>
            <div className="stat-bar">
              <motion.div className="stat-bar-fill bg-[var(--accent-gold)]" animate={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </PixelPanel>
  );
}

function SevenDayGuideCard({
  guide,
  loading,
  onComplete,
  onDismiss,
}: {
  guide: SevenDayGuideData;
  loading: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  const progress = (guide.completedDays.length / guide.totalDays) * 100;

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(59,130,246,0.25)', background: 'linear-gradient(145deg, rgba(59,130,246,0.12), rgba(255,255,255,0.02))' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-blue)]">Semana del Héroe</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">Día {guide.currentDay}/{guide.totalDays}: {guide.task.title}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Tu misión de hoy vive en <span className="font-semibold text-[var(--text-primary)]">{guide.task.zone}</span>. Bonus: +{guide.task.xpBonus} XP.
          </p>
        </div>
        <button onClick={onDismiss} className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          Ya sé cómo funciona <E e="✕" />
        </button>
      </div>

      <div className="mt-3">
        <div className="stat-bar">
          <motion.div className="stat-bar-fill bg-[var(--accent-blue)]" animate={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onComplete}
          disabled={loading}
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--accent-blue)', color: '#fff', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Completando...' : 'Completar y abrir zona'}
        </button>
        {guide.task.suggestedReady && (
          <span className="text-xs font-semibold text-[var(--accent-green)]">Ya hiciste progreso real hoy.</span>
        )}
      </div>
    </div>
  );
}

function RecoveryOverlay({ open, bonusXp }: { open: boolean; bonusXp: number }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          style={{ background: 'rgba(15,17,23,0.66)' }}
        >
          <motion.div
            initial={{ scale: 0.88, y: 18 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 10 }}
            className="relative overflow-hidden rounded-3xl border px-8 py-10 text-center"
            style={{ borderColor: 'rgba(217,180,74,0.5)', background: 'linear-gradient(180deg, rgba(217,180,74,0.16), rgba(0,0,0,0.45))' }}
          >
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 8 }, (_, index) => (
                <motion.span
                  key={index}
                  className="absolute text-3xl"
                  style={{ left: `${10 + index * 10}%`, bottom: 8 }}
                  animate={{ y: [-6, -30, -12], opacity: [0.3, 1, 0.2] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: index * 0.08 }}
                >
                  <E e="✨" />
                </motion.span>
              ))}
            </div>
            <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent-gold)]">¡Racha recuperada!</p>
            <h3 className="relative mt-3 text-3xl font-black text-white">Tu fuego volvió</h3>
            <p className="relative mt-3 text-sm text-white/85">+{bonusXp} XP bonus y restauración parcial de racha.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CoinBurst({ count }: { count: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {Array.from({ length: count }, (_, index) => (
        <motion.span
          key={`${count}-${index}`}
          className="absolute text-2xl"
          initial={{ opacity: 0, y: -20, x: 0, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [0, 80 + index * 8, 150 + index * 12],
            x: [0, (index - count / 2) * 12, (index - count / 2) * 20],
            rotate: [0, 120, 220],
          }}
          transition={{ duration: 1, ease: 'easeIn' }}
          style={{ left: `calc(50% + ${(index - count / 2) * 8}px)`, top: 110 }}
        >
          <E e="🪙" />
        </motion.span>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const { addFloatingXP, flashScreen, showAchievementToast, triggerLevelUp } = useUIStore();

  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<HabitSummary[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<AgendaEvent[]>([]);
  const [showBriefing, setShowBriefing] = useState(false);
  const [lifeScore, setLifeScore] = useState<LifeScore | null>(null);
  const [showClassModal, setShowClassModal] = useState(false);
  const [coinBurstCount, setCoinBurstCount] = useState(0);
  const [recoveryOverlay, setRecoveryOverlay] = useState<{ open: boolean; bonusXp: number }>({ open: false, bonusXp: 0 });

  useEffect(() => {
    loadDashboard();
    fetchUpcoming().then(setUpcomingEvents).catch(() => null);
    fetchLifeScore().then(setLifeScore).catch(() => null);
  }, []);

  useEffect(() => {
    if (!coinBurstCount) return;
    const timeout = setTimeout(() => setCoinBurstCount(0), 1100);
    return () => clearTimeout(timeout);
  }, [coinBurstCount]);

  useEffect(() => {
    if (!recoveryOverlay.open) return;
    const timeout = setTimeout(() => setRecoveryOverlay((current) => ({ ...current, open: false })), 2100);
    return () => clearTimeout(timeout);
  }, [recoveryOverlay.open]);

  if (!user) return null;

  async function loadDashboard() {
    setLoading(true);
    try {
      const data = await fetchDashboard();
      setDashData(data as DashboardData);
      setHabits((data as DashboardData).todayHabits ?? []);
    } catch {
      setDashData(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshCharacterState() {
    try {
      const character = await fetchCharacter();
      updateUser(character);
    } catch {
      // ignore
    }
  }

  async function handleHabitLog(habitId: string) {
    try {
      const result = await logHabit(habitId, 'completed');
      addFloatingXP(result.rewards?.xpEarned ?? 0, window.innerWidth / 2, 200);
      flashScreen('#4a825f');
      if (result.rewards?.leveledUp && result.rewards.newLevel) {
        triggerLevelUp({
          oldLevel: Math.max(1, result.rewards.newLevel - 1),
          newLevel: result.rewards.newLevel,
          xpEarned: result.rewards.xpEarned,
          goldEarned: result.rewards.goldEarned,
          statIncreases: {},
        });
      }
      if ((result.rewards?.goldEarned ?? 0) > 0) {
        setCoinBurstCount(Math.min(8, Math.max(5, result.rewards?.goldEarned ?? 0)));
      }
      for (const achievement of result.achievementsUnlocked) showAchievementToast(achievement);
      if (result.recoveryCompleted) {
        setRecoveryOverlay({ open: true, bonusXp: result.recoveryCompleted.bonusXp });
      }

      setHabits((previous) =>
        previous.map((habit) =>
          habit.id === habitId
            ? { ...habit, todayStatus: 'completed', todayCompleted: true, currentStreak: result.currentStreak }
            : habit
        )
      );

      await Promise.all([refreshCharacterState(), loadDashboard()]);
      return true;
    } catch {
      return false;
    }
  }

  const visualState = dashData?.visualState;
  const visualHpValue = Math.round((user.maxHp * (visualState?.hpPercent ?? 100)) / 100);
  const statBars = [
    { label: 'HP', value: visualHpValue, max: user.maxHp, color: 'bg-accent-pink', pulse: visualState?.hpLow ?? false },
    { label: 'MP', value: user.mp, max: user.maxMp, color: 'bg-accent-cyan', pulse: false },
    { label: 'XP', value: user.xp, max: user.xpToNextLevel, color: 'bg-accent-gold', pulse: false },
  ];

  const stats = [
    { key: 'STR', value: user.strength, color: 'text-[var(--accent-red)]' },
    { key: 'INT', value: user.intelligence, color: 'text-[var(--accent-blue)]' },
    { key: 'CHA', value: user.charisma, color: 'text-[var(--accent-pink)]' },
  ];

  const lastWorkoutDaysAgo = dashData?.recentWorkout
    ? Math.floor((Date.now() - new Date(dashData.recentWorkout.date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const maxHabitStreak = habits.reduce((max, habit) => Math.max(max, habit.currentStreak), 0);
  const topHabit = habits.find((habit) => habit.currentStreak === maxHabitStreak && maxHabitStreak > 0);
  const playerClass = (user as unknown as { playerClass?: string }).playerClass;

  return (
    <div className="w-full max-w-none space-y-5 pb-8">
      <AnimatePresence>
        {showBriefing && <MorningBriefing onClose={() => setShowBriefing(false)} />}
        {showClassModal && <ClassSelectionModal onClose={() => setShowClassModal(false)} />}
      </AnimatePresence>

      {coinBurstCount > 0 && <CoinBurst count={coinBurstCount} />}
      <RecoveryOverlay open={recoveryOverlay.open} bonusXp={recoveryOverlay.bonusXp} />

      <GreetingHeader displayName={user.displayName} currentStreak={user.currentStreak} createdAt={user.createdAt} gender={user.avatarConfig?.bodyType ?? 'male'} />

      <TodayPlan onHabitComplete={handleHabitLog} />

      <SageProactiveCard />

      <FirstStepsWidget
        questCount={dashData?.firstSteps.questCount ?? 0}
        habitCount={dashData?.firstSteps.habitCount ?? 0}
        hasJournalEntry={dashData?.firstSteps.hasJournalEntry ?? false}
      />

      <div className="grid grid-cols-4 gap-2">
        {DASHBOARD_SHORTCUTS.map(({ label, Icon, to, color }) => (
          <motion.button
            key={to}
            type="button"
            aria-label={label}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(to)}
            className="flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--bg-panel-light)]"
          >
            <Icon size={18} strokeWidth={1.8} style={{ color }} aria-hidden="true" />
            <span className="px-1 text-center text-[10px] font-medium leading-tight text-[var(--text-secondary)]">{label}</span>
          </motion.button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          {!playerClass && user.level >= 10 && (
            <button type="button" onClick={() => setShowClassModal(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[color-mix(in_oklab,var(--accent-gold)_45%,var(--border))] bg-[color-mix(in_oklab,var(--accent-gold)_8%,var(--bg-panel))] px-2.5 py-1.5 text-xs font-medium text-[var(--accent-gold)] transition-colors hover:bg-[color-mix(in_oklab,var(--accent-gold)_14%,var(--bg-panel))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]">
              <Zap size={14} aria-hidden="true" /> Elige tu clase · nivel 10
            </button>
          )}
        </div>
        <button type="button" onClick={() => setShowBriefing(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-panel-light)] hover:text-[var(--accent-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]">
          <ClipboardList size={14} aria-hidden="true" /> Briefing del día
        </button>
      </div>

      <BossWidget />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(250px,0.85fr)_minmax(0,1.45fr)_minmax(250px,0.85fr)]">
        <aside className="space-y-4">
          <PixelPanel animate className="p-4">
            <div className="flex items-center gap-3">
              <AvatarDisplay
                avatarConfig={user.avatarConfig}
                avatarUrl={user.avatarUrl}
                equippedAura={user.equippedAura}
                equippedFrame={user.equippedFrame}
                size={78}
                mood={visualState?.mood ?? 3}
                animate={(visualState?.mood ?? 3) >= 4 ? 'celebrate' : 'idle'}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-[var(--text-primary)]">{user.displayName}</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--accent-gold)]">{getLevelTitle(user.level)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--accent-gold)] px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] text-white">Nivel {user.level}</span>
                  {playerClass && <span className="rounded-full border border-[var(--border)] bg-[var(--bg-panel-light)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]">{CLASS_TITLES[playerClass] ?? playerClass}</span>}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5">
              {statBars.map(({ label, value, max, color, pulse }) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-[11px]">
                    <span className="font-medium text-[var(--text-secondary)]">{label}</span>
                    <span className="tabular-nums text-[var(--text-primary)]">{value}/{max}</span>
                  </div>
                  <div className={`stat-bar ${pulse ? 'animate-pulse' : ''}`}>
                    <motion.div className={`stat-bar-fill ${color}`} initial={{ width: 0 }} animate={{ width: `${xpProgressPercent(value, max)}%` }} transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }} />
                  </div>
                </div>
              ))}
            </div>

            {visualState && visualState.daysAway > 0 && (
              <p className="mt-3 rounded-lg bg-[var(--bg-panel-light)] px-2.5 py-2 text-[11px] leading-4 text-[var(--text-secondary)]">
                {visualState.daysAway >= 5 ? 'Tu energía visual pide retomar el ritmo.' : visualState.daysAway >= 3 ? 'Una pequeña acción hoy te ayudará a recuperar energía.' : 'Tu energía visual bajó un poco por distancia.'}
              </p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3">
              {stats.map(({ key, value, color }) => (
                <div key={key} className="rounded-lg bg-[var(--bg-panel-light)] px-2 py-2 text-center">
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">{key}</p>
                  <p className={`mt-0.5 text-base font-semibold tabular-nums ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-panel-light)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-gold)]"><Coins size={14} />{user.gold.toLocaleString()} oro</span>
              {user.currentStreak > 0 && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-red)]"><Flame size={14} />{user.currentStreak} días de racha</span>}
            </div>
          </PixelPanel>

          {lifeScore && <LifeScoreWidget score={lifeScore} />}

          {upcomingEvents.length > 0 && (
            <PixelPanel className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2"><CalendarDays size={15} className="text-[var(--accent-blue)]" /><h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Próximos eventos</h3></div>
                <button type="button" onClick={() => navigate('/agenda')} className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-[var(--accent-gold)] transition-colors hover:text-[var(--text-primary)]">Ver agenda</button>
              </div>
              <div className="space-y-3">
                {upcomingEvents.slice(0, 3).map((event) => {
                  const when = new Date(event.startDate);
                  const isToday = when.toDateString() === new Date().toDateString();
                  return (
                    <div key={event.id} className="flex items-start gap-2.5">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isToday ? 'bg-[var(--accent-red)]' : 'bg-[var(--accent-blue)]'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{event.title}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{isToday ? 'Hoy' : when.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}{!event.isAllDay ? ` · ${when.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </PixelPanel>
          )}
        </aside>

        <section className="min-w-0 space-y-4">
          <div id="daily-checkin">
            <DailyCheckinWidget />
          </div>

          {loading ? <SkeletonCard lines={4} /> : <TodayQuestsWidget quests={dashData?.todayQuests ?? []} />}

          {habits.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] shadow-[0_14px_36px_rgba(0,0,0,0.08)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--accent-green)_10%,var(--bg-panel))] text-[var(--accent-green)]"><Flame size={17} /></span>
                  <div><h3 className="text-sm font-semibold text-[var(--text-primary)]">Hábitos de hoy</h3><p className="mt-0.5 text-xs text-[var(--text-secondary)]">Rituales recurrentes que sostienen tu semana.</p></div>
                </div>
                <button type="button" onClick={() => navigate('/habits')} className="inline-flex min-h-11 items-center px-2 text-xs font-medium text-[var(--accent-gold)] transition-colors hover:text-[var(--text-primary)]">Ver todos</button>
              </div>
              <div className="divide-y divide-[var(--border)] px-4 sm:px-5">
                {habits.slice(0, 5).map((habit) => {
                  const isComplete = habit.todayStatus === 'completed';
                  return (
                    <div key={habit.id} className="flex items-center gap-3 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-panel)] text-[var(--text-secondary)]"><E e={habit.icon} s={16} /></span>
                      <div className="min-w-0 flex-1"><p className={`truncate text-sm font-medium ${isComplete ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>{habit.title}</p><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">+{habit.xpReward} XP</p></div>
                      <StreakFlame streak={habit.currentStreak} size="sm" />
                      <button
                        type="button"
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-green)] ${isComplete ? 'border-[var(--accent-green)] bg-[var(--accent-green)] text-white' : 'border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--text-muted)] hover:border-[var(--accent-green)] hover:text-[var(--accent-green)]'}`}
                        onClick={() => { if (!habit.todayCompleted) void handleHabitLog(habit.id); }}
                        disabled={isComplete}
                        aria-label={isComplete ? `Hábito completado: ${habit.title}` : `Completar hábito: ${habit.title}`}
                      >
                        {isComplete ? <Check size={16} /> : <span className="h-2 w-2 rounded-full border border-current" aria-hidden="true" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2">
            {topHabit && (
              <LifeQuestFlipCard
                eyebrow="Mejor racha actual"
                title={topHabit.title}
                description={`${topHabit.currentStreak} días de constancia en tu aventura.`}
                visual={(
                  <div className="flex items-end gap-3" aria-hidden="true">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card text-[var(--accent-gold)]"><Flame size={34} /></span>
                    <div className="text-left"><p className="text-4xl font-semibold leading-none text-foreground">{topHabit.currentStreak}</p><p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">días seguidos</p></div>
                  </div>
                )}
                visualLabel={`Racha de ${topHabit.currentStreak} días`}
                badge={topHabit.todayCompleted ? 'Hoy completado' : 'En curso'}
                frontFooter={<p className="text-xs font-medium [color:var(--flip-accent)]">+{topHabit.xpReward} XP por completar hoy</p>}
                backDescription={<p>Revisa tu progreso, conserva la cadena y elige el siguiente hábito que quieres marcar hoy.</p>}
                metrics={[
                  { label: 'Racha', value: `${topHabit.currentStreak} días` },
                  { label: 'Recompensa', value: `+${topHabit.xpReward} XP` },
                  { label: 'Hoy', value: topHabit.todayCompleted ? 'Hecho' : 'Pendiente' },
                ]}
                actionLabel="Ver hábitos"
                onAction={() => navigate('/habits')}
                accent="var(--accent-gold)"
              />
            )}

            {dashData?.recentAchievements?.[0] && (() => {
              const achievement = dashData.recentAchievements[0];
              const unlockedDate = new Date(achievement.unlockedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
              return (
                <LifeQuestFlipCard
                  eyebrow="Logro reciente"
                  title={achievement.title}
                  description={achievement.description}
                  visual={<span className="text-6xl" aria-hidden="true"><E e={achievement.icon} s={64} /></span>}
                  visualLabel={`Insignia de ${achievement.title}`}
                  badge="Desbloqueado"
                  frontFooter={<p className="inline-flex items-center gap-1.5 text-xs font-semibold [color:var(--flip-accent)]"><Trophy size={14} aria-hidden="true" /> +{achievement.xpReward} XP</p>}
                  backDescription={<p>{achievement.description} Forma parte de tu colección de hitos de LifeQuest.</p>}
                  metrics={[
                    { label: 'XP', value: `+${achievement.xpReward}` },
                    { label: 'Fecha', value: unlockedDate },
                    { label: 'Colección', value: 'Logros' },
                  ]}
                  actionLabel="Ver logros"
                  onAction={() => navigate('/achievements')}
                  accent="var(--accent-gold)"
                  />
              );
            })()}
          </div>
        </section>

        <aside className="space-y-4 lg:col-span-2 xl:col-span-1">
          <SageDailyTip />
          <SageScrollsWidget />
          {dashData?.recoveryChallenge && <RecoveryChallengeCard challenge={dashData.recoveryChallenge} />}
          {dashData?.latestWeeklySummary && <WeeklySummaryCard summary={dashData.latestWeeklySummary} />}
          <QuickStatsWidget sleepAvg7d={dashData?.sleepAvg7d ?? 0} monthBalance={dashData?.monthBalance ?? 0} lastWorkoutDaysAgo={lastWorkoutDaysAgo} />

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-3.5 shadow-[0_10px_25px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center gap-2"><Swords size={15} className="text-[var(--accent-gold)]" /><div><p className="text-xs font-semibold text-[var(--text-primary)]">Zonas de vida</p><p className="text-[11px] text-[var(--text-secondary)]">Elige dónde avanzar ahora.</p></div></div>
            <div className="grid grid-cols-2 gap-2">
              {ZONES.map(({ Icon, ...zone }) => <ZoneCard key={zone.label} {...zone} icon={<Icon size={16} strokeWidth={1.9} />} />)}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

