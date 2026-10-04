// Cargador "terminal": ventana con semáforo, un título que se escribe solo y
// líneas de código que van apareciendo abajo mientras las viejas salen por arriba.
// Todo lo visual es decorativo (aria-hidden); el estado se anuncia con role="status".
// Solo transform/opacity: los segmentos crecen con scaleX desde la izquierda.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePageVisibility } from '@/components/ui/LoadingGate';

const TONES = ['bg-on-surface-light', 'bg-success', 'bg-primary', 'bg-on-surface-light', 'bg-info', 'bg-secondary'];
const TICK_MS = 200;
const KEEP_LINES = 16;

interface Segment { width: number; tone: string; dot: boolean }
interface Line { id: number; indent: boolean; spaced: boolean; rule: boolean; segments: Segment[] }

let seq = 0;
const rand = (n: number) => Math.floor(Math.random() * n);
function makeLine(): Line {
  seq += 1;
  return {
    id: seq,
    indent: Math.random() > 0.7,
    spaced: seq % 4 === 0,
    rule: seq % 6 === 0,
    segments: Array.from({ length: rand(4) + 1 }, () => ({
      width: rand(80) + 50,
      tone: TONES[rand(TONES.length)],
      dot: Math.random() > 0.93,
    })),
  };
}

/** Escribe y borra cada frase en bucle (lento, con pausa al completar). */
function useTyped(words: readonly string[], active: boolean) {
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const word = words[index % words.length] ?? '';

  useEffect(() => {
    if (!active) return;
    const atEnd = count >= word.length;
    const delay = deleting ? 40 : atEnd ? 2000 : 62;
    const t = window.setTimeout(() => {
      if (atEnd && !deleting) setDeleting(true);
      else if (count === 0 && deleting) { setDeleting(false); setIndex((i) => (i + 1) % words.length); }
      else setCount((c) => c + (deleting ? -1 : 1));
    }, delay);
    return () => window.clearTimeout(t);
  }, [active, count, deleting, word, words.length]);

  return word.slice(0, count);
}

export interface ModernLoaderProps {
  /** Frases que se van escribiendo en la barra de título. */
  words?: readonly string[];
  /** Texto para lectores de pantalla (por defecto, la primera frase). */
  label?: string;
  /** lg: página o splash (300 px) · sm: sección o tarjeta (200 px). */
  size?: 'lg' | 'sm';
  className?: string;
}

export function ModernLoader({
  words = ['Preparando todo…', 'Cargando módulos…', 'Casi listo…'],
  label,
  size = 'lg',
  className,
}: ModernLoaderProps) {
  const visible = usePageVisibility();
  const [lines, setLines] = useState<Line[]>([]);
  const typed = useTyped(words, visible);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setLines((old) => [...old.slice(-(KEEP_LINES - 1)), makeLine()]), TICK_MS);
    return () => window.clearInterval(id);
  }, [visible]);

  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn('mx-auto w-full max-w-md', className)}>
      <span className="sr-only">{label ?? words[0]}</span>
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg',
          size === 'lg' ? 'h-[300px]' : 'h-[200px]',
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-error sm:size-3" />
            <span className="size-2.5 rounded-full bg-warning sm:size-3" />
            <span className="size-2.5 rounded-full bg-success sm:size-3" />
          </span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="min-w-0 flex-1 truncate pr-12 text-center font-mono text-body-sm text-on-surface-light"
          >
            {typed}
            <span className="ml-px inline-block h-3.5 w-px translate-y-0.5 bg-on-surface-light" />
          </motion.span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden px-5 py-4">
          {lines.map((line) => (
            <div key={line.id} className={cn('flex shrink-0 flex-col gap-2', line.spaced && 'mt-2')}>
              <motion.div
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={cn('flex h-5 items-center gap-2', line.indent && 'pl-4')}
              >
                {line.segments.map((seg, i) => seg.dot ? (
                  <motion.span
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                    className={cn('size-4 shrink-0 rounded-full opacity-50', seg.tone)}
                  />
                ) : (
                  <motion.span
                    key={i}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    style={{ width: seg.width }}
                    className={cn('h-3 shrink-0 origin-left rounded-sm opacity-50', seg.tone)}
                  />
                ))}
              </motion.div>
              {line.rule && <span className="h-1 w-full rounded-sm bg-border opacity-60" />}
            </div>
          ))}
          <div className={cn('flex h-5 shrink-0 items-center', lines.length % 3 === 1 && 'pl-4')}>
            <motion.span
              animate={{ opacity: [1, 1, 0, 0] }}
              transition={{ duration: 1.06, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
              className="h-3.5 w-0.5 bg-primary"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
