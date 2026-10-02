import { AnimatePresence } from 'framer-motion';
import { SagePanel } from './SagePanel';
import { useUIStore } from '../../store/uiStore';

/**
 * Panel del Sabio. El disparador vive en el AppShell (Topbar en md+, menú en
 * móvil) para no flotar sobre el contenido ni competir con el FAB.
 */
export function SageWidget() {
  const { sageOpen, closeSage } = useUIStore();
  return (
    <AnimatePresence>
      {sageOpen && <SagePanel onClose={closeSage} />}
    </AnimatePresence>
  );
}
