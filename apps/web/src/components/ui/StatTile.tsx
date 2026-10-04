import { motion, useReducedMotionConfig } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  /** Position in a row, used to stagger the entrance. */
  index?: number;
}

/** Compact metric card with a hairline border and an ambient glow on hover. */
export function StatTile({ icon: Icon, label, value, index = 0 }: StatTileProps) {
  const reduceMotion = useReducedMotionConfig();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group relative min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-panel)_80%,transparent)] p-5 backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent-gold)_35%,var(--border))] hover:shadow-[0_10px_32px_-14px_color-mix(in_srgb,var(--accent-gold)_45%,transparent)] [.reduce-motion_&]:transition-none [.reduce-motion_&]:hover:translate-y-0"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--accent-gold)_45%,transparent)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-gold)_12%,transparent)] text-[var(--accent-gold)]">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="mt-4 truncate text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-[var(--text-primary)]">{value}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-[var(--text-secondary)]">{label}</p>
    </motion.div>
  );
}
