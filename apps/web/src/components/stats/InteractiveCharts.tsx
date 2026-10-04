// Gráficos interactivos de Estadísticas: ejes con valores reales, crosshair y
// tooltip que se desliza con muelle al pasar el cursor (o con ← → al enfocar),
// y animaciones que arrancan al entrar en pantalla. Solo clases de token.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotionConfig } from 'framer-motion';
import { cn } from '@/lib/utils';
import { expo } from '@/lib/motion';
import { smoothPath } from '@/components/ui/lq/AdvancedCharts';
import { fillSoftTone, fillTone, solidBg, strokeTone, type Tone } from '@/components/ui/lq/tones';

const glide = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 } as const;

/** Ancho real del contenedor (para dibujar en píxeles, sin deformar texto ni trazos). */
function useWidth<T extends HTMLElement>(fallback = 560) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, w };
}

/** Marcas "redondas" del eje Y (1, 2, 2.5, 5 × 10ⁿ). */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (hi === lo) { hi = lo + 1; lo = Math.max(0, lo - 1); }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 0.001; v += step) out.push(+v.toFixed(6));
  if (out[out.length - 1] < hi) out.push(+(out[out.length - 1] + step).toFixed(6));
  return out;
}

/** Índices repartidos para las etiquetas del eje X. */
function spread(n: number, max: number) {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  return [...new Set(Array.from({ length: max }, (_, k) => Math.round((k * (n - 1)) / (max - 1))))];
}

/** Tarjeta flotante que sigue al punto activo. Se voltea abajo cerca del borde superior. */
function Tip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const TW = 248;
  const left = Math.min(Math.max(x - TW / 2, 0), Math.max(0, w - TW));
  const below = y < 92;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-10"
      initial={{ opacity: 0, x: left, y: below ? y + 18 : y - 8, scale: 0.94 }}
      animate={{ opacity: 1, x: left, y: below ? y + 18 : y - 14, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
      transition={glide}
      style={{ width: TW }}
    >
      <div className={cn('rounded-md border border-border bg-surface px-3.5 py-3 shadow-lg', !below && '-translate-y-full')}>
        {children}
      </div>
    </motion.div>
  );
}

/** Fila de tooltip: punto de color + etiqueta + valor en mono. */
export function TipRow({ tone, label, value, strong }: { tone?: Tone; label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-body-sm">
      <span className="flex min-w-0 items-center gap-1.5 text-on-surface-light">
        {tone && <span aria-hidden className={cn('size-2 shrink-0 rounded-full', solidBg[tone])} />}
        <span className="truncate">{label}</span>
      </span>
      <span className={cn('shrink-0 font-mono tabular-nums', strong ? 'text-label-lg text-on-background' : 'text-on-surface')}>{value}</span>
    </div>
  );
}

export function TipHead({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-2 flex flex-col">
      <span className="text-label-lg text-on-background first-letter:uppercase">{children}</span>
      {sub && <span className="text-caption text-on-surface-light">{sub}</span>}
    </div>
  );
}

function useKeys(n: number, active: number | null, set: (i: number | null) => void) {
  // El foco por puntero (tap/clic) no debe pisar el punto que se tocó: solo el foco por teclado preselecciona el último.
  const byPointer = useRef(false);
  return {
    tabIndex: 0,
    onPointerDownCapture: () => { byPointer.current = true; setTimeout(() => { byPointer.current = false; }, 0); },
    onFocus: () => { if (!byPointer.current) set(n - 1); },
    onBlur: () => set(null),
    onKeyDown: (e: KeyboardEvent) => {
      if (!n) return;
      const cur = active ?? n - 1;
      if (e.key === 'ArrowRight') { set(Math.min(n - 1, cur + 1)); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { set(Math.max(0, cur - 1)); e.preventDefault(); }
      else if (e.key === 'Home') { set(0); e.preventDefault(); }
      else if (e.key === 'End') { set(n - 1); e.preventDefault(); }
      else if (e.key === 'Escape') set(null);
    },
  };
}

// ───────────────────────────── TrendChart ─────────────────────────────

export interface TrendChartProps {
  /** Valores en orden cronológico. */
  values: number[];
  /** Etiqueta corta del eje X para cada punto (p. ej. "3 oct"). */
  xLabels: string[];
  tone?: Exclude<Tone, 'muted'>;
  height?: number;
  /** Rellena el área bajo la curva. */
  area?: boolean;
  /** El eje Y parte de 0 (por defecto) o se ajusta a los datos. */
  zeroBased?: boolean;
  min?: number;
  max?: number;
  goal?: { value: number; label: string };
  /** Barras de fondo (p. ej. XP ganada cada día bajo la curva acumulada). */
  bars?: number[];
  yFormat?: (n: number) => string;
  /** Contenido del tooltip y texto para lectores de pantalla. */
  tip: (i: number) => ReactNode;
  tipText: (i: number) => string;
  label: string;
  /** Marca puntos especiales (récords). */
  mark?: (i: number) => boolean;
  className?: string;
}

/** Curva suave con área, crosshair y tooltip deslizante. Se dibuja al entrar en pantalla. */
export function TrendChart({
  values, xLabels, tone = 'primary', height = 240, area = true, zeroBased = true, min, max, goal, bars, yFormat = String,
  tip, tipText, label, mark, className,
}: TrendChartProps) {
  const { ref, w } = useWidth<HTMLDivElement>();
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduce = useReducedMotionConfig() ?? false;
  const [active, setActive] = useState<number | null>(null);
  const clip = `tc${useId().replace(/:/g, '')}`;
  const n = values.length;

  const padL = 52, padR = 18, padT = 18, padB = 30;
  const plotW = Math.max(40, w - padL - padR), plotH = height - padT - padB;
  const extra = goal ? [goal.value] : [];
  const lo0 = min ?? (zeroBased ? 0 : Math.min(...values, ...extra));
  const hi0 = max ?? Math.max(...values, ...extra, lo0 + 1);
  const pad = zeroBased || min != null ? 0 : (hi0 - lo0) * 0.15 || 1;
  const ticks = niceTicks(Math.max(zeroBased ? 0 : -Infinity, lo0 - pad), hi0 + (max != null ? 0 : pad * 0.6));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const X = (i: number) => (n > 1 ? padL + (i / (n - 1)) * plotW : padL + plotW / 2);
  const Y = (v: number) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const pts = values.map((v, i): [number, number] => [X(i), Y(v)]);
  const line = n > 1 ? smoothPath(pts) : '';
  const areaD = n > 1 ? `${line} L${X(n - 1)},${padT + plotH} L${X(0)},${padT + plotH} Z` : '';
  const barMax = Math.max(1, ...(bars ?? [0]));
  const barW = Math.max(2, Math.min(14, (plotW / Math.max(1, n)) * 0.55));
  const xIdx = spread(n, Math.max(2, Math.floor(plotW / 84)));
  const go = inView || reduce;

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    if (!n) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setActive(n > 1 ? Math.round(Math.min(1, Math.max(0, px / r.width)) * (n - 1)) : 0);
  };

  return (
    <div ref={ref} className={cn('relative select-none rounded-md', className)} {...useKeys(n, active, setActive)}
      role="group" aria-label={`${label}. Usa las flechas para recorrer los puntos.`}>
      <svg width={w} height={height} className="block overflow-visible" aria-hidden>
        <defs>
          <clipPath id={clip}>
            <motion.rect x={0} y={-20} height={height + 40}
              initial={{ width: reduce ? w : 0 }} animate={{ width: go ? w : 0 }} transition={{ duration: reduce ? 0 : 1.5, ease: expo, delay: 0.1 }} />
          </clipPath>
        </defs>

        {ticks.map((t, k) => (
          <motion.g key={t} initial={{ opacity: 0 }} animate={{ opacity: go ? 1 : 0 }} transition={{ duration: 0.5, delay: 0.05 * k }}>
            <line x1={padL} x2={padL + plotW} y1={Y(t)} y2={Y(t)} strokeDasharray={k === 0 ? undefined : '3 6'} className="stroke-border" />
            <text x={padL - 10} y={Y(t)} textAnchor="end" dominantBaseline="middle" className="fill-on-surface-light font-mono text-[11px]">{yFormat(t)}</text>
          </motion.g>
        ))}

        {bars && bars.map((b, i) => {
          const h = (b / barMax) * plotH * 0.42;
          return (
            <motion.rect key={`b${i}`} x={X(i) - barW / 2} y={padT + plotH - h} width={barW} height={Math.max(0, h)} rx={Math.min(3, barW / 2)}
              className={fillTone[tone]}
              style={{ transformBox: 'fill-box', originY: 1 }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: go ? 1 : 0, opacity: go ? (active === i ? 0.55 : 0.16) : 0 }}
              transition={{ scaleY: { type: 'spring', stiffness: 260, damping: 26, delay: 0.25 + i * 0.012 }, opacity: { duration: 0.2 } }} />
          );
        })}

        {goal && (
          <g>
            <line x1={padL} x2={padL + plotW} y1={Y(goal.value)} y2={Y(goal.value)} strokeDasharray="6 5" strokeWidth={1.5} className="stroke-on-surface-light" />
            <text x={padL + plotW} y={Y(goal.value) - 7} textAnchor="end" className="fill-on-surface-light text-[11px] font-semibold">{goal.label}</text>
          </g>
        )}

        {area && n > 1 && (
          <motion.path d={areaD} className={cn('stroke-none', fillSoftTone[tone])}
            initial={{ opacity: 0 }} animate={{ opacity: go ? 1 : 0 }} transition={{ duration: 0.8, delay: reduce ? 0 : 0.9 }} />
        )}
        {n > 1 && (
          <path d={line} fill="none" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" clipPath={`url(#${clip})`} className={strokeTone[tone]} />
        )}

        {values.map((v, i) => {
          const special = mark?.(i);
          if (n > 40 && !special && i !== n - 1) return null;
          return (
            <motion.circle key={`d${i}`} cx={X(i)} cy={Y(v)}
              className={cn(special ? 'fill-secondary stroke-surface' : 'fill-surface', !special && strokeTone[tone])} strokeWidth={special ? 2 : 2.25}
              initial={{ r: 0 }} animate={{ r: go ? (special ? 5.5 : n > 1 ? 3.5 : 7) : 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18, delay: reduce ? 0 : 0.35 + (n > 1 ? (i / (n - 1)) * 1.2 : 0) }} />
          );
        })}

        {xIdx.map((i) => (
          <motion.text key={`x${i}`} x={X(i)} y={height - 8} textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'}
            className={cn('text-[11px]', active === i ? 'fill-on-background font-semibold' : 'fill-on-surface-light')}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: go ? 1 : 0, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
            {xLabels[i]}
          </motion.text>
        ))}

        <AnimatePresence>
          {active != null && n > 0 && (
            <motion.g key="cross" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <motion.line y1={padT} y2={padT + plotH} strokeWidth={1.5} strokeDasharray="2 4" className="stroke-on-surface-light"
                initial={false} animate={{ x1: X(active), x2: X(active) }} transition={glide} />
              <motion.circle r={12} className={cn(fillSoftTone[tone])} initial={false} animate={{ cx: X(active), cy: Y(values[active]) }} transition={glide} />
              <motion.circle r={6} strokeWidth={3} className={cn('fill-surface', strokeTone[tone])}
                initial={false} animate={{ cx: X(active), cy: Y(values[active]) }} transition={glide} />
            </motion.g>
          )}
        </AnimatePresence>

        <rect x={padL - 12} y={0} width={plotW + 24} height={height} fill="transparent"
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }} />
      </svg>

      <AnimatePresence>
        {active != null && n > 0 && <Tip key="tip" x={X(active)} y={Y(values[active])} w={w}>{tip(active)}</Tip>}
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">{active != null ? tipText(active) : ''}</span>
    </div>
  );
}

// ───────────────────────────── GroupedBars ─────────────────────────────

export interface BarSeries { name: string; tone: Exclude<Tone, 'muted'> }

export interface GroupedBarsProps {
  groups: Array<{ label: string; values: number[] }>;
  series: BarSeries[];
  height?: number;
  yFormat?: (n: number) => string;
  tip: (i: number) => ReactNode;
  tipText: (i: number) => string;
  label: string;
  className?: string;
}

/** Barras agrupadas con eje Y, banda de hover que resalta el tramo y tooltip con el desglose. */
export function GroupedBars({ groups, series, height = 220, yFormat = String, tip, tipText, label, className }: GroupedBarsProps) {
  const { ref, w } = useWidth<HTMLDivElement>();
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduce = useReducedMotionConfig() ?? false;
  const [active, setActive] = useState<number | null>(null);
  const n = groups.length;
  const padL = 60, padR = 10, padT = 14, padB = 30;
  const plotW = Math.max(40, w - padL - padR), plotH = height - padT - padB;
  const ticks = niceTicks(0, Math.max(1, ...groups.flatMap((g) => g.values)));
  const hi = ticks[ticks.length - 1];
  const gw = plotW / Math.max(1, n);
  const gap = Math.min(6, gw * 0.06);
  const bw = Math.max(4, Math.min(30, (gw * 0.68 - gap * (series.length - 1)) / series.length));
  const inner = bw * series.length + gap * (series.length - 1);
  const Y = (v: number) => padT + plotH - (v / hi) * plotH;
  const go = inView || reduce;
  const xIdx = spread(n, Math.max(2, Math.floor(plotW / 72)));

  return (
    <div ref={ref} className={cn('relative select-none rounded-md', className)} {...useKeys(n, active, setActive)}
      role="group" aria-label={`${label}. Usa las flechas para recorrer los tramos.`}>
      <svg width={w} height={height} className="block overflow-visible" aria-hidden onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}>
        {ticks.map((t, k) => (
          <motion.g key={t} initial={{ opacity: 0 }} animate={{ opacity: go ? 1 : 0 }} transition={{ duration: 0.5, delay: 0.05 * k }}>
            <line x1={padL} x2={padL + plotW} y1={Y(t)} y2={Y(t)} strokeDasharray={k === 0 ? undefined : '3 6'} className="stroke-border" />
            <text x={padL - 10} y={Y(t)} textAnchor="end" dominantBaseline="middle" className="fill-on-surface-light font-mono text-[11px]">{yFormat(t)}</text>
          </motion.g>
        ))}
        {groups.map((g, i) => {
          const gx = padL + i * gw;
          const dim = active != null && active !== i;
          return (
            <g key={g.label + i} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}>
              <motion.rect x={gx + 2} y={padT - 6} width={gw - 4} height={plotH + 6} rx={8} className="fill-on-background"
                initial={false} animate={{ opacity: active === i ? 0.05 : 0 }} transition={{ duration: 0.2 }} />
              {g.values.map((v, k) => {
                const h = Math.max(v > 0 ? 3 : 0, (v / hi) * plotH);
                return (
                  <motion.rect key={k} x={gx + (gw - inner) / 2 + k * (bw + gap)} y={padT + plotH - h} width={bw} height={h} rx={Math.min(5, bw / 2.5)}
                    className={fillTone[series[k].tone]}
                    style={{ transformBox: 'fill-box', originY: 1 }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: go ? 1 : 0, opacity: dim ? 0.35 : 1 }}
                    transition={{ scaleY: { type: 'spring', stiffness: 220, damping: 22, delay: reduce ? 0 : 0.15 + i * 0.06 + k * 0.05 }, opacity: { duration: 0.2 } }} />
                );
              })}
              {xIdx.includes(i) && (
                <text x={gx + gw / 2} y={height - 8} textAnchor="middle"
                  className={cn('text-[11px]', active === i ? 'fill-on-background font-semibold' : 'fill-on-surface-light')}>{g.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      <AnimatePresence>
        {active != null && n > 0 && (
          <Tip key="tip" x={padL + active * gw + gw / 2} y={Y(Math.max(...groups[active].values))} w={w}>{tip(active)}</Tip>
        )}
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">{active != null ? tipText(active) : ''}</span>
    </div>
  );
}

// ───────────────────────────── HabitHeatmap ─────────────────────────────

const HEAT = ['bg-surface-variant', 'bg-primary/25', 'bg-primary/45', 'bg-primary/70', 'bg-primary'];
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export interface HabitHeatmapProps {
  /** Conteo diario (YYYY-MM-DD). */
  counts: Map<string, number>;
  weeks?: number;
  className?: string;
}

/** Constancia por día (lunes → domingo): ola de entrada, tooltip con fecha y conteo, ← → ↑ ↓ con teclado. */
export function HabitHeatmap({ counts, weeks = 26, className }: HabitHeatmapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const reduce = useReducedMotionConfig() ?? false;
  const [active, setActive] = useState<number | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const cells = useRef<Array<HTMLSpanElement | null>>([]);
  const tapped = useRef(false);

  const { days, max, todayIdx } = useMemo(() => {
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
    const list = Array.from({ length: weeks * 7 }, (_, k) => {
      const d = new Date(monday); d.setDate(monday.getDate() + k);
      const key = d.toISOString().slice(0, 10);
      return { d, key, n: counts.get(key) ?? 0, future: d > today };
    });
    return { days: list, max: Math.max(1, ...list.map((x) => x.n)), todayIdx: list.findIndex((x) => x.d.toDateString() === today.toDateString()) };
  }, [counts, weeks]);

  const level = (n: number) => (n <= 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const show = (k: number | null) => {
    setActive(k);
    const el = k != null ? cells.current[k] : null;
    const box = ref.current?.getBoundingClientRect();
    if (el && box) { const r = el.getBoundingClientRect(); setPos({ x: r.left - box.left + r.width / 2, y: r.top - box.top }); }
  };
  const onKey = (e: KeyboardEvent) => {
    const cur = active ?? todayIdx;
    const mv: Record<string, number> = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 };
    if (mv[e.key] != null) { e.preventDefault(); show(Math.min(Math.max(0, todayIdx), Math.max(0, cur + mv[e.key]))); }
    else if (e.key === 'Escape') show(null);
  };
  const months = Array.from({ length: weeks }, (_, w) => {
    const d = days[w * 7].d, prev = w ? days[(w - 1) * 7].d : null;
    return !prev || prev.getMonth() !== d.getMonth() ? d.toLocaleDateString('es-ES', { month: 'short' }) : '';
  });
  const a = active != null ? days[active] : null;
  const total = days.reduce((s, x) => s + x.n, 0);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div ref={ref} className="relative rounded-md" tabIndex={0} onKeyDown={onKey} onPointerDownCapture={() => { tapped.current = true; setTimeout(() => { tapped.current = false; }, 0); }} onFocus={() => { if (!tapped.current) show(todayIdx); }} onBlur={() => show(null)}
        role="group" aria-label={`Constancia de hábitos de las últimas ${weeks} semanas: ${total} completados. Usa las flechas para recorrer los días.`}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') show(null); }}>
        <div className="grid gap-1" style={{ gridTemplateColumns: `1.25rem repeat(${weeks}, minmax(0, 1fr))` }}>
          <span />
          {months.map((m, w) => <span key={w} className="h-4 overflow-visible whitespace-nowrap text-caption text-on-surface-light">{m}</span>)}
          {DAYS.map((dl, d) => (
            <div key={dl} className="contents">
              <span className="flex items-center text-caption text-on-surface-light">{d % 2 === 0 ? dl : ''}</span>
              {Array.from({ length: weeks }, (_, w) => {
                const k = w * 7 + d, x = days[k];
                return (
                  <span key={k} ref={(el) => { cells.current[k] = el; }}
                    onPointerEnter={() => !x.future && show(k)} onPointerDown={() => !x.future && show(k)}
                    className={cn(
                      'aspect-square rounded-[3px] transition-[transform,box-shadow] duration-200',
                      x.future ? 'opacity-0' : HEAT[level(x.n)],
                      inView || reduce ? 'lq-day-in' : 'opacity-0',
                      active === k && 'z-[1] scale-125 shadow-md ring-2 ring-on-background/70',
                      k === todayIdx && active !== k && 'ring-1 ring-primary-text',
                    )}
                    style={{ animationDelay: reduce ? undefined : `${(w + d) * 18}ms` }} />
                );
              })}
            </div>
          ))}
        </div>
        <AnimatePresence>
          {a && pos && (
            <motion.div key="tip" aria-hidden className="pointer-events-none absolute left-0 top-0 z-10"
              initial={{ opacity: 0, x: pos.x, y: pos.y - 6, scale: 0.94 }} animate={{ opacity: 1, x: pos.x, y: pos.y - 10, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={glide}>
              <div className="-translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-surface px-3 py-2 shadow-lg">
                <div className="text-label-lg first-letter:uppercase">{a.d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                <div className="text-body-sm text-on-surface-light">
                  {a.n ? <><span className="font-mono tabular-nums text-on-background">{a.n}</span> {a.n === 1 ? 'hábito completado' : 'hábitos completados'}</> : 'Sin hábitos completados'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <span className="sr-only" aria-live="polite">{a ? `${a.d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}: ${a.n} hábitos` : ''}</span>
      </div>
      <div className="flex items-center justify-end gap-1.5 text-caption text-on-surface-light">
        Menos{HEAT.map((c) => <span key={c} aria-hidden className={cn('size-3 rounded-[3px]', c)} />)}Más
      </div>
    </div>
  );
}

// ───────────────────────────── RadarPlus ─────────────────────────────

export interface RadarPlusAxis { label: string; value: number; previous: number }

/** Radar con vértices interactivos: tooltip con este periodo, el anterior y la diferencia. */
export function RadarPlus({ axes, label, tone = 'primary' }: { axes: RadarPlusAxis[]; label: string; tone?: Exclude<Tone, 'muted'> }) {
  const { ref, w } = useWidth<HTMLDivElement>(420);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduce = useReducedMotionConfig() ?? false;
  const [active, setActive] = useState<number | null>(null);
  const H = 320, R = Math.min(118, (Math.min(w, H) - 90) / 2), cx = w / 2, cy = H / 2;
  const n = axes.length;
  const pt = (i: number, r: number) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, R * Math.max(0, Math.min(1, v / 100))).map((q) => q.toFixed(1)).join(',')).join(' ');
  const go = inView || reduce;
  const a = active != null ? axes[active] : null;

  return (
    <div ref={ref} className="relative select-none rounded-md" {...useKeys(n, active, setActive)} role="group"
      aria-label={`${label}. Usa las flechas para recorrer las áreas.`} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}>
      <svg width={w} height={H} className="block overflow-visible" aria-hidden>
        {[0.25, 0.5, 0.75, 1].map((f, k) => (
          <motion.polygon key={f} points={poly(axes.map(() => f * 100))} fill="none" className="stroke-border"
            style={{ transformOrigin: `${cx}px ${cy}px` }}
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: go ? 1 : 0, scale: go ? 1 : 0.6 }} transition={{ duration: 0.7, ease: expo, delay: k * 0.07 }} />
        ))}
        {axes.map((ax, i) => {
          const [x, y] = pt(i, R), [lx, ly] = pt(i, R + 22);
          return (
            <g key={ax.label}>
              <line x1={cx} y1={cy} x2={x} y2={y} className="stroke-border" />
              <text x={lx} y={ly} textAnchor={Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'} dominantBaseline="middle"
                className={cn('text-[12px] font-semibold transition-colors', active === i ? 'fill-on-background' : 'fill-on-surface-light')}>{ax.label}</text>
            </g>
          );
        })}
        <motion.polygon points={poly(axes.map((x) => x.previous))} fill="none" strokeDasharray="4 4" strokeWidth={1.5} className="stroke-on-surface-light"
          initial={{ opacity: 0 }} animate={{ opacity: go ? 0.9 : 0 }} transition={{ duration: 0.6, delay: 0.3 }} />
        <motion.polygon points={poly(axes.map((x) => x.value))} strokeWidth={2.5} strokeLinejoin="round"
          className={cn(strokeTone[tone], fillSoftTone[tone])} style={{ transformOrigin: `${cx}px ${cy}px` }}
          initial={{ opacity: 0, scale: 0 }} animate={{ opacity: go ? 1 : 0, scale: go ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 16, delay: reduce ? 0 : 0.45 }} />
        {axes.map((ax, i) => {
          const [x, y] = pt(i, R * Math.max(0, Math.min(1, ax.value / 100)));
          const [hx, hy] = pt(i, R + 4);
          return (
            <g key={`v${i}`} onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)}>
              <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="transparent" strokeWidth={34} />
              <motion.circle cx={x} cy={y} className={cn('fill-surface', strokeTone[tone])} strokeWidth={2.5}
                initial={{ r: 0 }} animate={{ r: go ? (active === i ? 7 : 4) : 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16, delay: active != null ? 0 : reduce ? 0 : 0.7 + i * 0.05 }} />
            </g>
          );
        })}
      </svg>
      <AnimatePresence>
        {a && active != null && (() => {
          const [x, y] = pt(active, R * Math.max(0, Math.min(1, a.value / 100)));
          const d = Math.round(a.value - a.previous);
          return (
            <Tip key="tip" x={x} y={y} w={w}>
              <TipHead sub="Ritmo de registro en esta área">{a.label}</TipHead>
              <div className="flex flex-col gap-1">
                <TipRow tone={tone} label="Este periodo" value={`${Math.round(a.value)}%`} strong />
                <TipRow label="Anterior" value={`${Math.round(a.previous)}%`} />
                <div className={cn('mt-1 text-label-md', d > 0 ? 'text-success-text' : d < 0 ? 'text-error-text' : 'text-on-surface-light')}>
                  {d > 0 ? `▲ ${d} puntos más` : d < 0 ? `▼ ${Math.abs(d)} puntos menos` : 'Igual que antes'}
                </div>
              </div>
            </Tip>
          );
        })()}
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">{a ? `${a.label}: ${Math.round(a.value)}% este periodo, ${Math.round(a.previous)}% el anterior` : ''}</span>
    </div>
  );
}
