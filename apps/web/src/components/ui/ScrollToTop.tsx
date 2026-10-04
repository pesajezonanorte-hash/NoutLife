import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotionConfig } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

/** Volver arriba (la página hace scroll en window). Sobre el FAB en móvil. */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const reduce = useReducedMotionConfig();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          aria-label="Volver arriba"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
          whileTap={{ scale: 0.92 }}
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })}
          className="fixed bottom-[calc(11rem+env(safe-area-inset-bottom))] right-6 z-30 flex size-11 items-center justify-center rounded-full border border-border bg-background text-on-surface shadow-md transition-colors hover:bg-surface-variant md:bottom-8 md:left-28 md:right-auto lg:left-72"
        >
          <ArrowUp aria-hidden className="size-5" strokeWidth={1.75} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
