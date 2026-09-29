import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../../lib/api';
import { E } from '@/components/ui/glyphs';

interface ProactiveNote {
  id: string;
  message: string;
  tone: string;
  icon: string;
  isRead: boolean;
  createdAt: string;
  isNew: boolean;
}

const TONE_STYLES: Record<string, { border: string; bg: string; badge: string }> = {
  positive:    { border: 'var(--accent-green)', bg: 'color-mix(in oklab, var(--accent-green) 8%, transparent)', badge: 'var(--accent-green)' },
  warning:     { border: 'var(--accent-gold)',  bg: 'color-mix(in oklab, var(--accent-gold) 8%, transparent)',  badge: 'var(--accent-gold)' },
  motivational:{ border: 'var(--accent-cyan)',  bg: 'color-mix(in oklab, var(--accent-cyan) 8%, transparent)',  badge: 'var(--accent-cyan)' },
  neutral:     { border: 'var(--border)',       bg: 'transparent',           badge: 'var(--text-muted)' },
};

export function SageProactiveCard() {
  const [note, setNote] = useState<ProactiveNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get<ProactiveNote>('/sage/proactive-note')
      .then(r => setNote(r.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  function handleDismiss() {
    if (!note) return;
    setDismissed(true);
    api.post(`/sage/proactive-note/${note.id}/read`).catch(() => {});
  }

  if (loading || dismissed || !note) return null;

  const style = TONE_STYLES[note.tone] ?? TONE_STYLES.neutral;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl relative overflow-hidden"
      style={{
        border: `1px solid ${style.border}55`,
        background: style.bg,
        padding: '14px 16px',
      }}
    >
      {note.isNew && (
        <span
          className="absolute top-3 right-3 text-xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
          style={{ background: style.badge, color: 'var(--text-inv)' }}
        >
          Nuevo
        </span>
      )}
      <div className="flex items-start gap-3 pr-10">
        <span className="text-2xl flex-shrink-0 mt-0.5"><E e={note.icon} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: style.badge }}>
            El Sabio dice
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {note.message}
          </p>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="mt-3 text-xs font-medium"
        style={{ color: 'var(--text-muted)' }}
      >
        <E e="✓" /> Entendido
      </button>
    </motion.div>
  );
}
