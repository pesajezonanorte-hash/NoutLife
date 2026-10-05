// Barras con peso (lenguaje compartido de Gimnasio y Finanzas): suben como una
// repetición —arrancan lentas, se pasan un poco y asientan—, cambian de altura con
// el mismo muelle cuando cambian los datos y reaccionan entre sí: al pasar o enfocar
// una, las demás bajan de tono y aparece un tooltip con el detalle.
import { useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';
import { heavy, slam } from '@/lib/motion';

export interface WeightBar {
  key: string;
  /** Etiqueta corta del eje (L, M, lun…). */
  label: string;
  /** Título del tooltip («Martes, 30 sep»). */
  title: string;
  value: number;
  /** Líneas de detalle (sesiones, movimientos…). */
  details: string[];
}

type BarTone = 'primary' | 'error';
const strong: Record<BarTone, string> = { primary: 'bg-primary', error: 'bg-error' };
const soft: Record<BarTone, string> = { primary: 'bg-primary/35', error: 'bg-error/35' };
const ink: Record<BarTone, string> = { primary: 'text-primary-text', error: 'text-error-text' };

export interface WeightBarsProps {
  data: WeightBar[];
  label: string;
  format: (n: number) => string;
  height?: number;
  tone?: BarTone;
  /** Texto del tooltip para la barra mayor («Mayor carga de la semana»). */
  bestLabel?: string;
  /** Texto para barras en cero («Descanso», «Sin gastos»). */
  emptyLabel?: string;
  /** Sustantivo del detalle para lectores de pantalla: [singular, plural]. */
  noun?: [string, string];
  /** Barra resaltada desde fuera (p. ej. al pasar por una fila de la lista). */
  highlightKey?: string | null;
  onActiveChange?: (key: string | null) => void;
}

export function WeightBars({
  data, label, format, height = 190, tone = 'primary', bestLabel, emptyLabel = 'Sin datos', noun = ['registro', 'registros'],
  highlightKey, onActiveChange,
}: WeightBarsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.4 });
  const [own, setOwn] = useState<number | null>(null);
  const set = (i: number | null) => { setOwn(i); onActiveChange?.(i === null ? null : data[i].key); };
  const outside = highlightKey ? data.findIndex((d) => d.key === highlightKey) : -1;
  const active = own ?? (outside >= 0 ? outside : null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const filled = data.filter((d) => d.value > 0);
  const avg = filled.length ? filled.reduce((a, d) => a + d.value, 0) / filled.length : 0;
  const best = data.findIndex((d) => d.value === max && d.value > 0);
  const plot = height - 28;
  const cols = { gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` };

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <div role="group" aria-label={label} className="relative" style={{ height }} onPointerLeave={(e) => { if (e.pointerType === 'mouse') set(null); }}>
        {avg > 0 && (
          <motion.div
            aria-hidden className="pointer-events-none absolute inset-x-0 z-10"
            initial={{ opacity: 0, y: 0 }}
            animate={seen ? { opacity: active === null ? 1 : 0.35, y: -(avg / max) * plot } : {}}
            transition={{ opacity: { duration: 0.4, delay: seen && active === null ? 0.9 : 0 }, y: heavy }}
            style={{ bottom: 0 }}
          >
            <motion.span
              className="block h-px border-t border-dashed border-on-surface-light/50" style={{ originX: 0 }}
              initial={{ scaleX: 0 }} animate={seen ? { scaleX: 1 } : {}} transition={{ ...heavy, delay: 0.9 }}
            />
            <span className="absolute -top-5 left-0 rounded-full bg-surface/90 px-1.5 font-mono text-label-md tabular-nums text-on-surface-light">media {format(avg)}</span>
          </motion.div>
        )}
        <div className="absolute inset-0 grid items-end gap-2 md:gap-4" style={cols}>
          {data.map((d, i) => {
            const on = active === i;
            const dim = active !== null && !on;
            const h = d.value > 0 ? Math.max(6, (d.value / max) * plot) : 4;
            const edge = i === 0 ? 'left-0' : i === data.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2';
            const n = d.details.length;
            const desc = d.value > 0 ? `${d.title}: ${format(d.value)}${n ? `, ${n} ${n === 1 ? noun[0] : noun[1]}` : ''}` : `${d.title}: ${emptyLabel.toLowerCase()}`;
            return (
              <button
                key={d.key} type="button" aria-label={desc}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') set(i); }}
                onPointerDown={() => set(i)}
                onFocus={() => set(i)} onBlur={() => set(null)}
                className="relative flex h-full flex-col items-center justify-end rounded-md focus-visible:outline-offset-4"
              >
                <AnimatePresence>
                  {on && (
                    <motion.span
                      role="tooltip"
                      initial={{ opacity: 0, y: 8, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.12 } }}
                      transition={slam}
                      className={cn('pointer-events-none absolute z-20 w-max max-w-[220px] rounded-lg border border-border bg-surface px-3 py-2 text-left shadow-lg', edge)}
                      style={{ bottom: h + 10 }}
                    >
                      <span className="block text-label-md text-on-surface-light">{d.title}</span>
                      <span className="block font-mono text-heading-sm font-bold tabular-nums text-on-background">{d.value > 0 ? format(d.value) : emptyLabel}</span>
                      {d.details.slice(0, 2).map((x, k) => <span key={k} className="block truncate text-label-md text-on-surface">{x}</span>)}
                      {n > 2 && <span className="block text-label-md text-on-surface-light">+{n - 2} más</span>}
                      {i === best && bestLabel && <span className={cn('mt-1 block text-label-md', ink[tone])}>{bestLabel}</span>}
                    </motion.span>
                  )}
                </AnimatePresence>
                {i === best && !on && (
                  <motion.span
                    aria-hidden className={cn('absolute whitespace-nowrap font-mono text-label-md tabular-nums', ink[tone])}
                    style={{ bottom: 0 }}
                    initial={{ opacity: 0, y: -(h + 6) }} animate={{ opacity: seen && active === null ? 1 : 0, y: -(h + 6) }}
                    transition={{ opacity: { duration: 0.3, delay: active === null ? 0.8 : 0 }, y: heavy }}
                  >
                    {format(d.value)}
                  </motion.span>
                )}
                {/* Entrada: la columna se levanta desde el suelo. Cambios de datos: la barra cambia de alto con el mismo muelle. */}
                <motion.span
                  aria-hidden className="flex w-full flex-col justify-end"
                  style={{ height: plot, originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: seen ? 1 : 0 }}
                  transition={{ ...heavy, delay: 0.15 + i * 0.07 }}
                >
                  <motion.span
                    layout
                    transition={heavy}
                    className={cn(
                      'block w-full transition-[opacity,background-color] duration-300',
                      d.value === 0 ? 'bg-surface-variant' : i === best ? strong[tone] : soft[tone],
                      dim && 'opacity-40',
                    )}
                    style={{ height: h, borderRadius: '10px 10px 4px 4px' }}
                  />
                </motion.span>
              </button>
            );
          })}
        </div>
      </div>
      <div aria-hidden className="grid gap-2 md:gap-4" style={cols}>
        {data.map((d, i) => (
          <span key={d.key} className={cn('text-center text-label-md transition-colors duration-300', active === i ? 'text-on-background' : 'text-on-surface-light')}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
