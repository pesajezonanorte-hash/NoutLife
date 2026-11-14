// Música dentro de la app: el reproductor incrustado de Spotify con listas para enfocarse, la playlist de
// Ajustes (Spotify o YouTube) o cualquier enlace pegado (lista, álbum, pódcast, episodio).
// Panel NO modal: al ocultarlo el iframe sigue montado para que la música no se corte al navegar.
// md+: píldora flotante abajo a la derecha que abre el panel encima. Móvil: Menú → Herramientas → Música.
// Reproducir y pausar se controlan desde la app (store/musicStore): el Modo enfoque arranca y detiene la
// música con el temporizador. Con YouTube no hay control propio: se usa el del propio reproductor.
import { useEffect, useId, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ExternalLink, Music, Pause, Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { useShellStore } from '@/store/shellStore';
import { attachPlayer, useMusicStore } from '@/store/musicStore';
import { Button, ChipGroup, Field, IconChip, Input } from '@/components/ui/lq';
import { useText, type Copy } from '@/lib/i18n';
import { STATIONS, parseSpotify, resolveSource, spotifyEmbedUrl, spotifyOpenUrl, stationOf } from '@/lib/spotify';

const es = {
  title: 'Música',
  openIn: (p: string): string => `Abrir en ${p} (nueva pestaña)`,
  hide: 'Ocultar reproductor',
  player: (p: string): string => `Reproductor de ${p}`,
  keepPlaying: 'Sigue sonando aunque ocultes el panel.',
  launcher: 'Música',
  sources: 'Qué escuchar',
  mine: 'Mi playlist',
  custom: 'Tu enlace',
  link: 'Enlace de Spotify',
  linkHelp: 'Pega una lista, un álbum, un pódcast o un episodio.',
  linkErr: 'No reconocemos ese enlace. Cópialo desde Spotify con «Compartir».',
  play: 'Reproducir',
  pause: 'Pausar',
  preview: 'Sin sesión de Spotify en este navegador suenan avances de 30 s.',
};

const en: typeof es = {
  title: 'Music',
  openIn: (p: string): string => `Open in ${p} (new tab)`,
  hide: 'Hide player',
  player: (p: string): string => `${p} player`,
  keepPlaying: 'Keeps playing even when you hide the panel.',
  launcher: 'Music',
  sources: 'What to listen to',
  mine: 'My playlist',
  custom: 'Your link',
  link: 'Spotify link',
  linkHelp: 'Paste a playlist, an album, a podcast or an episode.',
  linkErr: 'We do not recognise that link. Copy it from Spotify with “Share”.',
  play: 'Play',
  pause: 'Pause',
  preview: 'Without a Spotify session in this browser you hear 30-second previews.',
};

const COPY: Copy<typeof es> = { es, en };

type Provider = 'spotify' | 'youtube';

/** Enlace de Spotify o YouTube como URL de su reproductor incrustado. */
export function parseEmbed(url: string | null | undefined): { type: Provider | null; embedUrl: string | null } {
  if (!url) return { type: null, embedUrl: null };
  const spotify = parseSpotify(url);
  if (spotify) return { type: 'spotify', embedUrl: spotifyEmbedUrl(spotify, true) };
  const ytVideo = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytVideo) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytVideo[1]}?autoplay=0` };
  const ytList = url.match(/youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/);
  if (ytList) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/videoseries?list=${ytList[1]}` };
  return { type: null, embedUrl: null };
}

/** La fuente que suena si la persona aún no eligió: su playlist de Ajustes o, sin ella, la primera lista. */
export const defaultSource = (mine: string | null | undefined) => (parseEmbed(mine).embedUrl ? 'mine' : STATIONS[0].id);

export function MusicPlayer({ url }: { url: string | null | undefined }) {
  const t = useText(COPY);
  const open = useShellStore((s) => s.musicOpen);
  const setOpen = useShellStore((s) => s.setMusicOpen);
  const { source, custom, active, ready, playing, setSource, setCustom, activate, play, pause } = useMusicStore();
  const panelId = useId();
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const hasMine = Boolean(parseEmbed(url).embedUrl);
  // Una fuente guardada que ya no existe (se quitó la playlist de Ajustes) cae a la de por defecto.
  const current = source && (source !== 'mine' || hasMine) && (source === 'mine' || source === 'custom' || stationOf(source)) ? source : defaultSource(url);
  const spotify = resolveSource(current, url, custom);
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  // «Mi playlist» o el enlace pegado también pueden ser de YouTube.
  const embedUrl = useMemo(
    () => (spotify ? spotifyEmbedUrl(spotify, dark) : parseEmbed(current === 'mine' ? url : current === 'custom' ? custom : null).embedUrl),
    [spotify?.kind, spotify?.id, dark, current, url, custom], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const provider: Provider = spotify ? 'spotify' : 'youtube';
  const name = current === 'mine' ? t.mine : current === 'custom' ? t.custom : stationOf(current)?.name ?? '';

  useEffect(() => {
    if (!open) return;
    activate();
    // Tras cerrar el menú (que devuelve el foco), llevarlo al panel.
    const raf = requestAnimationFrame(() => panelRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open, activate]);

  const close = () => {
    setOpen(false);
    if (panelRef.current?.contains(document.activeElement)) launcherRef.current?.focus();
  };

  const options = [
    ...(hasMine ? [{ value: 'mine', label: t.mine }] : []),
    ...STATIONS.map((s) => ({ value: s.id, label: s.name })),
    { value: 'custom', label: t.custom },
  ];

  return (
    <>
      <motion.section
        ref={panelRef}
        id={panelId}
        aria-labelledby={titleId}
        tabIndex={-1}
        hidden={!active}
        initial={false}
        animate={open ? { opacity: 1, y: 0, visibility: 'visible' } : { opacity: 0, y: 16, transitionEnd: { visibility: 'hidden' } }}
        transition={{ duration: open ? 0.3 : 0.2, ease }}
        onKeyDown={(e) => e.key === 'Escape' && close()}
        className={cn(
          'fixed inset-x-4 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-40 overflow-hidden rounded-3xl border border-border bg-background text-on-background shadow-lg outline-none',
          'md:inset-x-auto md:bottom-24 md:right-8 md:w-[380px]',
        )}
      >
        <header className="flex items-center gap-3 border-b border-border py-2 pl-4 pr-2">
          <IconChip icon={Music} tone="forest" size="sm" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-heading-sm">{t.title}</h2>
            <p className="truncate text-body-sm text-on-surface-light">{name}</p>
          </div>
          {spotify && (
            <a
              href={spotifyOpenUrl(spotify)} target="_blank" rel="noopener noreferrer" aria-label={t.openIn('Spotify')}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface hover:bg-surface-variant"
            >
              <ExternalLink aria-hidden className="size-5" strokeWidth={1.75} />
            </a>
          )}
          <Button variant="icon" aria-label={t.hide} onClick={close}>
            <X aria-hidden className="size-5" strokeWidth={1.75} />
          </Button>
        </header>

        <div className="flex flex-col gap-3 p-3">
          <ChipGroup
            label={t.sources} value={current} onChange={setSource} options={options}
            className="-mx-3 flex-nowrap overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />
          {current === 'custom' && (
            <Field label={t.link} help={t.linkHelp} error={custom.trim() && !embedUrl ? t.linkErr : undefined}>
              <Input type="url" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="https://open.spotify.com/…" />
            </Field>
          )}
          {active && embedUrl && (
            <iframe
              // Otra lista es otro reproductor: se monta de nuevo y vuelve a avisar que está listo.
              key={embedUrl}
              ref={provider === 'spotify' ? attachPlayer : undefined}
              title={t.player(provider === 'spotify' ? 'Spotify' : 'YouTube')}
              src={embedUrl}
              className={cn('block w-full rounded-xl border-0', provider === 'spotify' ? 'h-[152px]' : 'aspect-video')}
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            />
          )}
          {provider === 'spotify' && embedUrl && (
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="md" disabled={!ready} onClick={() => (playing ? pause() : play())}>
                {playing ? <Pause aria-hidden className="size-4" strokeWidth={1.75} /> : <Play aria-hidden className="size-4" strokeWidth={1.75} />}
                {playing ? t.pause : t.play}
              </Button>
              <p className="min-w-0 flex-1 text-body-sm text-on-surface-light">{t.preview}</p>
            </div>
          )}
          <p className="text-body-sm text-on-surface-light">{t.keepPlaying}</p>
        </div>
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
        <Music aria-hidden className={cn('size-5', playing ? 'text-primary-text' : 'text-forest-text')} strokeWidth={1.75} />
        {t.launcher}
        <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-200', !open && 'rotate-180')} strokeWidth={1.75} />
      </button>
    </>
  );
}
