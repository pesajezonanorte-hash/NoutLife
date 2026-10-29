// El armario del Espejo en 3D (CSS): un mueble de madera cuyas puertas se abren al
// llegar (la derecha trae el espejo por dentro), una barra de latón con las prendas
// colgadas en perchas que se mecen y una repisa abajo para el calzado. Tocar una
// prenda la lleva al «look en curso» (la bandeja de abajo), donde se arma y se guarda
// la combinación; el botón «⋯» de cada prenda abre su ficha (usar hoy, eliminar).
// Solo transform y opacity; con «Reducir movimiento» las puertas ya están abiertas.
import { type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MoreHorizontal, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import { useMotionStore } from '@/store/motionStore';
import { Button } from '@/components/ui/lq';
import { useText, type Copy } from '@/lib/i18n';

export interface WardrobeItem {
  id: string; name: string; category: string; color?: string | null; photoData?: string | null;
  brand?: string | null; timesWorn: number; isFavorite: boolean;
}

const es = {
  pick: (name: string): string => `Añadir ${name} al look`,
  unpick: (name: string): string => `Quitar ${name} del look`,
  more: (name: string): string => `Ficha de ${name}`,
  uses: (n: number): string => `${n} ${n === 1 ? 'uso' : 'usos'}`,
  look: 'Look en curso',
  lookEmpty: 'Toca prendas del armario para armar una combinación.',
  lookCount: (n: number): string => `${n} ${n === 1 ? 'prenda' : 'prendas'}`,
  save: 'Guardar combinación',
  remove: (name: string): string => `Quitar ${name}`,
  rail: 'Prendas colgadas',
  shelf: 'Calzado',
};

const en: typeof es = {
  pick: (name: string): string => `Add ${name} to the look`,
  unpick: (name: string): string => `Remove ${name} from the look`,
  more: (name: string): string => `${name} details`,
  uses: (n: number): string => `${n} ${n === 1 ? 'wear' : 'wears'}`,
  look: 'Look in progress',
  lookEmpty: 'Tap pieces in the wardrobe to build an outfit.',
  lookCount: (n: number): string => `${n} ${n === 1 ? 'piece' : 'pieces'}`,
  save: 'Save outfit',
  remove: (name: string): string => `Remove ${name}`,
  rail: 'Hanging pieces',
  shelf: 'Shoes',
};

const COPY: Copy<typeof es> = { es, en };

/** Colores escritos a mano («azul marino», «black»…) a un tono; si no se reconoce, uno estable por nombre. */
const COLOR_WORDS: Array<[RegExp, string]> = [
  [/negr|black/, '#2b2b30'], [/blanc|white|crema|cream|beige|hueso/, '#ece6da'], [/gris|grey|gray/, '#8a8f98'],
  [/marino|navy/, '#2c3e66'], [/azul|blue|celeste|jean|denim/, '#4a74b5'], [/verde|green|oliva|olive/, '#5e8a54'],
  [/roj|red|vino|burdeos|wine/, '#b03a3a'], [/rosa|pink|fucsia/, '#e08aa6'], [/morad|lila|purple|violet/, '#7d5ba6'],
  [/amarill|yellow|mostaza|mustard/, '#e0b43a'], [/naranj|orange|coral/, '#e07a3f'], [/marr|caf[eé]|brown|camel|tabaco/, '#8a5a3c'],
];
function tint(item: WardrobeItem) {
  const c = (item.color ?? '').toLowerCase();
  const hit = COLOR_WORDS.find(([re]) => re.test(c));
  if (hit) return hit[1];
  const h = [...item.name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 17);
  return `hsl(${h} 32% 52%)`;
}

/** Silueta de la prenda cuando no tiene foto. */
const SHAPES: Record<string, string> = {
  tops: 'M30 8 L18 14 L6 30 L16 38 L22 32 L22 92 L78 92 L78 32 L84 38 L94 30 L82 14 L70 8 C66 16 58 20 50 20 C42 20 34 16 30 8 Z',
  outerwear: 'M32 6 L16 12 L6 34 L6 96 L20 96 L22 40 L24 100 L76 100 L78 40 L80 96 L94 96 L94 34 L84 12 L68 6 L56 30 L50 22 L44 30 Z',
  bottoms: 'M22 6 L78 6 L82 96 L60 96 L52 34 L48 34 L40 96 L18 96 Z',
  accessories: 'M34 30 C34 12 66 12 66 30 L74 30 L80 88 L20 88 L26 30 Z M42 30 C42 20 58 20 58 30 Z',
  shoes: 'M8 58 C8 46 18 40 30 42 L44 46 C54 48 62 40 70 42 L86 50 C94 54 96 62 92 68 L12 68 C8 68 8 62 8 58 Z',
};

function Garment({ item, className }: { item: WardrobeItem; className?: string }) {
  if (item.photoData) {
    return <img src={`data:image/jpeg;base64,${item.photoData}`} alt="" className={cn('lq-garment-photo object-cover', className)} />;
  }
  return (
    <svg viewBox="0 0 100 104" aria-hidden className={cn('overflow-visible', className)} style={{ '--g': tint(item) } as CSSProperties}>
      <path d={SHAPES[item.category] ?? SHAPES.tops} className="lq-garment" />
    </svg>
  );
}

function Hanger({ item, picked, index, onToggle, onMore }: { item: WardrobeItem; picked: boolean; index: number; onToggle: () => void; onMore: () => void }) {
  const t = useText(COPY);
  return (
    <li className="lq-hanger relative flex w-[6.5rem] shrink-0 flex-col items-center" style={{ '--sway-delay': `${-(index % 5) * 0.7}s` } as CSSProperties}>
      {/* Gancho y hombros de la percha */}
      <svg viewBox="0 0 100 34" aria-hidden className="lq-hanger-wire relative z-[1] -mb-2 h-8 w-24 overflow-visible">
        <path d="M50 2 C50 -3 57 -3 57 2 C57 6 52 7 50 10 L50 13 M50 13 L8 30 C5 31 6 34 9 34 L91 34 C94 34 95 31 92 30 L50 13" />
      </svg>
      <motion.button
        type="button" aria-pressed={picked} aria-label={picked ? t.unpick(item.name) : t.pick(item.name)} onClick={onToggle}
        animate={{ y: picked ? 6 : 0, scale: picked ? 1.04 : 1 }} transition={springs.natural}
        className={cn('lq-hanger-cloth relative block rounded-xl outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary', picked && 'lq-hanger-picked')}
      >
        <Garment item={item} className="h-24 w-[5.5rem] rounded-xl" />
        <AnimatePresence>
          {picked && (
            <motion.span
              key="ok" aria-hidden className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-primary-strong text-on-primary shadow-sm"
              initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={springs.snappy}
            >
              <Check className="size-3.5" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
      <span className="mt-2 w-full truncate text-center text-label-md text-jade-50">{item.name}</span>
      <span className="flex items-center gap-1 text-[0.6875rem] text-jade-50/70">
        <span className="font-mono tabular-nums">{t.uses(item.timesWorn)}</span>
        <button type="button" aria-label={t.more(item.name)} onClick={onMore} className="-mr-2 flex size-8 items-center justify-center rounded-full text-jade-50/80 hover:bg-white/10">
          <MoreHorizontal aria-hidden className="size-4" />
        </button>
      </span>
    </li>
  );
}

/** El mueble con sus puertas, la barra con perchas y la repisa del calzado. */
export function Wardrobe3D({ items, selected, onToggle, onMore }: {
  items: WardrobeItem[];
  selected: string[];
  onToggle: (id: string) => void;
  onMore: (item: WardrobeItem) => void;
}) {
  const t = useText(COPY);
  const reduce = useMotionStore((s) => s.reduce);
  const hanging = items.filter((i) => i.category !== 'shoes');
  const shoes = items.filter((i) => i.category === 'shoes');
  const door = (side: 'l' | 'r') => ({
    initial: reduce ? false : { rotateY: 0 },
    animate: { rotateY: side === 'l' ? -108 : 108 },
    transition: { type: 'spring' as const, stiffness: 70, damping: 15, mass: 1.1, delay: side === 'l' ? 0.25 : 0.38 },
  });
  return (
    <div className="lq-wardrobe relative mx-auto w-full max-w-5xl px-5 md:px-10">
      <div className="lq-wardrobe-crown" aria-hidden />
      <div className="lq-wardrobe-body relative">
        {/* Interior: fondo de madera, luz que cae desde arriba y la barra de latón */}
        <span aria-hidden className="lq-wardrobe-light pointer-events-none absolute inset-x-0 top-0 h-2/3" />
        <span aria-hidden className="lq-wardrobe-rail absolute inset-x-3 top-6 h-2.5 rounded-full" />
        <ul aria-label={t.rail} className="relative flex min-h-[15rem] gap-1 overflow-x-auto px-4 pb-4 pt-[1.15rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {hanging.map((it, i) => (
            <Hanger key={it.id} item={it} index={i} picked={selected.includes(it.id)} onToggle={() => onToggle(it.id)} onMore={() => onMore(it)} />
          ))}
        </ul>
        {shoes.length > 0 && (
          <div className="relative border-t border-black/20">
            <span aria-hidden className="lq-wardrobe-shelf absolute inset-x-0 top-0 h-3" />
            <ul aria-label={t.shelf} className="relative flex gap-3 overflow-x-auto px-4 pb-3 pt-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {shoes.map((it) => {
                const picked = selected.includes(it.id);
                return (
                  <li key={it.id} className="flex w-[6rem] shrink-0 flex-col items-center">
                    <motion.button
                      type="button" aria-pressed={picked} aria-label={picked ? t.unpick(it.name) : t.pick(it.name)} onClick={() => onToggle(it.id)}
                      animate={{ y: picked ? -8 : 0 }} transition={springs.natural}
                      className={cn('relative rounded-xl outline-none focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-primary', picked && 'lq-hanger-picked')}
                    >
                      <Garment item={it} className="h-14 w-[5.5rem] rounded-xl" />
                    </motion.button>
                    <span className="mt-1 w-full truncate text-center text-label-md text-jade-50">{it.name}</span>
                    <button type="button" aria-label={t.more(it.name)} onClick={() => onMore(it)} className="flex size-8 items-center justify-center rounded-full text-jade-50/80 hover:bg-white/10">
                      <MoreHorizontal aria-hidden className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {/* Puertas: se abren hacia fuera; la derecha lleva el espejo por dentro. */}
        <motion.span aria-hidden className="lq-wardrobe-door lq-wardrobe-door-l" {...door('l')}>
          <span className="lq-door-face" /><span className="lq-door-face lq-door-inside" />
        </motion.span>
        <motion.span aria-hidden className="lq-wardrobe-door lq-wardrobe-door-r" {...door('r')}>
          <span className="lq-door-face" /><span className="lq-door-face lq-door-inside lq-door-mirror" />
        </motion.span>
      </div>
      <div className="lq-wardrobe-base" aria-hidden />
    </div>
  );
}

/** La bandeja del look en curso: las prendas elegidas, apiladas como sobre una cama. */
export function LookTray({ items, onRemove, onSave }: { items: WardrobeItem[]; onRemove: (id: string) => void; onSave: () => void }) {
  const t = useText(COPY);
  return (
    <section aria-label={t.look} className="lq-look flex flex-wrap items-center gap-4 rounded-3xl border border-border p-4">
      <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
        <h3 className="text-label-lg text-on-background">{t.look}</h3>
        <p className="text-body-sm text-on-surface-light">{items.length ? t.lookCount(items.length) : t.lookEmpty}</p>
      </div>
      <ul className="flex min-h-16 flex-[2_1_16rem] items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <motion.li
              key={it.id} className="relative shrink-0"
              initial={{ opacity: 0, y: -26, rotate: -8, scale: 0.8 }} animate={{ opacity: 1, y: 0, rotate: (i % 2 ? 4 : -3), scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.8, transition: { duration: 0.18 } }} transition={springs.natural}
            >
              <Garment item={it} className="h-16 w-14 rounded-lg shadow-sm" />
              <button type="button" aria-label={t.remove(it.name)} onClick={() => onRemove(it.id)} className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full border border-border bg-background text-on-surface-light shadow-sm">
                <X aria-hidden className="size-3.5" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <Button size="md" disabled={items.length < 2} onClick={onSave}><Sparkles aria-hidden className="size-4" />{t.save}</Button>
    </section>
  );
}
