// La agenda de escritorio: el vade de fieltro verde con esquineros de cuero, la
// hoja de la agenda con su anillado metálico arriba (la hoja se pasa hacia arriba
// sobre las anillas) y las notas adhesivas con su cinta. Lo decorativo es aria-hidden.
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Vade de escritorio: fieltro con esquineros de cuero. */
export function DeskMat({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('lq-mat relative rounded-2xl p-3 md:p-6', className)}>
      {(['left-0 top-0', 'right-0 top-0 rotate-90', 'bottom-0 right-0 rotate-180', 'bottom-0 left-0 -rotate-90'] as const).map((p) => (
        <span key={p} aria-hidden="true" className={cn('lq-mat-corner pointer-events-none absolute block size-10 md:size-14', p)} />
      ))}
      <div className="relative">{children}</div>
    </div>
  );
}

/** Hoja de la agenda con anillas arriba. `rings={false}`: hoja suelta. */
export function PlannerPage({ children, rings = true, className, ...rest }: { children: ReactNode; rings?: boolean; className?: string } & HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('lq-planner-page relative rounded-xl', rings ? 'pt-7 md:pt-8' : '', className)} {...rest}>
      {rings && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 -top-3 flex justify-between md:inset-x-10">
          {Array.from({ length: 11 }, (_, i) => (
            <span key={i} className={cn('relative flex flex-col items-center', i > 6 && 'hidden sm:flex')}>
              <span className="lq-ring block h-6 w-2.5 rounded-full" />
              <span className="lq-ring-hole -mt-2 block size-2 rounded-full" />
            </span>
          ))}
        </span>
      )}
      {children}
    </section>
  );
}

/** Nota adhesiva con su cinta: se endereza un poco al pasar el cursor. */
export function StickyNote({ children, tone = 'warning', tilt = -1.5, className, ...rest }: { children: ReactNode; tone?: 'warning' | 'info' | 'success'; tilt?: number; className?: string } & HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('lq-note relative flex flex-col gap-3 p-5 pt-6', `lq-note-${tone}`, className)} style={{ ['--tilt' as string]: `${tilt}deg` }} {...rest}>
      <span aria-hidden="true" className="lq-tape pointer-events-none absolute -top-2.5 left-1/2 block h-5 w-20 -translate-x-1/2 -rotate-2" />
      {children}
    </section>
  );
}
