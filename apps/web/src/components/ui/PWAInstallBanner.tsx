import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { BrandMark } from '@/components/layout/Brand';
import { Button } from '@/components/ui/lq';
import { springSoft } from '@/lib/motion';

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
    // Solo en móvil: en el ordenador el navegador ya ofrece instalar desde su barra y el aviso estorba.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

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
          role="dialog"
          aria-label="Instalar Noutlife"
          className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[150] mx-auto w-full max-w-sm px-4 md:bottom-6 md:left-auto md:right-6 md:mx-0"
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, transition: { duration: 0.2 } }}
          transition={springSoft}
        >
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 pl-4 shadow-lg">
            <BrandMark size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-label-lg text-on-background">Instala Noutlife</p>
              <p className="text-body-sm text-on-surface-light">Ábrela como una app, sin navegador.</p>
            </div>
            <Button size="sm" onClick={() => void handleInstall()}>Instalar</Button>
            <Button variant="icon" aria-label="Cerrar" onClick={handleDismiss}>
              <X aria-hidden className="size-5" strokeWidth={1.75} />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
