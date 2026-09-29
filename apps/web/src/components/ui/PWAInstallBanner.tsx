import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { E } from '@/components/ui/glyphs';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('lq_pwa_dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after 30s
      setTimeout(() => setVisible(true), 30000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
      localStorage.setItem('lq_pwa_dismissed', '1');
    }
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setVisible(false);
    setDismissed(true);
    localStorage.setItem('lq_pwa_dismissed', '1');
  }

  if (dismissed || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-16 md:bottom-4 left-1/2 z-[150] w-full max-w-sm px-4"
          style={{ translateX: '-50%' }}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
          <div className="bg-bg-panel border-2 border-accent-gold shadow-pixel-gold px-4 py-3 flex items-center gap-3">
            <span className="text-2xl"><E e="⚔" /></span>
            <div className="flex-1 min-w-0">
              <p className="font-pixel text-accent-gold" style={{ fontSize: '12px' }}>
                ¡Instala LifeQuest!
              </p>
              <p className="font-vt text-text-secondary text-base leading-tight">
                Experiencia épica sin navegador
              </p>
            </div>
            <button
              onClick={handleInstall}
              className="font-pixel text-border-pixel bg-accent-gold border-2 border-border-pixel px-3 py-1 shadow-pixel hover:brightness-110 whitespace-nowrap flex-shrink-0"
              style={{ fontSize: '12px' }}
            >
              INSTALAR
            </button>
            <button
              onClick={handleDismiss}
              className="font-pixel text-text-secondary hover:text-text-primary flex-shrink-0"
              style={{ fontSize: '12px' }}
            >
              <E e="✕" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
