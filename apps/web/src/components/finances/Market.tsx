// Finanzas con aire de mercado de valores, sin perder la calma: una cinta de
// cotizaciones con tus propias cifras del mes (cada categoría y su variación frente
// al mes anterior), la evolución del saldo del mes dibujada como la gráfica de una
// acción y, al fondo, la cuadrícula tenue de un terminal con velas apagadas.
// Los datos son siempre los tuyos; lo decorativo es aria-hidden.
import { useId, useMemo, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Transaction } from '@noutlife/shared';
import { cn } from '@/lib/utils';
import { useMotionStore } from '@/store/motionStore';

/** Fondo de terminal: cuadrícula fina y unas velas apagadas en la esquina. */
export function MarketBackdrop() {
  const candles: Array<[number, number, number, boolean]> = [
    [12, 60, 30, true], [26, 48, 34, true], [40, 58, 22, false], [54, 40, 38, true], [68, 44, 26, false], [82, 30, 40, true], [96, 34, 22, true], [110, 22, 36, true],
  ];
  return (
    <>
      <span className="lq-market-grid" />
      <svg viewBox="0 0 124 120" className="lq-market-candles absolute -right-4 top-16 hidden w-72 md:block">
        {candles.map(([x, y, h, up], i) => (
          <g key={i} className={up ? 'lq-candle-up' : 'lq-candle-down'}>
            <path d={`M${x} ${y - 10}V${y + h + 10}`} strokeWidth="1.4" />
            <rect x={x - 4} y={y} width="8" height={h} rx="1.5" />
          </g>
        ))}
        <path d="M6 96C24 92 30 70 46 74S70 52 86 48 108 30 120 24" className="lq-market-trend" />
      </svg>
    </>
  );
}

export interface Quote { key: string; label: string; value: string; change: number | null }

/** Cinta de cotizaciones: se desliza sola (en pausa al pasar el cursor); con «Reducir movimiento», fila quieta. */
export function Ticker({ quotes, label }: { quotes: Quote[]; label: string }) {
  const reduce = useMotionStore((s) => s.reduce);
  if (quotes.length === 0) return null;
  const row = (dup: boolean) => quotes.map((q) => (
    <li key={`${dup ? 'b' : 'a'}-${q.key}`} aria-hidden={dup || undefined} className="flex shrink-0 items-baseline gap-2 px-4">
      <span className="text-label-md text-on-surface">{q.label}</span>
      <span className="font-mono text-label-md tabular-nums text-on-background">{q.value}</span>
      {q.change !== null && (
        <span className={cn('font-mono text-label-md tabular-nums', q.change > 0 ? 'text-success-text' : q.change < 0 ? 'text-error-text' : 'text-on-surface-light')}>
          {q.change > 0 ? '▲' : q.change < 0 ? '▼' : '■'} {Math.abs(q.change)}%
        </span>
      )}
    </li>
  ));
  return (
    <div role="region" aria-label={label} className="lq-ticker relative -mx-4 overflow-hidden border-y border-border py-2 md:mx-0 md:rounded-xl md:border">
      <ul className={cn('flex w-max', !reduce && 'lq-ticker-track')} style={{ '--n': quotes.length } as CSSProperties}>
        {row(false)}
        {!reduce && row(true)}
      </ul>
    </div>
  );
}

/** Saldo acumulado día a día del mes visible (ingresos − gastos), desde el día 1 hasta hoy o fin de mes. */
export function dailyBalance(txs: Transaction[], from: string, to: string): number[] {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const today = new Date();
  const last = end < today ? end : today;
  const days = Math.max(1, Math.round((last.getTime() - start.getTime()) / 86_400_000) + 1);
  const delta = new Array(days).fill(0);
  for (const t of txs) {
    const i = Math.round((new Date(`${t.date.slice(0, 10)}T00:00:00`).getTime() - start.getTime()) / 86_400_000);
    if (i < 0 || i >= days) continue;
    delta[i] += (t.type === 'INCOME' ? 1 : -1) * Number(t.amount);
  }
  let run = 0;
  return delta.map((d) => (run += d));
}

/** La gráfica del saldo como la de una acción: línea, área degradada y el último valor marcado. */
export function BalanceChart({ series, className }: { series: number[]; className?: string }) {
  const reduce = useMotionStore((s) => s.reduce);
  const fill = useId();
  const { line, area, end, up } = useMemo(() => {
    const W = 300;
    const H = 72;
    const pts = series.length > 1 ? series : [0, ...series];
    const lo = Math.min(0, ...pts);
    const hi = Math.max(1, ...pts);
    const x = (i: number) => (i / (pts.length - 1)) * W;
    const y = (v: number) => H - 4 - ((v - lo) / (hi - lo || 1)) * (H - 10);
    const xy = pts.map((v, i) => [x(i), y(v)] as const);
    // Curva suave (Catmull-Rom a Bézier) para que no parezca una escalera.
    let d = `M${xy[0][0].toFixed(1)} ${xy[0][1].toFixed(1)}`;
    for (let i = 0; i < xy.length - 1; i++) {
      const [p0, p1, p2, p3] = [xy[Math.max(0, i - 1)], xy[i], xy[i + 1], xy[Math.min(xy.length - 1, i + 2)]];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return { line: d, area: `${d}L${W} ${H}L0 ${H}Z`, end: xy[xy.length - 1], up: pts[pts.length - 1] >= 0 };
  }, [series]);
  return (
    // Se revela de izquierda a derecha (clip): pathLength no casa con un trazo que no escala.
    <motion.svg
      viewBox="0 0 300 72" preserveAspectRatio="none" aria-hidden className={cn('h-16 w-full overflow-visible', up ? 'text-success' : 'text-error', className)}
      initial={reduce ? false : { clipPath: 'inset(-10% 100% -10% 0)' }} animate={{ clipPath: 'inset(-10% -4% -10% 0)' }}
      transition={{ duration: 1.1, ease: [0.45, 0.05, 0.25, 1], delay: 0.2 }}
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fill})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <motion.circle cx={end[0]} cy={end[1]} r="3.5" fill="currentColor" initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2 }} className="lq-balance-dot" />
    </motion.svg>
  );
}
