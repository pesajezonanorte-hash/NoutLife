import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Habit, HeatmapEntry } from '../../services/habit.service';
import { StreakFlame } from './StreakFlame';
import { HabitHeatmap } from './HabitHeatmap';
import { HabitCompleteButton } from './HabitCompleteButton';
import { fetchHabitHeatmap } from '../../services/habit.service';
import { E } from '@/components/ui/glyphs';

interface Props {
  habit: Habit;
  onLog: (habitId: string, status: 'completed' | 'failed' | 'skipped') => Promise<void>;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

export const HabitRow = memo(function HabitRow({ habit, onLog, onEdit, onDelete }: Props) {
  const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (expanded && heatmap.length === 0) {
      fetchHabitHeatmap(habit.id, 30).then(setHeatmap).catch(() => {});
    }
  }, [expanded, habit.id, heatmap.length]);

  async function handleLog(status: 'completed' | 'failed' | 'skipped') {
    setLogging(true);
    try {
      await onLog(habit.id, status);
    } finally {
      setLogging(false);
    }
  }

  return (
    <motion.div
      layout
      className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl overflow-hidden"
      style={{ borderLeftColor: habit.color, borderLeftWidth: '3px' }}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 p-3">
        {/* Icon */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-2xl transition-transform hover:scale-110"
          title="Ver detalles"
        >
          <E e={habit.icon} />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded((e) => !e)}>
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{habit.title}</p>
          {habit.description && (
            <p className="text-xs text-[var(--text-secondary)] truncate">{habit.description}</p>
          )}
        </div>

        {/* Streak */}
        <div className="flex-shrink-0">
          <StreakFlame streak={habit.currentStreak} size="sm" />
        </div>

        {/* Complete button */}
        <div className="flex-shrink-0">
          <HabitCompleteButton
            status={habit.todayStatus as 'completed' | 'failed' | 'skipped' | null}
            onLog={handleLog}
            disabled={logging}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={() => onEdit(habit)}
            className="flex h-11 w-11 items-center justify-center text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-gold)]"
          >
            <E e="✏" />
          </button>
          <button
            onClick={() => onDelete(habit)}
            className="flex h-11 w-11 items-center justify-center text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-red)]"
          >
            <E e="🗑" />
          </button>
        </div>
      </div>

      {/* Expanded heatmap */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-[var(--border)] p-3 bg-[var(--bg-panel-light)]"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                Últimos 30 días
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="text-xs text-[var(--text-secondary)]">
                  Mejor racha: <span className="text-[var(--accent-gold)]">{habit.longestStreak}d</span>
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  +{habit.xpReward}XP / día
                </span>
              </div>
            </div>
            <HabitHeatmap entries={heatmap} days={30} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});
