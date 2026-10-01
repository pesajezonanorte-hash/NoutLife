import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[500] flex items-center justify-center gap-2 bg-[var(--accent-red)] py-1.5 text-white"
        >
          <WifiOff size={14} />
          <span className="font-pixel" style={{ fontSize: '12px' }}>
            Sin conexión — los cambios se guardarán al reconectar
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
