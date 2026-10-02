import { FlowButton } from '@/components/ui/flow-button';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { PixelPanel } from '../../components/ui/PixelPanel';
import { LifeQuestFlipCard } from '../../components/ui/lifequest-flip-card';
import { PixelButton } from '../../components/ui/PixelButton';
import { StreakFlame } from '../../components/habits/StreakFlame';
import { HabitRow } from '../../components/habits/HabitRow';
import { HabitModal } from '../../components/habits/HabitModal';
import { SkeletonList } from '../../components/ui/Skeleton';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { refreshUser } from '../../hooks/useAuth';
import { useToastStore } from '../../hooks/useToast';
import * as habitService from '../../services/habit.service';
import type { Habit } from '../../services/habit.service';
import { E } from '@/components/ui/glyphs';
import { EmptyState } from '@/components/ui/EmptyState';
import { AlertTriangle } from 'lucide-react';

export default function HabitsPage() {
  const user = useAuthStore((s) => s.user);
  const { addFloatingXP, flashScreen, showAchievementToast, triggerLevelUp } = useUIStore();
  const toast = useToastStore();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [streakToast, setStreakToast] = useState<{ streak: number; name: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Habit | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const data = await habitService.fetchHabits();
      setHabits(data);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleLog(habitId: string, status: 'completed' | 'failed' | 'skipped') {
    // Optimistic update
    setHabits(prev => prev.map(h =>
      h.id === habitId ? { ...h, todayStatus: status, todayCompleted: status === 'completed' } : h
    ));
    if (status === 'completed') flashScreen('#4a825f');

    try {
      const result = await habitService.logHabit(habitId, status);

      if (result.rewards) {
        addFloatingXP(result.rewards.xpEarned, window.innerWidth / 2, window.innerHeight / 3);
        flashScreen('#4a825f');

        if (result.rewards.leveledUp && result.rewards.newLevel) {
          triggerLevelUp({
            oldLevel: result.rewards.newLevel - 1,
            newLevel: result.rewards.newLevel,
            xpEarned: result.rewards.xpEarned,
            goldEarned: 0,
            statIncreases: {},
          });
        }

        // Streak milestone toast
        const streak = result.currentStreak;
        if (streak > 0 && streak % 7 === 0) {
          setStreakToast({ streak, name: result.habit.title });
          setTimeout(() => setStreakToast(null), 4000);
        }
      }

      for (const ach of result.achievementsUnlocked) {
        showAchievementToast(ach);
      }

      // Update habit in list
      setHabits((prev) => prev.map((h) =>
        h.id === habitId
          ? { ...h, currentStreak: result.currentStreak, longestStreak: result.longestStreak, todayStatus: status, todayCompleted: status === 'completed' }
          : h
      ));

      // Sincronizar XP/gold/nivel/racha con el backend: el store quedaba
      // congelado desde el boot y "Ficha del héroe"/HUD no mostraban el XP ganado
      // aunque el leaderboard (que lee la BD) sí lo reflejaba.
      void refreshUser();
    } catch {
      // Rollback optimistic
      setHabits(prev => prev.map(h =>
        h.id === habitId ? { ...h, todayStatus: undefined, todayCompleted: false } : h
      ));
    }
  }

  async function handleCreate(data: habitService.CreateHabitPayload) {
    await habitService.createHabit(data);
    setShowModal(false);
    await load();
  }

  async function handleEdit(data: habitService.CreateHabitPayload) {
    if (!editingHabit) return;
    await habitService.updateHabit(editingHabit.id, data);
    setEditingHabit(null);
    setShowModal(false);
    await load();
  }

  async function handleDelete(habit: Habit) {
    setPendingDelete(habit);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await habitService.archiveHabit(pendingDelete.id);
    setPendingDelete(null);
    toast.success(`Hábito "${pendingDelete.title}" archivado`);
    await load();
  }

  const displayedHabits = habits;
  const maxStreak = displayedHabits.reduce((max, h) => Math.max(max, h.longestStreak), 0);
  const topHabit = displayedHabits.find((h) => h.longestStreak === maxStreak);
  const remainingHabits = topHabit ? displayedHabits.filter((habit) => habit.id !== topHabit.id) : displayedHabits;
  const completedToday = displayedHabits.filter((h) => h.todayStatus === 'completed').length;
  const totalHabits = displayedHabits.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-pixel text-accent-gold" style={{ fontSize: '14px' }}>
            TUS HÁBITOS DIARIOS
          </h1>
          <p className="font-vt text-text-secondary text-base">
            {`Construye quién quieres ser, un día a la vez, ${user?.displayName?.split(' ')[0]}`}
          </p>
        </div>
        <PixelButton variant="primary" onClick={() => { setEditingHabit(null); setShowModal(true); }}>
+ NUEVO HÁBITO
        </PixelButton>
      </div>

      {/* Stats */}
      {!loadFailed && <div className="grid grid-cols-3 gap-3">
        <PixelPanel className="p-3 text-center">
          <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '12px' }}>HOY</p>
          <p className="font-vt text-accent-green text-3xl">{completedToday}/{totalHabits}</p>
          <p className="font-vt text-text-secondary text-sm">completados</p>
        </PixelPanel>

        <PixelPanel className="p-3 text-center">
          <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '12px' }}>MEJOR RACHA</p>
          <div className="flex justify-center">
            <StreakFlame streak={maxStreak} size="sm" />
          </div>
          {topHabit && <p className="font-vt text-text-secondary text-xs mt-1 truncate">{topHabit.title}</p>}
        </PixelPanel>

        <PixelPanel className="p-3 text-center">
          <p className="font-pixel text-text-secondary mb-1" style={{ fontSize: '12px' }}>RACHA GLOBAL</p>
          <p className="font-vt text-accent-gold text-3xl">{user?.currentStreak ?? 0}</p>
          <p className="font-vt text-text-secondary text-sm">días</p>
        </PixelPanel>
      </div>}

      {!loading && topHabit && (
        <LifeQuestFlipCard
          eyebrow="Hábito destacado"
          title={topHabit.title}
          description={topHabit.todayCompleted ? 'Ya sumaste este paso a tu día. Mira el detalle o ajusta su configuración.' : 'Tu siguiente oportunidad de sostener la racha está lista.'}
          visual={<span className="text-6xl" aria-hidden="true"><E e={topHabit.icon} s={64} /></span>}
          visualLabel={`Hábito destacado: ${topHabit.title}`}
          badge={topHabit.todayCompleted ? 'Completado hoy' : 'Pendiente'}
          frontFooter={<p className="text-xs font-semibold [color:var(--flip-accent)]">{completedToday}/{totalHabits} hábitos completados hoy</p>}
          backDescription={<p>Esta es tu mejor racha registrada. Completarla mantiene el ritmo de tu aventura y actualiza tus recompensas.</p>}
          metrics={[
            { label: 'Racha actual', value: `${topHabit.currentStreak} días` },
            { label: 'Mejor racha', value: `${topHabit.longestStreak} días` },
            { label: 'Hoy', value: topHabit.todayCompleted ? 'Hecho' : 'Pendiente' },
          ]}
          backActions={(
            <FlowButton
              tone="ghost"
              size="sm"
              withArrows={false}
              onClick={(event) => { event.stopPropagation(); setEditingHabit(topHabit); setShowModal(true); }}
              className="min-h-11 rounded-xl border border-border bg-muted px-3 text-sm font-semibold text-foreground transition-transform hover:scale-[1.015] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Editar hábito
            </FlowButton>
          )}
          actionLabel={topHabit.todayCompleted ? 'Editar hábito' : 'Completar hábito'}
          onAction={() => {
            if (topHabit.todayCompleted) { setEditingHabit(topHabit); setShowModal(true); return; }
            void handleLog(topHabit.id, 'completed');
          }}
          accent="var(--accent-gold)"
        />
      )}

      {/* Habits list */}
      {loading ? (
        <SkeletonList count={3} />
      ) : loadFailed ? (
        <EmptyState
          icon={AlertTriangle}
          title="No pudimos cargar tus hábitos"
          description="Tus hábitos siguen guardados. Revisa tu conexión e inténtalo de nuevo."
          actionLabel="Reintentar"
          onAction={() => { void load(); }}
        />
      ) : habits.length === 0 ? (
        <PixelPanel className="p-8 text-center">
          <p className="text-4xl mb-3"><E e="🔥" /></p>
          <p className="font-pixel text-text-secondary" style={{ fontSize: '12px' }}>SIN HÁBITOS AÚN</p>
          <p className="font-vt text-text-secondary text-base mt-1">Crea tu primer hábito y empieza a construir racha</p>
          <div className="mt-4">
            <PixelButton variant="primary" onClick={() => setShowModal(true)}>+ PRIMER HÁBITO</PixelButton>
          </div>
        </PixelPanel>
      ) : remainingHabits.length > 0 ? (
        <div className="space-y-2">
          {remainingHabits.map((habit, idx) => (
            <motion.div
              key={habit.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <HabitRow
                habit={habit}
                onLog={handleLog}
                onEdit={(h) => { setEditingHabit(h); setShowModal(true); }}
                onDelete={handleDelete}
              />
            </motion.div>
          ))}
        </div>
      ) : null}

      {/* Streak milestone toast */}
      <AnimatePresence>
        {streakToast && (
          <motion.div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-accent-gold text-bg-deep font-pixel px-6 py-3 border-2 border-border-pixel z-50 text-center"
            initial={{ y: 40, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.8 }}
            style={{ fontSize: '12px' }}
          >
            <E e="🔥" /> ¡{streakToast.streak} DÍAS!<br />
            <span style={{ fontSize: '12px' }}>{streakToast.name}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Habit Modal */}
      <AnimatePresence>
        {showModal && (
          <HabitModal
            title={editingHabit ? 'EDITAR HÁBITO' : 'NUEVO HÁBITO'}
            initial={editingHabit ?? undefined}
            onSubmit={editingHabit ? handleEdit : handleCreate}
            onClose={() => { setShowModal(false); setEditingHabit(null); }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {pendingDelete && (
          <ConfirmDialog
            title="¿ARCHIVAR HÁBITO?"
            message={`"${pendingDelete.title}" será archivado. Tu racha se guardará.`}
            confirmLabel="ARCHIVAR"
            danger
            onConfirm={confirmDelete}
            onCancel={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
