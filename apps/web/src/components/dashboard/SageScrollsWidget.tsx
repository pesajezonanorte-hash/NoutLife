import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, X, Sparkles } from 'lucide-react';
import * as scrollsService from '../../services/scrolls.service';
import type { SageScroll } from '../../services/scrolls.service';
import { E } from '@/components/ui/glyphs';

const CATEGORY_CONFIG = {
  praise:    { color: 'var(--accent-gold)',  icon: '⭐', bg: 'var(--accent-gold)' },
  warning:   { color: 'var(--accent-red)',   icon: '⚠️', bg: 'var(--accent-red)' },
  nudge:     { color: 'var(--accent-cyan)',  icon: '💡', bg: 'var(--accent-cyan)' },
  milestone: { color: 'var(--accent-green)', icon: '🏆', bg: 'var(--accent-green)' },
};

export function SageScrollsWidget() {
  const [scrolls, setScrolls] = useState<SageScroll[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [visible, setVisible] = useState<SageScroll | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await scrollsService.getUnreadScrolls();
      setScrolls(data);
      if (data.length > 0) setVisible(data[0]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const data = await scrollsService.generateScroll();
      setScrolls(data);
      if (data.length > 0) setVisible(data[0]);
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  }

  async function handleDismiss(scroll: SageScroll) {
    await scrollsService.markScrollRead(scroll.id).catch(() => null);
    setScrolls((prev) => prev.filter((s) => s.id !== scroll.id));
    const remaining = scrolls.filter((s) => s.id !== scroll.id);
    setVisible(remaining.length > 0 ? remaining[0] : null);
  }

  if (loading) return null;

  if (!visible && scrolls.length === 0) {
    return (
      <motion.button
        onClick={handleGenerate}
        disabled={generating}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-[var(--border)] text-xs text-[var(--text-muted)] hover:text-[var(--accent-gold)] hover:border-[var(--accent-gold)]/50 transition-all"
      >
        <Sparkles size={14} />
        {generating ? 'El Sabio está pensando...' : 'Pedir consejo del Sabio'}
      </motion.button>
    );
  }

  if (!visible) return null;

  const cfg = CATEGORY_CONFIG[visible.category] ?? CATEGORY_CONFIG.nudge;

  return (
    <AnimatePresence>
      <motion.div
        key={visible.id}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="rounded-2xl border p-4"
        style={{ borderColor: cfg.color + '55', background: cfg.bg + '0d' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ background: cfg.bg + '22' }}
          >
            <ScrollText size={14} style={{ color: cfg.color }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold" style={{ color: cfg.color }}>
                <E e={cfg.icon} /> El Sabio dice
              </span>
              {scrolls.length > 1 && (
                <span className="text-xs text-[var(--text-muted)]">+{scrolls.length - 1} más</span>
              )}
            </div>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">{visible.message}</p>
          </div>

          <button
            onClick={() => handleDismiss(visible)}
            className="flex-shrink-0 p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel-light)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
