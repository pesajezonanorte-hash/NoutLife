// Aviso discreto de almacenamiento local: aparece la primera vez y no vuelve
// tras pulsar «Aceptar». El consentimiento se guarda en el propio localStorage.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/lq';
import { useLocale, type Copy } from '@/lib/i18n';

const KEY = 'noutlife.storage-notice';

const COPY: Copy<{ region: string; text: string; more: string; accept: string }> = {
  es: {
    region: 'Aviso de almacenamiento local',
    text: 'Noutlife usa el almacenamiento local de tu navegador (localStorage) para mantener tu sesión y tu tema visual. No usamos cookies publicitarias.',
    more: 'Más información',
    accept: 'Aceptar',
  },
  en: {
    region: 'Local storage notice',
    text: 'NoutLife uses your browser’s storage and a few essential cookies to keep you signed in, remember your preferences and understand how the app is used. No advertising cookies.',
    more: 'Learn more',
    accept: 'OK',
  },
};

function accepted(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function CookieNotice() {
  const t = COPY[useLocale()];
  const [open, setOpen] = useState(() => !accepted());
  if (!open) return null;

  const accept = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* sin storage: se oculta en esta visita */ }
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label={t.region}
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-xl flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-on-background shadow-lg sm:flex-row sm:items-center md:bottom-4"
    >
      <p className="flex-1 text-body-sm text-on-surface">
        {t.text}{' '}
        <Link to="/privacy" className="font-semibold text-primary-text underline-offset-4 hover:underline">{t.more}</Link>
      </p>
      <Button size="sm" onClick={accept}>{t.accept}</Button>
    </div>
  );
}
