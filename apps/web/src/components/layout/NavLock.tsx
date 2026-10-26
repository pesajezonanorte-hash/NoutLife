import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/lib/i18n';

/** Candado de zona Pro sobre el ícono de una entrada de navegación (cuenta en Lite). Va dentro de un contenedor posicionado. */
export function NavLock({ className }: { className?: string }) {
  const proZone = useLocale() === 'en' ? 'Pro zone' : 'zona Pro';
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'absolute -right-1.5 -top-1 flex size-4 items-center justify-center rounded-full bg-background text-secondary-text shadow-sm ring-1 ring-secondary/60',
          className,
        )}
      >
        <Lock className="size-2.5" strokeWidth={2.5} />
      </span>
      <span className="sr-only"> ({proZone})</span>
    </>
  );
}
