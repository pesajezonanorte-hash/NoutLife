import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { cn } from '@/lib/utils';

type ModalFrameSize = 'sm' | 'md' | 'lg';

interface ModalFrameProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: ModalFrameSize;
  contentClassName?: string;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  closeLabel?: string;
}

const sizeClasses: Record<ModalFrameSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

/**
 * Shared, viewport-safe surface for product dialogs.
 *
 * The header and footer remain visible while only the body scrolls. This keeps
 * long forms usable on 390px screens and avoids a dialog restoring an old
 * scroll position with its title outside the viewport.
 */
export function ModalFrame({
  title,
  description,
  icon,
  children,
  footer,
  onClose,
  size = 'md',
  contentClassName,
  panelClassName,
  panelStyle,
  closeLabel,
}: ModalFrameProps) {
  useEscapeKey(onClose);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const frame = (
    <motion.div
      className="fixed inset-0 z-[200] flex items-end justify-center overflow-hidden bg-[var(--scrim)] p-3 backdrop-blur-[2px] sm:items-center sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onClick={onClose}
    >
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-panel)] shadow-lg sm:max-h-[calc(100dvh-2.5rem)]',
          sizeClasses[size],
          panelClassName,
        )}
        style={panelStyle}
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30, mass: 0.82 }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-soft)] bg-[var(--bg-panel-light)] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--accent-gold)] shadow-sm">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
              {description && <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">{description}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel ?? `Cerrar ${title.toLowerCase()}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5', contentClassName)}>
          {children}
        </div>

        {footer && (
          <footer className="shrink-0 border-t border-[var(--border-soft)] bg-[var(--bg-panel)] px-4 py-3.5 sm:px-5">
            {footer}
          </footer>
        )}
      </motion.section>
    </motion.div>
  );

  // Some triggers live inside animated/overflowing containers (the desktop dock
  // is one example). Rendering at document level keeps fixed positioning and
  // the scrim relative to the real viewport rather than to that container.
  return typeof document === 'undefined' ? frame : createPortal(frame, document.body);
}
