import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, NotebookPen, Swords, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Quest } from '@lifequest/shared';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { MiguelSprite } from '../../components/character/MiguelSprite';
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

const ZONES: { icon: ReactNode; label: string; sublabel: string; to: string; color: string; badge: undefined }[] = [
  { icon: <span className="text-4xl leading-none block"><E e="🏋" /></span>, label: 'Gym', sublabel: 'Coliseo', to: '/gym', color: 'border-[var(--accent-red)]', badge: undefined },
  { icon: <span className="text-4xl leading-none block"><E e="💰" /></span>, label: 'Finanzas', sublabel: 'La Bóveda', to: '/finances', color: 'border-[var(--accent-gold)]', badge: undefined },
  { icon: <span className="text-4xl leading-none block"><E e="📚" /></span>, label: 'Aprend.', sublabel: 'Biblioteca', to: '/learning', color: 'border-[var(--accent-blue)]', badge: undefined },
  { icon: <span className="text-4xl leading-none block"><E e="🍽" /></span>, label: 'Comida', sublabel: 'La Posada', to: '/food', color: 'border-[var(--accent-green)]', badge: undefined },
  { icon: <span className="text-4xl leading-none block"><E e="🌙" /></span>, label: 'Sueño', sublabel: 'La Torre', to: '/sleep', color: 'border-[var(--accent-cyan)]', badge: undefined },
  { icon: <span className="text-4xl leading-none block"><E e="💕" /></span>, label: 'Amor', sublabel: 'El Jardín', to: '/love', color: 'border-[var(--accent-pink)]', badge: undefined },
];

const DASHBOARD_SHORTCUTS = [
  { label: 'Nueva Quest', Icon: Swords,      to: '/quests',   color: 'var(--primary)' },
  { label: 'Gasto',       Icon: Wallet,      to: '/finances', color: 'var(--text-2)' },
  { label: 'Hábitos',     Icon: Flame,       to: '/habits',   color: 'var(--primary)' },
  { label: 'Diario',      Icon: NotebookPen, to: '/journal',  color: 'var(--text-2)' },
] as const;

const CLASS_TITLES: Record<string, string> = {
  warrior: ' Guerrero',
  mage: ' Mago',
  merchant: ' Mercader',
  paladin: ' Paladín',
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
          <E e="📊" />
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
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
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

  const avatarCfg = user.avatarConfig;
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
    <div className="space-y-5">
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {playerClass ? (
            <span className="text-xs font-semibold text-[var(--accent-gold)] bg-[var(--bg-panel-light)] border border-[var(--border)] px-2 py-1 rounded">
              {CLASS_TITLES[playerClass] ?? playerClass}
            </span>
          ) : user.level >= 10 ? (
            <button onClick={() => setShowClassModal(true)} className="text-xs font-semibold text-[var(--accent-gold)] animate-pulse">
              <E e="⚡" /> ¡Elige tu Clase! (Nivel 10)
            </button>
          ) : null}
        </div>
        <button onClick={() => setShowBriefing(true)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-gold)] transition-colors">
          <E e="📋" /> Briefing del día
        </button>
      </div>

      <BossWidget />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PixelPanel animate className="p-4 md:col-span-1">
          <div className="flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-[var(--bg-panel-light)] flex items-center justify-center relative overflow-hidden">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <MiguelSprite
                  size={80}
                  bodyType={avatarCfg.bodyType}
                  hairStyle={avatarCfg.hairStyle}
                  hairColor={avatarCfg.hairColor}
                  skinColor={avatarCfg.skinColor}
                  shirtColor={avatarCfg.shirtColor}
                  pantsColor={avatarCfg.pants}
                  accessory={avatarCfg.accessory}
                  expression={avatarCfg.expression}
                  mood={visualState?.mood ?? 3}
                  animate={(visualState?.mood ?? 3) >= 4 ? 'celebrate' : 'idle'}
                />
              )}
            </div>

            <div className="text-center">
              <p className="font-semibold text-sm text-[var(--text-primary)]">{user.displayName}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-gold)] mt-1">{getLevelTitle(user.level)}</p>
              <div className="bg-[var(--accent-gold)] text-white text-xs font-bold px-3 py-1 rounded-full mt-2 inline-block">
                NIVEL {user.level}
              </div>
            </div>

            <div className="w-full space-y-2">
              {statBars.map(({ label, value, max, color, pulse }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="text-[var(--text-secondary)]">{label}</span>
                    <span className="text-[var(--text-primary)]">{value}/{max}</span>
                  </div>
                  <div className={`stat-bar ${pulse ? 'animate-pulse' : ''}`}>
                    <motion.div className={`stat-bar-fill ${color}`} initial={{ width: 0 }} animate={{ width: `${xpProgressPercent(value, max)}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }} />
                  </div>
                  {label === 'HP' && visualState && visualState.daysAway > 0 && (
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      {visualState.daysAway >= 5 ? 'Tu HP luce crítico por ausencia.' : visualState.daysAway >= 3 ? 'Tu HP visual pide volver al castillo.' : 'Tu HP visual bajó un poco por distancia.'}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-1">
              {stats.map(({ key, value, color }) => (
                <div key={key} className="text-center">
                  <p className="text-xs font-bold text-[var(--text-secondary)]">{key}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[var(--bg-panel-light)] border border-[var(--border)] rounded-lg px-3 py-1.5">
              <span className="text-base font-semibold text-[var(--accent-gold)]"><E e="💰" /> {user.gold.toLocaleString()}</span>
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide ml-1">GOLD</span>
            </div>

            {user.currentStreak > 0 && (
              <motion.div className="flex items-center gap-1 text-[var(--accent-red)]" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                <span><E e="🔥" /></span>
                <span className="text-sm">{user.currentStreak} días de racha</span>
              </motion.div>
            )}
          </div>
        </PixelPanel>

        <div className="md:col-span-2 space-y-4">
          <SageDailyTip />
          <SageScrollsWidget />
          <div id="daily-checkin">
            <DailyCheckinWidget />
          </div>

          {dashData?.recoveryChallenge && <RecoveryChallengeCard challenge={dashData.recoveryChallenge} />}
          {dashData?.latestWeeklySummary && <WeeklySummaryCard summary={dashData.latestWeeklySummary} />}

          {loading ? <SkeletonCard lines={4} /> : <TodayQuestsWidget quests={dashData?.todayQuests ?? []} />}

          {habits.length > 0 && (
            <PixelPanel className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide"><E e="🔥" /> HÁBITOS DE HOY</h3>
                <button onClick={() => navigate('/habits')} className="text-xs font-medium text-[var(--accent-gold)] hover:text-[var(--text-primary)]">
                  VER TODOS →
                </button>
              </div>
              <div className="space-y-2">
                {habits.slice(0, 5).map((habit) => (
                  <div key={habit.id} className="flex items-center gap-2 py-1">
                    <span className="text-lg"><E e={habit.icon} /></span>
                    <span className="text-sm text-[var(--text-primary)] flex-1 truncate">{habit.title}</span>
                    <StreakFlame streak={habit.currentStreak} size="sm" />
                    <motion.button
                      className={`w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center text-sm font-medium transition-colors ${
                        habit.todayStatus === 'completed'
                          ? 'bg-[var(--accent-green)] border-[var(--accent-green)] text-white'
                          : 'bg-[var(--bg-deep)] hover:border-[var(--accent-green)]'
                      }`}
                      onClick={() => {
                        if (!habit.todayCompleted) handleHabitLog(habit.id);
                      }}
                      whileTap={{ scale: 0.9 }}
                      disabled={habit.todayStatus === 'completed'}
                    >
                      {habit.todayStatus === 'completed' ? '✓' : '○'}
                    </motion.button>
                  </div>
                ))}
              </div>
            </PixelPanel>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topHabit && (
              <PixelPanel className="p-3 cursor-pointer hover:border-[var(--accent-gold)] transition-colors" onClick={() => navigate('/habits')}>
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1"><E e="🏆" /> MEJOR RACHA ACTUAL</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl"><E e={topHabit.icon} /></span>
                  <div>
                    <p className="text-sm text-[var(--text-primary)]">{topHabit.title}</p>
                    <p className="text-sm text-[var(--accent-gold)]">{topHabit.currentStreak} días seguidos</p>
                  </div>
                </div>
              </PixelPanel>
            )}

            {dashData?.recentAchievements?.[0] && (
              <PixelPanel className="p-3 cursor-pointer hover:border-[var(--accent-gold)] transition-colors" onClick={() => navigate('/achievements')}>
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1"><E e="⭐" /> LOGRO RECIENTE</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl"><E e={dashData.recentAchievements[0].icon} /></span>
                  <div>
                    <p className="text-base font-semibold text-[var(--accent-gold)]">{dashData.recentAchievements[0].title}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{dashData.recentAchievements[0].description}</p>
                  </div>
                </div>
              </PixelPanel>
            )}
          </div>

          {lifeScore && <LifeScoreWidget score={lifeScore} />}

          <QuickStatsWidget sleepAvg7d={dashData?.sleepAvg7d ?? 0} monthBalance={dashData?.monthBalance ?? 0} lastWorkoutDaysAgo={lastWorkoutDaysAgo} />

          {upcomingEvents.length > 0 && (
            <PixelPanel className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide"><E e="📅" /> PRÓXIMOS EVENTOS</h3>
                <button onClick={() => navigate('/agenda')} className="text-xs font-medium text-[var(--accent-gold)] hover:text-[var(--text-primary)]">
                  VER AGENDA →
                </button>
              </div>
              <div className="space-y-2">
                {upcomingEvents.slice(0, 3).map((event) => {
                  const when = new Date(event.startDate);
                  const isToday = when.toDateString() === new Date().toDateString();
                  return (
                    <div key={event.id} className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-primary)] truncate">{event.title}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {isToday ? 'Hoy' : when.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {!event.isAllDay ? ` · ${when.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </p>
                      </div>
                      {isToday && <span className="text-xs font-semibold text-[var(--accent-red)] flex-shrink-0">HOY</span>}
                    </div>
                  );
                })}
              </div>
            </PixelPanel>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ZONES.map((zone) => (
              <ZoneCard key={zone.label} {...zone} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

