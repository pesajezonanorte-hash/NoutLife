import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cn } from '@/lib/utils';

const paddings = { none: '', sm: 'p-4', md: 'p-4 md:p-6', lg: 'p-6' } as const;

type CardOwnProps<T extends ElementType> = {
  as?: T;
  /** base = surface + border + shadow-sm · elevated = background + shadow-md */
  variant?: 'base' | 'elevated';
  /** Lift −4 px + shadow-lg + borde primary/25 en hover y focus-within (200 ms); el IconChip interno gira. */
  interactive?: boolean;
  /** p-4 (sm) · p-4 md:p-6 (md, por defecto) · p-6 (lg) */
  padding?: keyof typeof paddings;
};

export type CardProps<T extends ElementType = 'div'> = CardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof CardOwnProps<T>>;

/** <Card as="li|a|section" variant="base|elevated" interactive> rounded-2xl. */
export function Card<T extends ElementType = 'div'>({
  as, variant = 'base', interactive, padding = 'md', className, ...rest
}: CardProps<T>) {
  const Tag: ElementType = as ?? 'div';
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-border',
        variant === 'base' ? 'bg-surface shadow-sm' : 'bg-background shadow-md',
        interactive && 'lq-lift',
        paddings[padding],
        className,
      )}
      {...rest}
    />
  );
}
