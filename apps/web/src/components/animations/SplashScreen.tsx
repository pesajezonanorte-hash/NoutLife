import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Compass, ShieldCheck } from 'lucide-react';

interface Props {
  /** The app has completed its minimum loading/authentication work. */
  ready: boolean;
  onDone: () => void;
}

const INTRO_STEPS = [18, 42, 72, 88];

/**
 * A short, theme-aware launch transition. It intentionally shares the same
 * surface, border, typography and semantic accent tokens as the application
 * instead of presenting a separate arcade-style loading scene.
 */
export function SplashScreen({ ready, onDone }: Props) {
  const reduceMotion = useReducedMotion();
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
    const beginExit = window.setTimeout(() => setExiting(true), reduceMotion ? 0 : 150);
    return () => window.clearTimeout(beginExit);
  }, [exiting, ready, reduceMotion]);

  useEffect(() => {
    if (!exiting) return;

    // Wait for AnimatePresence to finish the fade before revealing the route.
    const finish = window.setTimeout(onDone, reduceMotion ? 0 : 290);
    return () => window.clearTimeout(finish);
  }, [exiting, onDone, reduceMotion]);

  const isReady = ready && progress === 100;
  const status = isReady ? 'Todo listo' : 'Preparando tu espacio';

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
          transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 50% 44%, color-mix(in oklab, var(--accent-gold) 9%, transparent), transparent 33%)',
            }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color-mix(in_oklab,var(--border)_72%,transparent)]" />
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[23rem] w-[23rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color-mix(in_oklab,var(--border-soft)_82%,transparent)]" />

          <motion.div
            className="relative w-full max-w-[23rem] rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)] p-5 shadow-[var(--shadow-lg)] sm:p-6"
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3">
              <motion.div
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]"
                animate={isReady || reduceMotion ? undefined : { rotate: [0, -2, 2, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <img src="/brand/lifequest-logo.png" alt="" className="h-full w-full object-cover" />
              </motion.div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-gold)]">LifeQuest</p>
                <h1 className="mt-0.5 text-lg font-bold tracking-tight text-[var(--text-primary)]">Tu aventura, en orden.</h1>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Preparando tu espacio de progreso.</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-muted)]/45 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                  {isReady ? <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent-green)]" aria-hidden="true" /> : <Compass className="h-4 w-4 shrink-0 text-[var(--accent-gold)]" aria-hidden="true" />}
                  <span className="truncate">{status}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--text-secondary)]">{progress}%</span>
              </div>

              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-panel)]"
                role="progressbar"
                aria-label="Progreso de inicio"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <motion.div
                  className="h-full rounded-full bg-[var(--accent-gold)]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>

            <p className="mt-4 text-center text-[11px] leading-4 text-[var(--text-muted)]">
              Misiones, hábitos y progreso real en un solo lugar.
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
