// Navegadores internos (Instagram, Facebook, TikTok): Google no deja iniciar sesión
// dentro de ellos. En Android un toque abre la misma página en Chrome (intent://);
// en iPhone no hay forma de saltar solo, así que se explica dónde está «Abrir en el navegador».
import { useState } from 'react';
import { Copy, ExternalLink, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/lq';
import { track } from '@/lib/analytics';
import { useLocale, type Copy as Texts } from '@/lib/i18n';
import { chromeIntent, type InAppBrowser } from '@/lib/inAppBrowser';

const APP_NAME: Record<InAppBrowser, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

const COPY: Texts<{
  title: string; blocked: (app: string) => string; oneTap: string; twoTaps: string; openChrome: string;
  menu: string; tapMenu: [string, string]; choose: [string, string, string]; copied: string; copy: string;
}> = {
  es: {
    title: 'Ábrelo en tu navegador para entrar',
    blocked: (app) => `Google no permite iniciar sesión dentro de ${app}.`,
    oneTap: 'Un toque y sigues en Chrome.',
    twoTaps: 'Son dos toques:',
    openChrome: 'Abrir en Chrome',
    menu: 'el menú de tres puntos',
    tapMenu: ['Toca', 'arriba a la derecha'],
    choose: ['Elige', '«Abrir en el navegador»', '(o «Abrir en Safari»)'],
    copied: 'Enlace copiado: pégalo en tu navegador',
    copy: 'Copiar enlace',
  },
  en: {
    title: 'Open it in your browser to sign in',
    blocked: (app) => `Google doesn’t allow signing in inside ${app}.`,
    oneTap: 'One tap and you’re in Chrome.',
    twoTaps: 'It takes two taps:',
    openChrome: 'Open in Chrome',
    menu: 'the three-dot menu',
    tapMenu: ['Tap', 'at the top right'],
    choose: ['Choose', '“Open in browser”', '(or “Open in Safari”)'],
    copied: 'Link copied: paste it in your browser',
    copy: 'Copy link',
  },
};

export function OpenInBrowser({ app }: { app: InAppBrowser }) {
  const android = /Android/i.test(navigator.userAgent);
  const locale = useLocale();
  const t = COPY[locale];
  const [copied, setCopied] = useState(false);

  async function copy() {
    track('open_in_browser_clicked', { app, method: 'copy' });
    try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { /* sin portapapeles: queda la guía */ }
  }

  return (
    <div role="region" aria-labelledby="lq-open-browser" lang={locale} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 id="lq-open-browser" className="text-heading-sm">{t.title}</h2>
        <p className="text-body-md text-on-surface-light">
          {t.blocked(APP_NAME[app])} {android ? t.oneTap : t.twoTaps}
        </p>
      </div>
      {android ? (
        <Button size="lg" block onClick={() => { track('open_in_browser_clicked', { app, method: 'intent' }); location.href = chromeIntent(location.href); }}>
          <ExternalLink aria-hidden className="size-5" strokeWidth={1.75} />{t.openChrome}
        </Button>
      ) : (
        <ol className="flex flex-col gap-3 text-body-md">
          <li className="flex items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-label-sm text-on-primary">1</span>
            <span className="min-w-0 flex-1">{t.tapMenu[0]} <MoreHorizontal aria-label={t.menu} className="inline size-5 align-text-bottom" strokeWidth={2} /> {t.tapMenu[1]}</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-label-sm text-on-primary">2</span>
            <span className="min-w-0 flex-1">{t.choose[0]} <strong>{t.choose[1]}</strong> {t.choose[2]}</span>
          </li>
        </ol>
      )}
      <Button variant="secondary" size="md" block onClick={() => void copy()}>
        <Copy aria-hidden className="size-4" strokeWidth={1.75} />{copied ? t.copied : t.copy}
      </Button>
    </div>
  );
}
