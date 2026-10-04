import { useId, type ReactNode } from "react";
import { motion, useReducedMotionConfig } from "framer-motion";

export interface SegmentedItem<K extends string> {
  key: K;
  label: ReactNode;
}

interface SegmentedControlProps<K extends string> {
  items: readonly SegmentedItem<K>[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
  /** Stretch segments to fill the row (tabs) or size them to content (filters). */
  fill?: boolean;
  className?: string;
}

/** iOS-style segmented control with a floating, blurred active indicator. */
export function SegmentedControl<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  fill = true,
  className = "",
}: SegmentedControlProps<K>) {
  const reduceMotion = useReducedMotionConfig();
  const indicatorId = useId();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`${fill ? "flex w-full" : "inline-flex"} gap-1 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-muted)_70%,transparent)] p-1 backdrop-blur-md ${className}`}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={`relative min-h-11 min-w-0 shrink-0 rounded-xl px-4 text-sm font-medium transition-[color,transform] duration-300 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${fill ? "flex-1" : ""} ${
              active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {active && (
              <motion.span
                layoutId={indicatorId}
                aria-hidden="true"
                className="absolute inset-0 rounded-xl border border-[color-mix(in_srgb,var(--border-strong)_60%,transparent)] bg-[color-mix(in_srgb,var(--bg-card)_85%,transparent)] shadow-[0_1px_2px_rgba(0,0,0,0.12),0_4px_14px_-6px_color-mix(in_srgb,var(--accent-gold)_35%,transparent)] backdrop-blur-md"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10 block truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
