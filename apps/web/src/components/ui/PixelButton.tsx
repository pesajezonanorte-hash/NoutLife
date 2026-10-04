import { Children, isValidElement, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { audio } from '../../lib/audio';
import { FlowButton, type FlowButtonTone } from './flow-button';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'cyan' | 'green';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantTones: Record<Variant, FlowButtonTone> = {
  primary: 'primary',
  secondary: 'secondary',
  danger: 'danger',
  ghost: 'ghost',
  cyan: 'cyan',
  green: 'green',
};

function hasTextualLabel(node: ReactNode): boolean {
  return Children.toArray(node).some((child) => {
    if (typeof child === 'string') return child.trim().length > 1;
    if (!isValidElement(child)) return false;
    return hasTextualLabel((child.props as { children?: ReactNode }).children);
  });
}

/**
 * Shared action button for Noutlife. It preserves the historical PixelButton
 * API and audio feedback, while rendering the bounded FlowButton interaction
 * instead of the previous liquid-glass/scale-on-hover treatment.
 */
export function PixelButton({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth,
  loading,
  disabled,
  className = '',
  onClick,
  onMouseEnter,
  ...props
}: Props) {
  const isDisabled = disabled || loading;
  const hasTextLabel = hasTextualLabel(children);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (isDisabled) return;
    audio.play('blip');
    onClick?.(event);
  }

  return (
    <FlowButton
      tone={variantTones[variant]}
      size={size}
      fullWidth={fullWidth}
      withArrows={!loading && hasTextLabel}
      className={cn('font-sans select-none', className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={handleClick}
      onMouseEnter={(event) => {
        if (!isDisabled) audio.play('hover');
        onMouseEnter?.(event);
      }}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-1.5" aria-label="Cargando">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0.1s]" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0.2s]" />
        </span>
      ) : children}
    </FlowButton>
  );
}
