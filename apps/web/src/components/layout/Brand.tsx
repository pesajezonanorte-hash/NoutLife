import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Marca del shell: escudo en IconChip primary (DashboardDesktop / DashboardTablet). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[var(--lq-soft-alpha)] text-primary-text',
        className,
      )}
    >
      <ShieldCheck aria-hidden className="size-6" strokeWidth={1.75} />
    </span>
  );
}
