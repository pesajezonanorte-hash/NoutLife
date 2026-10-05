// El santuario de Sabiduría: el principio del día tallado en una estela de piedra
// entre dos columnas, cada una con su antorcha de llama viva. Los demás principios
// son placas de piedra; los que aún no se desbloquean siguen cubiertos de polvo.
// Lo decorativo es aria-hidden.
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Llama de antorcha: oscila despacio (≈1 vez por segundo) con su halo. */
export function TorchFlame({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('pointer-events-none relative block h-12 w-8', className)}>
      {/* Resplandor: núcleo casi blanco, halo cálido largo; oscila con la llama */}
      <span className="lq-candle lq-torch-glow absolute -inset-x-14 -inset-y-12 block rounded-full" />
      <svg viewBox="0 0 32 48" className="lq-flame absolute inset-0 block size-full overflow-visible">
        <path d="M16 2C22 14 28 20 28 31a12 12 0 0 1-24 0C4 20 10 14 16 2Z" className="fill-warning" />
        <path d="M16 16c3 7 6 10 6 16a6 6 0 0 1-12 0c0-6 3-9 6-16Z" className="fill-secondary" />
        <path d="M16 27c1.5 3 3 4.5 3 7a3 3 0 0 1-6 0c0-2.5 1.5-4 3-7Z" className="fill-white/80" />
      </svg>
    </span>
  );
}

/** Columna de piedra: capitel, fuste estriado, basa y una antorcha en su soporte. */
export function Column({ side, className }: { side: 'left' | 'right'; className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none relative flex w-16 shrink-0 flex-col items-center', className)}>
      <span className="lq-capital block h-8 w-full rounded-t-[3px]" />
      <span className="lq-abacus block h-2 w-[86%]" />
      <span className="lq-shaft relative block w-11 flex-1">
        {/* Soporte de la antorcha */}
        <span className={cn('absolute top-[16%] flex flex-col items-center', side === 'left' ? '-right-4' : '-left-4')}>
          <TorchFlame className="-mb-1" />
          <span className="lq-torch-cup block h-4 w-6 rounded-b-full" />
          <span className="lq-torch-arm block h-5 w-1.5" />
        </span>
      </span>
      <span className="lq-col-base block h-3 w-[86%]" />
      <span className="lq-col-base block h-4 w-full rounded-b-[3px]" />
    </div>
  );
}

/** Estela de piedra: bordes desgastados, un marco grabado y el texto tallado. */
export function StoneTablet({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('lq-stone lq-tablet relative', className)} {...rest}>
      <span aria-hidden="true" className="lq-tablet-frame pointer-events-none absolute inset-3 block rounded-[10px] md:inset-4" />
      {/* La luz de las antorchas lame los cantos de la piedra (solo con columnas, md+) */}
      <span aria-hidden="true" className="lq-torchlit pointer-events-none absolute inset-0 hidden rounded-[inherit] md:block" />
      <div className="relative">{children}</div>
    </section>
  );
}
