import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Archive,
  Check,
  CircleSlash2,
  Coins,
  Edit3,
  Flag,
  FolderKanban,
  ListChecks,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getOpenOrigin } from '@/lib/origin';
import type { Quest } from '@lifequest/shared';
import { CategoryIcon, CATEGORY_LABELS } from './CategoryIcon';
import { DifficultyBadge } from './DifficultyBadge';
import { DeadlineBadge } from './DeadlineBadge';
import { FlowButton } from '../ui/flow-button';
import { toggleSubObjective } from '../../services/quest.service';

interface Props {
  quest: Quest | null;
  onClose: () => void;
  onComplete: (quest: Quest) => void;
  onEdit: (quest: Quest) => void;
  onArchive: (quest: Quest) => void;
  onFail: (quest: Quest) => void;
  onQuestUpdated: (quest: Quest) => void;
}

const TYPE_CONFIG: Record<string, { label: string; Icon: LucideIcon }> = {
  MAIN: { label: 'Proyecto', Icon: FolderKanban },
  SIDE: { label: 'Tarea', Icon: ListChecks },
  META: { label: 'Meta', Icon: Target },
  DAILY: { label: 'Diaria', Icon: Flag },
  WEEKLY: { label: 'Semanal', Icon: Flag },
};

const modalSpring = { type: 'spring', stiffness: 380, damping: 31, mass: 0.72 } as const;

export function QuestModal({ quest, onClose, onComplete, onEdit, onArchive, onFail, onQuestUpdated }: Props) {
  const [origin] = useState(() => getOpenOrigin());

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!quest) return null;

  const subObjectives = Array.isArray(quest.subObjectives)
    ? quest.subObjectives as Array<{ id: string; title: string; completed: boolean }>
    : [];
  const questId = quest.id;
  const isActive = quest.status === 'ACTIVE';
  const type = TYPE_CONFIG[quest.type] ?? TYPE_CONFIG.SIDE;
  const TypeIcon = type.Icon;

  async function handleToggleSub(subId: string, completed: boolean) {
    try {
      const updated = await toggleSubObjective(questId, subId, completed);
      onQuestUpdated(updated);
    } catch {
      // The next reload or update keeps the previous checkbox value intact.
    }
  }

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0 bg-black/65"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quest-detail-title"
        className="relative z-10 flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--border-strong)] bg-[var(--bg-panel)] shadow-2xl sm:max-h-[92vh] sm:rounded-2xl"
        initial={{ opacity: 0, y: 12, scale: 0.975 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 7, scale: 0.985 }}
        transition={modalSpring}
        style={{ transformOrigin: origin }}
      >
        <header className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-start gap-3">
            <CategoryIcon category={quest.category} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <h2 id="quest-detail-title" className="min-w-0 flex-1 text-base font-semibold leading-6 text-[var(--text-primary)]">
                  {quest.title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-panel-light)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] sm:h-8 sm:w-8"
                  aria-label="Cerrar"
                >
                  <X size={18} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                  <TypeIcon size={12} strokeWidth={1.8} aria-hidden="true" />
                  {type.label}
                </span>
                <DifficultyBadge difficulty={quest.difficulty} />
                <DeadlineBadge deadline={quest.deadline} />
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-3 py-2.5">
              <p className="text-sm font-medium text-[var(--text-secondary)]">Experiencia</p>
              <p className="mt-1 text-sm font-semibold text-[var(--accent-gold)]">+{quest.xpReward} XP</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-3 py-2.5">
              <p className="text-sm font-medium text-[var(--text-secondary)]">Oro</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-primary)]"><Coins size={13} strokeWidth={1.8} aria-hidden="true" />+{quest.goldReward}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-3 py-2.5">
              <p className="text-sm font-medium text-[var(--text-secondary)]">Categoría</p>
              <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{CATEGORY_LABELS[quest.category] ?? quest.category}</p>
            </div>
          </div>

          {quest.description && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">Descripción</p>
              <p className="text-sm leading-6 text-[var(--text-primary)]">{quest.description}</p>
            </div>
          )}

          {subObjectives.length > 0 && (
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--text-secondary)]">Objetivos</p>
                <span className="text-xs tabular-nums text-[var(--text-secondary)]">
                  {subObjectives.filter((objective) => objective.completed).length}/{subObjectives.length}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                {subObjectives.map((objective) => (
                  <label key={objective.id} className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--bg-panel-light)] ${!isActive ? 'cursor-default' : ''}`}>
                    <input
                      type="checkbox"
                      checked={objective.completed}
                      disabled={!isActive}
                      onChange={(event) => { void handleToggleSub(objective.id, event.target.checked); }}
                      className="h-4 w-4 shrink-0 accent-[var(--accent-gold)]"
                    />
                    <span className={`min-w-0 flex-1 text-sm ${objective.completed ? 'text-[var(--text-secondary)] line-through' : 'text-[var(--text-primary)]'}`}>
                      {objective.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-3 text-xs leading-5 text-[var(--text-secondary)]">
            <p>Creada el {new Date(quest.createdAt).toLocaleDateString('es-CO')}</p>
            {quest.deadline && <p>Fecha límite: {new Date(quest.deadline).toLocaleDateString('es-CO')}</p>}
            {quest.completedAt && <p>Completada el {new Date(quest.completedAt).toLocaleDateString('es-CO')}</p>}
          </div>
        </div>

        {isActive && (
          <footer className="border-t border-[var(--border)] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:py-4">
            <FlowButton
              tone="primary"
              size="md"
              fullWidth
              withArrows={false}
              onClick={() => { onComplete(quest); onClose(); }}
              className="gap-2"
            >
              <Check size={16} strokeWidth={2} aria-hidden="true" />
              Completar misión
            </FlowButton>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <FlowButton tone="ghost" size="sm" withArrows={false} onClick={() => { onEdit(quest); onClose(); }} className="gap-1 px-2">
                <Edit3 size={14} strokeWidth={1.8} aria-hidden="true" />
                Editar
              </FlowButton>
              <FlowButton tone="danger" size="sm" withArrows={false} onClick={() => { onFail(quest); onClose(); }} className="gap-1 px-2">
                <CircleSlash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                Fallar
              </FlowButton>
              <FlowButton tone="ghost" size="sm" withArrows={false} onClick={() => { onArchive(quest); onClose(); }} className="gap-1 px-2">
                <Archive size={14} strokeWidth={1.8} aria-hidden="true" />
                Archivar
              </FlowButton>
            </div>
          </footer>
        )}
      </motion.section>
    </motion.div>,
    document.body,
  );
}
