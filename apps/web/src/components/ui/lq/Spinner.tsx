import { cn } from '@/lib/utils';

const sizes = {
  sm: 'size-[18px] border-2 border-current border-r-transparent',
  md: 'size-8 border-[3px] border-primary/[var(--lq-soft-alpha)] border-t-primary',
} as const;

/** Spinner circular. Con reduced motion pulsa en vez de girar (lq.css). */
export function Spinner({ size = 'md', className, label }: { size?: keyof typeof sizes; className?: string; label?: string }) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block shrink-0 animate-spin rounded-full motion-reduce:animate-pulse', sizes[size], className)}
    />
  );
}
