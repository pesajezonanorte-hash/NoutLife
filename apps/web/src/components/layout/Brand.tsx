import { cn } from '@/lib/utils';

/**
 * Marca de LifeQuest: el logo "LQ" original (public/brand/lifequest-logo.png).
 * El PNG trae margen alrededor de la baldosa blanca; se amplía dentro de un
 * contenedor redondeado para que la baldosa ocupe todo el tamaño.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('flex size-10 shrink-0 overflow-hidden rounded-xl border border-border bg-white', className)}>
      <img src="/brand/lifequest-logo.png" alt="" aria-hidden width={40} height={40} className="size-full scale-[1.56] object-cover" draggable={false} />
    </span>
  );
}
