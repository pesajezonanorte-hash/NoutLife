// FlowButton — API heredada (tone/size/fullWidth/withArrows) que ahora pinta
// con las clases del <Button> de lq: tokens, 44 px táctiles (36 px sm en md+),
// contraste AA y foco visible. Se eliminó el relleno animado y las flechas
// (decorativos, sin equivalente en el sistema). Para código nuevo usa
// <Button> de '@/components/ui/lq'. Ver docs/redesign/COMPONENT_MIGRATION.md.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { buttonClasses, type ButtonSize, type ButtonVariant } from '@/components/ui/lq';

export type FlowButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost' | 'cyan' | 'green';
export type FlowButtonSize = 'sm' | 'md' | 'lg';

interface FlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Etiqueta alternativa a children. */
  text?: string;
  children?: ReactNode;
  tone?: FlowButtonTone;
  size?: FlowButtonSize;
  fullWidth?: boolean;
  /** Obsoleto: se acepta por compatibilidad, ya no dibuja flechas. */
  withArrows?: boolean;
}

const variantOf: Record<FlowButtonTone, ButtonVariant> = {
  primary: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  ghost: 'secondary',
  cyan: 'secondary',
  green: 'secondary',
};

// Tonos sin variante propia en lq: contorno neutro y tintes suaves AA.
const toneExtra: Partial<Record<FlowButtonTone, string>> = {
  ghost: 'border border-border bg-transparent text-on-surface hover:bg-surface-variant hover:shadow-none',
  cyan: 'bg-info/[var(--lq-soft-alpha)] text-info-text',
  green: 'bg-success/[var(--lq-soft-alpha)] text-success-text',
};

export const FlowButton = forwardRef<HTMLButtonElement, FlowButtonProps>(function FlowButton(
  { text = 'Modern Button', children, tone = 'primary', size = 'md', fullWidth = false, withArrows: _withArrows, className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      data-tone={tone}
      className={cn(buttonClasses(variantOf[tone], size as ButtonSize, fullWidth), toneExtra[tone], 'min-w-11 max-w-full', className)}
      {...props}
    >
      {children ?? text}
    </button>
  );
});
