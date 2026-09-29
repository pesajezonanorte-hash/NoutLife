import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared, responsive page heading for zone screens. It deliberately leaves
 * visual tokens to the surrounding theme so it can be used in light/dark mode.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  actions,
  className = '',
}: PageHeaderProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.header
      initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0.01 } : { duration: 0.2, ease: 'easeOut' }}
      className={`flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {eyebrow}
          </div>
        )}
        <div className="flex min-w-0 items-center gap-2">
          {icon && <span className="flex shrink-0 text-[var(--accent-gold)]">{icon}</span>}
          <h1 className="min-w-0 text-xl font-extrabold tracking-[-0.025em] text-[var(--text-primary)] sm:text-2xl">
            {title}
          </h1>
        </div>
        {description && (
          <div className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">
            {description}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}
