// Reproductor de la playlist del usuario (Spotify o YouTube embebidos).
// Panel NO modal: al ocultarlo el iframe sigue montado para que la música no
// se corte. md+: píldora flotante abajo a la derecha que abre el panel encima.
// Móvil: se abre desde Menú → Herramientas → Música, sobre la tab bar.
// TODO(api): los controles propios (play/pausa, volumen, pista actual) no son
// posibles con los embeds; requieren Spotify Web Playback SDK / YouTube IFrame API.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ExternalLink, Music, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { useShellStore } from '@/store/shellStore';
import { Button, IconChip } from '@/components/ui/lq';

type Provider = 'spotify' | 'youtube';

export function parseEmbed(url: string | null | undefined): { type: Provider | null; embedUrl: string | null } {
  if (!url) return { type: null, embedUrl: null };
  const spotify = url.match(/spotify\.com\/(playlist|track|album|artist)\/([a-zA-Z0-9]+)/);
  if (spotify) return { type: 'spotify', embedUrl: `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}?utm_source=generator&theme=0` };
  const ytVideo = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytVideo) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytVideo[1]}?autoplay=0` };
  const ytList = url.match(/youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/);
  if (ytList) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/videoseries?list=${ytList[1]}` };
  return { type: null, embedUrl: null };
}

const PROVIDER: Record<Provider, string> = { spotify: 'Spotify', youtube: 'YouTube' };

export function MusicPlayer({ url }: { url: string | null | undefined }) {
  const { type, embedUrl } = useMemo(() => parseEmbed(url), [url]);
  const open = useShellStore((s) => s.musicOpen);
  const setOpen = useShellStore((s) => s.setMusicOpen);
  // El iframe se monta la primera vez que se abre y ya no se desmonta.
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    // Tras cerrar el menú (que devuelve el foco), llevarlo al panel.
    const raf = requestAnimationFrame(() => panelRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!url || !embedUrl || !type) return null;

  const close = () => {
    setOpen(false);
    if (panelRef.current?.contains(document.activeElement)) launcherRef.current?.focus();
  };

  return (
    <>
      <motion.section
        ref={panelRef}
        id={panelId}
        aria-labelledby={titleId}
        tabIndex={-1}
        hidden={!mounted}
        initial={false}
        animate={open ? { opacity: 1, y: 0, visibility: 'visible' } : { opacity: 0, y: 16, transitionEnd: { visibility: 'hidden' } }}
        transition={{ duration: open ? 0.3 : 0.2, ease }}
        onKeyDown={(e) => e.key === 'Escape' && close()}
        className={cn(
          'fixed inset-x-4 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-40 overflow-hidden rounded-3xl border border-border bg-background text-on-background shadow-lg outline-none',
          'md:inset-x-auto md:bottom-24 md:right-8 md:w-[360px]',
        )}
      >
        <header className="flex items-center gap-3 border-b border-border py-2 pl-4 pr-2">
          <IconChip icon={Music} tone="secondary" size="sm" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-heading-sm">Tu música</h2>
            <p className="text-body-sm text-on-surface-light">Playlist de {PROVIDER[type]}</p>
          </div>
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            aria-label={`Abrir en ${PROVIDER[type]} (nueva pestaña)`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface hover:bg-surface-variant"
          >
            <ExternalLink aria-hidden className="size-5" strokeWidth={1.75} />
          </a>
          <Button variant="icon" aria-label="Ocultar reproductor" onClick={close}>
            <X aria-hidden className="size-5" strokeWidth={1.75} />
          </Button>
        </header>
        {mounted && (
          <iframe
            title={`Reproductor de ${PROVIDER[type]}`}
            src={embedUrl}
            className={cn('block w-full border-0', type === 'spotify' ? 'h-[152px]' : 'aspect-video')}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        )}
        <p className="px-4 py-2 text-body-sm text-on-surface-light">Sigue sonando aunque ocultes el panel.</p>
      </motion.section>

      {/* Lanzador (md+). En móvil se abre desde el menú. */}
      <button
        ref={launcherRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        className="fixed bottom-8 right-8 z-40 hidden min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-label-lg text-on-background shadow-md transition-shadow hover:shadow-lg md:inline-flex"
      >
        <Music aria-hidden className="size-5 text-secondary-text" strokeWidth={1.75} />
        Música
        <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-200', !open && 'rotate-180')} strokeWidth={1.75} />
      </button>
    </>
  );
}
