import { motion } from 'framer-motion';
import type { Achievement } from '../../services/achievement.service';
import { E } from '@/components/ui/glyphs';

interface Props {
  achievement: Achievement;
  onClick: (a: Achievement) => void;
}

export function AchievementCard({ achievement, onClick }: Props) {
  const { unlocked, progress, target } = achievement;
  const pct = progress != null && target ? Math.min((progress / target) * 100, 100) : null;

  return (
    <motion.button
      onClick={() => onClick(achievement)}
      className={`p-3 border-2 text-left w-full transition-all ${
        unlocked
          ? 'border-accent-gold bg-accent-gold/5 hover:bg-accent-gold/10'
          : 'border-border-pixel bg-bg-panel opacity-60 hover:opacity-80'
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Badge icon */}
      <div className="flex items-start gap-2">
        <motion.div
          className={`text-2xl flex-shrink-0 ${unlocked ? '' : 'grayscale opacity-40'}`}
          animate={unlocked ? { filter: ['brightness(1)', 'brightness(1.4)', 'brightness(1)'] } : {}}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <E e={achievement.icon} />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className={`font-pixel text-left leading-tight ${unlocked ? 'text-accent-gold' : 'text-text-secondary'}`} style={{ fontSize: '12px' }}>
            {achievement.title}
          </p>
          <p className="font-vt text-text-secondary text-sm mt-0.5 leading-tight">
            {achievement.description}
          </p>
          {unlocked && achievement.xpReward > 0 && (
            <p className="font-pixel text-accent-gold mt-1" style={{ fontSize: '12px' }}>
              +{achievement.xpReward} XP
            </p>
          )}
          {unlocked && achievement.unlockedAt && (
            <p className="font-vt text-text-secondary text-xs mt-0.5">
              {new Date(achievement.unlockedAt).toLocaleDateString('es-CO')}
            </p>
          )}
        </div>
        {unlocked && (
          <div className="flex-shrink-0 text-accent-green"><E e="✓" /></div>
        )}
      </div>

      {/* Progress bar (if not unlocked and has progress) */}
      {!unlocked && pct !== null && target && (
        <div className="mt-2">
          <div className="flex justify-between font-pixel mb-0.5" style={{ fontSize: '12px' }}>
            <span className="text-text-secondary">PROGRESO</span>
            <span className="text-text-secondary">{progress}/{target}</span>
          </div>
          <div className="h-1 bg-bg-deep border border-border-pixel">
            <motion.div
              className="h-full bg-accent-gold/50"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
        </div>
      )}
    </motion.button>
  );
}
