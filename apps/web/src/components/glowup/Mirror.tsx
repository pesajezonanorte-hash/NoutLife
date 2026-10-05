// El espejo de Glow up: un marco en arco con superficie de vidrio, un reflejo
// que se desliza muy despacio y un resplandor que crece con el brillo del día
// (sube de forma gradual, como una luz que se enciende). Al llegar el espejo
// está empañado y se desempaña poco a poco. Lo decorativo es aria-hidden.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';

export function Mirror({ brightness, children, className }: { brightness: number; children: ReactNode; className?: string }) {
  const reduce = useMotionStore((s) => s.reduce);
  const b = Math.max(0, Math.min(100, brightness)) / 100;
  return (
    <div className={cn('relative flex shrink-0 items-center justify-center', className)}>
      {/* Resplandor detrás del espejo: más brillo, más luz */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 block rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-jade-200)/.9),transparent)] dark:bg-[radial-gradient(closest-side,rgb(var(--lq-jade-400)/.35),transparent)]"
        initial={{ opacity: 0.15 }}
        animate={{ opacity: 0.18 + b * 0.62, transition: { ...springs.gentle, mass: 3 } }}
      />
      <div className="relative flex h-56 w-44 items-center justify-center overflow-hidden rounded-b-[2rem] rounded-t-[999px] border border-border-strong/30 bg-[linear-gradient(160deg,rgb(var(--lq-surface)),rgb(var(--lq-surface-variant)))] shadow-lg">
        {/* Reflejo que se desplaza muy despacio */}
        <span aria-hidden="true" className="lq-mirror-glint pointer-events-none absolute -inset-y-6 left-0 block w-1/3 bg-[linear-gradient(100deg,transparent,rgb(255_255_255/.55),transparent)] dark:bg-[linear-gradient(100deg,transparent,rgb(var(--lq-jade-50)/.08),transparent)]" />
        <div className="relative">{children}</div>
        {/* Vaho: se disipa al llegar */}
        {!reduce && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 block bg-surface/70 backdrop-blur-md"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0, transition: { duration: 1.8, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] } }}
          />
        )}
      </div>
    </div>
  );
}
