import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ModernLoader from '@/components/ui/modern-loader';

interface Props {
  /** The app has completed its minimum loading/authentication work. */
  ready: boolean;
  onDone: () => void;
}

const INTRO_STEPS = [18, 42, 72, 88];
const LOADING_WORDS = [
  'Iniciando tus herramientas…',
  'Sincronizando tu progreso…',
  'Preparando tu jornada…',
];

/**
 * LifeQuest's launch transition. It keeps the real bootstrap gate while using
 * a compact terminal stream rather than an unrelated, simulated loading scene.
 */
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

    // Let the terminal fade before the application routes become visible.
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
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 50% 44%, color-mix(in oklab, var(--accent-gold) 8%, transparent), transparent 38%)',
            }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color-mix(in_oklab,var(--border)_72%,transparent)]" />

          <div className="relative flex w-full max-w-[30rem] flex-col items-center">
            <motion.div
              className="mb-5 flex items-center gap-3 self-start"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-pixel">
                <img src="/brand/lifequest-logo.png" alt="LifeQuest" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-gold)]">LifeQuest</p>
                <h1 className="mt-0.5 text-base font-bold tracking-tight text-[var(--text-primary)]">Tu aventura, en orden.</h1>
              </div>
            </motion.div>

            <ModernLoader words={LOADING_WORDS} progress={progress} ready={isReady} />

            <motion.p
              className="mt-4 text-center text-[11px] leading-4 text-[var(--text-muted)]"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.22, duration: reduceMotion ? 0 : 0.28 }}
            >
              {isReady ? 'Todo listo. Abriendo tu espacio.' : 'Misiones, hábitos y progreso real en un solo lugar.'}
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
