import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShellStore } from '@/store/shellStore';
import { useToastStore } from '@/hooks/useToast';
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen';

/** Botón flotante móvil (64 px) sobre la TabBar: abre las acciones rápidas. */
export function Fab({ className }: { className?: string }) {
  const quickOpen = useShellStore((s) => s.quickOpen);
  const setQuickOpen = useShellStore((s) => s.setQuickOpen);
  // Los avisos salen justo encima de la barra: el botón sube para dejarles sitio.
  const toasts = useToastStore((s) => s.toasts.length);
  const keyboard = useKeyboardOpen();
  return (
    <motion.button
      type="button"
      aria-label="Crear: acciones rápidas"
      data-tour="create"
      aria-haspopup="dialog"
      aria-expanded={quickOpen}
      onClick={() => setQuickOpen(true)}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: keyboard ? 0 : 1, opacity: keyboard ? 0 : 1, y: -Math.min(toasts, 2) * 76 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className={cn(
        'fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-40 flex size-16 items-center justify-center rounded-full',
        'bg-primary-strong text-on-primary shadow-lg transition-colors hover:bg-primary-hover',
        className,
      )}
    >
      <Plus aria-hidden className="size-7" strokeWidth={2} />
    </motion.button>
  );
}
