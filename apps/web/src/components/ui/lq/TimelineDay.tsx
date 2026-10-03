import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface TimelineItem {
  id: string;
  /** Minutos desde las 00:00. */
  start: number;
  /** Duración en minutos (se muestra con un mínimo de 56 px). */
  duration: number;
  render: ReactNode;
  className?: string;
}

export interface TimelineDayProps {
  items: TimelineItem[];
  /** Mostrar la línea "ahora" (solo si el día es hoy). */
  showNow?: boolean;
  /** Rango visible mínimo, en horas. Se amplía para que quepan todos los bloques. */
  fromHour?: number;
  toHour?: number;
  /** Altura de una hora en px. */
  hourHeight?: number;
  label: string;
  className?: string;
}

const MIN_BLOCK = 56;

/** Reparte los bloques solapados en columnas (greedy por inicio). */
function layout(items: TimelineItem[]) {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.duration - a.duration);
  const out: Array<{ item: TimelineItem; col: number; cols: number }> = [];
  let group: typeof out = [];
  let groupEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...group.map((g) => g.col + 1));
    group.forEach((g) => { g.cols = cols; });
    out.push(...group);
    group = [];
  };
  for (const item of sorted) {
    if (group.length && item.start >= groupEnd) flush();
    const taken = new Set(group.filter((g) => g.item.start + Math.max(g.item.duration, 1) > item.start).map((g) => g.col));
    let col = 0;
    while (taken.has(col)) col += 1;
    group.push({ item, col, cols: 1 });
    groupEnd = Math.max(groupEnd, item.start + Math.max(item.duration, 1));
  }
  flush();
  return out;
}

/**
 * Día en horas: rejilla con etiquetas mono, bloques absolutos (entran con pop escalonado)
 * y línea "ahora" que aparece al final. Solo transform/opacity en la animación.
 */
export function TimelineDay({ items, showNow, fromHour = 7, toHour = 20, hourHeight = 64, label, className }: TimelineDayProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!showNow) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [showNow]);

  const { start, end, placed } = useMemo(() => {
    const first = Math.min(fromHour, ...items.map((i) => Math.floor(i.start / 60)));
    const last = Math.max(toHour, ...items.map((i) => Math.ceil((i.start + Math.max(i.duration, 30)) / 60)));
    return { start: Math.max(0, first), end: Math.min(24, last), placed: layout(items) };
  }, [items, fromHour, toHour]);

  const hours = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowVisible = showNow && nowMin >= start * 60 && nowMin <= end * 60;
  const top = (min: number) => ((min - start * 60) / 60) * hourHeight;

  return (
    <div role="group" aria-label={label} className={cn('relative ml-14', className)} style={{ height: (end - start) * hourHeight }}>
      {hours.map((h) => (
        <div key={h} aria-hidden className="absolute inset-x-0 border-t border-border" style={{ top: (h - start) * hourHeight }}>
          <span className="absolute -left-14 -top-3 font-mono text-body-sm tabular-nums text-on-surface-light">{String(h).padStart(2, '0')}:00</span>
        </div>
      ))}
      {nowVisible && (
        <motion.div
          aria-label={`Ahora, ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`}
          role="img"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.4 }}
          className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-error" style={{ top: top(nowMin) }}
        >
          <span aria-hidden className="absolute -left-1.5 -top-[5px] size-3 rounded-full bg-error" />
        </motion.div>
      )}
      {placed.map(({ item, col, cols }, i) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 + i * 0.06, ease: [0, 0, 0.2, 1] }}
          className={cn('absolute', item.className)}
          style={{
            top: top(item.start) + 2,
            minHeight: Math.max(MIN_BLOCK, (item.duration / 60) * hourHeight - 4),
            left: `calc(${(col / cols) * 100}% + ${col === 0 ? 12 : 4}px)`,
            width: `calc(${100 / cols}% - ${col === 0 ? 12 : 4}px)`,
          }}
        >
          {item.render}
        </motion.div>
      ))}
    </div>
  );
}
