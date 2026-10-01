import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../store/uiStore';

export function FloatingXPLayer() {
  const { floatingXPs } = useUIStore();

  return (
    <AnimatePresence>
      {floatingXPs.map(({ id, amount, x, y }) => (
        <motion.div
          key={id}
          className="fixed z-[90] pointer-events-none font-pixel text-accent-gold select-none"
          style={{ left: x, top: y, fontSize: '12px', textShadow: '1px 1px 0 rgba(0,0,0,0.35)' }}
          initial={{ opacity: 1, y: 0, x: '-50%' }}
          animate={{ opacity: 0, y: -60, x: '-50%' }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          +{amount} XP
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
