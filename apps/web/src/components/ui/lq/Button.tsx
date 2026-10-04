import { forwardRef, type ReactNode } from 'react';
import { motion, type HTMLMotionProps, type TargetAndTransition } from 'framer-motion';
import { cn } from '@/lib/utils';
import { pressSpring } from '@/lib/motion';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
export type ButtonSize = 'lg' | 'md' | 'sm';

const base =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-label-lg ' +
  'transition-[background-color,color,border-color,box-shadow,scale] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-55';

// Design system: primario jade sólido (uno por vista), secundario con borde
// border-strong, peligro sólido error-text. Reposo shadow-sm, hover shadow-md.
const variants: Record<ButtonVariant, string> = {
  primary: 'lq-shine bg-primary-strong text-on-primary shadow-sm hover:bg-primary-hover hover:shadow-md active:shadow-sm',
  secondary: 'border border-border-strong bg-surface-variant text-on-background shadow-sm hover:border-primary hover:shadow-md active:shadow-sm',
  ghost: 'bg-transparent text-primary-text hover:bg-primary/[var(--lq-soft-alpha)]',
  danger: 'bg-error-text text-on-primary shadow-sm hover:shadow-md active:shadow-sm',
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
  return cn(classesFor(variant, size, block), 'transition-[background-color,color,border-color,box-shadow,transform,scale] hover:-translate-y-px active:translate-y-0 active:[scale:.97] [.reduce-motion_&]:hover:translate-y-0');
}

// Hover −1 px y pulsación 0.97 con muelle; ghost no se eleva, icon solo escala.
const lift: TargetAndTransition = { y: -1 };
const press: TargetAndTransition = { y: 0, scale: 0.97 };
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
 * Hover: sube 1 px + shadow-md (el primario además deja pasar un brillo);
 * pulsación 0.97 con muelle. Icon escala, ghost solo se hunde.
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
