import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { SagePanel } from './SagePanel';
import { useUIStore } from '../../store/uiStore';

const SEEN_KEY = 'sage-daily-seen';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}

export function SageWidget() {
  const { sageOpen, openSage, closeSage } = useUIStore();
  const isMobile = useIsMobile();

  const hasNew = (() => {
    const today = new Date().toDateString();
    return localStorage.getItem(SEEN_KEY) !== today;
  })();

  const handleOpen = () => {
    openSage();
    localStorage.setItem(SEEN_KEY, new Date().toDateString());
  };

  const btnStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        top: 68,
        right: 12,
        width: 36,
        height: 36,
        zIndex: 45,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }
    : {
        position: 'fixed',
        // El dock de acciones vive centrado; el Sabio puede quedarse anclado
        // en la esquina inferior derecha, sin flotar sobre el contenido.
        bottom: 24,
        right: 24,
        width: 52,
        height: 52,
        zIndex: 45,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '16px',
        border: '1.5px solid var(--border)',
        background: 'var(--bg-panel)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      };

  return (
    <>
      {!isMobile && (
        <motion.button
          onClick={handleOpen}
          style={btnStyle}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="El Sabio — Asistente IA"
        >
          <Sparkles size={22} className="text-[var(--accent-gold)]" />

          {hasNew && (
            <motion.div
              className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[var(--bg-panel)] bg-[var(--accent-gold)]"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </motion.button>
      )}

      <AnimatePresence>
        {sageOpen && <SagePanel onClose={closeSage} />}
      </AnimatePresence>
    </>
  );
}
