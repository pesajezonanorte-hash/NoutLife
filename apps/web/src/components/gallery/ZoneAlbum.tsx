// Capítulos del Álbum RPG: las fotos privadas que tomaste en cada zona
// (progreso del Gimnasio y prendas del armario del Espejo) junto a las de las cartas.
// Solo las ve su dueño; se cargan desde los endpoints de cada zona.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Dumbbell, Shirt, X } from 'lucide-react';
import { Button, EmptyState, Skeleton } from '@/components/ui/lq';
import { InstantPhoto } from '@/components/social/letters/InstantPhoto';
import { Lettering } from '@/components/layout/Lettering';
import { PrivatePhotoNotice } from '@/components/privacy/PrivatePhotoNotice';
import { lockScroll, unlockScroll } from '@/components/ui/lq/Modal';
import { springs } from '@/lib/motion/presets';
import { useMotionStore } from '@/store/motionStore';
import api from '@/lib/api';
import * as gym2 from '@/services/gym2.service';

export type ZoneAlbumId = 'gym' | 'wardrobe';

export interface ZonePhoto { id: string; zone: ZoneAlbumId; at: string; caption: string | null; src: string }

export const ZONE_ALBUMS: Record<ZoneAlbumId, { label: string; icon: typeof Dumbbell; link: string; empty: string }> = {
  gym: { label: 'Gimnasio', icon: Dumbbell, link: '/gym', empty: 'Sube tu primera foto de progreso en el Gimnasio.' },
  wardrobe: { label: 'Espejo', icon: Shirt, link: '/espejo', empty: 'Fotografía una prenda en el armario del Espejo para empezar este capítulo.' },
};

const toSrc = (data: string) => (data.startsWith('data:') ? data : `data:image/jpeg;base64,${data}`);

/** Fotos de las zonas (una sola carga por visita). */
export function useZonePhotos() {
  const [photos, setPhotos] = useState<ZonePhoto[] | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      gym2.fetchProgressPhotos().catch(() => [] as gym2.ProgressPhoto[]),
      api.get<Array<{ id: string; name: string; category: string; photoData?: string | null; createdAt: string }>>('/mirror/wardrobe').then((r) => r.data).catch(() => []),
    ]).then(([gym, wardrobe]) => {
      if (!alive) return;
      const out: ZonePhoto[] = [
        ...gym.filter((p) => p.photoData).map((p) => ({ id: p.id, zone: 'gym' as const, at: p.date || p.createdAt, caption: p.notes ?? null, src: toSrc(p.photoData!) })),
        ...wardrobe.filter((w) => w.photoData).map((w) => ({ id: w.id, zone: 'wardrobe' as const, at: w.createdAt, caption: w.name, src: toSrc(w.photoData!) })),
      ];
      setPhotos(out.sort((a, b) => b.at.localeCompare(a.at)));
    });
    return () => { alive = false; };
  }, []);
  return photos;
}

function ZoneViewer({ items, index, onIndex, onClose }: { items: ZonePhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const reduce = useMotionStore((s) => s.reduce);
  const navigate = useNavigate();
  const it = items[index];
  const meta = ZONE_ALBUMS[it.zone];
  const go = (d: number) => { const n = index + d; if (n >= 0 && n < items.length) onIndex(n); };
  useEffect(() => {
    lockScroll();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); unlockScroll(); };
  });
  return createPortal(
    <motion.div role="dialog" aria-modal="true" aria-label="Foto en grande"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center gap-4 bg-[rgb(var(--lq-jade-900)/.94)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex w-full max-w-[460px] items-center justify-between text-jade-50">
        <span className="font-mono text-label-md text-jade-100/80">{index + 1} / {items.length}</span>
        <Button variant="icon" aria-label="Cerrar" onClick={onClose} className="text-jade-50 hover:bg-white/10"><X aria-hidden className="size-6" /></Button>
      </div>
      <div className="relative flex w-full max-w-[460px] flex-1 items-center justify-center">
        <motion.div key={it.id} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1, rotate: -1.5 }} transition={springs.natural}
          drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
          onDragEnd={(_, info) => { if (info.offset.x < -80) go(1); else if (info.offset.x > 80) go(-1); }}
          className="w-[min(86vw,400px)] touch-pan-y">
          <InstantPhoto src={it.src} alt={it.caption ?? `Foto de ${meta.label}`} caption={it.caption} className="w-full" />
        </motion.div>
        <button type="button" aria-label="Foto anterior" disabled={index === 0} onClick={() => go(-1)} className="absolute left-0 hidden size-11 items-center justify-center rounded-full bg-white/10 text-jade-50 disabled:opacity-30 md:-left-14 md:flex"><ChevronLeft aria-hidden className="size-6" /></button>
        <button type="button" aria-label="Foto siguiente" disabled={index === items.length - 1} onClick={() => go(1)} className="absolute right-0 hidden size-11 items-center justify-center rounded-full bg-white/10 text-jade-50 disabled:opacity-30 md:-right-14 md:flex"><ChevronRight aria-hidden className="size-6" /></button>
      </div>
      <div className="flex w-full max-w-[460px] items-center gap-3 rounded-2xl bg-white/10 p-3 text-jade-50">
        <meta.icon aria-hidden className="size-6 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-label-lg">{meta.label}</span>
          <span className="block truncate text-body-sm text-jade-100/80">{new Date(it.at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </span>
        <Button size="sm" onClick={() => navigate(meta.link)} className="bg-jade-50 text-jade-900 hover:bg-white">Ir a la zona</Button>
      </div>
    </motion.div>,
    document.body,
  );
}

/** Un capítulo del álbum: las fotos de una zona agrupadas por mes. */
export function ZoneAlbum({ zone, photos }: { zone: ZoneAlbumId; photos: ZonePhoto[] | null }) {
  const [open, setOpen] = useState<number | null>(null);
  const items = useMemo(() => (photos ?? []).filter((p) => p.zone === zone), [photos, zone]);
  const months = useMemo(() => {
    const out: Array<{ label: string; items: Array<{ it: ZonePhoto; index: number }> }> = [];
    items.forEach((it, index) => {
      const label = new Date(it.at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push({ it, index }); else out.push({ label, items: [{ it, index }] });
    });
    return out;
  }, [items]);
  const meta = ZONE_ALBUMS[zone];

  if (photos === null) return <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <li key={i}><Skeleton className="aspect-[0.86] rounded-[3px]" /></li>)}</ul>;
  return (
    <div className="flex flex-col gap-8">
      <PrivatePhotoNotice />
      {items.length === 0 ? <EmptyState icon={meta.icon} title={`Capítulo «${meta.label}» en blanco`} description={meta.empty} /> : months.map((mo) => (
        <section key={mo.label} aria-label={mo.label} className="flex flex-col gap-5">
          <h2 className="text-heading-lg capitalize text-on-background"><Lettering text={mo.label} draw={false} /></h2>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
            {mo.items.map(({ it, index }) => (
              <li key={it.id}>
                <button type="button" onClick={() => setOpen(index)} className="block w-full rounded-[3px] text-left" aria-label={`${meta.label}: ${it.caption ?? 'foto'}, ${new Date(it.at).toLocaleDateString('es-ES')}`}>
                  <InstantPhoto src={it.src} alt="" caption={it.caption} tilt={((index % 5) - 2) * 0.9} className="w-full" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <AnimatePresence>{open !== null && items[open] && <ZoneViewer key="zone-viewer" items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}</AnimatePresence>
    </div>
  );
}
