import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Check, Info, Trophy, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast as toastVariants } from '@/lib/motion';
import { useToastStore, type ToastType } from '@/hooks/useToast';
import { Button } from './Button';
import { IconChip } from './IconChip';
import type { Tone } from './tones';

// La API para disparar toasts sigue siendo la existente: useToast() de
// @/hooks/useToast (success/error/info/warning). Aquí solo cambia el render.
export { useToast } from '@/hooks/useToast';

const byType: Record<ToastType, { tone: Tone; icon: LucideIcon }> = {
  success: { tone: 'success', icon: Check },
  error: { tone: 'error', icon: AlertCircle },
  warning: { tone: 'warning', icon: AlertTriangle },
  info: { tone: 'info', icon: Info },
  achievement: { tone: 'primary', icon: Trophy },
};

export interface ToastProps {
  type?: ToastType;
  message: ReactNode;
  subtitle?: ReactNode;
  onClose?: () => void;
  className?: string;
}

/** Toast: ícono de estado + mensaje + cerrar. Errores con role="alert", resto role="status". */
export function Toast({ type = 'success', message, subtitle, onClose, className }: ToastProps) {
  const { tone, icon } = byType[type];
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-border bg-background py-3 pl-3 pr-2 text-body-md text-on-background shadow-lg',
        className,
      )}
    >
      <IconChip icon={icon} tone={tone} size="sm" className="size-9 rounded-[10px]" />
      <div className="min-w-0 flex-1">
        <div>{message}</div>
        {subtitle && <div className="text-body-sm text-on-surface-light">{subtitle}</div>}
      </div>
      {onClose && (
        <Button variant="icon" aria-label="Cerrar" onClick={onClose}>
          <X aria-hidden className="size-6" strokeWidth={1.75} />
        </Button>
      )}
    </div>
  );
}

/**
 * Pila de toasts del store global. Móvil: justo encima de la tab bar, suben
 * desde detrás de ella con un muelle y se pueden apartar deslizando. Desktop (≥768): abajo a la derecha. Vida 4 s (la gestiona el store).
 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] flex flex-col-reverse items-center gap-2 md:inset-x-auto md:bottom-8 md:right-8 md:w-[380px] md:flex-col md:items-stretch"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            variants={toastVariants} initial="initial" animate="animate" exit="exit"
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
            onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) remove(t.id); }}
            className="pointer-events-auto w-full max-w-[420px] touch-pan-y"
          >
            <Toast type={t.type} message={t.message} subtitle={t.subtitle} onClose={() => remove(t.id)} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
