// Barra de páginas de la libreta: avanza con cada hoja. Usa el lenguaje de las barras
// de la app (pista surface-variant, relleno primary que entra con muelle y un brillo
// que recorre el relleno). El pulgar se desliza hasta la página y, si caben, los
// puntos marcan las que ya pasaste. Por dentro es un input range: el teclado y los
// lectores de pantalla lo manejan como siempre. La hoja gira al soltar.
import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { useText, type Copy } from '@/lib/i18n';

const es = {
  goTo: 'Ir a la página',
  pageOf: (shown: number, total: number): string => `Página ${shown} de ${total}`,
};

const en: typeof es = {
  goTo: 'Go to page',
  pageOf: (shown: number, total: number): string => `Page ${shown} of ${total}`,
};

const COPY: Copy<typeof es> = { es, en };

/** Hasta esta cantidad de páginas se dibuja un punto por página. */
const DOTS_MAX = 24;

export function PageProgress({ value, total, onCommit }: {
  /** Página actual (desde 1). */
  value: number;
  total: number;
  /** Al soltar (o al soltar una tecla): la hoja pasa a esa página. */
  onCommit: (page: number) => void;
}) {
  const t = useText(COPY);
  // Mientras se arrastra, la barra sigue al dedo sin muelle; la hoja no se mueve hasta soltar.
  const [drag, setDrag] = useState<number | null>(null);
  const shown = drag ?? value;
  const frac = total > 1 ? (shown - 1) / (total - 1) : 1;
  const spring = drag !== null ? { duration: 0 } : springs.natural;
  const finish = () => {
    if (drag === null) return;
    setDrag(null);
    onCommit(drag);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 px-1">
      <div className="flex items-baseline justify-between font-mono text-label-md tabular-nums text-on-surface-light">
        <motion.span
          key={shown}
          className="text-on-background"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {shown}
        </motion.span>
        <span>{total}</span>
      </div>
      <div className="relative flex h-11 items-center">
        {/* Pista y relleno: el relleno se escala en X, nunca cambia de ancho */}
        <div aria-hidden className="absolute inset-x-0 h-2 overflow-hidden rounded-full bg-surface-variant">
          <motion.span
            className="relative block h-full w-full origin-left overflow-hidden rounded-full bg-primary"
            animate={{ scaleX: frac }}
            transition={spring}
          >
            <span className="lq-sheen-sweep" />
          </motion.span>
        </div>
        {total > 1 && total <= DOTS_MAX && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
            {Array.from({ length: total }, (_, k) => (
              <span
                key={k}
                className={cn('size-1.5 rounded-full transition-colors duration-300', k < shown ? 'bg-background/80' : 'bg-on-surface-light/35')}
              />
            ))}
          </div>
        )}
        {/* Control real: transparente, encima de todo lo visual */}
        <input
          type="range" min={1} max={total} step={1} value={shown}
          aria-label={t.goTo} aria-valuetext={t.pageOf(shown, total)}
          onChange={(e) => setDrag(Number(e.target.value))}
          onPointerUp={finish} onKeyUp={finish} onBlur={finish}
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none opacity-0 focus:outline-none"
        />
        {/* El pulgar va después del control para que su anillo de foco siga al teclado */}
        <motion.span
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-1/2 size-5 rounded-full border-[3px] border-background bg-primary shadow-md',
            'peer-focus-visible:ring-4 peer-focus-visible:ring-primary/30',
          )}
          style={{ x: '-50%', y: '-50%' }}
          animate={{ left: `${frac * 100}%`, scale: drag !== null ? 1.15 : 1 }}
          transition={spring}
        />
      </div>
    </div>
  );
}
