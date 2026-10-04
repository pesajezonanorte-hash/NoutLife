import { useRef } from 'react';
import { useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtNumber, useCountUp } from '@/lib/motion';
import { Card } from './Card';
import { IconChip } from './IconChip';
import type { Tone } from './tones';

export interface StatCardProps {
  icon: LucideIcon;
  tone?: Tone;
  /** Número (anima con count-up) o texto ya formateado ("3/5"). */
  value: number | string;
  /** Formatea el número animado. Por defecto separador de miles es-CO. */
  format?: (n: number) => string;
  label: string;
  /** Destino del enlace "Ver más". */
  to?: string;
  linkLabel?: string;
  size?: 'md' | 'lg';
  className?: string;
}

/** Número animado para la vista; los lectores reciben solo el valor final. */
export function AnimatedValue({ value, format = fmtNumber }: { value: number; format?: (n: number) => string }) {
  // Cuenta al aparecer en pantalla (no al montar), para que se vea aunque esté bajo el pliegue.
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const v = useCountUp(seen ? value : 0);
  return (
    <>
      <span ref={ref} aria-hidden>{format(v)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

/** Ícono + número (count-up) + label + enlace. Lift en hover. */
export function StatCard({ icon, tone = 'primary', value, format, label, to, linkLabel = 'Ver más', size = 'md', className }: StatCardProps) {
  return (
    <Card interactive padding={size === 'lg' ? 'lg' : 'sm'} className={cn('flex flex-col', size === 'lg' ? 'gap-4' : 'gap-3', className)}>
      <IconChip icon={icon} tone={tone} />
      <div>
        <div className={cn('font-mono tabular-nums', size === 'lg' ? 'text-display-md' : 'text-heading-lg')}>
          {typeof value === 'number' ? <AnimatedValue value={value} format={format} /> : value}
        </div>
        <div className={cn('text-on-surface-light', size === 'lg' ? 'text-body-md' : 'text-body-sm')}>{label}</div>
      </div>
      {to && (
        <Link to={to} className="inline-flex min-h-11 items-center gap-1 self-start text-label-lg text-primary-text hover:underline hover:underline-offset-4">
          {linkLabel}
          <span className="sr-only"> · {label}</span>
          <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
        </Link>
      )}
    </Card>
  );
}
