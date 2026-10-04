import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import type { Quest } from '@lifequest/shared';
import { Button, Confetti, IconChip, ProgressBar, ResponsiveDialog } from '@/components/ui/lq';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useToastStore } from '@/hooks/useToast';
import * as questService from '@/services/quest.service';

export interface CompleteQuestDialogProps {
  quest: Quest | null;
  onClose: () => void;
  /** Se llama tras completar en el servidor (para refrescar la lista). */
  onCompleted: (quest: Quest) => void;
}

/** Quests.dc.html: confirmar → éxito con +XP (pop), barra de nivel y confeti. */
export function CompleteQuestDialog({ quest: current, onClose, onCompleted }: CompleteQuestDialogProps) {
  const last = useRef(current);
  if (current) last.current = current;
  const quest = current ?? last.current;
  const [phase, setPhase] = useState<'confirm' | 'success'>('confirm');
  const [saving, setSaving] = useState(false);
  const [earned, setEarned] = useState(0);
  const [burst, setBurst] = useState(0);
  const user = useAuthStore((s) => s.user);
  const { triggerLevelUp, showAchievementToast } = useUIStore();

  useEffect(() => { if (current) { setPhase('confirm'); setSaving(false); } }, [current?.id]);

  async function confirm() {
    if (!quest) return;
    setSaving(true);
    try {
      const result = await questService.completeQuest(quest.id);
      useAuthStore.getState().updateUser(result.user);
      setEarned(result.rewards.xpEarned);
      setPhase('success');
      setBurst((b) => b + 1);
      onCompleted(quest);
      if (result.rewards.leveledUp && result.rewards.newLevel) {
        triggerLevelUp({
          oldLevel: result.rewards.newLevel - 1, newLevel: result.rewards.newLevel, xpEarned: result.rewards.xpEarned,
          goldEarned: result.rewards.goldEarned, statIncreases: result.rewards.statIncreases ?? {},
        });
      }
      for (const a of result.achievementsUnlocked) showAchievementToast(a);
    } catch {
      useToastStore.getState().error('No se pudo completar la misión', 'Inténtalo de nuevo');
    } finally {
      setSaving(false);
    }
  }

  const success = phase === 'success';
  const continueRef = useRef<HTMLButtonElement>(null);
  // El botón Completar desaparece al pasar a éxito: el foco va a Continuar.
  useEffect(() => { if (success) continueRef.current?.focus(); }, [success]);
  const pct = user && user.xpToNextLevel > 0 ? (user.xp / user.xpToNextLevel) * 100 : 0;

  return (
    <>
      <ResponsiveDialog
        open={Boolean(current)}
        onClose={onClose}
        title={success ? '¡Misión completada!' : '¿Completar misión?'}
        hideClose={success}
      >
        {quest && !success && (
          <div className="flex flex-col gap-6">
            <p className="text-body-md text-on-surface">
              “{quest.title}” pasará a Completadas y recibirás <b className="text-primary-text">+{quest.xpReward} XP</b>
              {quest.goldReward ? <> y <b>{quest.goldReward} de oro</b></> : null}.
            </p>
            <div className="grid grid-cols-2 gap-3 md:flex md:justify-end">
              <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
              <Button size="md" data-autofocus loading={saving} onClick={() => void confirm()}>Completar</Button>
            </div>
          </div>
        )}
        {quest && success && (
          <div className="flex flex-col items-center gap-4 text-center" role="status">
            <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, 1.08, 1], opacity: 1 }} transition={{ duration: 0.45 }}>
              <IconChip icon={Trophy} tone="success" size="lg" className="rounded-full" />
            </motion.span>
            <motion.p
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.6, 1.08, 1], opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.18 }}
              className="text-display-md text-primary-text font-mono tabular-nums md:text-display-lg"
            >
              +{earned} XP
            </motion.p>
            {user && (
              <div className="flex w-full flex-col gap-1.5">
                <ProgressBar value={pct} size="lg" shine label="Experiencia" valueText={`${user.xp} de ${user.xpToNextLevel} XP`} />
                <span className="text-body-sm text-on-surface-light font-mono tabular-nums">
                  {user.xp.toLocaleString('es-CO')} / {user.xpToNextLevel.toLocaleString('es-CO')} XP · Nivel {user.level}
                </span>
              </div>
            )}
            <Button ref={continueRef} block onClick={onClose}>Continuar</Button>
          </div>
        )}
      </ResponsiveDialog>
      {burst > 0 && <Confetti burst={burst} />}
    </>
  );
}
