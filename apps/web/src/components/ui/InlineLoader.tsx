import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePageVisibility } from './LoadingGate';

export interface InlineLoaderProps {
  /** A concise, contextual status for inline actions and route cues. */
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * A small token-aware loading indicator for places where a terminal would be
 * visually disproportionate. Button-level Loader2 indicators remain intact.
 */
export function InlineLoader({
  label = 'Cargando…',
  className,
  size = 'sm',
}: InlineLoaderProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const isPageVisible = usePageVisibility();
  const animate = !reduceMotion && isPageVisible;
  const dotClassName = size === 'md' ? 'h-2 w-2' : 'h-1.5 w-1.5';
  const textClassName = size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <span
      className={cn('inline-flex min-w-0 items-center gap-2 text-[var(--text-secondary)]', textClassName, className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
    >
      <motion.span
        aria-hidden="true"
        className={cn('shrink-0 rounded-full bg-[var(--accent-gold)]', dotClassName)}
        animate={animate ? { opacity: [0.35, 1, 0.35], scale: [0.82, 1, 0.82] } : { opacity: 1, scale: 1 }}
        transition={animate ? { duration: 0.82, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

export default InlineLoader;
