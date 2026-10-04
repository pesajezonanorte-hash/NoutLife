import { cn } from '@/lib/utils';

/**
 * Marca de Noutlife: la N de hojas (public/brand/noutlife-mark*.svg) dentro de
 * la misma baldosa redondeada que usaba el logo anterior. En oscuro se usa la
 * versión -on-dark (degradado más claro) para mantener el contraste.
 */
export function BrandMark({ className, alt = '' }: { className?: string; alt?: string }) {
  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface', className)}>
      <img src="/brand/noutlife-mark.svg" alt={alt} aria-hidden={!alt || undefined} width={40} height={40} className="size-[62%] object-contain dark:hidden" draggable={false} />
      <img src="/brand/noutlife-mark-on-dark.svg" alt="" aria-hidden width={40} height={40} className="hidden size-[62%] object-contain dark:block" draggable={false} />
    </span>
  );
}
