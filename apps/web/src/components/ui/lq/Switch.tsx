import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> {}

/**
 * Interruptor nativo (checkbox con role="switch") de 52×32. Necesita un
 * <label htmlFor> o `aria-label`. El foco se dibuja sobre la pista.
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch({ className, ...rest }, ref) {
  return (
    <span className={cn('relative inline-flex h-8 w-[52px] shrink-0', className)}>
      <input ref={ref} type="checkbox" role="switch" className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0 disabled:cursor-not-allowed" {...rest} />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 rounded-full border border-border-strong bg-surface-variant transition-colors duration-200',
          'peer-checked:border-primary-strong peer-checked:bg-primary-strong',
          'peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary',
          'peer-disabled:opacity-40',
          'after:absolute after:left-[3px] after:top-[3px] after:size-6 after:rounded-full after:bg-background after:shadow-sm',
          'after:transition-[transform,width] after:duration-300 after:ease-[cubic-bezier(.34,1.56,.64,1)] peer-checked:after:translate-x-5 peer-active:after:scale-x-110',
        )}
      />
    </span>
  );
});
