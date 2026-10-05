// Pinceladas de Mis zonas: un trazo grueso del color de la zona que se pinta
// despacio en el fondo de la tarjeta, y una salpicadura al crear una zona.
// Decorativo (aria-hidden); el color llega por la variable --zone.
import type { CSSProperties } from 'react';
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
