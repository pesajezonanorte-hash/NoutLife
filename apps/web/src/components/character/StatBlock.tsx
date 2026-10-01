import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { E } from '@/components/ui/glyphs';

interface Props {
  icon: string;
  label: string;
  value: number;
  max?: number;
  color: string;
  barColor?: string;
  tooltip: string;
}

export function StatBlock({ icon, label, value, max, color, barColor, tooltip }: Props) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="relative">
      <div
        className="flex items-center gap-3 cursor-help group"
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <span className="text-xl w-6 text-center"><E e={icon} /></span>
        <div className="flex-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className={`font-pixel ${color}`} style={{ fontSize: '12px' }}>{label}</span>
            <span className="font-vt text-text-primary text-lg">
              {max !== undefined ? `${value}/${max}` : value}
            </span>
          </div>
          {max !== undefined && (
            <div className="stat-bar">
              <motion.div
                className={`stat-bar-fill ${barColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${(value / max) * 100}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showTip && (
          <motion.div
            className="absolute left-8 top-full mt-1 z-20 bg-bg-deep border-2 border-accent-gold p-2 max-w-48 pointer-events-none"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <p className="font-vt text-text-secondary text-base">{tooltip}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
