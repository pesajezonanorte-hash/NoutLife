import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dialog, scrim, sheet } from '@/lib/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from './Button';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bloqueo de scroll real (también en iOS, donde overflow:hidden no frena el
 * arrastre): el body queda fijo en su posición y se restaura al cerrar. Con un
 * contador, para diálogos abiertos uno encima de otro.
 */
let locks = 0;
let saved: { y: number; style: string } | null = null;
export function lockScroll() {
  locks += 1;
  if (locks > 1) return;
  const y = window.scrollY;
  saved = { y, style: document.body.getAttribute('style') ?? '' };
  const gap = window.innerWidth - document.documentElement.clientWidth;
  Object.assign(document.body.style, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', width: '100%', overflow: 'hidden', paddingRight: gap ? `${gap}px` : '' });
}
export function unlockScroll() {
  locks = Math.max(0, locks - 1);
  if (locks > 0 || !saved) return;
  const { y, style } = saved;
  saved = null;
  document.body.setAttribute('style', style);
  window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
  // iOS: si el teclado aún se está cerrando, la vista queda desplazada y la
  // barra inferior fuera de sitio. Se vuelve a colocar cuando termina.
  const vv = window.visualViewport;
  if (vv && vv.offsetTop > 0) {
    const settle = () => { if (locks === 0) window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }); };
    vv.addEventListener('resize', settle, { once: true });
    window.setTimeout(settle, 400);
  }
}

/** Focus trap + Escape + restaurar foco + bloquear scroll del body. */
export function useDialogBehavior(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    lockScroll();

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
      unlockScroll();
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
          className="fixed inset-0 z-[82] flex items-center justify-center bg-[var(--scrim)] p-4"
          onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={panelRef}
            role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            variants={dialog}
            className={cn('flex max-h-[calc(100dvh-2rem)] w-full max-w-[440px] flex-col gap-4 overflow-y-auto overscroll-contain rounded-3xl bg-background p-6 text-on-background shadow-lg outline-none', className)}
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
  const drag = useDragControls();
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          variants={scrim} initial="initial" animate="animate" exit="exit"
          className="fixed inset-0 z-[82] flex items-end justify-center overscroll-none bg-[var(--scrim)]"
          onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}
        >
          {/* Se arrastra hacia abajo desde el asa o el título para cerrarla. */}
          <motion.div
            ref={panelRef}
            role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            variants={sheet}
            drag={dismissible ? 'y' : false} dragControls={drag} dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.7 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose(); }}
            className={cn(
              'flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-background text-on-background shadow-lg outline-none',
              className,
            )}
          >
            <div
              onPointerDown={(e) => dismissible && drag.start(e)}
              className="flex shrink-0 touch-none flex-col gap-3 px-4 pb-2 pt-3"
            >
              <span aria-hidden className="h-1.5 w-11 self-center rounded-full bg-border-strong/60" />
              <div className="flex items-start justify-between gap-4">
                <h2 id={titleId} className="text-heading-lg">{title}</h2>
                {!hideClose && (
                  <Button variant="icon" aria-label="Cerrar" onClick={onClose} onPointerDown={(e) => e.stopPropagation()} className="-mr-2">
                    <X aria-hidden className="size-6" strokeWidth={1.75} />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2">
              {children}
            </div>
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
