import { springSoft } from '@/lib/motion';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepItemProps {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** Texto secundario a la derecha (series, minutos, peso…). */
  meta?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** Paso con check animado: aria-pressed, tick 28 px que se rellena de success y etiqueta tachada. */
export function StepItem({ checked, onToggle, children, meta, disabled, className }: StepItemProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'flex min-h-[52px] w-full items-center gap-3 rounded-xl px-2 py-1 text-left transition-colors duration-150 hover:bg-surface-variant disabled:opacity-50',
        className,
      )}
    >
      <motion.span
        aria-hidden
        animate={{ scale: checked ? 1.08 : 1 }}
        transition={springSoft}
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
          checked ? 'border-success bg-success text-on-primary' : 'border-border-strong text-transparent',
        )}
      >
        <Check className="size-4" strokeWidth={2.5} />
      </motion.span>
      <span className={cn('min-w-0 flex-1 text-body-md', checked ? 'text-on-surface-light line-through decoration-border-strong' : 'text-on-background')}>
        {children}
      </span>
      {meta !== undefined && <span className="shrink-0 font-mono text-body-sm tabular-nums text-on-surface-light">{meta}</span>}
    </button>
  );
}
