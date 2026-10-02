import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { softTone, type Tone } from './tones';

export type BadgeVariant = Exclude<Tone, 'muted'> | 'neutral';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: 'md' | 'lg';
  /** Obligatorio en badges de estado: el color nunca es la única señal. */
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}

/** <Badge variant size="md|lg" icon={Check}>Completado</Badge> */
export function Badge({ variant = 'neutral', size = 'md', icon: Icon, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold leading-normal tracking-[0.1px]',
        size === 'md' ? 'px-2.5 py-1 text-label-md' : 'px-3 py-1.5 text-label-lg',
        variant === 'neutral' ? 'bg-surface-variant text-on-surface' : softTone[variant],
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />}
      {children}
    </span>
  );
}
