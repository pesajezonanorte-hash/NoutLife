// Piezas de la Posada (Comida) como restaurante de alta gama: vapor que sube de
// un plato recién servido, la campana (cloche) del servicio del chef y los
// platos donde se sirven los macros. Lo decorativo va con aria-hidden; los
// valores siempre están en texto.
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { ProgressRing, type Tone } from '@/components/ui/lq';

/** Tres hilos de vapor que suben y se disipan (CSS, en bucle lento). */
export function Steam({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('pointer-events-none relative inline-flex h-6 w-5 items-end justify-center text-on-surface-light', className)}>
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 8 24" className="lq-steam absolute bottom-0 h-full w-2 overflow-visible" style={{ left: `${2 + i * 6}px`, animationDelay: `${-i * 1.1}s` }}>
          <path d="M4 23C1.6 19.6 6.4 16.4 4 13 1.6 9.6 6.4 6.4 4 3" className="lq-ink" strokeWidth={1.3} />
        </svg>
      ))}
    </span>
  );
}

/** Campana del chef sobre su plato. */
function ClocheArt({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 70" className={cn('overflow-visible', className)}>
      <path d="M14 60C14 34 34 16 60 16s46 18 46 44" className="fill-surface-variant stroke-current" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M30 38c5-8 13-13 22-15" className="lq-ink opacity-50" strokeWidth={2} />
      <circle cx="60" cy="11" r="5" className="fill-surface stroke-current" strokeWidth={2.4} />
      <path d="M8 61h104" className="lq-ink" strokeWidth={3} />
    </svg>
  );
}

function PlateArt({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 16" className={cn('overflow-visible', className)}>
      <ellipse cx="60" cy="8" rx="56" ry="6.5" className="fill-surface stroke-current" strokeWidth={1.8} />
      <ellipse cx="60" cy="7" rx="38" ry="3.6" className="fill-none stroke-current opacity-40" strokeWidth={1.2} />
    </svg>
  );
}

/**
 * Servicio del chef. `cooking`: la campana cubre el plato y sale vapor.
 * `served`: la campana se levanta y el contenido (el plato analizado) queda a la vista.
 */
export function ChefService({ state, children, className }: { state: 'cooking' | 'served'; children?: ReactNode; className?: string }) {
  const reduce = useMotionStore((s) => s.reduce);
  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div className="relative flex min-h-[7.5rem] w-full items-end justify-center">
        {/* Lo que hay bajo la campana */}
        <AnimatePresence>
          {state === 'served' && (
            <motion.div
              key="dish"
              className="relative z-0 mb-3 w-full"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { ...springs.heavy, delay: reduce ? 0 : 0.25 } }}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
        {/* La campana: cubre, humea y se levanta */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
        <AnimatePresence>
          {state === 'cooking' && (
            <motion.div
              key="cloche"
              className="relative w-40 text-on-surface"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0, transition: springs.natural }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.2 } } : { y: -64, x: 34, rotate: 18, opacity: 0, transition: { ...springs.heavy, opacity: { duration: 0.35, delay: 0.25 } } }}
            >
              <motion.div animate={reduce ? undefined : { rotate: [0, -1.2, 0.8, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} style={{ originY: 1 }}>
                <ClocheArt className="w-full" />
              </motion.div>
              <span className="absolute inset-x-0 -top-6 flex justify-center"><Steam /></span>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
      <PlateArt className="w-44 text-border-strong" />
    </div>
  );
}

/** Icono de campana para el botón del servicio (la tapa se levanta al pasar el cursor). */
export function ClocheIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cn('overflow-visible', className)}>
      <g className="transition-transform duration-[560ms] ease-[var(--lq-ease-heavy)] group-hover:-translate-y-[2.5px] group-hover:-rotate-6 [transform-box:fill-box] [transform-origin:20%_100%]">
        <path d="M4 17a8 8 0 0 1 16 0" className="lq-ink" strokeWidth={1.75} />
        <path d="M12 7V5.6" className="lq-ink" strokeWidth={1.75} />
        <circle cx="12" cy="4.6" r="1" className="fill-current" />
      </g>
      <path d="M2.5 19.5h19" className="lq-ink" strokeWidth={1.75} />
    </svg>
  );
}

/** Un plato para un macro: anillo de progreso dentro de su borde de porcelana. */
export function MacroPlate({ label, value, max, tone, size = 92, className }: { label: string; value: number; max: number; tone: Exclude<Tone, 'muted'>; size?: number; className?: string }) {
  const over = value > max;
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const fmt = (n: number) => Math.round(n).toLocaleString('es-CO');
  return (
    <div className={cn('group flex min-w-0 flex-col items-center gap-2 text-center', className)}>
      <span className="rounded-full border border-border bg-surface p-1.5 shadow-sm transition-transform duration-[560ms] ease-[var(--lq-ease-heavy)] group-hover:-translate-y-1 group-hover:shadow-md">
        <ProgressRing value={Math.min(100, pct)} tone={over ? 'error' : tone} size={size} stroke={7} label={label} valueText={`${fmt(value)} de ${fmt(max)} gramos`}>
          <span className={cn('font-mono text-label-lg tabular-nums', over ? 'text-error-text' : 'text-on-background')}>{fmt(value)}<span className="text-on-surface-light"> g</span></span>
        </ProgressRing>
      </span>
      <span className="text-label-lg text-on-background">{label}</span>
      <span className="font-mono text-label-md tabular-nums text-on-surface-light">de {fmt(max)} g</span>
    </div>
  );
}
