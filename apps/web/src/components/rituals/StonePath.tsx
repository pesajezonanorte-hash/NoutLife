// Camino de piedras de los Rituales: cada paso es una piedra que se enciende.
// Las hechas brillan, la actual respira y al avanzar sale una onda como en el
// agua. Al completar el ritual todas brillan juntas y se expande una onda de
// calma. Decorativo: el progreso real se anuncia con texto.
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';

/** Camino horizontal para el modo guiado. */
export function StonePath({ total, current }: { total: number; current: number }) {
  return (
    <div aria-hidden="true" className="flex w-full items-center gap-1.5 py-2">
      {Array.from({ length: total }, (_, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <span key={i} className="flex flex-1 items-center gap-1.5">
            <span className="relative flex size-4 shrink-0 items-center justify-center">
              {/* Halo de la piedra encendida */}
              <motion.span
                className="absolute -inset-2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-success)/.45),transparent)]"
                initial={false}
                animate={{ opacity: done ? 1 : now ? 0.55 : 0, scale: done ? 1 : 0.7 }}
                transition={springs.gentle}
              />
              <span className={cn('relative block size-4 rounded-[45%_55%_50%_50%] transition-colors duration-700', done ? 'bg-success' : now ? 'bg-primary lq-breath' : 'bg-surface-variant')} />
              {/* Onda al encender la piedra */}
              {done && <span key={`w${i}`} className="lq-ripple absolute inset-0 rounded-full border border-success" />}
            </span>
            {i < total - 1 && <span className={cn('h-px flex-1 border-t border-dashed transition-colors duration-700', done ? 'border-success' : 'border-border-strong/50')} />}
          </span>
        );
      })}
    </div>
  );
}

/** Círculo de respiración: crece al inhalar y se recoge al exhalar (ciclo de 8 s). */
export function BreathCircle({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('relative flex size-24 shrink-0 items-center justify-center', className)}>
      <span className="lq-breath-slow absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(var(--lq-info)/.28),rgb(var(--lq-info)/.06)_70%,transparent)]" />
      <span className="lq-breath-slow absolute inset-5 rounded-full border border-info/40 [animation-delay:-.4s]" />
    </span>
  );
}
