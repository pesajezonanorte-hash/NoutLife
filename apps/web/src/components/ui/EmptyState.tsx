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
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: reduceMotion ? 0 : 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`relative mx-auto flex min-h-56 w-full max-w-xl flex-col items-center justify-center overflow-hidden rounded-3xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-panel)_80%,transparent)] p-8 text-center shadow-[var(--shadow-sm)] backdrop-blur-md ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[color-mix(in_srgb,var(--accent-gold)_8%,transparent)] to-transparent"
      />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--accent-gold)_25%,var(--border))] bg-gradient-to-b from-[color-mix(in_srgb,var(--accent-gold)_16%,transparent)] to-[color-mix(in_srgb,var(--accent-gold)_4%,transparent)] text-[var(--accent-gold)] shadow-[0_8px_28px_-10px_color-mix(in_srgb,var(--accent-gold)_55%,transparent)]">
        <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h2 className="relative mt-5 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
        {title}
      </h2>
      <p className="relative mt-1.5 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
        {description}
      </p>
      <FlowButton
        tone="primary"
        size="lg"
        withArrows={false}
        onClick={onAction}
        className="relative mt-5 min-h-11"
      >
        {actionLabel}
      </FlowButton>
    </motion.section>
  );
}
