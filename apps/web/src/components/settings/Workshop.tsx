// El taller de Ajustes: la pared de tablero perforado con sus herramientas, los
// bancos de trabajo (una sección cada uno, atornillados en las esquinas), el par de
// engranajes que gira cada vez que cambia un valor y el encaje al guardar: los
// tornillos se aprietan y las piezas se asientan en su sitio. Lo decorativo es aria-hidden.
import { useEffect, useRef, type ReactNode } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Cog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';

/** Dos engranajes engranados: giran (en sentidos opuestos) cada vez que `turns` sube. */
export function Gears({ turns, className }: { turns: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('relative block h-14 w-20', className)}>
      <motion.span className="absolute left-0 top-0 block text-secondary-text" animate={{ rotate: turns * 45 }} transition={springs.heavy}>
        <Cog className="size-14" strokeWidth={1.4} />
      </motion.span>
      <motion.span className="absolute bottom-0 right-0 block text-on-surface-light" animate={{ rotate: turns * -67.5 }} transition={springs.heavy}>
        <Cog className="size-9" strokeWidth={1.5} />
      </motion.span>
    </span>
  );
}

function Screw({ turn, className }: { turn: number; className?: string }) {
  return (
    <motion.span aria-hidden="true" className={cn('lq-screw pointer-events-none absolute block size-3 rounded-full', className)} animate={{ rotate: 30 + turn * 90 }} transition={springs.snappy}>
      <span className="absolute inset-x-[2px] top-1/2 block h-px -translate-y-1/2 bg-black/45" />
    </motion.span>
  );
}

/** Banco de trabajo: una sección atornillada. `fit` sube al guardar: los tornillos se aprietan y el contenido encaja. */
export function Workbench({ eyebrow, title, description, aside, fit = 0, children, className }: {
  eyebrow?: string; title: string; description?: string; aside?: ReactNode; fit?: number; children: ReactNode; className?: string;
}) {
  const controls = useAnimationControls();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    void controls.start({ y: [-3, 1.5, 0], scale: [0.992, 1.004, 1], transition: { duration: 0.42, times: [0, 0.55, 1], ease: 'easeOut' } });
  }, [fit, controls]);
  return (
    <section className={cn('lq-bench relative flex flex-col gap-5 rounded-xl p-6 pt-7', className)}>
      <Screw turn={fit} className="left-2.5 top-2.5" />
      <Screw turn={fit} className="right-2.5 top-2.5" />
      <Screw turn={fit} className="bottom-3.5 left-2.5" />
      <Screw turn={fit} className="bottom-3.5 right-2.5" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <span className="text-label-lg text-primary-text">{eyebrow}</span>}
          <h2 className="text-heading-lg">{title}</h2>
          {description && <p className="max-w-2xl text-body-sm text-on-surface-light">{description}</p>}
        </div>
        {aside}
      </div>
      <motion.div animate={controls} className="flex flex-col gap-5">{children}</motion.div>
    </section>
  );
}

/** Herramientas colgadas del tablero perforado (silueta tenue). */
export function HangingTools({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 220 120" className={cn('block', className)}>
      <g className="lq-tool">
        {/* Llave inglesa */}
        <path d="M30 12a10 10 0 0 0-8 15l-2 60a6 6 0 0 0 12 0l-2-60a10 10 0 0 0-8-15l4 8h-6Z" />
        {/* Destornillador */}
        <path d="M78 10h12v34H78ZM81 44h6l-1 50h-4Z" />
        {/* Martillo */}
        <path d="M118 12h40v14h-40ZM134 26h8v72h-8Z" />
        {/* Alicates */}
        <path d="M186 12l8 30-6 52h-6l4-50-6-30ZM202 12l-8 30 6 52h6l-4-50 6-30Z" />
      </g>
      {[30, 84, 138, 194].map((x) => <circle key={x} cx={x} cy={6} r={3} className="lq-peg" />)}
    </svg>
  );
}
