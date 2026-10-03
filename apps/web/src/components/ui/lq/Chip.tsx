import { useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Contador opcional a la derecha del texto. */
  count?: number;
}

export interface ChipGroupProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre accesible del grupo de filtros. */
  label: string;
  className?: string;
}

/** Chip de filtro: píldora 44 px, tinte primary al seleccionar. Úsalo dentro de ChipGroup. */
export function chipClasses(selected: boolean) {
  return cn(
    'inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-label-lg transition-[background-color,border-color,color,transform] duration-200 active:scale-[.97] motion-reduce:active:transform-none',
    selected
      ? 'border-primary/40 bg-primary/[var(--lq-soft-alpha)] text-primary-text'
      : 'border-border bg-background text-on-surface hover:border-primary/40 hover:text-on-background',
  );
}

/** Filtros en píldora (listbox horizontal): flechas mueven la selección, Inicio/Fin saltan. */
export function ChipGroup<T extends string>({ options, value, onChange, label, className }: ChipGroupProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = Math.max(0, options.findIndex((o) => o.value === value));

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = options.length - 1;
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % options.length
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + options.length) % options.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="listbox" aria-label={label} aria-orientation="horizontal" className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="option"
            aria-selected={on}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={chipClasses(on)}
          >
            {Icon && <Icon aria-hidden className="size-4" strokeWidth={1.75} />}
            {o.label}
            {o.count !== undefined && <span className="font-mono text-label-md tabular-nums opacity-80">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
