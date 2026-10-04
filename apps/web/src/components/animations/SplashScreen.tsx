// Splash inicial: marca + terminal animada (ModernLoader) mientras la app
// autentica. Continúa el splash estático de index.html (mismo layout), así que
// el paso de HTML a React no se nota. Sin interacción.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { ease } from '@/lib/motion';
import { LOADING_COPY } from '@/lib/loadingCopy';
import { ModernLoader } from '@/components/ui/lq';
import { BrandMark } from '@/components/layout/Brand';

interface Props {
  /** La app terminó su carga mínima / autenticación. */
  ready: boolean;
  onDone: () => void;
}

export function SplashScreen({ ready, onDone }: Props) {
  const reduce = useReducedMotionConfig() ?? false;
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!ready || exiting) return;
    const t = window.setTimeout(() => setExiting(true), reduce ? 0 : 180);
    return () => window.clearTimeout(t);
  }, [exiting, ready, reduce]);

  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(onDone, reduce ? 0 : 300);
    return () => window.clearTimeout(t);
  }, [exiting, onDone, reduce]);

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          className="fixed inset-0 z-[300] flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 text-on-background"
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.3, ease }}
        >
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="text-heading-lg">Noutlife</span>
          </div>
          <ModernLoader words={LOADING_COPY.splash} label="Preparando tu aventura" className="max-w-md" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
