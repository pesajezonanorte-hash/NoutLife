import { heavy } from '@/lib/motion';
import { useId, useRef, type KeyboardEvent } from 'react';
import { motion, PresenceContext } from 'framer-motion';
import { cn } from '@/lib/utils';

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
 * Control segmentado con píldora deslizante (layoutId, spring). Flechas
 * izquierda/derecha mueven la selección (roving tabindex).
 */
export function SegmentedControl<T extends string>({
  options, value, onChange, label, role = 'tablist', className,
}: SegmentedControlProps<T>) {
  const pillId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const itemRole = role === 'tablist' ? 'tab' : 'radio';

  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  // El indicador usa layoutId: al cambiar de opción el anterior se desmonta y,
  // dentro de un diálogo, quedaba registrado como salida pendiente de su
  // AnimatePresence y el diálogo no terminaba de cerrarse. Se aísla aquí.
  return (
    <PresenceContext.Provider value={null}>
    <div role={role} aria-label={label} className={cn('flex gap-1 rounded-[0.875rem] bg-surface-variant p-1', className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => (refs.current[i] = el)}
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
            {on && (
              <motion.span
                layoutId={pillId}
                aria-hidden
                className="absolute inset-0 rounded-[0.625rem] bg-background shadow-sm"
                transition={heavy}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
    </PresenceContext.Provider>
  );
}
