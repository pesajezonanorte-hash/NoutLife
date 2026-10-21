// Navegadores internos (Instagram, Facebook, TikTok): Google no deja iniciar sesión
// dentro de ellos. En Android un toque abre la misma página en Chrome (intent://);
// en iPhone no hay forma de saltar solo, así que se explica dónde está «Abrir en el navegador».
import { useState } from 'react';
import { Copy, ExternalLink, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/lq';
import { track } from '@/lib/analytics';
import { chromeIntent, type InAppBrowser } from '@/lib/inAppBrowser';

const APP_NAME: Record<InAppBrowser, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };

export function OpenInBrowser({ app }: { app: InAppBrowser }) {
  const android = /Android/i.test(navigator.userAgent);
  const [copied, setCopied] = useState(false);

  async function copy() {
    track('open_in_browser_clicked', { app, method: 'copy' });
    try { await navigator.clipboard.writeText(location.href); setCopied(true); } catch { /* sin portapapeles: queda la guía */ }
  }

  return (
    <div role="region" aria-labelledby="lq-open-browser" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 id="lq-open-browser" className="text-heading-sm">Ábrelo en tu navegador para entrar</h2>
        <p className="text-body-md text-on-surface-light">
          Google no permite iniciar sesión dentro de {APP_NAME[app]}. {android ? 'Un toque y sigues en Chrome.' : 'Son dos toques:'}
        </p>
      </div>
      {android ? (
        <Button size="lg" block onClick={() => { track('open_in_browser_clicked', { app, method: 'intent' }); location.href = chromeIntent(location.href); }}>
          <ExternalLink aria-hidden className="size-5" strokeWidth={1.75} />Abrir en Chrome
        </Button>
      ) : (
        <ol className="flex flex-col gap-3 text-body-md">
          <li className="flex items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-label-sm text-on-primary">1</span>
            <span className="min-w-0 flex-1">Toca <MoreHorizontal aria-label="el menú de tres puntos" className="inline size-5 align-text-bottom" strokeWidth={2} /> arriba a la derecha</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-label-sm text-on-primary">2</span>
            <span className="min-w-0 flex-1">Elige <strong>«Abrir en el navegador»</strong> (o «Abrir en Safari»)</span>
          </li>
        </ol>
      )}
      <Button variant="secondary" size="md" block onClick={() => void copy()}>
        <Copy aria-hidden className="size-4" strokeWidth={1.75} />{copied ? 'Enlace copiado: pégalo en tu navegador' : 'Copiar enlace'}
      </Button>
    </div>
  );
}
