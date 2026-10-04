import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tone } from './tones';

// Fondos sólidos con texto AA tanto en claro como en oscuro (text-background invierte con el tema).
const cover: Record<Exclude<Tone, 'muted'>, string> = {
  primary: 'bg-primary-strong',
  secondary: 'bg-secondary-text',
  forest: 'bg-forest-text',
  success: 'bg-success-text',
  warning: 'bg-warning-text',
  error: 'bg-error-text',
  info: 'bg-info-text',
};

export interface BookCoverProps {
  title: string;
  icon: LucideIcon;
  tone?: Exclude<Tone, 'muted'>;
  className?: string;
}

/** Portada de libro/curso: color por tipo, ícono y título. Decorativa (aria-hidden): el título real va debajo. */
export function BookCover({ title, icon: Icon, tone = 'primary', className }: BookCoverProps) {
  return (
    <div aria-hidden className={cn('flex min-h-32 flex-col justify-between gap-4 rounded-xl p-4 text-background shadow-sm', cover[tone], className)}>
      <Icon className="size-6 opacity-90" strokeWidth={1.75} />
      <span className="line-clamp-3 text-heading-sm leading-tight [text-wrap:balance]">{title}</span>
    </div>
  );
}
