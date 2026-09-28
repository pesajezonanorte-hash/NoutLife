import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { E } from '@/components/ui/glyphs';

interface Props {
  status: 'completed' | 'failed' | 'skipped' | null;
  onLog: (status: 'completed' | 'failed' | 'skipped') => Promise<void>;
  disabled?: boolean;
}

export function HabitCompleteButton({ status, onLog, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  async function handleComplete() {
    if (status === 'completed' || disabled) return;
    setLoading(true);
    try {
      await onLog('completed');
    } finally {
      setLoading(false);
    }
  }

  function getButtonStyle() {
    if (status === 'completed') return { bg: 'var(--accent-green)', label: '✓', pulse: false };
    if (status === 'failed') return { bg: 'var(--accent-red)', label: '✗', pulse: false };
    if (status === 'skipped') return { bg: 'color-mix(in oklab, var(--accent-gold) 28%, transparent)', label: '~', pulse: false };
    return { bg: 'var(--bg-muted)', label: '?', pulse: true };
  }

  const btn = getButtonStyle();

  return (
    <div className="relative">
      <motion.button
        className="w-12 h-12 rounded-full border-2 border-border-pixel flex items-center justify-center font-vt text-2xl"
        style={{ backgroundColor: btn.bg }}
        animate={btn.pulse ? { scale: [1, 1.08, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
        onClick={handleComplete}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
        disabled={loading || disabled}
        whileTap={{ scale: 0.9 }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={status ?? 'empty'}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {loading ? '⏳' : btn.label}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* Context menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-[190]" onClick={() => setShowMenu(false)} />
            <motion.div
              className="absolute right-0 bottom-full z-[200] mb-2 min-w-36 border-2 border-border-pixel bg-bg-panel py-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
            >
              {(['completed', 'failed', 'skipped'] as const).map((s) => (
                <button
                  key={s}
                  className="block min-h-11 w-full px-3 py-1.5 text-left font-vt text-base transition-colors hover:bg-bg-panel-light"
                  onClick={async () => {
                    setShowMenu(false);
                    setLoading(true);
                    try { await onLog(s); } finally { setLoading(false); }
                  }}
                >
                  {s === 'completed' ? ' Completado' : s === 'failed' ? ' Fallé' : '~ No aplica'}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
