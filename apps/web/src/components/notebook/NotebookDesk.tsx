// Escritorio de libretas: cada libreta es un cuaderno en 3D (tapa con su tela, lomo,
// canto de hojas y goma elástica) que se levanta y se deja donde quieras sobre la
// mesa, con inercia y rebote en los bordes (components/ambience/Pickup). El sitio de
// cada una se guarda en el dispositivo como fracción del espacio libre, así sobrevive
// a otro ancho de pantalla; «Ordenar» las vuelve a poner en filas. Un toque la abre.
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { LayoutGrid, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pickup } from '@/components/ambience';
import { Button } from '@/components/ui/lq';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useLocale, useText, type Copy } from '@/lib/i18n';
import type { Notebook } from '@/services/notebook.service';
import { categoryLabelFor, coversFor } from './paper';

const es = {
  openAria: (title: string): string => `Abrir ${title}`,
  settingsAria: (title: string): string => `Ajustes de ${title}`,
  pagesUsed: (used: number, total: number): string => `${used}/${total} págs.`,
  tidy: 'Ordenar',
  hintTouch: 'Mantén pulsada una libreta para moverla por la mesa.',
  hintMouse: 'Arrastra las libretas para dejarlas donde quieras.',
};

const en: typeof es = {
  openAria: (title: string): string => `Open ${title}`,
  settingsAria: (title: string): string => `${title} settings`,
  pagesUsed: (used: number, total: number): string => `${used}/${total} pp.`,
  tidy: 'Tidy up',
  hintTouch: 'Press and hold a notebook to move it around the desk.',
  hintMouse: 'Drag your notebooks anywhere on the desk.',
};

const COPY: Copy<typeof es> = { es, en };

type Spot = { fx: number; fy: number };
const keyOf = (userId: string) => `lq-desk-notebooks:${userId}`;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function readSpots(key: string): Record<string, Spot> {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, Spot>; } catch { return {}; }
}

/** El cuaderno en 3D: un prisma con tapa, contratapa, lomo y cantos de hojas (CSS 3D). */
function Book3D({ book, w, h, onOpen, onEdit }: { book: Notebook; w: number; h: number; onOpen: () => void; onEdit: () => void }) {
  const t = useText(COPY);
  const locale = useLocale();
  const cover = coversFor(locale)[book.color].className;
  // Grosor según las páginas: un cuaderno de 200 hojas abulta más que uno de 20.
  const depth = Math.round(9 + Math.min(14, book.pageCount / 14));
  return (
    <div className="lq-book3d" style={{ '--w': `${w}px`, '--h': `${h}px`, '--t': `${depth}px` } as CSSProperties}>
      <span aria-hidden className={cn('lq-book3d-back', cover)} />
      <span aria-hidden className={cn('lq-book3d-spine', cover)} />
      <span aria-hidden className="lq-book3d-pages" />
      <span aria-hidden className="lq-book3d-foot" />
      <div className={cn('lq-book3d-cover text-background', cover)}>
        <button type="button" onClick={onOpen} aria-label={t.openAria(book.title)} className="absolute inset-0 rounded-[inherit] text-left outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary">
          {/* Lomo, goma elástica y grano de la tela */}
          <span aria-hidden className="absolute inset-y-0 left-0 w-[9%] bg-black/25 shadow-[inset_-2px_0_3px_rgb(0_0_0/.2)]" />
          <span aria-hidden className="absolute inset-y-0 right-[11%] w-[4.5%] bg-black/30 shadow-[1px_0_2px_rgb(0_0_0/.25)]" />
          <span aria-hidden className="lq-tex-linen absolute inset-0 opacity-60" />
          <span className="absolute left-[16%] right-[19%] top-[15%] flex flex-col gap-1 rounded-md bg-background/95 px-2.5 py-2 text-on-background shadow-sm">
            <span className="line-clamp-3 hyphens-auto break-words text-label-lg leading-snug">{book.title}</span>
            <span className="text-label-md text-on-surface-light">{categoryLabelFor(book.category, locale)}</span>
          </span>
          <span className="absolute bottom-3 left-[17%] font-mono text-label-md tabular-nums opacity-90">{t.pagesUsed(book.usedPages, book.pageCount)}</span>
        </button>
        <Button variant="icon" aria-label={t.settingsAria(book.title)} onClick={onEdit} className="absolute right-0 top-0 text-background hover:bg-black/20">
          <MoreHorizontal aria-hidden className="size-5" />
        </Button>
      </div>
    </div>
  );
}

export function NotebookDesk({ books, userId, onOpen, onEdit }: { books: Notebook[]; userId: string; onOpen: (id: string) => void; onEdit: (book: Notebook) => void }) {
  const t = useText(COPY);
  const touch = useMediaQuery('(pointer: coarse)');
  const desk = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const key = keyOf(userId);
  const [spots, setSpots] = useState<Record<string, Spot>>(() => readSpots(key));
  /** Orden de apilado: la última que se levantó queda encima. */
  const [stack, setStack] = useState<string[]>([]);

  useLayoutEffect(() => {
    const el = desk.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const narrow = width < 520;
  const slotW = narrow ? 150 : 172;
  const slotH = Math.round((slotW * 4) / 3);
  const gap = narrow ? 18 : 30;
  const cols = Math.max(2, Math.floor((width + gap) / (slotW + gap)));
  const rows = Math.max(1, Math.ceil(books.length / cols));
  const rowH = slotH + gap + 14;
  // Siempre queda sitio libre para apartar una libreta, aunque quepan todas en una fila.
  const height = Math.max(rows * rowH + 36, Math.round(slotH * 1.9) + 60);
  const left = Math.max(0, (width - (cols * slotW + (cols - 1) * gap)) / 2);
  const freeW = Math.max(1, width - slotW);
  const freeH = Math.max(1, height - slotH);

  const place = (book: Notebook, i: number) => {
    const s = spots[book.id];
    if (s) return { x: s.fx * freeW, y: s.fy * freeH };
    return { x: left + (i % cols) * (slotW + gap), y: 22 + Math.floor(i / cols) * rowH };
  };
  const save = (update: (prev: Record<string, Spot>) => Record<string, Spot>) => setSpots((prev) => {
    const next = update(prev);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* sin almacenamiento: vale para esta visita */ }
    return next;
  });
  const tidy = () => {
    setStack([]);
    save(() => ({}));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-on-surface-light">{touch ? t.hintTouch : t.hintMouse}</p>
        {Object.keys(spots).length > 0 && (
          <Button variant="ghost" size="sm" onClick={tidy}><LayoutGrid aria-hidden className="size-4" />{t.tidy}</Button>
        )}
      </div>
      <div ref={desk} className="lq-desk relative" style={{ height }}>
        {width > 0 && books.map((book, i) => (
          <Pickup
            key={book.id}
            bounds={desk}
            at={place(book, i)}
            onLift={() => setStack((s) => [...s.filter((id) => id !== book.id), book.id])}
            onDrop={(p) => save((prev) => ({ ...prev, [book.id]: { fx: clamp01(p.x / freeW), fy: clamp01(p.y / freeH) } }))}
            className="absolute left-0 top-0"
            style={{ width: slotW, height: slotH, zIndex: stack.indexOf(book.id) + 2 }}
          >
            <Book3D book={book} w={slotW} h={slotH} onOpen={() => onOpen(book.id)} onEdit={() => onEdit(book)} />
          </Pickup>
        ))}
      </div>
    </div>
  );
}
