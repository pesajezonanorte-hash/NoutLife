// Completar un hábito con todas las recompensas reales del backend:
// XP flotante, subida de nivel, logros, toast "+XP" y confeti.
import { useCallback, useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useToastStore } from '@/hooks/useToast';
import { refreshUser } from '@/hooks/useAuth';
import * as habitService from '@/services/habit.service';

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
        useToastStore.getState().info(`${habit.title}: omitido hoy`);
      }
      if (r?.leveledUp && r.newLevel) {
        triggerLevelUp({ oldLevel: Math.max(1, r.newLevel - 1), newLevel: r.newLevel, xpEarned: r.xpEarned, goldEarned: r.goldEarned, statIncreases: {} });
      }
      for (const a of result.achievementsUnlocked ?? []) showAchievementToast(a);
      if (result.recoveryCompleted) {
        useToastStore.getState().success('¡Racha recuperada!', `+${result.recoveryCompleted.bonusXp} XP de bonus`);
      }
      void refreshUser();
      return result;
    } catch {
      useToastStore.getState().error('No se pudo registrar el hábito', 'Inténtalo de nuevo');
      return null;
    } finally {
      setPending(null);
    }
  }, [addFloatingXP, triggerLevelUp, showAchievementToast]);

  const undo = useCallback(async (habit: { id: string; title: string }) => {
    setPending(habit.id);
    try {
      const result = await habitService.undoHabitLog(habit.id);
      if (result.undone) useToastStore.getState().info(`${habit.title}: desmarcado hoy`, 'La racha queda protegida; no volverás a cobrar XP por este registro.');
      return result;
    } catch {
      useToastStore.getState().error('No se pudo desmarcar el hábito', 'Inténtalo de nuevo');
      return null;
    } finally {
      setPending(null);
    }
  }, []);

  return { complete, undo, pending, burst };
}
