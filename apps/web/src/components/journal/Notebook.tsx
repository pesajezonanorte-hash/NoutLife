// Piezas de la libreta del Diario: la página de hoy (con hojas debajo y una
// tapa que se abre al llegar) y el sello del día. Lo decorativo es aria-hidden.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';
import { MoodFace, moodOf } from '@/components/ui/lq';
import { softTone } from '@/components/ui/lq/tones';

/** Página de la libreta: papel, margen, hojas apiladas detrás y la tapa que se abre. */
export function NotebookPage({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useMotionStore((s) => s.reduce);
  return (
    <div className={cn('relative', className)}>
      {/* Hojas de debajo */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 translate-x-1.5 translate-y-2 rotate-[0.8deg] rounded-2xl border border-border bg-surface shadow-sm" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 translate-x-0.5 translate-y-1 -rotate-[0.4deg] rounded-2xl border border-border bg-surface" />
      <motion.div
        className="lq-tex-paper relative overflow-hidden rounded-2xl border border-border shadow-lg"
        style={{ transformPerspective: 1400, originX: 0 }}
        initial={reduce ? false : { rotateY: -9, opacity: 0.6 }}
        animate={{ rotateY: 0, opacity: 1, transition: { ...springs.heavy, delay: 0.25 } }}
      >
        <span aria-hidden="true" className="lq-tex-margin pointer-events-none absolute inset-y-0 left-6 w-0 md:left-10" />
        {children}
        {/* La tapa se abre hacia la izquierda y deja ver la página de hoy */}
        {!reduce && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 block rounded-2xl bg-jade-800 [background-image:linear-gradient(115deg,rgb(var(--lq-jade-700)/.9),rgb(var(--lq-jade-900)))]"
            style={{ transformPerspective: 1400, originX: 0 }}
            initial={{ rotateY: 0, opacity: 1 }}
            animate={{ rotateY: -105, opacity: 0, transition: { ...springs.heavy, delay: 0.15, opacity: { duration: 0.45, delay: 0.45 } } }}
          />
        )}
      </motion.div>
    </div>
  );
}

/** Sello del día: el ánimo y la fecha dentro de un anillo de tinta, un poco torcido. */
export function DayStamp({ mood, date, animate = false, className }: { mood: number; date: Date; animate?: boolean; className?: string }) {
  const m = moodOf(mood);
  return (
    <motion.span
      aria-hidden="true"
      className={cn('pointer-events-none relative flex size-[4.5rem] shrink-0 flex-col items-center justify-center rounded-full border-2 border-dashed md:size-20', softTone[m.tone], className)}
      initial={animate ? { scale: 2, rotate: -40, opacity: 0 } : false}
      animate={{ scale: 1, rotate: -12, opacity: 0.9 }}
      transition={{ type: 'spring', stiffness: 520, damping: 20, mass: 1.1 }}
    >
      <MoodFace mood={m.n} className="size-6" />
      <span className="font-mono text-label-md tabular-nums">{date.getDate()}/{date.getMonth() + 1}</span>
    </motion.span>
  );
}
