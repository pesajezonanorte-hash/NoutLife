// El diario de cuero: al llegar el elástico se suelta, la tapa gira sobre el lomo
// y se hojean dos páginas hasta hoy; queda abierto a doble página (una sola en
// pantallas angostas) con costura en el lomo, curvatura del papel, el canto de
// las hojas ya escritas y una cinta marcapáginas. Las entradas anteriores son
// hojas rayadas con el sello de ánimo en el margen y la esquina doblada.
// Lo decorativo es aria-hidden; la tapa y las hojas que se pasan solo existen
// durante la apertura. Con «Reducir movimiento» el diario ya está abierto.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/** Curva de una hoja que se pasa: despega despacio, cruza rápido y se posa. */
const TURN = [0.45, 0.05, 0.25, 1] as const;

/** Canto de las hojas: capas de papel desplazadas (box-shadow), más gruesas cuantas más páginas. */
function edges(layers: number, side: 'left' | 'right' | 'bottom') {
  return Array.from({ length: layers }, (_, i) => {
    const d = i * 2 + 1;
    const [x1, y1, x2, y2] = side === 'left' ? [-d, i * 0.4, -d - 1, i * 0.4] : side === 'right' ? [d, i * 0.4, d + 1, i * 0.4] : [0, d, 0, d + 1];
    return `${x1}px ${y1}px 0 rgb(var(--lq-surface)), ${x2}px ${y2}px 0 rgb(var(--lq-border-strong) / .35)`;
  }).join(', ');
}

/** Tapa que se abre (con su elástico) y dos hojas que se pasan hasta la página de hoy. */
function OpeningCover({ spread, onDone }: { spread: boolean; onDone: () => void }) {
  const year = new Date().getFullYear();
  return (
    <>
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className={cn('lq-diary-paper lq-diary-paper-r pointer-events-none absolute block', spread ? 'inset-y-0 left-1/2 right-0 rounded-r-xl' : 'inset-0 rounded-xl')}
          style={{ originX: 0 }}
          initial={{ rotateY: 0, opacity: 1 }}
          animate={{
            rotateY: spread ? -180 : -170,
            opacity: [1, 1, 0],
            transition: { rotateY: { duration: 0.8, ease: TURN, delay: 0.8 + i * 0.13 }, opacity: { duration: 0.98, times: [0, 0.8, 1], delay: 0.8 + i * 0.13 } },
          }}
        />
      ))}
      {/* El fundido va en un envoltorio: opacidad < 1 sobre el elemento 3D lo aplanaría
          y la tapa se vería al revés en vez de mostrar su dorso. */}
      <motion.div
        aria-hidden="true"
        className={cn('pointer-events-none absolute', spread ? '-bottom-2.5 -right-2.5 -top-2.5 left-1/2' : '-inset-2.5')}
        initial={{ opacity: 1 }}
        animate={{ opacity: [1, 1, 0], transition: { duration: 1.3, times: [0, 0.82, 1], delay: 0.55 } }}
        onAnimationComplete={onDone}
      >
      <motion.div
        className="absolute inset-0 [transform-style:preserve-3d]"
        style={{ originX: 0, transformPerspective: 2400 }}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: spread ? -180 : -170, transition: { duration: 1.05, ease: TURN, delay: 0.55 } }}
      >
        {/* Tapa de cuero con marco repujado y letras de pan de oro */}
        <span className="lq-diary-cover absolute inset-0 flex flex-col items-center justify-start gap-3 overflow-hidden rounded-l-md rounded-r-[1.25rem] pt-28 [backface-visibility:hidden] lg:justify-center lg:pt-0">
          <span className="lq-foil text-display-sm md:text-display-md">Diario</span>
          <span className="lq-foil font-mono text-label-lg">{year}</span>
          {/* El elástico se suelta antes de abrir */}
          <motion.span
            className="lq-diary-band absolute inset-y-0 right-7 block w-3"
            initial={{ x: 0, opacity: 1 }}
            animate={{ x: 26, opacity: 0, transition: { duration: 0.32, delay: 0.22, ease: [0.4, 0, 1, 1] } }}
          />
        </span>
        {/* Dorso: el interior de la tapa, cuero con su guarda de papel */}
        <span className="lq-diary-case absolute inset-0 rounded-l-[1.25rem] rounded-r-md [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <span className="lq-diary-paper lq-diary-paper-l absolute bottom-2.5 left-2.5 right-0 top-2.5 rounded-l-xl" />
        </span>
      </motion.div>
      </motion.div>
    </>
  );
}

/** Cinta marcapáginas: cae sobre la página de hoy y su punta cuelga bajo el diario y se mece. */
function Ribbon({ delay, spread }: { delay: number; spread: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      className={cn('pointer-events-none absolute -top-3 bottom-0 block w-3 origin-top', spread ? 'left-[calc(50%+1.25rem)]' : 'right-2')}
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1, transition: { ...springs.heavy, delay } }}
    >
      <span className="lq-ribbon absolute inset-x-0 -bottom-2.5 top-0 block" />
      <span className="lq-amb-sway absolute inset-x-0 top-[calc(100%+0.5rem)] block h-10 [--d:5.5s] [--o:50%_0%] [--r:3deg]">
        <span className="lq-ribbon lq-ribbon-tail block size-full" />
      </span>
    </motion.span>
  );
}

/**
 * El diario abierto. `left`: la página de la izquierda (arriba en pantallas
 * angostas); `right`: la de la derecha. `pages` engrosa el canto de las hojas.
 */
export function DiaryBook({ left, right, pages = 0, className }: { left: ReactNode; right: ReactNode; pages?: number; className?: string }) {
  const reduce = useMotionStore((s) => s.reduce);
  const spread = useMediaQuery('(min-width: 1024px)');
  const [opening, setOpening] = useState(!reduce);
  const leftLayers = Math.min(6, 1 + Math.ceil(pages / 3));
  return (
    <div className={cn('lq-diary relative', className)}>
      <motion.div
        className="relative grid lg:grid-cols-2"
        style={{ perspective: 2400 }}
        initial={opening && spread ? { x: '-25%' } : false}
        animate={{ x: 0, transition: { ...springs.gentle, delay: 0.5 } }}
      >
        {/* En una sola columna, el cuero es una pieza que abraza toda la página */}
        <span aria-hidden="true" className="lq-diary-case pointer-events-none absolute -inset-2.5 rounded-[1.25rem] lg:hidden" />
        {/* Página izquierda: aparece cuando la tapa se posa sobre ella */}
        <motion.div
          className="relative"
          initial={opening && spread ? { opacity: 0 } : false}
          animate={{ opacity: 1, transition: { delay: 1.05, duration: 0.3 } }}
        >
          <span aria-hidden="true" className="lq-diary-case pointer-events-none absolute -bottom-2.5 -left-2.5 -top-2.5 right-0 hidden rounded-l-[1.25rem] lg:block" />
          <div
            className="lq-diary-paper lq-diary-paper-l relative h-full rounded-t-xl lg:rounded-l-xl lg:rounded-tr-none"
            style={{ boxShadow: spread ? edges(leftLayers, 'left') : undefined } as CSSProperties}
          >
            {left}
          </div>
        </motion.div>
        <div className="relative">
          <span aria-hidden="true" className="lq-diary-case pointer-events-none absolute -bottom-2.5 -right-2.5 -top-2.5 left-0 hidden rounded-r-[1.25rem] lg:block" />
          <div
            className="lq-diary-paper lq-diary-paper-r relative h-full rounded-b-xl lg:rounded-bl-none lg:rounded-r-xl"
            style={{ boxShadow: edges(4, spread ? 'right' : 'bottom') } as CSSProperties}
          >
            {right}
          </div>
        </div>
        {/* El lomo: sombra de la curvatura y la costura */}
        <span aria-hidden="true" className="lq-diary-gutter pointer-events-none hidden lg:block" />
        <Ribbon spread={spread} delay={reduce ? 0 : opening ? 1.6 : 0.3} />
        {opening && <OpeningCover spread={spread} onDone={() => setOpening(false)} />}
      </motion.div>
    </div>
  );
}

/** Hoja de una entrada anterior: papel con margen, el sello de ánimo en él y la esquina doblada. */
export function DiaryLeaf({ stamp, children, aside, className }: { stamp: ReactNode; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <article className={cn('lq-leaf grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-x-4 py-5 pl-2.5 pr-4 md:grid-cols-[4rem_minmax(0,1fr)_auto] md:gap-x-6 md:py-6 md:pl-4 md:pr-5', className)}>
      <span aria-hidden="true" className="lq-tex-margin pointer-events-none absolute inset-y-0 left-[3.95rem] w-0 md:left-[5.25rem]" />
      <span className="flex justify-center pt-0.5">{stamp}</span>
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
      {aside}
      <span aria-hidden="true" className="lq-dogear" />
    </article>
  );
}
