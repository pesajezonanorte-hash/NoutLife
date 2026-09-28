import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';

interface Props {
  message: string;
  label?: string;
  className?: string;
}

export function SageContextButton({ message, label = 'Pregúntale al Sabio', className = '' }: Props) {
  const openSage = useUIStore((s) => s.openSage);

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={() => openSage(message)}
      className={`flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)] hover:text-[var(--text-primary)] ${className}`}
      title={message}
    >
      <Sparkles size={13} className="text-[var(--accent-gold)]" />
      {label}
    </motion.button>
  );
}
