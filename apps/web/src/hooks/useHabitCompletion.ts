// Completar un hábito con todas las recompensas reales del backend:
// XP flotante, subida de nivel, logros, toast "+XP" y confeti.
import { useCallback, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useToastStore } from '@/hooks/useToast';
import { refreshUser } from '@/hooks/useAuth';
import * as habitService from '@/services/habit.service';
import { getLocale, type Copy } from '@/lib/i18n';

const es = {
  skipped: (title: string): string => `${title}: omitido hoy`,
  streakBack: '¡Racha recuperada!',
  bonusXp: (xp: number): string => `+${xp} XP de bonus`,
  logFail: 'No se pudo registrar el hábito',
  undoFail: 'No se pudo desmarcar el hábito',
  tryAgain: 'Inténtalo de nuevo',
  undone: (title: string): string => `${title}: desmarcado hoy`,
  xpRemoved: (xp: number): string => `Se descontaron ${xp} XP; si lo completas de nuevo, los recuperas.`,
};

const en: typeof es = {
  skipped: (title: string): string => `${title}: skipped today`,
  streakBack: 'Streak recovered!',
  bonusXp: (xp: number): string => `+${xp} bonus XP`,
  logFail: 'Could not log the habit',
  undoFail: 'Could not undo the habit',
  tryAgain: 'Try again',
  undone: (title: string): string => `${title}: unchecked today`,
  xpRemoved: (xp: number): string => `${xp} XP were taken away; if you complete it again, you get them back.`,
};

const COPY: Copy<typeof es> = { es, en };

export function useHabitCompletion() {
  const { addFloatingXP, triggerLevelUp, showAchievementToast } = useUIStore();
  const [pending, setPending] = useState<string | null>(null);
  /** Cambia en cada éxito: úsalo como `burst` del <Confetti>. */
  const [burst, setBurst] = useState(0);

  const complete = useCallback(async (habit: { id: string; title: string }, status: 'completed' | 'skipped' = 'completed') => {
    setPending(habit.id);
    try {
      const result = await habitService.logHabit(habit.id, status);
      const r = result.rewards;
      if (status === 'completed') {
        if (r && r.xpEarned > 0) addFloatingXP(r.xpEarned, window.innerWidth / 2, window.innerHeight / 3);
        useToastStore.getState().success(habit.title, r && r.xpEarned > 0 ? `+${r.xpEarned} XP` : undefined);
        setBurst((b) => b + 1);
      } else {
        useToastStore.getState().info(COPY[getLocale()].skipped(habit.title));
      }
      if (r?.leveledUp && r.newLevel) {
        triggerLevelUp({ oldLevel: Math.max(1, r.newLevel - 1), newLevel: r.newLevel, xpEarned: r.xpEarned, goldEarned: r.goldEarned, statIncreases: {} });
      }
      for (const a of result.achievementsUnlocked ?? []) showAchievementToast(a);
      if (result.recoveryCompleted) {
        useToastStore.getState().success(COPY[getLocale()].streakBack, COPY[getLocale()].bonusXp(result.recoveryCompleted.bonusXp));
      }
      void refreshUser();
      return result;
    } catch {
      useToastStore.getState().error(COPY[getLocale()].logFail, COPY[getLocale()].tryAgain);
      return null;
    } finally {
      setPending(null);
    }
  }, [addFloatingXP, triggerLevelUp, showAchievementToast]);

  const undo = useCallback(async (habit: { id: string; title: string }) => {
    setPending(habit.id);
    try {
      const result = await habitService.undoHabitLog(habit.id);
      if (result.undone) {
        useToastStore.getState().info(COPY[getLocale()].undone(habit.title), result.xpRemoved > 0 ? COPY[getLocale()].xpRemoved(result.xpRemoved) : undefined);
        void refreshUser();
      }
      return result;
    } catch {
      useToastStore.getState().error(COPY[getLocale()].undoFail, COPY[getLocale()].tryAgain);
      return null;
    } finally {
      setPending(null);
    }
  }, []);

  return { complete, undo, pending, burst };
}
