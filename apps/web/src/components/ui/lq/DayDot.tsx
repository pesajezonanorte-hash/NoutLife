import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DayStatus = 'done' | 'today' | 'rest';

export interface DayDotProps {
  status: DayStatus;
  /** Inicial del día (L, M, X…): se muestra cuando no está hecho. */
  label: string;
  className?: string;
}

/**
 * Punto de asistencia 44 px. El estado se comunica con ícono + color (nunca solo color):
 * done = check sobre success · today = anillo primary · rest = gris. Decorativo: el <li>
 * contenedor lleva el aria-label ("lunes: asististe").
 */
export function DayDot({ status, label, className }: DayDotProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-label-lg sm:size-11 transition-[background-color,color,transform] duration-300 ease-spring',
        status === 'done' && 'bg-success text-on-primary',
        status === 'today' && 'bg-background text-primary-text ring-2 ring-primary',
        status === 'rest' && 'bg-surface-variant text-on-surface-light',
        className,
      )}
    >
      {status === 'done' ? <Check className="size-4" strokeWidth={2.5} /> : label}
    </span>
  );
}
