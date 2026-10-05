// El escritorio de la Biblioteca: la lámpara de banquero (pantalla de vidrio verde,
// latón y su cadena para encender o apagar), la ficha de lectura con tus cifras
// mecanografiadas y las fichas del catálogo, con su regla roja, el sello del
// estado y la perforación. Lo decorativo es aria-hidden.
import type { HTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';
import { AnimatedValue } from '@/components/ui/lq/StatCard';

/** Lámpara de banquero. `on`: encendida; la cadena es un botón que la enciende o la apaga. */
export function BankerLamp({ on, onToggle, className }: { on: boolean; onToggle: () => void; className?: string }) {
  const reduce = useMotionStore((s) => s.reduce);
  return (
    <div className={cn('relative', className)}>
      <motion.span
        aria-hidden="true"
        className="lq-desk-bulb pointer-events-none absolute left-[18%] right-[18%] top-[2.75rem] block h-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: on ? 1 : 0, transition: { duration: 0.4, delay: on ? 0.95 : 0 } }}
      />
      <svg aria-hidden="true" viewBox="0 0 200 150" className="relative block w-full overflow-visible">
        {/* Base, columna y brazo de latón */}
        <ellipse cx="100" cy="142" rx="46" ry="7" className="lq-brass-fill" />
        <rect x="64" y="132" width="72" height="10" rx="5" className="lq-brass-fill" />
        <rect x="96" y="70" width="8" height="64" rx="3" className="lq-brass-fill" />
        <path d="M100 74H86" className="lq-brass-stroke" strokeWidth="3" strokeLinecap="round" />
        {/* Pantalla de vidrio verde */}
        <path d="M24 64C30 40 58 30 100 30S170 40 176 64Z" className="lq-shade" />
        <path d="M36 52C52 40 76 36 100 36" className="fill-none stroke-white/35" strokeWidth="3" strokeLinecap="round" />
        <path d="M22 64H178" className="lq-brass-stroke" strokeWidth="4" strokeLinecap="round" />
        <motion.ellipse cx="100" cy="66" rx="70" ry="4" className="fill-warning" initial={{ opacity: 0 }} animate={{ opacity: on ? 0.9 : 0, transition: { duration: 0.4, delay: on ? 0.95 : 0 } }} />
      </svg>
      {/* La cadena: tira de ella para encender o apagar */}
      <motion.button
        type="button"
        aria-pressed={on}
        aria-label={on ? 'Apagar la lámpara' : 'Encender la lámpara'}
        onClick={onToggle}
        whileTap={{ y: 7, transition: springs.snappy }}
        className="absolute left-[43%] top-[42%] -ml-[22px] flex h-14 w-11 flex-col items-center rounded-md"
      >
        <span aria-hidden="true" className="lq-chain block h-9 w-[3px]" />
        <span aria-hidden="true" className="lq-brass-dot -mt-px block size-2.5 rounded-full" />
      </motion.button>
    </div>
  );
}

/** Encendido con parpadeo de bombilla (tres destellos lentos, muy por debajo de 3 Hz). */
const flicker = (on: boolean, reduce: boolean, peak = 1) => ({
  opacity: on ? (reduce ? peak : [0, peak * 0.8, peak * 0.35, peak]) : 0,
  transition: on ? { duration: reduce ? 0.3 : 0.9, times: reduce ? undefined : [0, 0.3, 0.5, 1], delay: 0.7 } : { duration: 0.35 },
});

/**
 * La luz de la lámpara sobre el escritorio. Va fuera de la lámpara y encima del
 * escritorio para fundirse con lo que ilumina (mix-blend): el cono aclara el aire,
 * el charco aclara de verdad la madera y la ficha donde cae, y lo que queda fuera
 * del cono se hunde en penumbra. Cubre su contenedor posicionado; la lámpara va
 * arriba a la derecha.
 */
export function DeskLight({ on }: { on: boolean }) {
  const reduce = useMotionStore((s) => s.reduce);
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 block">
      <motion.span className="lq-desk-dusk absolute inset-x-0 bottom-0 top-[7.25rem] block rounded-lg" initial={{ opacity: 0 }} animate={flicker(on, reduce)} />
      <motion.span className="lq-desk-beam absolute right-1 top-[3.55rem] block h-[15rem] w-[17.25rem] max-w-full" initial={{ opacity: 0 }} animate={flicker(on, reduce)}>
        <span className="lq-desk-cone" />
      </motion.span>
      <motion.span className="lq-desk-pool absolute bottom-[9%] left-[16%] right-[2%] block h-[55%]" initial={{ opacity: 0 }} animate={flicker(on, reduce)} />
    </span>
  );
}

/** Ficha de lectura: tus cifras en una tarjeta de cartulina, con puntos guía. */
export function ReadingCard({ rows, className }: { rows: { label: string; value: number }[]; className?: string }) {
  return (
    <section aria-label="Resumen" className={cn('lq-index-card relative px-5 pb-8 pt-6 [--rule-y:3.05rem]', className)}>
      <h2 className="relative mb-3 text-label-lg text-on-background">Ficha de lectura</h2>
      <dl className="relative flex flex-col">
        {rows.map((r) => (
          <div key={r.label} className="lq-lines flex items-baseline gap-2 font-mono text-body-sm text-on-surface [--lq-rule:2rem]">
            <dt className="shrink-0">{r.label}</dt>
            <span aria-hidden="true" className="lq-leader min-w-4 flex-1" />
            <dd className="font-semibold text-on-background"><AnimatedValue value={r.value} /></dd>
          </div>
        ))}
      </dl>
      <span aria-hidden="true" className="lq-punch absolute bottom-2.5 left-1/2 block size-3.5 -translate-x-1/2 rounded-full" />
    </section>
  );
}

/** Ficha del catálogo: cartulina con regla roja, color del formato en el canto y perforación. */
export function CatalogCard({ edge, children, className, ...rest }: { edge: string; children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return (
    <article className={cn('lq-index-card lq-catalog group relative flex h-full flex-col gap-3 px-5 pb-9 pt-6', className)} style={{ ['--edge' as string]: edge }} {...rest}>
      {children}
      <span aria-hidden="true" className="lq-punch absolute bottom-3 left-1/2 block size-3.5 -translate-x-1/2 rounded-full" />
    </article>
  );
}

/** Sello de goma del estado de un ítem en su ficha. */
export function StatusStamp({ label, tone }: { label: string; tone: string }) {
  return <span className={cn('inline-flex -rotate-3 items-center rounded-md border-2 px-2 py-0.5 font-mono text-label-md transition-transform duration-[600ms] ease-[var(--lq-ease-heavy)] group-hover:rotate-0', tone)}>{label}</span>;
}
