// La agenda de escritorio, con el mismo lenguaje que la libreta de Hábitos: el
// vade de fieltro verde con esquineros de cuero; la hoja de la agenda se posa
// sobre el vade, sus anillas se cierran una a una, los garabatos del margen se
// dibujan despacio y el papel «respira» con una luz que deriva muy lenta. Las
// notas adhesivas caen torcidas con su cinta y se enderezan al pasar el cursor.
// Lo decorativo es aria-hidden y vive en <ZoneAmbience> (en pausa fuera de pantalla).
import type { ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { InkPath, ZoneAmbience } from '@/components/ambience';

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

/** Garabatos de la hoja, en sus esquinas libres: una estrella junto a las anillas y una flecha abajo. */
const DOODLES = [
  { d: 'M12 2.5l2.6 6.1 6.6.5-5 4.3 1.6 6.5L12 16.4 6.2 19.9l1.6-6.5-5-4.3 6.6-.5z', box: '0 0 24 24', cls: 'left-2.5 top-2 hidden size-5 md:block', r: '4deg', d0: 1.2 },
  { d: 'M3 15.5c4.6-.9 9.1-3.6 12.8-7.7M12.4 6.8l3.9.6-.4 4', box: '0 0 20 20', cls: 'bottom-1 right-3 size-5 md:right-4 md:size-6', r: '3deg', d0: 1.5 },
] as const;

type SectionProps = Omit<HTMLMotionProps<'section'>, 'children' | 'className'>;

/**
 * Hoja de la agenda con anillas arriba. `rings={false}`: hoja suelta. Las clases
 * de diseño (flex, gap, padding) van al contenido, que se pinta sobre el ambiente.
 */
export function PlannerPage({ children, rings = true, doodles = true, className, ...rest }: {
  children: ReactNode; rings?: boolean; doodles?: boolean; className?: string;
} & SectionProps) {
  return (
    <motion.section
      className={cn('lq-planner-page relative rounded-xl', rings && 'pt-7 md:pt-8')}
      initial={{ y: 14, rotate: -0.35 }}
      animate={{ y: 0, rotate: 0, transition: springs.heavy }}
      {...rest}
    >
      <ZoneAmbience zone="agenda-sheet" scope="local">
        {/* El papel respira: una luz suave que deriva despacio sobre la hoja */}
        <span className="lq-amb-wander absolute -left-1/4 -top-1/3 block h-[120%] w-[120%] [--d:32s]">
          <span className="lq-amb-breathe block size-full bg-[radial-gradient(40%_35%_at_40%_35%,rgb(255_255_255/.5),transparent_70%)] [--d:12s] [--hi:.95] [--lo:.5] dark:bg-[radial-gradient(40%_35%_at_40%_35%,rgb(var(--lq-jade-50)/.035),transparent_70%)]" />
        </span>
        {doodles && DOODLES.map((g) => (
          <svg key={g.cls} viewBox={g.box} className={cn('lq-amb-sway absolute overflow-visible text-on-surface-light opacity-[.16] dark:opacity-[.22]', g.cls)} style={{ ['--r' as string]: g.r, ['--d' as string]: '11s', ['--o' as string]: '50% 50%' }}>
            <InkPath d={g.d} delay={g.d0} duration={1.1} strokeWidth={1.4} />
          </svg>
        ))}
      </ZoneAmbience>
      {rings && (
        // Las anillas se cierran una a una sobre la hoja que acaba de posarse.
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 -top-3 flex justify-between md:inset-x-10">
          {Array.from({ length: 11 }, (_, i) => (
            <motion.span
              key={i}
              className={cn('relative flex flex-col items-center', i > 6 && 'hidden sm:flex')}
              initial={{ scaleY: 0.2, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1, transition: { ...springs.snappy, delay: 0.2 + i * 0.035, opacity: { duration: 0.12, delay: 0.2 + i * 0.035 } } }}
              style={{ originY: 1 }}
            >
              <span className="lq-ring block h-6 w-2.5 rounded-full" />
              <span className="lq-ring-hole -mt-2 block size-2 rounded-full" />
            </motion.span>
          ))}
        </span>
      )}
      <div className={cn('relative', className)}>{children}</div>
    </motion.section>
  );
}

/** Nota adhesiva con su cinta: cae torcida, se asienta y se endereza al pasar el cursor. */
export function StickyNote({ children, tone = 'warning', tilt = -1.5, delay = 0, className, ...rest }: {
  children: ReactNode; tone?: 'warning' | 'info' | 'success'; tilt?: number; delay?: number; className?: string;
} & SectionProps) {
  return (
    <motion.section
      className={cn('lq-note relative flex flex-col gap-3 p-5 pt-6', `lq-note-${tone}`, className)}
      initial={{ opacity: 0, y: -18, rotate: tilt * 2.5 }}
      animate={{ opacity: 1, y: 0, rotate: tilt, transition: { ...springs.heavy, delay, opacity: { duration: 0.2, delay } } }}
      whileHover={{ rotate: 0, y: -3, transition: springs.natural }}
      {...rest}
    >
      <span aria-hidden="true" className="lq-tape pointer-events-none absolute -top-2.5 left-1/2 block h-5 w-20 -translate-x-1/2 -rotate-2" />
      {children}
    </motion.section>
  );
}
