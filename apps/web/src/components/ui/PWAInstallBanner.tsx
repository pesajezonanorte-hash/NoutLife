import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { BrandMark } from '@/components/layout/Brand';
import { Button } from '@/components/ui/lq';
import { springSoft } from '@/lib/motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Clave que Ajustes conserva al borrar datos. Guarda cuándo se cerró el aviso.
const STORAGE_KEY = 'lq_pwa_dismissed';
// Cerrado el aviso, vuelve a aparecer solo después de una semana.
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
// Antes de pedir la instalación, dejamos que la persona pruebe la app.
const SHOW_DELAY_MS = 30_000;

function wasDismissedRecently(): boolean {
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return false;
  // '1' lo guardaban versiones anteriores, que ocultaban el aviso para siempre.
  if (value === '1') return true;
  return Date.now() - Number(value) < SNOOZE_MS;
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Solo Safari en iPhone y iPad ofrece «Agregar a la pantalla de inicio». Chrome, Firefox
// y los navegadores de apps (Instagram, Facebook…) en iOS no tienen ese paso.
function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|GSA|Line\//.test(ua);
  return isIos && isSafari;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  // 'android': botón con el aviso nativo de Chrome. 'ios': guía manual de Safari.
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInstalled() || wasDismissedRecently()) return;
    // Solo en móvil: en el ordenador el navegador ya ofrece instalar desde su barra y el aviso estorba.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let timer: number | undefined;
    const reveal = () => {
      timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    };

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform('android');
      reveal();
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS nunca emite beforeinstallprompt: la instalación es manual, así que mostramos la guía.
    if (isIosSafari()) {
      setPlatform('ios');
      reveal();
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    // Si la persona rechaza el diálogo del navegador, es lo mismo que cerrar el aviso.
    if (outcome === 'accepted') setVisible(false);
    else dismiss();
  }

  return (
    <AnimatePresence>
      {visible && platform && (
        <motion.div
          role="region"
          aria-label="Instalar NoutLife"
          className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[150] mx-auto w-full max-w-sm px-4 md:bottom-6 md:left-auto md:right-6 md:mx-0"
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, transition: { duration: 0.2 } }}
          transition={springSoft}
        >
          <div className="rounded-lg border border-border bg-surface p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <BrandMark size={36} />
              <div className="min-w-0 flex-1">
                <p className="text-label-lg text-on-background">Instala NoutLife</p>
                <p className="text-body-sm text-on-surface-light">
                  Disfruta la experiencia completa sin descargas pesadas ni ocupar memoria. Añádela a tu pantalla de inicio.
                </p>
              </div>
              <Button variant="icon" aria-label="Cerrar" onClick={dismiss}>
                <X aria-hidden className="size-5" strokeWidth={1.75} />
              </Button>
            </div>

            {platform === 'android' ? (
              <Button block size="sm" className="mt-3" onClick={() => void handleInstall()}>
                <Download aria-hidden className="size-4" strokeWidth={1.75} />
                Instalar NoutLife
              </Button>
            ) : (
              <ol className="mt-4 space-y-3">
                <li className="flex items-center gap-3 text-body-sm text-on-background">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-label-sm text-on-primary">1</span>
                  <span className="min-w-0 flex-1">Toca el botón <strong>Compartir</strong></span>
                  <Share aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
                </li>
                <li className="flex items-center gap-3 text-body-sm text-on-background">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-label-sm text-on-primary">2</span>
                  <span className="min-w-0 flex-1">Selecciona <strong>«Agregar a la pantalla de inicio»</strong></span>
                  <PlusSquare aria-hidden className="size-5 shrink-0 text-on-surface-light" strokeWidth={1.75} />
                </li>
              </ol>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
