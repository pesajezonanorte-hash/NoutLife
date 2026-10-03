import { useId, useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { SegmentOption } from './SegmentedControl';

export interface TabsProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/** Pestañas con indicador inferior que se desliza (layoutId, 200 ms). */
export function Tabs<T extends string>({ options, value, onChange, label, className }: TabsProps<T>) {
  const barId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-6 border-b border-border', className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative -mb-px min-h-11 px-0.5 text-label-lg transition-colors',
              on ? 'text-primary-text' : 'text-on-surface-light hover:text-on-surface',
            )}
          >
            {o.label}
            {on && (
              <motion.span
                layoutId={barId}
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
                transition={{ duration: 0.2 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
