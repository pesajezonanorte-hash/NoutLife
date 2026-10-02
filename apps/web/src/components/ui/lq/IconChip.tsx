import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { softTone, type Tone } from './tones';

const sizes = {
  sm: { box: 'size-10 rounded-xl', icon: 'size-5' },
  md: { box: 'size-12 rounded-[14px]', icon: 'size-6' },
  lg: { box: 'size-20 rounded-3xl', icon: 'size-12' },
} as const;

export interface IconChipProps {
  icon?: LucideIcon;
  tone?: Tone;
  size?: keyof typeof sizes;
  className?: string;
  /** Contenido alternativo al ícono (iniciales, nivel…). */
  children?: ReactNode;
}

/** Ícono sobre tinte suave. Dentro de un <Card interactive> gira al hacer hover (.lq-ichip). */
export function IconChip({ icon: Icon, tone = 'primary', size = 'md', className, children }: IconChipProps) {
  const s = sizes[size];
  return (
    <span className={cn('lq-ichip inline-flex shrink-0 items-center justify-center', s.box, softTone[tone], className)}>
      {Icon ? <Icon aria-hidden className={s.icon} strokeWidth={size === 'lg' ? 1.5 : 1.75} /> : children}
    </span>
  );
}
