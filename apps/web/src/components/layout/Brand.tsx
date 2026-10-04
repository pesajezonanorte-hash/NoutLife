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

/**
 * Lockup horizontal: mark 34 px + «Noutlife» en Montserrat 500, 21 px,
 * tracking −0.012em, color on-background. Mínimo 120 px de ancho.
 * `wordClassName` permite ocultar/animar la palabra (Sidebar plegada).
 */
export function BrandLockup({ markSize = 34, className, wordClassName }: { markSize?: number; className?: string; wordClassName?: string }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <BrandMark size={markSize} />
      <span className={cn('whitespace-nowrap text-[1.3125rem] font-medium leading-none tracking-[-0.012em] text-on-background', wordClassName)}>
        Noutlife
      </span>
    </span>
  );
}
