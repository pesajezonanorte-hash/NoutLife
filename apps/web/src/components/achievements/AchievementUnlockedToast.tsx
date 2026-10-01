import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../store/uiStore';
import { E } from '@/components/ui/glyphs';

export function AchievementUnlockedToast() {
  const { achievementToasts, removeAchievementToast } = useUIStore();

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none">
      <AnimatePresence>
        {achievementToasts.map((toast) => (
          <motion.div
            key={toast.id}
            className="pointer-events-auto bg-bg-panel border-2 border-accent-gold w-72 overflow-hidden cursor-pointer"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={() => removeAchievementToast(toast.id)}
            style={{ boxShadow: '0 0 20px color-mix(in oklab, var(--accent-gold) 30%, transparent)' }}
          >
            {/* Gold header bar */}
            <div className="bg-accent-gold px-3 py-1">
              <p className="font-pixel text-bg-deep" style={{ fontSize: '12px' }}>
                <E e="🏆" /> ¡LOGRO DESBLOQUEADO!
              </p>
            </div>

            <div className="p-3 flex items-center gap-3">
              <motion.div
                className="text-3xl flex-shrink-0"
                animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6 }}
              >
                <E e={toast.icon} />
              </motion.div>
              <div>
                <p className="font-vt text-text-primary text-base">{toast.title}</p>
                <p className="font-vt text-text-secondary text-sm">{toast.description}</p>
                {toast.xpReward > 0 && (
                  <p className="font-pixel text-accent-gold mt-0.5" style={{ fontSize: '12px' }}>
                    +{toast.xpReward} XP
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar (auto-dismiss) */}
            <motion.div
              className="h-1 bg-accent-gold"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 5, ease: 'linear' }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
