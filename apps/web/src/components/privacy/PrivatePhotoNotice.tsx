import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Visible reminder wherever personal progress or wardrobe photos are uploaded. */
export function PrivatePhotoNotice({ className }: { className?: string }) {
  return (
    <aside
      role="note"
      aria-label="Aviso de privacidad de fotos"
      className={cn('flex items-start gap-3 rounded-2xl border border-info/30 bg-info/[var(--lq-soft-alpha)] p-3 text-info-text', className)}
    >
      <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      <div className="flex flex-col gap-0.5">
        <p className="text-label-md">Tus fotos son privadas</p>
        <p className="text-body-sm text-on-surface-light">Se guardan en tu cuenta y solo tú puedes verlas; no se publican ni se comparten sin tu permiso.</p>
      </div>
    </aside>
  );
}
