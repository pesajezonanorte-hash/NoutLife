import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PrivacyNote({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-start gap-2 text-body-sm text-on-surface-light', className)}>
      <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success-text" strokeWidth={1.75} />
      Tus fotos son estrictamente privadas, se almacenan de forma segura y nadie más tiene acceso a ellas.
    </p>
  );
}
