import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dialog, scrim, sheet } from '@/lib/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Focus trap + Escape + restaurar foco + bloquear scroll del body. */
export function useDialogBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) { e.preventDefault(); return; }
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  return panelRef;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Título visible; se enlaza con aria-labelledby. */
  title: ReactNode;
  /** Oculta la X de cerrar (p. ej. en estados de éxito con su propio botón). */
  hideClose?: boolean;
  /** Cerrar al pulsar el fondo (por defecto sí). */
  dismissible?: boolean;
  className?: string;
  children?: ReactNode;
}

/** Diálogo centrado: scrim fade 200 ms, panel y 20→0 + spring. role="dialog" aria-modal. */
export function Modal({ open, onClose, title, hideClose, dismissible = true, className, children }: ModalProps) {
  const titleId = useId();
  const panelRef = useDialogBehavior(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          variants={scrim} initial="initial" animate="animate" exit="exit"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] p-4"
          onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={panelRef}
            role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            variants={dialog}
            className={cn('flex max-h-[calc(100dvh-2rem)] w-full max-w-[440px] flex-col gap-4 overflow-y-auto rounded-3xl bg-background p-6 text-on-background shadow-lg outline-none', className)}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="min-w-0 flex-1 text-heading-md">{title}</h2>
              {!hideClose && (
                <Button variant="icon" aria-label="Cerrar" onClick={onClose} className="-mr-2 -mt-2">
                  <X aria-hidden className="size-6" strokeWidth={1.75} />
                </Button>
              )}
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Hoja inferior (móvil): sube y 100%→0 en 300 ms, sale en 200 ms. Mismo contrato que Modal. */
export function Sheet({ open, onClose, title, hideClose = true, dismissible = true, className, children }: ModalProps) {
  const titleId = useId();
  const panelRef = useDialogBehavior(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          variants={scrim} initial="initial" animate="animate" exit="exit"
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)]"
          onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={panelRef}
            role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            variants={sheet}
            className={cn(
              'flex max-h-[90dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 text-on-background shadow-lg outline-none',
              className,
            )}
          >
            <span aria-hidden className="h-1 w-10 self-center rounded-full bg-border" />
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="text-heading-lg">{title}</h2>
              {!hideClose && (
                <Button variant="icon" aria-label="Cerrar" onClick={onClose} className="-mr-2">
                  <X aria-hidden className="size-6" strokeWidth={1.75} />
                </Button>
              )}
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Modal centrado en md+, Sheet inferior en móvil (mismo contrato). */
export function ResponsiveDialog(props: ModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  return isDesktop ? <Modal {...props} /> : <Sheet hideClose={false} {...props} />;
}
