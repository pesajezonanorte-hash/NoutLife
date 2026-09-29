import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { FlowButton } from "./flow-button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  className?: string;
}

/** A compact, intentional first-use state for primary product spaces. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}: EmptyStateProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.32,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`mx-auto flex min-h-56 w-full max-w-xl flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-panel-light)] px-6 py-8 text-center shadow-[var(--shadow-sm)] ${className}`}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] text-[var(--accent-gold)]">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
        {description}
      </p>
      <FlowButton
        tone="primary"
        size="lg"
        withArrows={false}
        onClick={onAction}
        className="mt-5 min-h-11"
      >
        {actionLabel}
      </FlowButton>
    </motion.section>
  );
}
