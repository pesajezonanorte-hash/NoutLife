import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { indicatorStyle, useIndicator } from '@/hooks/useIndicator';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre accesible del grupo. */
  label: string;
  /** tablist (filtros, por defecto) · radiogroup (ajustes como el tema). */
  role?: 'tablist' | 'radiogroup';
  className?: string;
}

/**
 * Control segmentado con píldora deslizante (solo transform, ver useIndicator). Flechas
 * izquierda/derecha mueven la selección (roving tabindex).
 */
export function SegmentedControl<T extends string>({
  options, value, onChange, label, role = 'tablist', className,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const itemRole = role === 'tablist' ? 'tab' : 'radio';
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
    <div ref={ref} role={role} aria-label={label} className={cn('relative flex gap-1 rounded-[0.875rem] bg-surface-variant p-1', className)}>
      {box && <span aria-hidden className="lq-indicator pointer-events-none absolute left-0 top-0 rounded-[0.625rem] bg-background shadow-sm" style={indicatorStyle(box)} />}
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            data-indicator
            type="button"
            role={itemRole}
            aria-selected={itemRole === 'tab' ? on : undefined}
            aria-checked={itemRole === 'radio' ? on : undefined}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'relative min-h-11 flex-1 whitespace-nowrap rounded-[0.625rem] px-2 text-label-lg transition-colors duration-200',
              on ? 'text-on-background' : 'text-on-surface hover:text-on-background',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
