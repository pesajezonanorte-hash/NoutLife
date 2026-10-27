// Galería: todas las fotos de Noutlife en un álbum. Las que tomaste con la
// cámara o elegiste de la galería y las que te enviaron, con amigos y en tus
// gremios, como polaroids pegadas por meses (el mes escrito a mano). Se filtran
// por mías, de amigos o de gremios; al tocar una se abre en grande y se pasa a
// la siguiente deslizando (o con las flechas). Cada foto lleva a su carta.
// Solo viajan las miniaturas: la foto buena se pide al acercarse a la pantalla.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Album, ChevronLeft, ChevronRight, Mail, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { item } from '@/lib/motion';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useMedia, useNearScreen } from '@/lib/media';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { getGallery, socialLink, type GalleryFilter, type GalleryItem } from '@/services/network.service';
import { AmbientLight, ZoneShell } from '@/components/ambience';
import { Lettering } from '@/components/layout/Lettering';
import { AvatarDisplay } from '@/components/character/AvatarDisplay';
import { InstantPhoto } from '@/components/social/letters/InstantPhoto';
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui/lq';
import { ZONE_ALBUMS, ZoneAlbum, useZonePhotos, type ZoneAlbumId } from '@/components/gallery/ZoneAlbum';
import { INTL_LOCALE, useLocale, useText, type Copy, type Locale } from '@/lib/i18n';

const es = {
  filters: { all: 'Cartas', mine: 'Mías', friends: 'De amigos', guilds: 'De gremios', coliseo: 'Coliseo', wardrobe: 'Espejo' } as Record<string, string>,
  mine: 'Tú',
  forYou: 'para ti',
  forName: (name: string): string => `para ${name}`,
  photoAria: (who: string, place: string, date: string): string => `Foto de ${who} en ${place}, ${date}`,
  viewerAria: 'Foto en grande',
  counter: (i: number, n: number): string => `${i} / ${n}`,
  close: 'Cerrar',
  prev: 'Foto anterior',
  next: 'Foto siguiente',
  photoOf: (name: string): string => `Foto de ${name}`,
  yourPhoto: 'Tu foto',
  inGuild: (g: string): string => `En ${g}`,
  forNameLong: (name: string): string => `Para ${name}`,
  forYouLong: 'Para ti',
  camera: 'cámara',
  gallery: 'galería',
  goLetter: 'Ir a la carta',
  eyebrow: 'Álbum RPG',
  title: 'galería',
  desc: 'Todas tus fotos en un solo álbum, por capítulos: las de tus cartas, tu progreso en el Coliseo y las prendas del armario de tu Espejo.',
  chapters: 'Capítulos del álbum',
  lettersChapter: 'Cartas',
  photos: 'fotos',
  whichPhotos: 'Qué fotos ver',
  emptyTitle: 'Tu álbum está en blanco',
  emptyDesc: 'Las fotos que tomes o envíes en las cartas, y las que te envíen, aparecerán aquí.',
  seeMore: 'Ver más fotos',
  plus: '+',
  dash: '—',
};

const en: typeof es = {
  filters: { all: 'Letters', mine: 'Mine', friends: 'From friends', guilds: 'From guilds', coliseo: 'Coliseum', wardrobe: 'Mirror' } as Record<string, string>,
  mine: 'You',
  forYou: 'for you',
  forName: (name: string): string => `for ${name}`,
  photoAria: (who: string, place: string, date: string): string => `Photo from ${who} in ${place}, ${date}`,
  viewerAria: 'Photo large',
  counter: (i: number, n: number): string => `${i} / ${n}`,
  close: 'Close',
  prev: 'Previous photo',
  next: 'Next photo',
  photoOf: (name: string): string => `Photo from ${name}`,
  yourPhoto: 'Your photo',
  inGuild: (g: string): string => `In ${g}`,
  forNameLong: (name: string): string => `For ${name}`,
  forYouLong: 'For you',
  camera: 'camera',
  gallery: 'gallery',
  goLetter: 'Go to letter',
  eyebrow: 'RPG album',
  title: 'gallery',
  desc: 'All your photos in one album, by chapter: those from your letters, your progress in the Coliseum and the clothes in your Mirror wardrobe.',
  chapters: 'Album chapters',
  lettersChapter: 'Letters',
  photos: 'photos',
  whichPhotos: 'Which photos to see',
  emptyTitle: 'Your album is blank',
  emptyDesc: 'Photos you take or send in letters, and the ones sent to you, will appear here.',
  seeMore: 'See more photos',
  plus: '+',
  dash: '—',
};

const COPY: Copy<typeof es> = { es, en };

type AlbumFilter = GalleryFilter | ZoneAlbumId;
const FILTER_IDS: AlbumFilter[] = ['all', 'mine', 'friends', 'guilds', 'coliseo', 'wardrobe'];
const isZone = (f: AlbumFilter): f is ZoneAlbumId => f === 'coliseo' || f === 'wardrobe';
const monthOf = (iso: string, locale: Locale) => new Date(iso).toLocaleDateString(INTL_LOCALE[locale], { month: 'long', year: 'numeric' });
const tiltOf = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ((h % 7) - 3) * 0.9; };
const placeOf = (it: GalleryItem) => (it.place.type === 'guild' ? it.place.guild.name : it.place.user.displayName.split(' ')[0]);
const whoOf = (it: GalleryItem, mine: string) => (it.mine ? mine : it.author.displayName.split(' ')[0]);
const linkOf = (it: GalleryItem) => (it.place.type === 'guild' ? socialLink.guildLetter(it.place.guild.id) : socialLink.letter(it.place.user.username));

/** Una polaroid del álbum (la foto buena se pide al acercarse). */
function AlbumPhoto({ it, index, onOpen }: { it: GalleryItem; index: number; onOpen: () => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  const reduce = useMotionStore((s) => s.reduce);
  const { ref, near } = useNearScreen<HTMLLIElement>('400px');
  const media = useMedia(it.side, it.id, { enabled: near, hasThumb: Boolean(it.thumb) });
  const who = whoOf(it, t.mine);
  return (
    <motion.li
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 16, rotate: tiltOf(it.id) - 4 }} animate={{ opacity: 1, y: 0, rotate: tiltOf(it.id) }}
      transition={{ ...springs.natural, delay: Math.min(index, 12) * 0.03 }}
      whileHover={reduce ? undefined : { y: -4, rotate: 0, zIndex: 2 }}
      className="relative"
    >
      <button type="button" onClick={onOpen} className="block w-full rounded-[3px] text-left" aria-label={t.photoAria(who, placeOf(it), new Date(it.at).toLocaleDateString(INTL_LOCALE[locale]))}>
        <InstantPhoto src={media.photoUrl} thumb={it.thumb} alt="" caption={it.caption} className="w-full" />
      </button>
      <p className="mt-2 truncate text-center text-body-sm text-on-surface-light">
        {who} · <span className="text-on-surface">{it.place.type === 'guild' ? it.place.guild.name : it.mine ? t.forName(placeOf(it)) : t.forYou}</span>
      </p>
    </motion.li>
  );
}

/** La foto en grande: se pasa a la siguiente deslizando o con las flechas. */
function Viewer({ items, index, onIndex, onClose }: { items: GalleryItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  const reduce = useMotionStore((s) => s.reduce);
  const navigate = useNavigate();
  const it = items[index];
  const media = useMedia(it.side, it.id, { hasThumb: Boolean(it.thumb) });
  const [dir, setDir] = useState(0);
  const go = useCallback((d: number) => { const n = index + d; if (n >= 0 && n < items.length) { setDir(d); onIndex(n); } }, [index, items.length, onIndex]);
  useEffect(() => {
    lockScroll();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); unlockScroll(); };
  }, [go, onClose]);
  const who = whoOf(it, t.mine);
  return createPortal(
    <motion.div
      role="dialog" aria-modal="true" aria-label={t.viewerAria}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center bg-[rgb(var(--lq-jade-900)/.94)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div className="flex w-full max-w-[460px] items-center justify-between text-jade-50">
        <span className="font-mono text-label-md text-jade-100/80">{t.counter(index + 1, items.length)}</span>
        <Button variant="icon" aria-label={t.close} onClick={onClose} className="text-jade-50 hover:bg-white/10"><X aria-hidden className="size-6" /></Button>
      </div>
      <div className="relative flex w-full max-w-[460px] flex-1 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={it.id} custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 120, rotate: dir * 6 }} animate={{ opacity: 1, x: 0, rotate: -1.5 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -120, rotate: dir * -6, transition: { duration: 0.2 } }}
            transition={springs.natural}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
            onDragEnd={(_, info) => { if (info.offset.x < -80) go(1); else if (info.offset.x > 80) go(-1); }}
            className="w-[min(86vw,400px)] touch-pan-y"
          >
            <InstantPhoto src={media.photoUrl} thumb={it.thumb} alt={t.photoOf(who)} caption={it.caption} className="w-full" />
          </motion.div>
        </AnimatePresence>
        <button type="button" aria-label={t.prev} disabled={index === 0} onClick={() => go(-1)}
          className="absolute left-0 hidden size-11 items-center justify-center rounded-full bg-white/10 text-jade-50 disabled:opacity-30 md:-left-14 md:flex"><ChevronLeft aria-hidden className="size-6" /></button>
        <button type="button" aria-label={t.next} disabled={index === items.length - 1} onClick={() => go(1)}
          className="absolute right-0 hidden size-11 items-center justify-center rounded-full bg-white/10 text-jade-50 disabled:opacity-30 md:-right-14 md:flex"><ChevronRight aria-hidden className="size-6" /></button>
      </div>
      <div className="flex w-full max-w-[460px] items-center gap-3 rounded-2xl bg-white/10 p-3 text-jade-50">
        <AvatarDisplay avatarConfig={it.author.avatarConfig} avatarUrl={it.author.avatarUrl} size={40} animate="none" className="overflow-hidden rounded-full" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label-lg">{it.mine ? t.yourPhoto : t.photoOf(it.author.displayName)}</span>
          <span className="block truncate text-body-sm text-jade-100/80">
            {it.place.type === 'guild' ? t.inGuild(it.place.guild.name) : it.mine ? t.forNameLong(it.place.user.displayName) : t.forYouLong} · {new Date(it.at).toLocaleDateString(INTL_LOCALE[locale], { day: 'numeric', month: 'long' })} · {it.kind === 'SNAP' ? t.camera : t.gallery}
          </span>
        </span>
        <Button size="sm" onClick={() => navigate(linkOf(it))} className="bg-jade-50 text-jade-900 hover:bg-white"><Mail aria-hidden className="size-4" />{t.goLetter}</Button>
      </div>
    </motion.div>,
    document.body,
  );
}

export default function GalleryPage() {
  const t = useText(COPY);
  const locale = useLocale();
  const [filter, setFilter] = useState<AlbumFilter>('all');
  const zonePhotos = useZonePhotos();
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isZone(filter)) return;
    let alive = true;
    setState('loading'); setItems(null); setNext(null);
    getGallery({ filter })
      .then((r) => { if (!alive) return; setItems(r.items); setNext(r.next); setState('ready'); })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [filter]);

  const loadMore = useCallback(async () => {
    if (!next || more || isZone(filter)) return;
    setMore(true);
    try { const r = await getGallery({ filter, before: next }); setItems((l) => [...(l ?? []), ...r.items]); setNext(r.next); }
    catch { /* se reintenta al volver a bajar */ }
    finally { setMore(false); }
  }, [filter, more, next]);

  // Al llegar al final del álbum, se cargan más fotos.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) void loadMore(); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, next]);

  const months = useMemo(() => {
    const out: Array<{ label: string; items: Array<{ it: GalleryItem; index: number }> }> = [];
    (items ?? []).forEach((it, index) => {
      const label = monthOf(it.at, locale);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push({ it, index }); else out.push({ label, items: [{ it, index }] });
    });
    return out;
  }, [items, locale]);

  const FILTERS = FILTER_IDS.map((id) => ({ id, label: t.filters[id] }));
  const chapterOn = (id: string) => filter === id || (id === 'all' && !isZone(filter));

  return (
    <ZoneShell
      zone="gallery" contentClassName="gap-6 md:gap-10"
      ambience={<AmbientLight tone="warning" alpha={0.11} darkAlpha={0.07} d={14} className="left-[30%] top-[-10%] h-[30rem] w-[60%]" />}
    >
      <motion.section variants={item} className="flex flex-col gap-3 pt-6 md:pt-10">
        <span className="text-label-lg text-primary-text">{t.eyebrow}</span>
        <h1 className="text-display-sm md:text-display-md"><Lettering text={t.title} /></h1>
        <p className="max-w-[56ch] text-body-lg text-on-surface-light">{t.desc}</p>
      </motion.section>

      {/* Capítulos del álbum: cuántas fotos guarda cada zona. */}
      <motion.div variants={item} className="grid grid-cols-3 gap-3" role="group" aria-label={t.chapters}>
        {([
          { id: 'all' as const, label: t.lettersChapter, icon: Mail, count: items && !isZone(filter) ? `${items.length}${next ? t.plus : ''}` : t.dash },
          ...(['coliseo', 'wardrobe'] as const).map((z) => ({ id: z, label: t.filters[z], icon: ZONE_ALBUMS[z].icon, count: zonePhotos ? String(zonePhotos.filter((p) => p.zone === z).length) : t.dash })),
        ]).map((ch) => (
          <button key={ch.id} type="button" onClick={() => setFilter(ch.id)} aria-pressed={chapterOn(ch.id)}
            className={cn('flex min-h-20 flex-col items-start justify-between rounded-2xl border p-3 text-left transition-colors', chapterOn(ch.id) ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:border-primary/40')}>
            <ch.icon aria-hidden className="size-5 text-primary-text" />
            <span className="text-label-lg text-on-surface">{ch.label}</span>
            <span className="font-mono text-body-sm tabular-nums text-on-surface-light">{ch.count} {t.photos}</span>
          </button>
        ))}
      </motion.div>

      <motion.div variants={item} role="radiogroup" aria-label={t.whichPhotos} className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}
            className={cn('min-h-11 shrink-0 rounded-full border px-4 text-label-lg transition-colors', filter === f.id ? 'border-primary bg-primary/10 text-primary-text' : 'border-border bg-surface text-on-surface hover:border-primary/40')}>
            {f.label}
          </button>
        ))}
      </motion.div>

      {isZone(filter) ? <ZoneAlbum zone={filter} photos={zonePhotos} /> : state === 'error' ? <ErrorState onRetry={() => setFilter((f) => f)} /> : state === 'loading' ? (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <li key={i}><Skeleton className="aspect-[0.86] rounded-[3px]" /></li>)}</ul>
      ) : !items?.length ? (
        <EmptyState icon={Album} title={t.emptyTitle} description={t.emptyDesc} />
      ) : (
        <div className="flex flex-col gap-10">
          {months.map((mo) => (
            <section key={mo.label} aria-label={mo.label} className="flex flex-col gap-5">
              <h2 className="text-heading-lg capitalize text-on-background"><Lettering text={mo.label} draw={false} /></h2>
              <ul className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
                {mo.items.map(({ it, index }) => <AlbumPhoto key={`${it.side}:${it.id}`} it={it} index={index} onOpen={() => setOpen(index)} />)}
              </ul>
            </section>
          ))}
          <div ref={sentinel} className="flex justify-center py-4">
            {next && <Button variant="ghost" loading={more} onClick={() => void loadMore()}>{t.seeMore}</Button>}
          </div>
        </div>
      )}

      <AnimatePresence>
        {!isZone(filter) && open !== null && items?.[open] && <Viewer key="viewer" items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </ZoneShell>
  );
}
