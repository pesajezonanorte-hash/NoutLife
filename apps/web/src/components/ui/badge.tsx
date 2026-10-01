import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold leading-none transition-colors',
  {
    variants: {
      variant: {
        default: 'border-[var(--border-strong)] bg-[var(--bg-muted)] text-[var(--text-secondary)]',
        outline: 'border-[var(--border)] bg-transparent text-[var(--text-secondary)]',
        success: 'border-[color-mix(in_oklab,var(--accent-green)_38%,var(--border))] bg-[color-mix(in_oklab,var(--accent-green)_10%,transparent)] text-[var(--accent-green)]',
        warning: 'border-[color-mix(in_oklab,var(--accent-gold)_42%,var(--border))] bg-[color-mix(in_oklab,var(--accent-gold)_10%,transparent)] text-[var(--accent-gold)]',
        destructive: 'border-[color-mix(in_oklab,var(--accent-red)_38%,var(--border))] bg-[color-mix(in_oklab,var(--accent-red)_10%,transparent)] text-[var(--accent-red)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
