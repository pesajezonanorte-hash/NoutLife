import { useId } from 'react';
import { cn } from '@/lib/utils';
import { isHalloween } from '@/lib/season';

/** Las tres hojas de la N (misma geometría que /brand/noutlife-mark.svg y el splash de index.html). */
const LEAVES = [
  { key: 'c', d: 'M474 198C581.2 230.2 670.1 305.6 669.0 500.0L669 760C669 776 666 783 662 785L500 600L474 489Z', line: [520, 210, 669, 780], stops: [[0, 'c0'], [0.45, 'c1'], [1, 'c2']] },
  { key: 'a', d: 'M1 0C124.1 148.2 331.6 191.3 474.0 489.0L662 785C314.2 532.2 633.0 710.9 118.0 399.0C-22.3 290.2 2.6 200.5 0.0 150.0L0 4Z', line: [60, 40, 650, 770], stops: [[0, 'a0'], [0.35, 'a1'], [0.72, 'a2'], [1, 'a3']] },
  { key: 'b', d: 'M2 271C93.4 468.0 228.1 416.0 251.0 545.0L251 743C76.1 695.7 -13.2 587.2 0.0 380.0L0 275Z', line: [30, 290, 250, 740], stops: [[0, 'b0'], [1, 'b1']] },
] as const;

/** Sombrero de bruja (Halloween): copa con la punta doblada y cinta; el ala es una elipse. */
const HAT = [
  'M-120 -6C-94 -96 -60 -196 -18 -270C4 -310 50 -336 112 -318C62 -306 34 -286 24 -250C50 -170 88 -92 120 -6Z',
  'M-113 -30C-40 -8 40 -8 113 -30L104 -68C36 -48 -36 -48 -102 -68Z',
] as const;

/**
 * Marca de Noutlife (docs/redesign/design-system/logos): la N de hojas.
 * Sus degradados salen de --lq-brand-* (tokens.css): jade en Aurora (más claro
 * en oscuro) y la escala de color de cada tema de la Tienda (skins.css), así el
 * logo nunca desentona con el tema puesto. No se rota, estira ni lleva sombra o
 * glow. Mínimo 24 px de alto.
 *
 * `tile` la coloca en una baldosa (como el ícono de app) para avatares y
 * cabeceras grandes; sin `tile` es el mark solo.
 */
export function BrandMark({ size = 32, tile, className, alt = '' }: { size?: number; tile?: boolean; className?: string; alt?: string }) {
  // Ids únicos por instancia: varias marcas en pantalla no comparten degradado.
  const uid = useId().replace(/:/g, '');
  // En baldosa el sombrero quedaría recortado.
  const hat = !tile && isHalloween();
  const img = (
    <svg viewBox="0 0 670 786" width={size} height={size} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={!alt || undefined}
      className={tile ? 'size-[62%]' : 'size-full'} overflow={hat ? 'visible' : undefined}>
      <defs>
        {LEAVES.map(({ key, line: [x1, y1, x2, y2], stops }) => (
          <linearGradient key={key} id={`${uid}${key}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
            {stops.map(([offset, v]) => <stop key={v} offset={offset} style={{ stopColor: `var(--lq-brand-${v})` }} />)}
          </linearGradient>
        ))}
      </defs>
      {LEAVES.map(({ key, d }) => <path key={key} fill={`url(#${uid}${key})`} d={d} />)}
      {/* Halloween: sombrero de bruja que cae sobre la punta alta de la N y asoma por encima (lib/season,
          misma geometría que el splash de index.html; colores en styles/halloween.css). */}
      {hat && (
        <g transform="translate(60 30) rotate(-16) scale(.72)">
          <linearGradient id={`${uid}hat`} gradientUnits="userSpaceOnUse" x1={0} y1={-330} x2={0} y2={40}>
            <stop offset={0} style={{ stopColor: 'var(--lq-hat-0)' }} />
            <stop offset={1} style={{ stopColor: 'var(--lq-hat-1)' }} />
          </linearGradient>
          <g className="lq-hat-drop">
            <path fill={`url(#${uid}hat)`} d={HAT[0]} />
            <path d={HAT[1]} style={{ fill: 'rgb(var(--lq-primary))' }} />
            <ellipse fill={`url(#${uid}hat)`} cx={0} cy={0} rx={222} ry={42} />
          </g>
        </g>
      )}
    </svg>
  );
  if (tile) {
    return (
      <span className={cn('flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface', className)}>
        {img}
      </span>
    );
  }
  return <span className={cn('flex shrink-0', className)} style={{ width: size, height: size }}>{img}</span>;
}

/** Trazos del wordmark «noutlife» (monolínea, remates redondos; n de pierna inclinada,
 *  t con barra a la derecha, i con punto redondo, e de barra diagonal). Misma
 *  geometría que el splash de index.html. Caja: −10 −10 486 120. */
export const WORDMARK_PATHS = [
  'M4 100 L16 52 A22.5 22.5 0 0 1 59 58.5 V100',
  'M110 43.5a24.5 24.5 0 1 1 0 49a24.5 24.5 0 1 1 0-49',
  'M163.5 36v41.5a22.5 22.5 0 0 0 45 0V36M208.5 36v64',
  'M240 12v68a20 20 0 0 0 20 20M240 40h26',
  'M290 0v100',
  'M322 52v48',
  'M356 100V30a22 22 0 0 1 22-22h4M342 46h34',
  'M406 78 L449 56 A24.5 24.5 0 1 0 448.3 84.7',
] as const;

/** Wordmark «noutlife» en el color del texto (currentColor). `height` en px. */
export function Wordmark({ height = 22, className }: { height?: number; className?: string }) {
  return (
    <svg viewBox="-10 -10 486 120" height={height} width={(height * 486) / 120} fill="none" stroke="currentColor"
      strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Noutlife" className={cn('shrink-0', className)}>
      {WORDMARK_PATHS.map((d) => <path key={d} d={d} />)}
      <circle cx={322} cy={22} r={9} fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Lockup horizontal: mark 34 px + wordmark «noutlife» en on-background.
 * Mínimo 120 px de ancho. `wordClassName` permite ocultar/animar la palabra (Sidebar plegada).
 */
export function BrandLockup({ markSize = 34, className, wordClassName }: { markSize?: number; className?: string; wordClassName?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandMark size={markSize} />
      <span className={cn('flex whitespace-nowrap text-on-background', wordClassName)}>
        <Wordmark height={Math.round(markSize * 0.66)} />
      </span>
    </span>
  );
}
