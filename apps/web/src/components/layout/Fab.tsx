import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShellStore } from '@/store/shellStore';

/** Botón flotante móvil (64 px) sobre la TabBar: abre las acciones rápidas. */
export function Fab({ className }: { className?: string }) {
  const quickOpen = useShellStore((s) => s.quickOpen);
  const setQuickOpen = useShellStore((s) => s.setQuickOpen);
  return (
    <motion.button
      type="button"
      aria-label="Crear: acciones rápidas"
      aria-haspopup="dialog"
      aria-expanded={quickOpen}
      onClick={() => setQuickOpen(true)}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
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
