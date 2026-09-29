import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore } from '../../hooks/useToast';
import { E } from '@/components/ui/glyphs';

const ICONS: Record<string, string> = {
  success: '✅',
  error:   '❌',
  info:    '💬',
  warning: '⚠️',
  achievement: '🏆',
};

const COLORS: Record<string, string> = {
  success: 'border-accent-green bg-bg-panel',
  error:   'border-accent-red bg-bg-panel',
  info:    'border-accent-cyan bg-bg-panel',
  warning: 'border-accent-gold bg-bg-panel',
  achievement: 'border-accent-gold bg-bg-panel',
};

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none max-w-xs w-full">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`pointer-events-auto border-2 shadow-pixel p-3 flex items-start gap-3 cursor-pointer ${COLORS[toast.type] ?? COLORS.info}`}
            onClick={() => remove(toast.id)}
          >
            <span className="text-lg flex-shrink-0"><E e={ICONS[toast.type]} /></span>
            <div className="flex-1 min-w-0">
              <p className="font-pixel text-text-primary" style={{ fontSize: '12px' }}>{toast.message}</p>
              {toast.subtitle && (
                <p className="font-vt text-text-secondary text-sm mt-0.5">{toast.subtitle}</p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
