// La gaceta de la Temporada: una hoja de periódico que se despliega al llegar,
// con su cabecera (fecha, edición y las orejas), titulares que se entintan y el
// sello «Noticia cumplida» que cae sobre un objetivo logrado. Lo decorativo es
// aria-hidden.
import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';

/** La hoja: papel prensa que se despliega desde su doblez. */
export function Sheet({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useMotionStore((s) => s.reduce);
  return (
    <motion.article
      className={cn('lq-newspaper relative rounded-sm px-4 pb-8 pt-6 md:px-10 md:pb-12 md:pt-8', className)}
      style={{ transformPerspective: 1600, originY: 0 }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, rotateX: -38, scaleY: 0.6 }}
      animate={{ opacity: 1, rotateX: 0, scaleY: 1, transition: { ...springs.heavy, opacity: { duration: 0.3 } } }}
    >
      {/* El doblez del medio: una marca tenue que queda en el papel */}
      <span aria-hidden="true" className="lq-fold pointer-events-none absolute inset-x-0 top-1/2 block h-8 -translate-y-1/2" />
      <div className="relative">{children}</div>
    </motion.article>
  );
}

/** Texto que aparece como tinta sobre el papel (de izquierda a derecha). */
export function Ink({ children, delay = 0, d = 700, className, as: Tag = 'span' }: { children: ReactNode; delay?: number; d?: number; className?: string; as?: 'span' | 'h1' | 'h2' | 'h3' | 'p' }) {
  return <Tag className={cn('lq-write lq-ink-text', className)} style={{ '--d': `${d}ms`, '--delay': `${delay}ms` } as CSSProperties}>{children}</Tag>;
}

/** Cabecera: orejas a los lados, la cabecera al centro, la línea de fecha debajo. */
export function Masthead({ title, left, right, dateline }: { title: string; left: ReactNode; right: ReactNode; dateline: ReactNode }) {
  return (
    <header className="flex flex-col gap-3">
      <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="lq-ear order-2 justify-self-start md:order-none">{left}</div>
        <Ink as="span" d={900} delay={350} className="order-1 text-center text-heading-xl font-bold tracking-tight md:order-none md:text-display-sm">{title}</Ink>
        <div className="lq-ear order-3 justify-self-start md:justify-self-end">{right}</div>
      </div>
      <div className="lq-rule-double" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-2 text-label-md text-on-surface">{dateline}</div>
      <div className="lq-rule" aria-hidden="true" />
    </header>
  );
}

/** Sello de goma que cae sobre una noticia lograda. */
export function Stamp({ children, animate = false, className }: { children: ReactNode; animate?: boolean; className?: string }) {
  return (
    <motion.span
      className={cn('lq-news-stamp pointer-events-none inline-flex items-center rounded-md border-[3px] px-2.5 py-1 text-label-lg font-bold', className)}
      initial={animate ? { scale: 1.8, rotate: -24, opacity: 0 } : false}
      animate={{ scale: 1, rotate: -8, opacity: 0.9 }}
      transition={{ type: 'spring', stiffness: 520, damping: 18, mass: 1.1 }}
    >
      {children}
    </motion.span>
  );
}
