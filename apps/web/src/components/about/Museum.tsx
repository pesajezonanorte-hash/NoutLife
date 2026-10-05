// El museo de Acerca de: salas que se revelan al recorrerlas (el foco se enciende y
// la pieza sube a la pared), marcos, placas, el pedestal de la pieza central y la
// línea del recorrido que se dibuja a medida que avanzas. Lo decorativo es aria-hidden.
import { useRef, type ReactNode } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { expo, springs } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';

/** Foco de galería que se enciende cuando la sala entra en pantalla. */
export function GallerySpot({ className }: { className?: string }) {
  return (
    <motion.span
      aria-hidden="true"
      className={cn('lq-gallery-spot pointer-events-none absolute block', className)}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: [0, 1, 0.55, 1], transition: { duration: 0.9, times: [0, 0.3, 0.5, 1] } }}
      viewport={{ once: true, margin: '-80px' }}
    />
  );
}

/** Una sala del recorrido: número, foco y contenido que sube a la pared al llegar. */
export function Room({ n, label, id, children, className }: { n: number; label: string; id: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('lq-room relative scroll-mt-24', className)} data-room={n}>
      <GallerySpot className="inset-x-0 -top-10 mx-auto h-[30rem] w-[min(46rem,100%)]" />
      {/* Parada del recorrido: se enciende al llegar */}
      <motion.span aria-hidden="true" className="lq-room-dot pointer-events-none absolute -left-[3.15rem] top-1.5 hidden size-4 rounded-full md:block" initial={{ scale: 0.4, opacity: 0.3 }} whileInView={{ scale: 1, opacity: 1, transition: springs.heavy }} viewport={{ once: true, margin: '-45% 0px -45% 0px' }} />
      <motion.div
        className="relative flex flex-col gap-8"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.9, ease: expo }}
      >
        <span className="lq-room-sign self-start px-3 py-1 font-mono text-label-md">Sala {n} <span aria-hidden="true">—</span> {label}</span>
        {children}
      </motion.div>
    </section>
  );
}

/** Marco de cuadro (dorado o madera) con su sombra en la pared. */
export function Frame({ children, kind = 'gold', className }: { children: ReactNode; kind?: 'gold' | 'wood'; className?: string }) {
  return (
    <div className={cn('lq-museum-frame relative p-3 md:p-4', kind === 'gold' ? 'lq-museum-gold' : 'lq-museum-wood', className)}>
      <div className="lq-passepartout relative h-full p-3 md:p-4">
        <div className="relative h-full overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

/** Placa del museo: título y texto de la pieza. */
export function Plaque({ title, children, className, as: Tag = 'h3' }: { title: string; children?: ReactNode; className?: string; as?: 'h2' | 'h3' }) {
  return (
    <div className={cn('lq-plaque flex flex-col gap-1.5 px-4 py-3', className)}>
      <Tag className="text-heading-sm">{title}</Tag>
      {children && <div className="text-body-md text-on-surface">{children}</div>}
    </div>
  );
}

/** Pedestal de mármol de la pieza central. */
export function Pedestal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div className="relative">{children}</div>
      <span aria-hidden="true" className="lq-marble lq-pedestal-top mt-3 block h-3 w-44 rounded-sm md:w-52" />
      <span aria-hidden="true" className="lq-marble lq-pedestal block h-24 w-36 md:h-28 md:w-44" />
      <span aria-hidden="true" className="lq-marble lq-pedestal-top block h-3 w-44 rounded-sm md:w-52" />
    </div>
  );
}

/** La línea del recorrido: se dibuja con el scroll de la página a lo largo de las salas. */
export function TourLine({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useMotionStore((s) => s.reduce);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 70%'] });
  const drawn = useSpring(scrollYProgress, { ...springs.gentle, restDelta: 0.001 });
  const scaleY = useTransform(drawn, [0, 1], [0, 1]);
  return (
    <div ref={ref} className={cn('relative', className)}>
      <span aria-hidden="true" className="lq-tour-track pointer-events-none absolute bottom-0 left-3 top-0 hidden w-[3px] rounded-full md:block" />
      <motion.span aria-hidden="true" className="lq-tour-line pointer-events-none absolute bottom-0 left-3 top-0 hidden w-[3px] origin-top rounded-full md:block" style={{ scaleY: reduce ? 1 : scaleY }} />
      <div className="relative flex flex-col gap-24 md:pl-14 md:gap-32">{children}</div>
    </div>
  );
}
