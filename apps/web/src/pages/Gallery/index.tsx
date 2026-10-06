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

const FILTERS: Array<{ id: GalleryFilter; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'mine', label: 'Mías' },
  { id: 'friends', label: 'De amigos' },
  { id: 'guilds', label: 'De gremios' },
];
const monthOf = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
const tiltOf = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ((h % 7) - 3) * 0.9; };
const placeOf = (it: GalleryItem) => (it.place.type === 'guild' ? it.place.guild.name : it.place.user.displayName.split(' ')[0]);
const whoOf = (it: GalleryItem) => (it.mine ? 'Tú' : it.author.displayName.split(' ')[0]);
const linkOf = (it: GalleryItem) => (it.place.type === 'guild' ? socialLink.guildLetter(it.place.guild.id) : socialLink.letter(it.place.user.username));

/** Una polaroid del álbum (la foto buena se pide al acercarse). */
function AlbumPhoto({ it, index, onOpen }: { it: GalleryItem; index: number; onOpen: () => void }) {
  const reduce = useMotionStore((s) => s.reduce);
  const { ref, near } = useNearScreen<HTMLLIElement>('400px');
  const media = useMedia(it.side, it.id, { enabled: near, hasThumb: Boolean(it.thumb) });
  return (
    <motion.li
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 16, rotate: tiltOf(it.id) - 4 }} animate={{ opacity: 1, y: 0, rotate: tiltOf(it.id) }}
      transition={{ ...springs.natural, delay: Math.min(index, 12) * 0.03 }}
      whileHover={reduce ? undefined : { y: -4, rotate: 0, zIndex: 2 }}
      className="relative"
    >
      <button type="button" onClick={onOpen} className="block w-full rounded-[3px] text-left" aria-label={`Foto de ${whoOf(it)} en ${placeOf(it)}, ${new Date(it.at).toLocaleDateString('es-ES')}`}>
        <InstantPhoto src={media.photoUrl} thumb={it.thumb} alt="" caption={it.caption} className="w-full" />
      </button>
      <p className="mt-2 truncate text-center text-body-sm text-on-surface-light">
        {whoOf(it)} · <span className="text-on-surface">{it.place.type === 'guild' ? it.place.guild.name : it.mine ? `para ${placeOf(it)}` : 'para ti'}</span>
      </p>
    </motion.li>
  );
}

/** La foto en grande: se pasa a la siguiente deslizando o con las flechas. */
function Viewer({ items, index, onIndex, onClose }: { items: GalleryItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
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
  return createPortal(
    <motion.div
      role="dialog" aria-modal="true" aria-label="Foto en grande"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center bg-[rgb(var(--lq-jade-900)/.94)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
    >
      <div className="flex w-full max-w-[460px] items-center justify-between text-jade-50">
        <span className="font-mono text-label-md text-jade-100/80">{index + 1} / {items.length}</span>
        <Button variant="icon" aria-label="Cerrar" onClick={onClose} className="text-jade-50 hover:bg-white/10"><X aria-hidden className="size-6" /></Button>
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
            <InstantPhoto src={media.photoUrl} thumb={it.thumb} alt={`Foto de ${whoOf(it)}`} caption={it.caption} className="w-full" />
          </motion.div>
        </AnimatePresence>
        <button type="button" aria-label="Foto anterior" disabled={index === 0} onClick={() => go(-1)}
          className="absolute left-0 hidden size-11 items-center justify-center rounded-full bg-white/10 text-jade-50 disabled:opacity-30 md:-left-14 md:flex"><ChevronLeft aria-hidden className="size-6" /></button>
        <button type="button" aria-label="Foto siguiente" disabled={index === items.length - 1} onClick={() => go(1)}
          className="absolute right-0 hidden size-11 items-center justify-center rounded-full bg-white/10 text-jade-50 disabled:opacity-30 md:-right-14 md:flex"><ChevronRight aria-hidden className="size-6" /></button>
      </div>
      <div className="flex w-full max-w-[460px] items-center gap-3 rounded-2xl bg-white/10 p-3 text-jade-50">
        <AvatarDisplay avatarConfig={it.author.avatarConfig} avatarUrl={it.author.avatarUrl} size={40} animate="none" className="overflow-hidden rounded-full" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label-lg">{it.mine ? 'Tu foto' : `Foto de ${it.author.displayName}`}</span>
          <span className="block truncate text-body-sm text-jade-100/80">
            {it.place.type === 'guild' ? `En ${it.place.guild.name}` : it.mine ? `Para ${it.place.user.displayName}` : 'Para ti'} · {new Date(it.at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })} · {it.kind === 'SNAP' ? 'cámara' : 'galería'}
          </span>
        </span>
        <Button size="sm" onClick={() => navigate(linkOf(it))} className="bg-jade-50 text-jade-900 hover:bg-white"><Mail aria-hidden className="size-4" />Ir a la carta</Button>
      </div>
    </motion.div>,
    document.body,
  );
}

export default function GalleryPage() {
  const [filter, setFilter] = useState<GalleryFilter>('all');
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setState('loading'); setItems(null); setNext(null);
    getGallery({ filter })
      .then((r) => { if (!alive) return; setItems(r.items); setNext(r.next); setState('ready'); })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [filter]);

  const loadMore = useCallback(async () => {
    if (!next || more) return;
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
      const label = monthOf(it.at);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push({ it, index }); else out.push({ label, items: [{ it, index }] });
    });
    return out;
  }, [items]);

  return (
    <ZoneShell
      zone="gallery" contentClassName="gap-6 md:gap-10"
      ambience={<AmbientLight tone="warning" alpha={0.11} darkAlpha={0.07} d={14} className="left-[30%] top-[-10%] h-[30rem] w-[60%]" />}
    >
      <motion.section variants={item} className="flex flex-col gap-3 pt-6 md:pt-10">
        <span className="text-label-lg text-primary-text">{items ? `${items.length}${next ? '+' : ''} ${items.length === 1 ? 'foto' : 'fotos'}` : 'Galería'}</span>
        <h1 className="text-display-sm md:text-display-md"><Lettering text="galería" /></h1>
        <p className="max-w-[56ch] text-body-lg text-on-surface-light">Todas las fotos de tus cartas: las que tomaste o elegiste y las que te enviaron tus amigos y tus gremios.</p>
      </motion.section>

      <motion.div variants={item} role="radiogroup" aria-label="Qué fotos ver" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}
            className={cn('min-h-11 shrink-0 rounded-full border px-4 text-label-lg transition-colors', filter === f.id ? 'border-primary bg-primary/10 text-primary-text' : 'border-border bg-surface text-on-surface hover:border-primary/40')}>
            {f.label}
          </button>
        ))}
      </motion.div>

      {state === 'error' ? <ErrorState onRetry={() => setFilter((f) => f)} /> : state === 'loading' ? (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <li key={i}><Skeleton className="aspect-[0.86] rounded-[3px]" /></li>)}</ul>
      ) : !items?.length ? (
        <EmptyState icon={Album} title="Tu álbum está en blanco" description="Las fotos que tomes o envíes en las cartas, y las que te envíen, aparecerán aquí." />
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
            {next && <Button variant="ghost" loading={more} onClick={() => void loadMore()}>Ver más fotos</Button>}
          </div>
        </div>
      )}

      <AnimatePresence>
        {open !== null && items?.[open] && <Viewer key="viewer" items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </ZoneShell>
  );
}
