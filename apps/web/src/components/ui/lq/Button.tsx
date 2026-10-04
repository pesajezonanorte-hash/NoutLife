import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps, type TargetAndTransition } from 'framer-motion';
import { cn } from '@/lib/utils';
import { pressSpring } from '@/lib/motion';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
export type ButtonSize = 'lg' | 'md' | 'sm';

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg text-label-lg ' +
  'transition-[background-color,color,box-shadow,scale] duration-200 ease-[cubic-bezier(.22,1,.36,1)] disabled:cursor-not-allowed disabled:opacity-40';

const variants: Record<ButtonVariant, string> = {
  primary: 'lq-shine bg-primary-strong text-on-primary hover:bg-primary-hover hover:shadow-[0_10px_28px_-10px_rgb(var(--lq-primary)/0.65)] active:shadow-none',
  secondary: 'bg-surface-variant text-primary-text hover:bg-border hover:shadow-md active:shadow-none',
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

function classesFor(variant: ButtonVariant, size: ButtonSize, block?: boolean) {
  return cn(base, variants[variant], variant !== 'icon' && sizes[size], block && 'w-full');
}

/** Clases de botón para enlaces (<Link className={buttonClasses()} />), con pulsación en CSS. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'lg', block = false) {
  return cn(classesFor(variant, size, block), 'active:[scale:.96]');
}

// Hover y pulsación con muelle; ghost no se eleva, icon solo escala.
const lift: TargetAndTransition = { y: -1, scale: 1.015 };
const press: TargetAndTransition = { y: 0, scale: 0.96 };
const hoverFor: Record<ButtonVariant, TargetAndTransition | undefined> = {
  primary: lift, secondary: lift, danger: lift, ghost: undefined, icon: { scale: 1.06 },
};
const tapFor: Record<ButtonVariant, TargetAndTransition> = {
  primary: press, secondary: press, danger: press, ghost: { scale: 0.97 }, icon: { scale: 0.88 },
};

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

/**
 * <Button variant="primary|secondary|ghost|danger|icon" size="lg|md|sm">
 * Hover: sube 1 px y escala 1.015 (el primario además brilla y proyecta sombra
 * de color); pulsación 0.96 con muelle. Icon escala, ghost solo se hunde.
 * Los botones icon necesitan aria-label.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'lg', block, loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  const live = !disabled && !loading;
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      whileHover={live ? hoverFor[variant] : undefined}
      whileTap={live ? tapFor[variant] : undefined}
      transition={pressSpring}
      className={cn(classesFor(variant, size, block), className)}
      {...rest}
    >
      {loading && <Spinner size="sm" className="text-current" />}
      {children}
    </motion.button>
  );
});
