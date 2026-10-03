import { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ease } from '@/lib/motion';
import { solidBg, strokeTone, textTone, type Tone } from './tones';

type ChartTone = Exclude<Tone, 'muted'>;

/** Burbuja de tooltip; aparece con hover o foco del `group` padre. */
function Tip({ children, edge }: { children: string; edge?: 'start' | 'end' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute bottom-[calc(100%+6px)] z-10 translate-y-1 whitespace-nowrap rounded-md',
        // En los extremos se alinea al borde para no salirse del contenedor.
        edge === 'start' ? 'left-0' : edge === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2',
        'bg-on-background px-2 py-1 text-label-md text-background opacity-0 transition-[opacity,transform] duration-150',
        'group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100',
      )}
    >
      {children}
    </span>
  );
}

// ───────────────────────────── BarChart ─────────────────────────────

export interface BarDatum {
  label: string;
  value: number;
  /** Texto del tooltip y del aria-label de la barra. */
  tip?: string;
  /** Resalta la barra (máximo, día actual…). */
  highlight?: boolean;
  /** Barra atenuada (días futuros). */
  muted?: boolean;
}

export interface BarChartProps {
  data: BarDatum[];
  /** Resumen accesible de todo el gráfico. */
  label: string;
  tone?: ChartTone;
  highlightTone?: ChartTone;
  /** Alto del área de barras en px. */
  height?: number;
  /** Muestra el valor encima de cada barra (móvil). */
  showValues?: boolean;
  formatValue?: (v: number) => string;
  /** Líneas guía horizontales (desktop). */
  grid?: boolean;
  max?: number;
  className?: string;
}

/** Barras que suben (scaleY, stagger 70 ms) con tooltip en hover/foco. */
export function BarChart({
  data, label, tone = 'primary', highlightTone = 'error', height = 140, showValues, formatValue = String, grid, max, className,
}: BarChartProps) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="group"
        aria-label={label}
        className={cn(
          'grid items-end gap-2 md:gap-4',
          grid && 'bg-[repeating-linear-gradient(to_top,rgb(var(--lq-border))_0_1px,transparent_1px_25%)]',
        )}
        style={{ height, gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
      >
        {data.map((d, i) => {
          const pct = Math.max(2, (d.value / top) * (showValues ? 80 : 100));
          const tip = d.tip ?? `${d.label} · ${formatValue(d.value)}`;
          return (
            <div key={d.label + i} tabIndex={0} aria-label={tip} className="group relative flex h-full flex-col items-center justify-end gap-1.5 rounded-md">
              <Tip edge={i === 0 ? 'start' : i === data.length - 1 ? 'end' : undefined}>{tip}</Tip>
              {showValues && (
                <span className={cn('text-label-md tabular-nums', d.highlight ? textTone[highlightTone] : 'text-on-surface-light')}>
                  {formatValue(d.value)}
                </span>
              )}
              <motion.span
                className={cn(
                  'block w-full rounded-t-[10px] rounded-b-[4px]',
                  d.highlight ? solidBg[highlightTone] : d.muted ? 'bg-surface-variant' : cn(solidBg[tone], 'opacity-25'),
                )}
                style={{ height: `${pct}%`, originY: 1 }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 + i * 0.07 }}
              />
            </div>
          );
        })}
      </div>
      <div className="grid gap-2 md:gap-4" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} aria-hidden>
        {data.map((d, i) => <span key={d.label + i} className="text-center text-label-md text-on-surface-light">{d.label}</span>)}
      </div>
    </div>
  );
}

// ───────────────────────────── LineChart ─────────────────────────────

export interface LinePoint {
  label: string;
  value: number;
  tip?: string;
}

export interface LineChartProps {
  data: LinePoint[];
  label: string;
  /** Dominio del eje Y. */
  min: number;
  max: number;
  tone?: ChartTone;
  goal?: { value: number; label: string };
  height?: number;
  /** Puntos con tooltip (desktop). */
  dots?: boolean;
  className?: string;
}

/** Línea que se dibuja (pathLength 1.3 s), área que aparece después y meta punteada. */
export function LineChart({ data, label, min, max, tone = 'primary', goal, height = 140, dots, className }: LineChartProps) {
  const W = 300, H = 120;
  const clipId = `lc${useId().replace(/:/g, '')}`;
  // Cada punto en el centro de su columna: coincide con la fila de etiquetas (grid).
  const x = (i: number) => ((i + 0.5) * W) / Math.max(1, data.length);
  const y = (v: number) => H - 10 - ((v - min) / (max - min)) * (H - 20);
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`);
  const path = `M${pts.join(' L')}`;
  const area = `${path} L${x(data.length - 1)},${H} L${x(0)},${H} Z`;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative" style={{ height }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={label} className="block overflow-visible">
          {goal && (
            <line
              x1="0" x2={W} y1={y(goal.value)} y2={y(goal.value)}
              strokeWidth={1.5} strokeDasharray="5 5" vectorEffect="non-scaling-stroke"
              className="stroke-success"
            />
          )}
          <motion.path
            d={area} className={cn('stroke-none', tone === 'primary' ? 'fill-primary/[var(--lq-soft-alpha)]' : 'fill-secondary/[var(--lq-soft-alpha)]')}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1.2 }}
          />
          {/* La línea se "dibuja" con un recorte que crece de izquierda a derecha: pathLength
              falla con vector-effect non-scaling-stroke cuando el SVG se estira (desktop). */}
          <clipPath id={clipId}>
            <motion.rect x="0" y="-10" height={H + 20} initial={{ width: 0 }} animate={{ width: W }} transition={{ duration: 1.3, ease, delay: 0.2 }} />
          </clipPath>
          <path
            d={path} fill="none" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
            clipPath={`url(#${clipId})`}
            className={strokeTone[tone]}
          />
        </svg>
        {goal && (
          <span
            className="absolute left-0 -translate-y-[140%] text-label-md text-success-text"
            style={{ top: `${(y(goal.value) / H) * 100}%` }}
          >
            {goal.label}
          </span>
        )}
        {dots && data.map((d, i) => (
          <span
            key={d.label + i}
            tabIndex={0}
            aria-label={d.tip ?? `${d.label}: ${d.value}`}
            className="group absolute -ml-3.5 -mt-3.5 flex size-7 items-center justify-center rounded-full"
            style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(d.value) / H) * 100}%` }}
          >
            <Tip edge={i === 0 ? 'start' : i === data.length - 1 ? 'end' : undefined}>{d.tip ?? `${d.label} · ${d.value}`}</Tip>
            <motion.span
              className={cn('rounded-full border-[3px] bg-background', i === data.length - 1 ? 'size-4' : 'size-3', tone === 'primary' ? 'border-primary' : 'border-secondary')}
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9 + i * 0.09, type: 'spring', stiffness: 420, damping: 18 }}
            />
          </span>
        ))}
      </div>
      <div className="grid text-center" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} aria-hidden>
        {data.map((d, i) => <span key={d.label + i} className="text-label-md text-on-surface-light">{d.label}</span>)}
      </div>
    </div>
  );
}

// ───────────────────────────── Heatmap ─────────────────────────────

/** 0 = sin registrar · 1 = parcial · 2 = completado */
export type HeatLevel = 0 | 1 | 2;

export interface HeatmapProps {
  /** Semanas de 7 días (lunes→domingo). */
  weeks: HeatLevel[][];
  label: string;
  dayLabels?: string[];
  className?: string;
}

const levelCls: Record<HeatLevel, string> = {
  // Sin registrar lleva borde punteado: el color no es la única señal.
  0: 'bg-surface-variant outline-dashed outline-1 -outline-offset-1 outline-border-strong/40',
  1: 'bg-primary/[var(--lq-soft-alpha)]',
  2: 'bg-primary',
};

/** Mapa de calor semanal (12 semanas en el detalle de hábito) con leyenda. */
export function Heatmap({ weeks, label, dayLabels = ['L', '', 'X', '', 'V', '', 'D'], className }: HeatmapProps) {
  return (
    <div className={cn('flex w-full max-w-[640px] flex-col gap-4', className)}>
      <div
        role="img"
        aria-label={label}
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `24px repeat(${weeks.length}, minmax(0, 1fr))` }}
      >
        <div className="grid grid-rows-7 gap-1.5" aria-hidden>
          {dayLabels.map((l, i) => <span key={i} className="flex items-center text-label-md text-on-surface-light">{l}</span>)}
        </div>
        {weeks.map((week, w) => (
          <div key={w} className="grid grid-rows-7 gap-1.5">
            {week.map((lvl, d) => (
              <motion.span
                key={d}
                className={cn('aspect-square rounded-md', levelCls[lvl])}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, ease, delay: 0.3 + w * 0.04 + d * 0.015 }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-body-sm text-on-surface" aria-hidden>
        {([[0, 'Sin registrar'], [1, 'Parcial'], [2, 'Completado']] as const).map(([lvl, text]) => (
          <span key={lvl} className="flex items-center gap-1.5">
            <span className={cn('size-3.5 rounded', levelCls[lvl])} />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
