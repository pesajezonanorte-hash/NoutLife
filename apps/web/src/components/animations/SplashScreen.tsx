import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ModernLoader from '@/components/ui/modern-loader';
import { LOADING_COPY } from '@/lib/loadingCopy';

interface Props {
  /** The app has completed its minimum loading/authentication work. */
  ready: boolean;
  onDone: () => void;
}

const INTRO_STEPS = [18, 42, 72, 88];
/** A real bootstrap gate displayed as a restrained, animated code terminal. */
export function SplashScreen({ ready, onDone }: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timers = INTRO_STEPS.map((value, index) => (
      window.setTimeout(() => setProgress((current) => Math.max(current, value)), 100 + index * 180)
    ));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  useEffect(() => {
    if (!ready || exiting) return;

    setProgress(100);
    const beginExit = window.setTimeout(() => setExiting(true), reduceMotion ? 0 : 180);
    return () => window.clearTimeout(beginExit);
  }, [exiting, ready, reduceMotion]);

  useEffect(() => {
    if (!exiting) return;

    const finish = window.setTimeout(onDone, reduceMotion ? 0 : 300);
    return () => window.clearTimeout(finish);
  }, [exiting, onDone, reduceMotion]);

  const isReady = ready && progress === 100;

  return (
    <AnimatePresence>
      {!exiting ? (
        <motion.div
          aria-busy={!isReady}
          aria-label="Iniciando LifeQuest"
          className="fixed inset-0 z-[300] flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--bg-deep)] px-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <ModernLoader variant="screen" words={LOADING_COPY.splash} progress={progress} ready={isReady} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
