import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff, RefreshCw } from 'lucide-react';
import { ease } from '@/lib/motion';
import { useToastStore } from '@/hooks/useToast';
import { useConnectivity } from '@/lib/offline/connectivity';
import { useText, type Copy } from '@/lib/i18n';

const es = {
  offline: 'Sin conexión',
  offlinePending: (n: number) => `Sin conexión · ${n} ${n === 1 ? 'cambio' : 'cambios'} por enviar`,
  syncing: (n: number) => `Sincronizando ${n} ${n === 1 ? 'cambio' : 'cambios'}…`,
  synced: 'Todo al día',
  syncedBody: 'Tus cambios ya están guardados.',
  rejected: (n: number) => `${n === 1 ? 'Un cambio no se pudo guardar' : `${n} cambios no se pudieron guardar`}`,
  rejectedBody: 'El servidor los rechazó al sincronizar. Revisa esa zona e inténtalo otra vez.',
};
const en: typeof es = {
  offline: 'Offline',
  offlinePending: (n: number) => `Offline · ${n} ${n === 1 ? 'change' : 'changes'} to send`,
  syncing: (n: number) => `Syncing ${n} ${n === 1 ? 'change' : 'changes'}…`,
  synced: 'All caught up',
  syncedBody: 'Your changes are saved.',
  rejected: (n: number) => `${n === 1 ? 'A change couldn’t be saved' : `${n} changes couldn’t be saved`}`,
  rejectedBody: 'The server rejected them while syncing. Check that area and try again.',
};
const COPY: Copy<typeof es> = { es, en };

/** Píldora abajo a la izquierda, sobre la barra: sin conexión o sincronizando. No tapa títulos ni el botón de añadir, y no recibe toques. Al terminar lo pendiente, una confirmación breve. */
export function OfflineIndicator() {
  const t = useText(COPY);
  const online = useConnectivity((s) => s.online);
  const pending = useConnectivity((s) => s.pending);
  const syncing = useConnectivity((s) => s.syncing);
  const rejected = useConnectivity((s) => s.rejected);
  const hadPending = useRef(false);

  useEffect(() => {
    if (pending > 0) { hadPending.current = true; return; }
    if (hadPending.current && online && !syncing) {
      hadPending.current = false;
      if (useConnectivity.getState().rejected === 0) useToastStore.getState().success(t.synced, t.syncedBody);
    }
  }, [pending, online, syncing, t]);

  useEffect(() => {
    if (rejected === 0) return;
    useToastStore.getState().error(t.rejected(rejected), t.rejectedBody);
    useConnectivity.setState({ rejected: 0 });
  }, [rejected, t]);

  const band = !online ? (pending > 0 ? t.offlinePending(pending) : t.offline) : syncing && pending > 0 ? t.syncing(pending) : null;
  return (
    <AnimatePresence>
      {band && (
        <motion.div
          role="status"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3, ease } }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          className="pointer-events-none fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] left-4 z-[60] md:bottom-6 md:left-[5.5rem]"
        >
          <span className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-label-sm text-on-surface-light shadow-sm">
            {online
              ? <RefreshCw aria-hidden className="size-3.5 shrink-0 animate-spin" strokeWidth={1.75} />
              : <CloudOff aria-hidden className="size-3.5 shrink-0" strokeWidth={1.75} />}
            {band}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
