// Estante de la Biblioteca: cada ítem es un lomo de libro de pie sobre la
// tabla. El grosor sale del tamaño (páginas o unidades), el marcapáginas marca
// el progreso y al pasar el cursor el libro asoma del estante. Los libros se
// asientan uno a uno con peso; uno recién terminado se cierra y vuelve con un
// brillo suave. Cada lomo es un botón (abre «Actualizar progreso»).
import { motion } from 'framer-motion';
import type { LearningItem } from '@lifequest/shared';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion';
import type { Tone } from '@/components/ui/lq';

const SPINE: Record<Exclude<Tone, 'muted'>, string> = {
  primary: 'bg-primary-strong', secondary: 'bg-secondary-text', forest: 'bg-forest-text', success: 'bg-success-text',
  warning: 'bg-warning-text', error: 'bg-error-text', info: 'bg-info-text',
};

export interface ShelfBook { item: LearningItem; tone: Exclude<Tone, 'muted'>; label: string; pct: number }

/** Grosor del lomo (px) según el tamaño del ítem: un libro de 800 páginas es más grueso que uno de 120. */
const thickness = (total: number) => Math.round(30 + Math.min(26, Math.log2(Math.max(1, total)) * 2.6));

export function Bookshelf({ books, onPick, closing }: { books: ShelfBook[]; onPick: (it: LearningItem) => void; closing?: string | null }) {
  if (!books.length) return null;
  return (
    <div className="flex flex-col">
      <ul aria-label="Estante" className="flex items-end gap-1.5 overflow-x-auto px-3 pt-6 [scrollbar-width:thin]">
        {books.map((b, i) => {
          const h = 156 + ((b.item.title.length * 7) % 44);
          const done = b.item.status === 'COMPLETED';
          const isClosing = closing === b.item.id;
          return (
            <motion.li
              key={b.item.id}
              className="shrink-0"
              initial={{ y: -36, opacity: 0, rotate: i % 2 ? 2 : -2 }}
              animate={{ y: 0, opacity: 1, rotate: 0, transition: { ...springs.heavy, delay: 0.2 + i * 0.08, opacity: { duration: 0.25, delay: 0.2 + i * 0.08 } } }}
            >
              <motion.button
                type="button"
                onClick={() => onPick(b.item)}
                aria-label={`${b.item.title}: ${b.label}, ${b.pct} por ciento. Actualizar progreso`}
                // Al pasar el cursor el libro asoma del estante; al tocar se hunde un poco.
                whileHover={{ y: -12, rotate: -1.5, transition: springs.gentle }}
                whileTap={{ y: -6, scale: 0.98, transition: springs.snappy }}
                animate={isClosing ? { scaleX: [1, 1.18, 0.94, 1], y: [0, -26, 0, 0], transition: { duration: 1.1, times: [0, 0.35, 0.7, 1], ease: [0.16, 1, 0.3, 1] } } : undefined}
                className={cn('relative flex flex-col items-center justify-between overflow-hidden rounded-[3px_3px_2px_2px] py-3 text-background shadow-md', SPINE[b.tone])}
                style={{ width: thickness(b.item.totalProgress || 120), height: h }}
              >
                {/* Marcapáginas: cuelga más cuanto más llevas */}
                <motion.span
                  aria-hidden="true"
                  className="absolute right-1.5 top-0 block w-1.5 origin-top rounded-b-sm bg-warning"
                  style={{ height: h * 0.55 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: Math.max(0.08, b.pct / 100), transition: { ...springs.gentle, delay: 0.6 + i * 0.08 } }}
                />
                <span aria-hidden="true" className="block h-px w-3/5 bg-background/40" />
                <span aria-hidden="true" className="line-clamp-1 max-h-[70%] text-label-md font-semibold [writing-mode:vertical-rl] [text-orientation:mixed] rotate-180">{b.item.title}</span>
                <span aria-hidden="true" className="block h-px w-3/5 bg-background/40" />
                {/* Brillo al volver terminado al estante */}
                {(isClosing || done) && <span aria-hidden="true" className={cn('lq-sheen-sweep', !isClosing && 'hidden')} style={{ ['--sheen-every' as string]: '2.6s', ['--sheen-delay' as string]: '0.5s' }} />}
              </motion.button>
            </motion.li>
          );
        })}
      </ul>
      {/* La tabla del estante */}
      <div aria-hidden="true" className="h-3 rounded-[3px] bg-jade-800 shadow-md [background-image:linear-gradient(180deg,rgb(var(--lq-jade-700)),rgb(var(--lq-jade-900)))]" />
      <div aria-hidden="true" className="mx-2 h-2 rounded-b-md bg-on-background/10 blur-[3px]" />
    </div>
  );
}
