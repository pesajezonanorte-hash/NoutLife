import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cn } from '@/lib/utils';
import { useSpotlight } from '@/lib/motion';

const paddings = { none: '', sm: 'p-4', md: 'p-6', lg: 'p-6 md:p-8 lg:p-10' } as const;

type SpotCardOwnProps<T extends ElementType> = {
  as?: T;
  padding?: keyof typeof paddings;
};

export type SpotCardProps<T extends ElementType = 'section'> = SpotCardOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof SpotCardOwnProps<T>>;

/** Tarjeta protagonista (.spot): luz que sigue al cursor + tilt 3D de 3° como máximo.
 *  Sin tilt con «Reducir movimiento» ni en táctil (useSpotlight). */
export function SpotCard<T extends ElementType = 'section'>({ as, padding = 'lg', className, ...rest }: SpotCardProps<T>) {
  const Tag: ElementType = as ?? 'section';
  const spot = useSpotlight<HTMLElement>();
  return (
    <Tag
      {...spot}
      className={cn('lq-spot overflow-hidden rounded-2xl border border-border bg-background shadow-md', paddings[padding], className)}
      {...rest}
    />
  );
}
