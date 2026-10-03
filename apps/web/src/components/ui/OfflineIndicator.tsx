import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { ease } from '@/lib/motion';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/** Aviso sin conexión: banda warning (ícono + texto) arriba del contenido. */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { duration: 0.3, ease } }}
          exit={{ y: -40, opacity: 0, transition: { duration: 0.2 } }}
          className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 border-b-2 border-warning bg-background px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-label-lg text-warning-text shadow-md"
        >
          <WifiOff aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          Sin conexión: los cambios se guardarán al reconectar
        </motion.div>
      )}
    </AnimatePresence>
  );
}
