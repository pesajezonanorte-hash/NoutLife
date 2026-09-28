import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { requestPermissionAndSubscribe } from '../../services/notification.service';
import { E } from '@/components/ui/glyphs';

const PREF_KEY = 'notif-perm-asked';

export function useNotificationModalState() {
  const alreadyAsked = localStorage.getItem(PREF_KEY);
  const permStatus = 'Notification' in window ? Notification.permission : 'denied';
  const [show, setShow] = useState(
    !alreadyAsked && permStatus === 'default',
  );
  return { show, setShow };
}

interface Props {
  onClose: () => void;
}

export function NotificationPermissionModal({ onClose }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    localStorage.setItem(PREF_KEY, '1');
    try {
      await requestPermissionAndSubscribe();
    } finally {
      setLoading(false);
      onClose();
    }
  }

  function handleDeny() {
    localStorage.setItem(PREF_KEY, '1');
    onClose();
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
        onClick={handleDeny}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="w-full max-w-sm rounded-2xl border-2 border-[var(--border)] bg-[var(--bg-panel)] p-6 space-y-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-deep)] p-2">
                <Bell size={22} className="text-[var(--accent-gold)]" />
              </div>
              <h2 className="font-pixel text-[var(--accent-gold)]" style={{ fontSize: '11px' }}>
                ALERTAS
              </h2>
            </div>
            <button onClick={handleDeny} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <X size={16} />
            </button>
          </div>

          <p className="font-vt text-[var(--text-primary)] text-lg leading-snug">
            ¿Quieres recibir alertas de tus rachas y misiones?
          </p>
          <p className="font-vt text-[var(--text-secondary)] text-base">
            Te avisaremos cuando estés a punto de perder tu racha o tengas misiones pendientes. Sin spam.
          </p>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleDeny}
              className="flex-1 py-2.5 border-2 border-[var(--border)] text-[var(--text-secondary)] rounded-xl font-vt text-base hover:text-[var(--text-primary)] transition-colors"
            >
              Ahora no
            </button>
            <motion.button
              onClick={handleAccept}
              disabled={loading}
              whileTap={{ scale: 0.96 }}
              className="flex-1 py-2.5 border-2 border-[var(--accent-gold)] bg-[var(--accent-gold)] text-[var(--bg-deep)] rounded-xl font-vt text-base font-semibold disabled:opacity-60"
            >
              {loading ? 'Activando…' : 'Sí, activar '}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
