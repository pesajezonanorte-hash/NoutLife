// El taller de Mis zonas: el caballete con su lienzo (donde El Sabio pinta la
// propuesta), cada zona como un cuadro enmarcado colgado de un clavo, el trazo
// grueso del color de la zona que se pinta despacio y la salpicadura al crearla.
// Decorativo (aria-hidden); el color llega por la variable --zone.
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { InkPath } from '@/components/ambience';

const STROKES = [
  'M-10 120C40 70 90 140 150 96S260 60 330 104',
  'M-6 40C60 90 120 20 190 64S290 120 340 70',
  'M0 150C70 120 110 160 170 128S280 90 340 140',
];

export function BrushStroke({ seed = 0, delay = 0.3, className }: { seed?: number; delay?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 320 170" preserveAspectRatio="none" className={cn('pointer-events-none absolute inset-0 -z-10 size-full overflow-visible text-[color:var(--zone)] opacity-[.16] dark:opacity-[.2]', className)}>
      <InkPath d={STROKES[seed % STROKES.length]} delay={delay} duration={1.8} strokeWidth={30} />
      <InkPath d={STROKES[(seed + 1) % STROKES.length]} delay={delay + 0.5} duration={1.6} strokeWidth={9} className="opacity-60" />
    </svg>
  );
}

const DROPS = Array.from({ length: 9 }, (_, i) => {
  const a = (i / 9) * Math.PI * 2 + 0.4;
  const r = 40 + (i % 3) * 18;
  return { tx: `${Math.cos(a) * r}px`, ty: `${Math.sin(a) * r}px`, s: 6 + (i % 3) * 3 };
});

/** Salpicadura de pintura del color de la zona (una vez). */
export function PaintSplash({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn('pointer-events-none absolute left-10 top-10 z-10 block', className)}>
      {DROPS.map((d, i) => (
        <span key={i} className="lq-burst absolute block rounded-[55%_45%_60%_40%] bg-[var(--zone)]" style={{ width: d.s, height: d.s, '--tx': d.tx, '--ty': d.ty, '--delay': `${0.15 + (i % 4) * 0.04}s` } as CSSProperties} />
      ))}
    </span>
  );
}

/** Caballete de madera: mástil, patas y la repisa donde se apoya el lienzo. */
export function Easel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative pb-14 pt-8', className)}>
      <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[4%] bottom-0 top-0 block h-full w-[92%]">
        <path d="M50 0V100M50 4L8 100M50 4L92 100" className="lq-easel-leg" strokeWidth="2.2" vectorEffect="non-scaling-stroke" fill="none" strokeLinecap="round" />
      </svg>
      <div className="relative">{children}</div>
      {/* La repisa del caballete */}
      <span aria-hidden="true" className="lq-wood pointer-events-none absolute inset-x-[2%] bottom-10 block h-4 rounded-[3px] shadow-md" />
    </div>
  );
}

/** Cuadro colgado: marco dorado, cordel y clavo; se mece con peso al pasar el cursor. */
export function HungFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('lq-hang group/frame relative pt-9', className)}>
      <svg aria-hidden="true" viewBox="0 0 100 40" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 block h-10 w-full">
        <path d="M22 40L50 6L78 40" className="lq-cord" fill="none" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      </svg>
      <span aria-hidden="true" className="lq-nail pointer-events-none absolute left-1/2 top-0.5 block size-3 -translate-x-1/2 rounded-full" />
      <div className="lq-frame rounded-md p-2.5">{children}</div>
    </div>
  );
}
