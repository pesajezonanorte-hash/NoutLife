import { cn } from '@/lib/utils';

/**
 * Marca de Noutlife (docs/redesign/design-system/logos): la N de hojas.
 * En oscuro se usa la versión -on-dark (degradado más claro). Nunca se
 * recolorea, rota, estira ni lleva sombra o glow. Mínimo 24 px de alto.
 *
 * `tile` la coloca en una baldosa (como el ícono de app) para avatares y
 * cabeceras grandes; sin `tile` es el mark solo.
 */
export function BrandMark({ size = 32, tile, className, alt = '' }: { size?: number; tile?: boolean; className?: string; alt?: string }) {
  const img = (
    <>
      <img src="/brand/noutlife-mark.svg" alt={alt} aria-hidden={!alt || undefined} width={size} height={size}
        className={cn('object-contain dark:hidden', tile ? 'size-[62%]' : 'size-full')} draggable={false} />
      <img src="/brand/noutlife-mark-on-dark.svg" alt="" aria-hidden width={size} height={size}
        className={cn('hidden object-contain dark:block', tile ? 'size-[62%]' : 'size-full')} draggable={false} />
    </>
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
