// La rueda de las estaciones: el ciclo como un anillo que empieza arriba (día 1)
// y avanza en el sentido del reloj. Cada fase es un arco con el largo que tiene
// en su ciclo; al llegar, los arcos se trazan uno detrás de otro y una semilla
// de luz recorre el anillo desde el día 1 hasta hoy. La fase de hoy respira
// despacio. Cuando la semilla vuelve arriba, empieza el siguiente periodo.
// Solo se anima transform, opacity y el trazo; con «Reducir movimiento» todo
// queda en su sitio desde el principio.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springs, useMotionReduced } from '@/lib/motion';
import type { CyclePhase, CycleShape } from '@/services/cycle.service';
import { PHASES, PHASE_META, phaseFill, phaseInk } from './cycleMeta';

const SIZE = 320;
const C = SIZE / 2;
const R = 118;
/** Aire entre dos arcos, además de lo que ocupan sus puntas redondas. */
const GAP_DEG = 1.6;
/** Grados que ocupa la punta redonda de un trazo de ese grosor (para que las puntas no se pisen). */
const capDeg = (stroke: number) => ((stroke / 2) / R) * (180 / Math.PI);

const polar = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};
function arc(r: number, from: number, to: number) {
  const a = polar(r, from);
  const b = polar(r, to);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}
/** Posición en % del lienzo (para lo que va en HTML encima del SVG). */
const pct = (r: number, deg: number) => { const p = polar(r, deg); return { left: `${(p.x / SIZE) * 100}%`, top: `${(p.y / SIZE) * 100}%` }; };

export interface SeasonWheelProps {
  shape: CycleShape;
  cycleDay: number;
  phase: CyclePhase;
  /** Días de este ciclo con sangrado anotado (1 = día 1). */
  bleedDays?: number[];
  /** Días de este ciclo con algún registro. */
  loggedDays?: number[];
  /** Lo que va en el centro del anillo. */
  children?: ReactNode;
  className?: string;
}

export function SeasonWheel({ shape, cycleDay, phase, bleedDays = [], loggedDays = [], children, className }: SeasonWheelProps) {
  const reduce = useMotionReduced();
  // Con retraso, el anillo se estira para que hoy siga dentro.
  const days = Math.max(shape.length, cycleDay);
  const step = 360 / days;
  const todayDeg = (Math.min(cycleDay, days) - 0.5) * step;
  const bleed = new Set(bleedDays);
  const logged = new Set(loggedDays);
  const fertileFrom = (shape.ovulationDay - 6) * step;
  const fertileTo = (shape.ovulationDay + 1) * step;
  const label = `Día ${cycleDay} de unos ${shape.length}: ${PHASE_META[phase].name} (${PHASE_META[phase].season.toLowerCase()}).`;

  return (
    <div role="img" aria-label={label} className={cn('relative mx-auto aspect-square w-full max-w-[360px]', className)}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        {/* Surco del anillo */}
        <circle cx={C} cy={C} r={R} fill="none" strokeWidth={22} className="stroke-on-background/[.05]" />
        {/* Ventana fértil estimada: un filete punteado por fuera */}
        <motion.path
          d={arc(R + 21, Math.max(0, fertileFrom), Math.min(359.9, fertileTo))}
          fill="none" strokeWidth={2.5} strokeLinecap="round" strokeDasharray="1 6"
          style={{ stroke: phaseFill('ovulation', 0.8) }}
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1, transition: { delay: 1.1, duration: 0.6 } }}
        />
        {PHASES.map((p, i) => {
          const r = shape.ranges[p];
          if (r.end < r.start) return null;
          const current = p === phase;
          const stroke = current ? 22 : 14;
          // Cada arco se acorta lo que miden sus puntas: así nunca pisan al vecino.
          const trim = capDeg(stroke) + GAP_DEG / 2;
          const start = (r.start - 1) * step;
          const end = (p === 'luteal' ? days : r.end) * step;
          const from = Math.min(start + trim, (start + end) / 2 - 0.5);
          const to = Math.max(end - trim, (start + end) / 2 + 0.5);
          return (
            <g key={p}>
              {current && (
                // Halo de la fase de hoy: respira (solo opacidad)
                <path d={arc(R, from, to)} fill="none" strokeWidth={34} strokeLinecap="round" className={cn(!reduce && 'lq-cy-breathe')} style={{ stroke: phaseFill(p, 0.18) }} />
              )}
              <motion.path
                d={arc(R, from, to)} fill="none" strokeLinecap="round" strokeWidth={stroke}
                style={{ stroke: phaseFill(p, current ? 1 : 0.55) }}
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1, transition: { pathLength: { ...springs.gentle, delay: 0.15 + i * 0.14 }, opacity: { duration: 0.2, delay: 0.15 + i * 0.14 } } }}
              />
            </g>
          );
        })}
        {/* Un punto por día por dentro del anillo: lleno si hubo sangrado, con borde si anotaste algo */}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const p = polar(R - 24, (d - 0.5) * step);
          const isBleed = bleed.has(d);
          const isLogged = logged.has(d);
          return (
            <circle
              key={d} cx={p.x} cy={p.y} r={isBleed ? 3.2 : 2}
              style={isBleed ? { fill: phaseFill('menstrual') } : isLogged ? { fill: 'none', stroke: 'rgb(var(--lq-on-surface-light))', strokeWidth: 1.2 } : undefined}
              className={!isBleed && !isLogged ? (d < cycleDay ? 'fill-on-surface-light/50' : 'fill-on-surface-light/20') : undefined}
            />
          );
        })}
      </svg>

      {/* Glifo de cada estación por fuera de su arco */}
      {PHASES.map((p) => {
        const r = shape.ranges[p];
        if (r.end < r.start) return null;
        const mid = (((r.start - 1) + (p === 'luteal' ? days : r.end)) / 2) * step;
        const Icon = PHASE_META[p].icon;
        return (
          <span key={p} aria-hidden="true" className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-sm" style={{ ...pct(R + 40, mid), color: phaseInk(p) }}>
            <Icon className="size-4" strokeWidth={1.75} />
          </span>
        );
      })}

      {/* La semilla de luz: recorre el anillo desde el día 1 hasta hoy */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        initial={reduce ? false : { rotate: 0 }}
        animate={{ rotate: todayDeg, transition: { type: 'spring', stiffness: 38, damping: 14, mass: 1.4, delay: 0.55 } }}
      >
        <span
          className="absolute left-1/2 block size-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface"
          style={{ top: `${((C - R) / SIZE) * 100}%`, boxShadow: `0 0 0 4px ${phaseFill(phase)}, 0 0 18px 6px ${phaseFill(phase, 0.45)}` }}
        />
      </motion.div>

      <div className="absolute inset-[22%] flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
