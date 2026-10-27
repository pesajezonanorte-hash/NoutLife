import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useText, type Copy } from '@/lib/i18n';

const es = {
  label: 'Aviso de privacidad de fotos',
  title: 'Privacidad garantizada',
  body: 'Tus fotos son estrictamente privadas, se almacenan de forma segura y nadie más tiene acceso a ellas.',
};

const en: typeof es = {
  label: 'Photo privacy notice',
  title: 'Privacy guaranteed',
  body: 'Your photos are strictly private, stored securely, and no one else has access to them.',
};

const COPY: Copy<typeof es> = { es, en };

/** Visible reminder wherever personal progress or wardrobe photos are uploaded. */
export function PrivatePhotoNotice({ className }: { className?: string }) {
  const t = useText(COPY);
  return (
    <aside
      role="note"
      aria-label={t.label}
      className={cn('flex items-start gap-3 rounded-2xl border border-info/30 bg-info/[var(--lq-soft-alpha)] p-3 text-info-text', className)}
    >
      <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      <div className="flex flex-col gap-0.5">
        <p className="text-label-md">{t.title}</p>
        <p className="text-body-sm text-on-surface-light">{t.body}</p>
      </div>
    </aside>
  );
}
