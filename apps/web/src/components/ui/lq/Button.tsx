import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
export type ButtonSize = 'lg' | 'md' | 'sm';

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-label-lg ' +
  'transition-[background-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-40';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary-strong text-on-primary hover:bg-primary-hover hover:shadow-md active:shadow-none',
  secondary: 'bg-surface-variant text-primary-text hover:shadow-md active:shadow-none',
  ghost: 'bg-transparent text-primary-text hover:underline hover:underline-offset-4',
  danger: 'bg-error/[var(--lq-soft-alpha)] text-error-text hover:shadow-md active:shadow-none',
  icon: 'size-11 shrink-0 rounded-full bg-transparent p-0 text-on-surface hover:bg-surface-variant',
};

const sizes: Record<ButtonSize, string> = {
  lg: 'min-h-12 px-6 py-3',
  md: 'min-h-11 px-5 py-2.5',
  // sm: 36 px como btn-sm en desktop; 44 px en táctil (README regla 4).
  sm: 'min-h-11 px-3.5 py-1.5 md:min-h-9',
};

/** Clases de botón para usarlas en enlaces (<Link className={buttonClasses()} />). */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg', block = false) {
  return cn(base, variants[variant], variant !== 'icon' && sizes[size], block && 'w-full');
}

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

/**
 * <Button variant="primary|secondary|ghost|danger|icon" size="lg|md|sm">
 * Hover scale 1.02 + shadow-md (100 ms), tap 0.98. Los botones `icon`
 * necesitan `aria-label`. Ghost e icon no escalan (lq.css).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'lg', block, loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  const scales = variant !== 'ghost' && variant !== 'icon' && !disabled && !loading;
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      whileHover={scales ? { scale: 1.02 } : undefined}
      whileTap={scales ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.1 }}
      className={cn(buttonClasses(variant, size, block), className)}
      {...rest}
    >
      {loading && <Spinner size="sm" className="text-current" />}
      {children}
    </motion.button>
  );
});
