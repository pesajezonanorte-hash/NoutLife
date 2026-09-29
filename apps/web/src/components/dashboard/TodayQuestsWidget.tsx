import { useState, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  Check,
  Coins,
  ListTodo,
  Loader2,
  Repeat2,
  Swords,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { completeQuest } from '../../services/quest.service';
import type { Quest } from '@lifequest/shared';

const TYPE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  MAIN: { label: 'Principal', Icon: Trophy },
  SIDE: { label: 'Secundaria', Icon: Swords },
  META: { label: 'Meta', Icon: Target },
  DAILY: { label: 'Diaria', Icon: Repeat2 },
  WEEKLY: { label: 'Semanal', Icon: CalendarDays },
};

const DIFFICULTY_TONE: Record<string, string> = {
  EASY: 'var(--accent-green)',
  NORMAL: 'var(--accent-cyan)',
  HARD: 'var(--accent-gold)',
  EPIC: 'var(--accent-pink)',
};

interface Props {
  quests: Quest[];
  onQuestCompleted?: (questId: string) => void;
}

export function TodayQuestsWidget({ quests, onQuestCompleted }: Props) {
  const { updateUser } = useAuthStore();
  const { triggerLevelUp, addFloatingXP, flashScreen } = useUIStore();
  const [completing, setCompleting] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const handleComplete = async (quest: Quest, event: MouseEvent<HTMLButtonElement>) => {
    if (completing || completedIds.has(quest.id)) return;
    setCompleting(quest.id);
    const rect = event.currentTarget.getBoundingClientRect();

    try {
      const result = await completeQuest(quest.id);
      updateUser(result.user);
      setCompletedIds((previous) => new Set([...previous, quest.id]));
      flashScreen('#a8871e');
      addFloatingXP(result.rewards.xpEarned, rect.x + rect.width / 2, rect.y);

      if (result.rewards.leveledUp && result.rewards.newLevel) {
        setTimeout(() => {
          triggerLevelUp({
            oldLevel: result.rewards.newLevel! - 1,
            newLevel: result.rewards.newLevel!,
            xpEarned: result.rewards.xpEarned,
            goldEarned: result.rewards.goldEarned,
            statIncreases: result.rewards.statIncreases ?? {},
          });
        }, 600);
      }
      onQuestCompleted?.(quest.id);
    } finally {
      setCompleting(null);
    }
  };

  if (quests.length === 0) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] p-6 text-center shadow-[0_14px_36px_rgba(0,0,0,0.08)]">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-panel)] text-[var(--accent-gold)]"><ListTodo size={20} /></span>
        <h2 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">Misiones al día</h2>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-[var(--text-secondary)]">No tienes misiones pendientes. Cuando definas una nueva, aparecerá aquí sin mezclarse con tus hábitos.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] shadow-[0_14px_36px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--accent-gold)_10%,var(--bg-panel))] text-[var(--accent-gold)]"><Swords size={17} /></span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Misiones pendientes</h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">Pendientes con propósito, plazo y recompensa.</p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--bg-panel)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">{quests.length}</span>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        <AnimatePresence initial={false}>
          {quests.map((quest, index) => {
            const done = completedIds.has(quest.id);
            const meta = TYPE_META[quest.type] ?? { label: 'Misión', Icon: Target };
            const Icon = meta.Icon;
            const difficultyTone = DIFFICULTY_TONE[quest.difficulty] ?? 'var(--text-secondary)';

            return (
              <motion.article
                key={quest.id}
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: done ? 0.58 : 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index, 6) * 0.04 }}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${done ? 'border-[color-mix(in_oklab,var(--accent-green)_45%,var(--border))] bg-[color-mix(in_oklab,var(--accent-green)_7%,var(--bg-panel))]' : 'border-[var(--border)] bg-[var(--bg-panel)] hover:border-[var(--text-muted)]'}`}
              >
                <button
                  type="button"
                  onClick={(event) => void handleComplete(quest, event)}
                  disabled={done || completing === quest.id}
                  aria-label={done ? `Misión completada: ${quest.title}` : `Completar misión: ${quest.title}`}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] disabled:cursor-default ${done ? 'border-[var(--accent-green)] bg-[var(--accent-green)] text-white' : 'border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent-green)] hover:text-[var(--accent-green)]'}`}
                >
                  {done ? <Check size={16} /> : completing === quest.id ? <Loader2 size={15} className="animate-spin text-[var(--accent-gold)]" /> : null}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon size={14} style={{ color: difficultyTone }} aria-hidden="true" />
                    <p className={`truncate text-sm font-medium ${done ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>{quest.title}</p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span style={{ color: difficultyTone }}>{meta.label} · {quest.difficulty}</span>
                    <span className="font-medium text-[var(--accent-gold)]">+{quest.xpReward} XP</span>
                    <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]"><Coins size={12} />+{quest.goldReward}</span>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
}
