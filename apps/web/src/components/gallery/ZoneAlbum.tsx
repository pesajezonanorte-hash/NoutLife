// Álbum RPG: tus fotos de todas las zonas (gimnasio, espejo y cartas) en un solo
// álbum por meses, con su zona como sello. Privado: solo fotos propias. La foto
// buena se pide al acercarse a la pantalla; al tocarla se abre en grande.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Album, ChevronLeft, ChevronRight, Dumbbell, Mail, Sparkles, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import { useNearScreen } from '@/lib/media';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { Lettering } from '@/components/layout/Lettering';
import { InstantPhoto } from '@/components/social/letters/InstantPhoto';
import { PrivacyNote } from '@/components/ui/PrivacyNote';
import { Button, EmptyState, ErrorState, Skeleton } from '@/components/ui/lq';
import { fetchAlbum, fetchAlbumPhoto, type AlbumItem, type AlbumZone } from '@/services/album.service';

const ZONE_META: Record<AlbumZone, { label: string; icon: LucideIcon }> = {
  gym: { label: 'Gimnasio', icon: Dumbbell },
  espejo: { label: 'Espejo', icon: Sparkles },
  cartas: { label: 'Cartas', icon: Mail },
};
const FILTERS: Array<{ id: 'all' | AlbumZone; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'gym', label: 'Gimnasio' },
  { id: 'espejo', label: 'Espejo' },
  { id: 'cartas', label: 'Cartas' },
];
const monthOf = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
const tiltOf = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ((h % 7) - 3) * 0.9; };

function usePhoto(it: AlbumItem, enabled: boolean) {
  const key = `${it.source}:${it.id}`;
  const [loaded, setLoaded] = useState<{ key: string; src: string | null }>({ key, src: it.photoUrl });
  const src = loaded.key === key ? loaded.src : it.photoUrl;
  useEffect(() => {
    if (!enabled || src) return;
    let alive = true;
    void fetchAlbumPhoto(it).then((url) => { if (alive) setLoaded({ key, src: url }); });
    return () => { alive = false; };
  }, [enabled, key, src]); // eslint-disable-line react-hooks/exhaustive-deps
  return src;
}

function ZoneStamp({ zone }: { zone: AlbumZone }) {
  const { label, icon: Icon } = ZONE_META[zone];
  return (
    <span className="flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-label-md text-on-background shadow-sm">
      <Icon aria-hidden className="size-3.5" strokeWidth={2} />{label}
    </span>
  );
}

function AlbumCard({ it, index, onOpen }: { it: AlbumItem; index: number; onOpen: () => void }) {
  const reduce = useMotionStore((s) => s.reduce);
  const { ref, near } = useNearScreen<HTMLLIElement>('400px');
  const src = usePhoto(it, near);
  const date = new Date(it.at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return (
    <motion.li
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 16, rotate: tiltOf(it.id) - 4 }} animate={{ opacity: 1, y: 0, rotate: tiltOf(it.id) }}
      transition={{ ...springs.natural, delay: Math.min(index, 12) * 0.03 }}
      whileHover={reduce ? undefined : { y: -4, rotate: 0, zIndex: 2 }}
      className="relative"
    >
      <button type="button" onClick={onOpen} className="block w-full rounded-[3px] text-left" aria-label={`${it.title}, ${ZONE_META[it.zone].label}, ${date}`}>
        <InstantPhoto src={src} thumb={it.thumb} alt="" caption={it.title} badge={<ZoneStamp zone={it.zone} />} className="w-full" />
      </button>
      <p className="mt-2 truncate text-center text-body-sm text-on-surface-light">{ZONE_META[it.zone].label} · {date}</p>
    </motion.li>
  );
}

function Viewer({ items, index, onIndex, onClose }: { items: AlbumItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const reduce = useMotionStore((s) => s.reduce);
  const it = items[index];
  const src = usePhoto(it, true);
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
            key={`${it.source}:${it.id}`} custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 120, rotate: dir * 6 }} animate={{ opacity: 1, x: 0, rotate: -1.5 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -120, rotate: dir * -6, transition: { duration: 0.2 } }}
            transition={springs.natural}
            drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
            onDragEnd={(_, info) => { if (info.offset.x < -80) go(1); else if (info.offset.x > 80) go(-1); }}
            className="w-[min(86vw,400px)] touch-pan-y"
          >
            <InstantPhoto src={src} thumb={it.thumb} alt={it.title} caption={it.title} className="w-full" />
          </motion.div>
        </AnimatePresence>
        <button type="button" aria-label="Foto anterior" disabled={index === 0} onClick={() => go(-1)}
          className="absolute left-0 hidden size-11 items-center justify-center rounded-full bg-white/10 text-jade-50 disabled:opacity-30 md:-left-14 md:flex"><ChevronLeft aria-hidden className="size-6" /></button>
        <button type="button" aria-label="Foto siguiente" disabled={index === items.length - 1} onClick={() => go(1)}
          className="absolute right-0 hidden size-11 items-center justify-center rounded-full bg-white/10 text-jade-50 disabled:opacity-30 md:-right-14 md:flex"><ChevronRight aria-hidden className="size-6" /></button>
      </div>
      <div className="flex w-full max-w-[460px] items-center gap-3 rounded-2xl bg-white/10 p-3 text-jade-50">
        <ZoneStamp zone={it.zone} />
        <span className="min-w-0 flex-1 truncate text-body-sm text-jade-100/80">
          {new Date(it.at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>
    </motion.div>,
    document.body,
  );
}

export function ZoneAlbum() {
  const [filter, setFilter] = useState<'all' | AlbumZone>('all');
  const [items, setItems] = useState<AlbumItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const zone = filter === 'all' ? undefined : filter;

  useEffect(() => {
    let alive = true;
    setState('loading'); setItems(null); setNext(null);
    fetchAlbum({ zone })
      .then((r) => { if (!alive) return; setItems(r.items); setNext(r.next); setState('ready'); })
      .catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [zone, attempt]);

  const loadMore = useCallback(async () => {
    if (!next || more) return;
    setMore(true);
    try {
      const r = await fetchAlbum({ zone, before: next });
      setItems((l) => [...(l ?? []), ...r.items.filter((x) => !(l ?? []).some((y) => y.source === x.source && y.id === x.id))]);
      setNext(r.next);
    } catch { /* se reintenta al volver a bajar */ } finally { setMore(false); }
  }, [zone, more, next]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) void loadMore(); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, next]);

  const months = useMemo(() => {
    const out: Array<{ label: string; items: Array<{ it: AlbumItem; index: number }> }> = [];
    (items ?? []).forEach((it, index) => {
      const label = monthOf(it.at);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push({ it, index }); else out.push({ label, items: [{ it, index }] });
    });
    return out;
  }, [items]);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PrivacyNote />
      <div role="radiogroup" aria-label="Zona" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}
            className={cn('min-h-11 shrink-0 rounded-full border px-4 text-label-lg transition-colors', filter === f.id ? 'border-primary bg-primary/10 text-primary-text' : 'border-border bg-surface text-on-surface hover:border-primary/40')}>
            {f.label}
          </button>
        ))}
      </div>

      {state === 'error' ? <ErrorState onRetry={() => setAttempt((n) => n + 1)} /> : state === 'loading' ? (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <li key={i}><Skeleton className="aspect-[0.86] rounded-[3px]" /></li>)}</ul>
      ) : !items?.length ? (
        <EmptyState icon={Album} title="Tu álbum RPG está en blanco"
          description="Las fotos de progreso del gimnasio, las prendas y conjuntos del espejo y las que envías en tus cartas aparecerán aquí." />
      ) : (
        <div className="flex flex-col gap-10">
          {months.map((mo) => (
            <section key={mo.label} aria-label={mo.label} className="flex flex-col gap-5">
              <h2 className="text-heading-lg capitalize text-on-background"><Lettering text={mo.label} draw={false} /></h2>
              <ul className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
                {mo.items.map(({ it, index }) => <AlbumCard key={`${it.source}:${it.id}`} it={it} index={index} onOpen={() => setOpen(index)} />)}
              </ul>
            </section>
          ))}
          <div ref={sentinel} className="flex justify-center py-4">
            {next && <Button variant="ghost" loading={more} onClick={() => void loadMore()}>Ver más fotos</Button>}
          </div>
        </div>
      )}

      <AnimatePresence>
        {open !== null && items?.[open] && <Viewer key="album-viewer" items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}
