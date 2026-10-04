import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { E } from '@/components/ui/glyphs';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  icon?: React.ReactNode;
}

const shakeKeyframes = {
  x: [0, -8, 8, -5, 5, -2, 2, 0],
  transition: { duration: 0.45, ease: 'easeInOut' },
};

export const PixelInput = forwardRef<HTMLInputElement, Props>(
  ({ label, error, success, icon, className = '', onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false);

    const borderStyle = error
      ? 'border-[var(--accent-red)]'
      : success
        ? 'border-[var(--accent-green)]'
        : focused
          ? 'border-[var(--accent-blue)]'
          : 'border-[var(--border)]';

    const glowColor = error
      ? 'rgba(200,70,63,0.28)'
      : success
        ? 'rgba(58,155,103,0.28)'
        : focused
          ? 'rgba(107,138,120,0.28)'
          : 'transparent';

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <motion.div
          className="relative"
          animate={error ? shakeKeyframes : {}}
          key={error}
        >
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none z-10">
              {icon}
            </span>
          )}
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-md"
            animate={{ boxShadow: focused || error || success ? `0 0 0 3px ${glowColor}` : '0 0 0 0px transparent' }}
            transition={{ duration: 0.2 }}
          />
          <input
            ref={ref}
              className={[
              'pixel-input relative z-10 transition-all duration-200 bg-[var(--bg-panel)]',
              `border ${borderStyle}`,
              icon ? 'pl-10' : '',
              className,
            ].join(' ')}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            {...props}
          />
          {/* Success check */}
          {success && !error && (
            <motion.span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--accent-green)] z-10"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <E e="✓" />
            </motion.span>
          )}
        </motion.div>
        <AnimatePresence>
          {error && (
            <motion.p
              className="text-sm text-[var(--accent-red)] flex items-center gap-1"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: 'spring', stiffness: 280, damping: 20 }}
            >
              <span><E e="✕" /></span> {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

PixelInput.displayName = 'PixelInput';
