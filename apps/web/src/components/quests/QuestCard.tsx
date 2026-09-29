import { memo, type KeyboardEvent, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Archive,
  Check,
  CheckCircle2,
  CircleSlash2,
  Coins,
  Flag,
  FolderKanban,
  ListTodo,
  Target,
  type LucideIcon,
} from 'lucide-react';
import type { Quest } from '@lifequest/shared';
import { CategoryIcon } from './CategoryIcon';
import { DifficultyBadge, DIFFICULTY_CONFIG } from './DifficultyBadge';
import { DeadlineBadge } from './DeadlineBadge';
import { audio } from '../../lib/audio';

interface Props {
  quest: Quest;
  onComplete: (quest: Quest, e: MouseEvent<HTMLButtonElement>) => void;
  onClick: (quest: Quest) => void;
}

const TYPE_CONFIG: Record<string, { label: string; Icon: LucideIcon }> = {
  MAIN: { label: 'Proyecto', Icon: FolderKanban },
  SIDE: { label: 'Tarea', Icon: ListTodo },
  META: { label: 'Meta', Icon: Target },
  DAILY: { label: 'Diaria', Icon: Flag },
  WEEKLY: { label: 'Semanal', Icon: Flag },
};

/**
 * A compact list row rather than a floating game card. Its state is conveyed
 * through restrained colour and metadata, so a single quest never dominates
 * the whole page.
 */
export const QuestCard = memo(function QuestCard({ quest, onComplete, onClick }: Props) {
  const subObjectives = Array.isArray(quest.subObjectives)
    ? quest.subObjectives as Array<{ id: string; title: string; completed: boolean }>
    : [];
  const completedSubs = subObjectives.filter((sub) => sub.completed).length;
  const progressPct = subObjectives.length > 0 ? (completedSubs / subObjectives.length) * 100 : null;

  const isCompleted = quest.status === 'COMPLETED';
  const isFailed = quest.status === 'FAILED';
  const isArchived = quest.status === 'ARCHIVED';
  const isInactive = isCompleted || isFailed || isArchived;
  const difficulty = DIFFICULTY_CONFIG[quest.difficulty] ?? { color: 'var(--border)' };
  const type = TYPE_CONFIG[quest.type] ?? TYPE_CONFIG.SIDE;
  const TypeIcon = type.Icon;

  function openQuest() {
    audio.play('blip');
    onClick(quest);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openQuest();
    }
  }

  return (
    <motion.article
      layout="position"
      transition={{ type: 'spring', stiffness: 360, damping: 34, mass: 0.7 }}
      onClick={openQuest}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={`group relative flex cursor-pointer items-start gap-3 px-4 py-3.5 text-left outline-none transition-colors duration-200 hover:bg-[var(--bg-panel-light)] focus-visible:bg-[var(--bg-panel-light)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-gold)] ${
        isInactive ? 'opacity-55' : ''
      }`}
      style={{ borderLeft: `2px solid ${isInactive ? 'transparent' : difficulty.color}` }}
    >
      <CategoryIcon category={quest.category} size="md" className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p
                className={`truncate text-sm font-semibold leading-5 ${
                  isInactive ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'
                }`}
              >
                {quest.title}
              </p>
              <span className="hidden shrink-0 items-center gap-1 text-xs text-[var(--text-secondary)] sm:inline-flex">
                <TypeIcon size={12} strokeWidth={1.8} aria-hidden="true" />
                {type.label}
              </span>
            </div>
            {quest.description && (
              <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-[var(--text-secondary)]">
                {quest.description}
              </p>
            )}
          </div>

          {!isInactive && (
            <motion.button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-deep)] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/10 hover:text-[var(--accent-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
              onClick={(event) => {
                event.stopPropagation();
                audio.play('questComplete');
                onComplete(quest, event);
              }}
              whileTap={{ scale: 0.94 }}
              aria-label={`Completar ${quest.title}`}
              title="Completar misión"
            >
              <Check size={16} strokeWidth={2} aria-hidden="true" />
            </motion.button>
          )}
          {isCompleted && <CheckCircle2 className="mt-1 shrink-0 text-[var(--accent-green)]" size={20} aria-label="Completada" />}
          {isFailed && <CircleSlash2 className="mt-1 shrink-0 text-[var(--accent-red)]" size={20} aria-label="Fallida" />}
          {isArchived && <Archive className="mt-1 shrink-0 text-[var(--text-secondary)]" size={19} aria-label="Archivada" />}
        </div>

        {progressPct !== null && !isInactive && (
          <div className="mt-2.5 max-w-xl">
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Progreso</span>
              <span className="tabular-nums">{completedSubs}/{subObjectives.length}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[var(--bg-deep)]">
              <motion.div
                className="h-full rounded-full bg-[var(--accent-gold)]"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 22, delay: 0.08 }}
              />
            </div>
          </div>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] sm:hidden">
            <TypeIcon size={12} strokeWidth={1.8} aria-hidden="true" />
            {type.label}
          </span>
          <DifficultyBadge difficulty={quest.difficulty} />
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-gold)]">
            <span>+{quest.xpReward} XP</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
            <Coins size={12} strokeWidth={1.8} aria-hidden="true" />
            {quest.goldReward}
          </span>
          <DeadlineBadge deadline={quest.deadline} />
        </div>
      </div>
    </motion.article>
  );
});
