// AreaChart (curva suave Catmull-Rom) y RadarChart, del prototipo StatsDesktop.
// Solo clases de token; la línea se dibuja con un recorte que crece (como LineChart)
// y el área aparece después. `redrawKey` vuelve a dibujar al cambiar de periodo.
import { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { expo, springSoft } from '@/lib/motion';
import { strokeTone, type Tone } from './tones';

const fillSoft: Partial<Record<Tone, string>> = {
  primary: 'fill-primary/[var(--lq-soft-alpha)]',
  secondary: 'fill-secondary/[var(--lq-soft-alpha)]',
  warning: 'fill-warning/[var(--lq-soft-alpha)]',
  success: 'fill-success/[var(--lq-soft-alpha)]',
};

/** Curva Catmull-Rom → Bézier cúbica. */
export function smoothPath(points: Array<[number, number]>) {
  if (points.length === 0) return '';
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)], [x1, y1] = points[i], [x2, y2] = points[i + 1], [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    const c1x = x1 + (x2 - x0) / 6, c1y = y1 + (y2 - y0) / 6, c2x = x2 - (x3 - x1) / 6, c2y = y2 - (y3 - y1) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  return d;
}

export interface AreaChartProps {
  values: number[];
  /** Etiquetas del eje X (se muestran repartidas). */
  labels?: string[];
  label: string;
  tone?: Tone;
  height?: number;
  /** Cambia para volver a dibujar la curva (p. ej. al cambiar de periodo). */
  redrawKey?: string | number;
  className?: string;
}

export function AreaChart({ values, labels = [], label, tone = 'primary', height = 220, redrawKey, className }: AreaChartProps) {
  const W = 600, H = 200;
  const clipId = `ac${useId().replace(/:/g, '')}`;
  const max = Math.max(1, ...values) * 1.15;
  const pts = values.map((v, i): [number, number] => [values.length > 1 ? (i / (values.length - 1)) * W : W / 2, 190 - (v / max) * 170]);
  const line = smoothPath(pts);
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <svg key={redrawKey} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={label} className="block overflow-visible">
        {[50, 110, 170].map((y) => (
          <line key={y} x1="0" x2={W} y1={y} y2={y} strokeDasharray="3 6" vectorEffect="non-scaling-stroke" className="stroke-border" />
        ))}
        <motion.path d={area} className={cn('stroke-none', fillSoft[tone] ?? fillSoft.primary)}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 1 }} />
        <clipPath id={clipId}>
          <motion.rect x="0" y="-10" height={H + 20} initial={{ width: 0 }} animate={{ width: W }} transition={{ duration: 1.6, ease: expo, delay: 0.15 }} />
        </clipPath>
        <path d={line} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          clipPath={`url(#${clipId})`} className={strokeTone[tone]} />
      </svg>
      {labels.length > 0 && (
        <div aria-hidden className="flex justify-between text-body-sm text-on-surface-light">
          {labels.map((l, i) => <span key={l + i}>{l}</span>)}
        </div>
      )}
    </div>
  );
}

export interface RadarAxis {
  label: string;
  /** 0–1, periodo actual. */
  value: number;
  /** 0–1, periodo anterior (línea discontinua). */
  previous?: number;
}

export interface RadarChartProps {
  axes: RadarAxis[];
  label: string;
  tone?: Tone;
  className?: string;
}

/** Radar de N ejes: rejilla, periodo anterior discontinuo y polígono actual que aparece con pop. */
export function RadarChart({ axes, label, tone = 'warning', className }: RadarChartProps) {
  const R = 110;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / axes.length;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, R * Math.max(0, Math.min(1, v))).map((n) => n.toFixed(1)).join(',')).join(' ');
  const hasPrev = axes.some((a) => a.previous != null);
  return (
    <svg viewBox="-160 -140 320 280" width="100%" height={300} role="img" aria-label={label} className={cn('overflow-visible', className)}>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={poly(axes.map(() => f))} fill="none" className="stroke-border" />)}
      {axes.map((a, i) => {
        const [x, y] = pt(i, R), [lx, ly] = pt(i, R + 20);
        return (
          <g key={a.label}>
            <line x1={0} y1={0} x2={x} y2={y} className="stroke-border" />
            <text x={lx} y={ly} textAnchor={Math.abs(lx) < 8 ? 'middle' : lx > 0 ? 'start' : 'end'} dominantBaseline="middle"
              className="fill-on-surface-light text-[11px] font-semibold">{a.label}</text>
          </g>
        );
      })}
      {hasPrev && (
        <polygon points={poly(axes.map((a) => a.previous ?? 0))} fill="none" strokeDasharray="4 4" strokeWidth={1.5} className="stroke-on-surface-light" />
      )}
      <motion.polygon
        points={poly(axes.map((a) => a.value))}
        strokeWidth={2.5} strokeLinejoin="round"
        className={cn(strokeTone[tone], fillSoft[tone] ?? fillSoft.primary)}
        style={{ transformOrigin: '0px 0px' }}
        initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...springSoft, delay: 0.3 }}
      />
    </svg>
  );
}
