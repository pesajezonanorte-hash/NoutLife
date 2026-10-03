// Splash inicial — marca con halo, nombre y barra de progreso mientras la app
// autentica. Sin interacción. role="status" para lectores de pantalla.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { ease } from '@/lib/motion';

interface Props {
  /** La app terminó su carga mínima / autenticación. */
  ready: boolean;
  onDone: () => void;
}

const INTRO_STEPS = [18, 42, 72, 88];

export function SplashScreen({ ready, onDone }: Props) {
  const reduce = useReducedMotionConfig() ?? false;
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timers = INTRO_STEPS.map((value, i) => window.setTimeout(() => setProgress((p) => Math.max(p, value)), 100 + i * 180));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (!ready || exiting) return;
    setProgress(100);
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
          role="status"
          aria-busy={progress < 100}
          aria-label="Preparando tu aventura"
          className="fixed inset-0 z-[300] flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-6 text-on-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.3, ease }}
        >
          <motion.span
            aria-hidden
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.4, ease } }}
            className="lq-halo flex size-20 items-center justify-center rounded-3xl bg-primary/[var(--lq-soft-alpha)] text-primary-text"
          >
            <ShieldCheck className="size-10" strokeWidth={1.5} />
          </motion.span>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-heading-lg">LifeQuest</span>
            <span className="text-body-md text-on-surface-light">Preparando tu aventura…</span>
          </div>
          <span aria-hidden className="h-1.5 w-48 overflow-hidden rounded-full bg-surface-variant">
            <span
              className="block h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
