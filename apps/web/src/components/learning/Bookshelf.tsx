// La estantería de la Biblioteca: un mueble de madera con remate, fondo en sombra
// y un estante por estado, cada uno con su placa de latón. Cada ítem es un lomo
// de pie (alto según el título, grueso según su tamaño, bandas doradas, color por
// formato y un marcapáginas que cuelga según el progreso). Al llegar, los libros
// se colocan deslizándose uno a uno; al pasar el cursor el libro asoma del estante.
// Un libro que terminas vuela de su estante al de completados (layoutId) y vuelve
// con un brillo. Cada lomo es un botón (abre «Actualizar progreso»).
import { useEffect, useRef } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import type { LearningItem } from '@lifequest/shared';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import type { Tone } from '@/components/ui/lq';

const SPINE: Record<Exclude<Tone, 'muted'>, string> = {
  primary: 'bg-primary-strong', secondary: 'bg-secondary-text', forest: 'bg-forest-text', success: 'bg-success-text',
  warning: 'bg-warning-text', error: 'bg-error-text', info: 'bg-info-text',
};

export interface ShelfBook { item: LearningItem; tone: Exclude<Tone, 'muted'>; label: string; pct: number }
export interface Shelf { id: string; label: string; books: ShelfBook[]; empty: string }

/** Grosor del lomo (px) según el tamaño del ítem: un libro de 800 páginas es más grueso que uno de 120. */
const thickness = (total: number) => Math.round(30 + Math.min(26, Math.log2(Math.max(1, total)) * 2.6));
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

function Spine({ b, i, onPick, closing, seen }: { b: ShelfBook; i: number; onPick: (it: LearningItem) => void; closing: boolean; seen: boolean }) {
  const h = hash(b.item.title);
  const height = 150 + (h % 46);
  const bands = h % 3;
  const done = b.item.status === 'COMPLETED';
  return (
    <motion.li
      layout="position"
      layoutId={`book-${b.item.id}`}
      className={cn('shrink-0', closing && 'relative z-20')}
      // Un libro que ya estaba en la estantería no vuelve a entrar: solo cambia de estante.
      initial={seen ? false : { x: 46, opacity: 0, rotate: 4 }}
      animate={{ x: 0, opacity: 1, rotate: 0, transition: { ...springs.heavy, delay: 0.35 + i * 0.07, opacity: { duration: 0.2, delay: 0.35 + i * 0.07 } } }}
      transition={{ layout: { ...springs.heavy } }}
    >
      <motion.button
        type="button"
        onClick={() => onPick(b.item)}
        aria-label={`${b.item.title}: ${b.label}, ${b.pct} por ciento. Actualizar progreso`}
        // Al pasar el cursor el libro asoma del estante; al tocar se hunde un poco.
        whileHover={{ y: -12, rotate: -1.5, transition: springs.gentle }}
        whileFocus={{ y: -12, rotate: -1.5, transition: springs.gentle }}
        whileTap={{ y: -6, scale: 0.98, transition: springs.snappy }}
        animate={closing ? { scaleX: [1, 1.18, 0.94, 1], y: [0, -26, 0, 0], transition: { duration: 1.1, times: [0, 0.35, 0.7, 1], ease: [0.16, 1, 0.3, 1], delay: 0.5 } } : undefined}
        className={cn('lq-spine relative flex flex-col items-center justify-between overflow-hidden rounded-[3px_3px_2px_2px] py-3 text-background', SPINE[b.tone])}
        style={{ width: thickness(b.item.totalProgress || 120), height }}
      >
        {/* Marcapáginas: cuelga más cuanto más llevas */}
        <motion.span
          aria-hidden="true"
          className="absolute right-1.5 top-0 z-10 block w-1.5 origin-top rounded-b-sm bg-warning"
          style={{ height: height * 0.55 }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: Math.max(0.08, b.pct / 100), transition: { ...springs.gentle, delay: 0.9 + i * 0.07 } }}
        />
        <span aria-hidden="true" className={cn('lq-band block w-full', bands === 0 ? 'h-[5px]' : 'h-[2px] shadow-[0_4px_0_rgb(var(--lq-secondary)/.7)]')} />
        <span aria-hidden="true" className="line-clamp-1 max-h-[64%] text-label-md font-semibold [text-orientation:mixed] [writing-mode:vertical-rl] rotate-180">{b.item.title}</span>
        <span aria-hidden="true" className="flex w-full flex-col items-center gap-1.5">
          {bands === 2 && <span className="block size-1.5 rotate-45 bg-secondary/80" />}
          <span className={cn('lq-band block w-full', bands === 1 ? 'h-[5px]' : 'h-[2px] shadow-[0_-4px_0_rgb(var(--lq-secondary)/.7)]')} />
        </span>
        {/* Terminado: el dorado del lomo brilla al volver al estante */}
        {done && <span aria-hidden="true" className={cn('lq-sheen-sweep', !closing && 'hidden')} style={{ ['--sheen-every' as string]: '2.6s', ['--sheen-delay' as string]: '1.2s' }} />}
      </motion.button>
    </motion.li>
  );
}

/** Libros de la biblioteca (sin título, apagados) y un objeto por estante: el mueble se ve lleno. */
function ShelfDecor({ kind }: { kind: number }) {
  const spines = [[132, 22, 'bg-forest/50'], [150, 26, 'bg-error-text/45'], [140, 18, 'bg-secondary-text/50'], [158, 24, 'bg-info-text/45']].slice(kind, kind + 3) as [number, number, string][];
  return (
    <span aria-hidden="true" className="relative ml-auto hidden shrink-0 items-end gap-0.5 pr-4 sm:flex">
      {kind !== 1 && spines.map(([h, w, c], k) => <span key={k} className={cn('lq-spine relative block rounded-[2px]', c)} style={{ height: h, width: w, rotate: k === spines.length - 1 && kind === 2 ? '-8deg' : undefined, transformOrigin: '100% 100%' }} />)}
      {kind === 0 && (
        // Pila de libros acostados
        <span className="ml-3 flex flex-col items-end">
          <span className="block h-4 w-28 rounded-[2px] bg-forest/80 shadow-sm" />
          <span className="block h-5 w-32 rounded-[2px] bg-error-text/80 shadow-sm" />
          <span className="block h-4 w-[7.5rem] rounded-[2px] bg-info-text/80 shadow-sm" />
        </span>
      )}
      {kind === 1 && (
        // Globo terráqueo sobre su pie
        <svg viewBox="0 0 70 96" className="ml-2 block h-24 w-[4.4rem]">
          <circle cx="35" cy="38" r="26" className="fill-info-text/70" />
          <path d="M18 26c8 4 10 12 6 18s4 10 10 8M44 16c-4 6 0 10 6 12s4 12-2 16" className="fill-none stroke-success/70" strokeWidth="6" strokeLinecap="round" />
          <path d="M9 38a26 26 0 0 0 52 0" className="fill-none stroke-[rgb(var(--lq-secondary))]" strokeWidth="2.5" />
          <path d="M35 64v18M20 90h30" className="stroke-[rgb(var(--lq-secondary))]" strokeWidth="4" strokeLinecap="round" />
        </svg>
      )}
      {kind === 2 && (
        // Planta en su maceta
        <svg viewBox="0 0 64 90" className="ml-3 block h-[5.5rem] w-16">
          <path d="M32 54C30 38 20 30 10 30c2 12 12 20 22 24ZM32 54c2-18 12-28 22-30-2 14-10 24-22 30ZM32 54c-2-16 0-30 4-40 4 12 2 28-4 40Z" className="fill-success/80" />
          <path d="M18 56h28l-4 30H22Z" className="fill-error-text/70" />
          <path d="M16 54h32v6H16Z" className="fill-error-text/90" />
        </svg>
      )}
    </span>
  );
}

export function Bookcase({ shelves, onPick, closing, className }: { shelves: Shelf[]; onPick: (it: LearningItem) => void; closing?: string | null; className?: string }) {
  let n = 0;
  const seen = useRef(new Set<string>());
  useEffect(() => { shelves.forEach((s) => s.books.forEach((b) => seen.current.add(b.item.id))); });
  return (
    <div className={cn('lq-wood lq-bookcase relative rounded-lg px-2.5 pb-3 pt-0 md:px-3.5', className)}>
      {/* Remate superior del mueble */}
      <span aria-hidden="true" className="lq-crown -mx-2.5 mb-2.5 block h-4 rounded-t-lg md:-mx-3.5" />
      <LayoutGroup>
        <div className="flex flex-col gap-2.5">
          {shelves.map((s, si) => (
            <div key={s.id} className="relative">
              <div className={cn('lq-shelf-back relative flex items-end rounded-sm', !closing && 'overflow-hidden', s.books.length ? 'min-h-[12.5rem]' : 'min-h-[9rem]')}>
                {/* Mientras un libro cambia de estante nada lo recorta */}
                <ul aria-labelledby={`shelf-${s.id}`} className={cn("relative flex min-w-0 items-end gap-1 px-3 pt-6 [scrollbar-width:thin]", closing ? "overflow-visible" : "overflow-x-auto")}>
                  {s.books.map((b) => <Spine key={b.item.id} b={b} i={n++} onPick={onPick} closing={closing === b.item.id} seen={seen.current.has(b.item.id)} />)}
                </ul>
                {s.books.length === 0 && <p className="relative self-center px-5 text-body-sm text-jade-50/70">{s.empty}</p>}
                {/* Sujetalibros de latón y, en el primer estante, libros acostados */}
                {s.books.length > 0 && <span aria-hidden="true" className="lq-bookend relative mb-0 ml-1 block h-14 w-3 shrink-0" />}
                <ShelfDecor kind={si % 3} />
              </div>
              {/* La tabla del estante, con su placa de latón */}
              <div aria-hidden="true" className="lq-board relative h-3.5 rounded-[2px]" />
              <span id={`shelf-${s.id}`} className="lq-brass absolute -bottom-2 left-4 px-2.5 py-0.5 text-label-md">
                {s.label} <span className="font-mono">{s.books.length}</span>
              </span>
            </div>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
