import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/motion/presets';
import { MIN_BLOCK_PX, layoutTimeline, type TimelineItem } from './timelineLayout';

export type { TimelineItem } from './timelineLayout';

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
  /** Hoja de agenda: medias horas punteadas y margen. */
  ruled?: boolean;
  className?: string;
}

/**
 * Día en horas: rejilla con etiquetas mono, bloques absolutos (entran con pop escalonado)
 * y línea "ahora" que aparece al final. Solo transform/opacity en la animación.
 * Con `ruled` es una hoja de agenda escrita a mano: el margen rojo se traza de arriba
 * abajo, cada línea de hora se dibuja de izquierda a derecha y su hora se escribe;
 * los bloques solo aparecen (su contenido trae su propia entrada, como el resaltador).
 */
export function TimelineDay({ items, showNow, fromHour = 7, toHour = 20, hourHeight = 64, label, ruled, className }: TimelineDayProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!showNow) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [showNow]);

  const { start, end, placed } = useMemo(() => {
    const first = Math.min(fromHour, ...items.map((i) => Math.floor(i.start / 60)));
    const last = Math.max(toHour, ...items.map((i) => Math.ceil((i.start + Math.max(i.duration, 30)) / 60)));
    return {
      start: Math.max(0, first),
      end: Math.min(24, last),
      placed: layoutTimeline(items, (MIN_BLOCK_PX / hourHeight) * 60),
    };
  }, [items, fromHour, toHour, hourHeight]);

  const hours = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowVisible = showNow && nowMin >= start * 60 && nowMin <= end * 60;
  const top = (min: number) => ((min - start * 60) / 60) * hourHeight;

  return (
    <div role="group" aria-label={label} className={cn('relative ml-14', className)} style={{ height: (end - start) * hourHeight }}>
      {/* Hoja de agenda: margen rojo y medias horas punteadas */}
      {ruled && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -left-2 bottom-0 top-0 w-px origin-top bg-error/40"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1, transition: { ...springs.gentle, delay: 0.15 } }}
        />
      )}
      {hours.map((h, i) => (
        <div key={h} aria-hidden className={cn('absolute inset-x-0', !ruled && 'border-t border-border')} style={{ top: (h - start) * hourHeight }}>
          {ruled && (
            <motion.span
              className="absolute inset-x-0 top-0 block h-px origin-left bg-border"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1, transition: { ...springs.gentle, mass: 0.8, delay: 0.2 + i * 0.035 } }}
            />
          )}
          <span
            className={cn('absolute -left-14 -top-3 font-mono text-body-sm tabular-nums text-on-surface-light', ruled && 'lq-write')}
            style={ruled ? ({ '--delay': `${260 + i * 35}ms`, '--d': '420ms' } as CSSProperties) : undefined}
          >
            {String(h).padStart(2, '0')}:00
          </span>
          {ruled && h < end && <span className="absolute inset-x-0 block border-t border-dashed border-border" style={{ top: hourHeight / 2 }} />}
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
          initial={ruled ? { opacity: 0 } : { opacity: 0, scale: 0.97 }} animate={ruled ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={{ duration: ruled ? 0.2 : 0.4, delay: 0.1 + i * 0.06, ease: [0, 0, 0.2, 1] }}
          className={cn('absolute', item.className)}
          style={{
            // Exactamente su tramo de la rejilla (con 1 px de aire arriba y abajo), salvo que no quepa su contenido.
            top: top(item.start) + 1,
            height: Math.max(MIN_BLOCK_PX, (item.duration / 60) * hourHeight - 2),
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
