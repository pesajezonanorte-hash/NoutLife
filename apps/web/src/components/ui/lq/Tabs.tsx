import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { useIndicator } from '@/hooks/useIndicator';
import type { SegmentOption } from './SegmentedControl';

export interface TabsProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

/** Pestañas con indicador inferior que se desliza (solo transform, ver useIndicator). */
export function Tabs<T extends string>({ options, value, onChange, label, className }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const { ref, box } = useIndicator<HTMLDivElement>(options.findIndex((o) => o.value === value));

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div ref={ref} role="tablist" aria-label={label} className={cn('relative flex gap-6 border-b border-border', className)}>
      {box && (
        <span
          aria-hidden
          className="lq-indicator pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-primary"
          style={{ width: box.w, transform: `translate3d(${box.x}px, 0, 0)` }}
        />
      )}
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            data-indicator
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
          </button>
        );
      })}
    </div>
  );
}
