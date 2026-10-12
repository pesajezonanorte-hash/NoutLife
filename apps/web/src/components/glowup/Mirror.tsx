// El tocador de Glow up: un espejo de camerino con bombillas alrededor del marco.
// Al llegar se encienden una a una; cuántas quedan encendidas es tu brillo de hoy
// (cada paso que completas enciende otra con un pequeño destello). El vidrio está
// empañado y se aclara a medida que avanzas, con un reflejo que se desliza muy
// despacio. Debajo, la repisa de mármol con sus frascos. Lo decorativo es aria-hidden.
import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';

/** Posición de cada bombilla en el marco (% del ancho y alto): arriba y a los lados. */
const BULBS: [number, number][] = [
  [10, 0], [30, 0], [50, 0], [70, 0], [90, 0],
  [100, 22], [100, 50], [100, 78],
  [0, 78], [0, 50], [0, 22],
];
/** Orden de encendido: de arriba a la izquierda y alrededor. */
const ORDER = [10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function Mirror({ brightness, children, className }: { brightness: number; children: ReactNode; className?: string }) {
  const reduce = useMotionStore((s) => s.reduce);
  const b = Math.max(0, Math.min(100, brightness)) / 100;
  const lit = Math.round(b * BULBS.length);
  // Al llegar se encienden en cadena; después, cada paso enciende la suya al momento.
  const [entered, setEntered] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setEntered(true), 1600); return () => window.clearTimeout(t); }, []);
  return (
    <div className={cn('relative flex shrink-0 flex-col items-center', className)}>
      {/* Resplandor del tocador: más brillo, más luz */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-y-12 inset-x-0 block rounded-full sm:-inset-12 bg-[radial-gradient(closest-side,rgb(var(--lq-warning)/.32),transparent)]"
        initial={{ opacity: 0.1 }}
        animate={{ opacity: 0.15 + b * 0.75, transition: { ...springs.gentle, mass: 3 } }}
      />
      <div className="lq-vanity-frame relative w-full rounded-[1.75rem] p-6">
        {/* Bombillas del marco */}
        {BULBS.map(([x, y], i) => {
          const on = ORDER.indexOf(i) < lit;
          return (
            <motion.span
              key={i}
              aria-hidden="true"
              className={cn('lq-bulb absolute z-10 -ml-[11px] -mt-[11px] block size-[22px] rounded-full', on && 'lq-bulb-on')}
              style={{ left: `calc(${x}% + ${x === 0 ? 12 : x === 100 ? -12 : 0}px)`, top: `calc(${y}% + ${y === 0 ? 12 : 0}px)` }}
              initial={{ opacity: 0.35, scale: 0.85 }}
              animate={{ opacity: on ? 1 : 0.55, scale: on ? [0.85, 1.25, 1] : 0.92, transition: { duration: on ? 0.55 : 0.3, delay: reduce || entered ? 0 : 0.45 + ORDER.indexOf(i) * 0.07 } }}
            />
          );
        })}
        {/* El vidrio */}
        <div className="lq-vanity-glass relative flex min-h-[12rem] items-center justify-center overflow-hidden rounded-[1.1rem] px-6 py-8 md:min-h-[14rem]">
          <span aria-hidden="true" className="lq-mirror-glint pointer-events-none absolute -inset-y-6 left-0 block w-1/3 bg-[linear-gradient(100deg,transparent,rgb(255_255_255/.5),transparent)] dark:bg-[linear-gradient(100deg,transparent,rgb(var(--lq-jade-50)/.08),transparent)]" />
          {/* Vaho sobre el vidrio (detrás de lo escrito): se disipa al llegar y lo que queda se aclara con tu brillo */}
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 block bg-surface/70 backdrop-blur-md"
            initial={{ opacity: reduce ? 0.55 * (1 - b) : 1 }}
            animate={{ opacity: 0.5 * (1 - b), transition: { duration: 1.8, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] } }}
          />

          <div className="relative">{children}</div>
        </div>
      </div>
      {/* La repisa de mármol con sus frascos */}
      <div aria-hidden="true" className="relative -mt-1 flex w-[calc(100%+1rem)] items-end justify-between px-6 sm:w-[108%]">
        <span className="absolute inset-x-0 bottom-0 block h-3.5 rounded-md lq-marble lq-ledge" />
        <svg viewBox="0 0 40 52" className="relative mb-3 block h-11 w-9">
          <rect x="14" y="2" width="12" height="9" rx="2" className="fill-secondary" />
          <path d="M8 16c0-3 2-5 5-5h14c3 0 5 2 5 5v30c0 3-2 5-5 5H13c-3 0-5-2-5-5Z" className="fill-jade-200/80 dark:fill-jade-700/80" />
          <path d="M12 20v20" className="stroke-white/60" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="relative mb-3 flex items-end gap-2">
          <svg viewBox="0 0 22 44" className="block h-10 w-5"><rect x="5" y="16" width="12" height="28" rx="2" className="fill-error-text/80" /><path d="M7 16V6l8-4v14Z" className="fill-error" /></svg>
          <svg viewBox="0 0 36 30" className="block h-7 w-9"><ellipse cx="18" cy="24" rx="16" ry="5" className="fill-secondary-text/70" /><rect x="3" y="10" width="30" height="14" rx="4" className="fill-secondary/80" /></svg>
        </span>
      </div>
    </div>
  );
}
