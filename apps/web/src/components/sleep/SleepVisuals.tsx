// Sueño — piezas visuales con movimiento continuo y suave:
// · SleepSky: cielo vivo (olas que fluyen, estrellas que titilan, luna que flota).
// · RestDial: reloj de 24 h donde la noche y las siestas se dibujan como arcos.
// · DurationMeter: duración en vivo con barra líquida que se llena con muelle.
// Solo transform/opacity (y pathLength en los arcos, como draw3); con «Reducir
// movimiento» las animaciones CSS quedan quietas (tokens.css).
import { AnimatePresence, motion } from 'framer-motion';
import { Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { expo, springSoft, useCountUp } from '@/lib/motion';
import { softTone } from '@/components/ui/lq/tones';
import { hm, minuteOfDay } from './sleepMeta';

/* ───────── Cielo ───────── */

const STARS = [
  [6, 18, 1.4, 0], [14, 42, 1, 1.2], [22, 12, 1.2, 2.1], [31, 30, 0.9, 0.6], [44, 9, 1.3, 1.7],
  [57, 24, 1, 2.6], [66, 8, 1.4, 0.9], [74, 34, 0.9, 1.9], [83, 16, 1.2, 0.3], [92, 38, 1, 2.3],
] as const;

/** Ola de dos periodos (1200 × 100): translateX(-50 %) en bucle sin costura. */
const WAVE = 'M0 52 Q150 22 300 52 T600 52 T900 52 T1200 52 V100 H0Z';
const WAVE_2 = 'M0 60 Q150 82 300 60 T600 60 T900 60 T1200 60 V100 H0Z';

export function SleepSky({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {/* Resplandor de luna */}
      <div className="lq-breathe absolute -right-16 -top-20 size-72 rounded-full bg-[radial-gradient(circle,rgb(var(--lq-secondary)/.22),transparent_65%)]" />
      {STARS.map(([x, y, r, d]) => (
        <span
          key={`${x}-${y}`}
          className="lq-twinkle absolute rounded-full bg-primary"
          style={{ left: `${x}%`, top: `${y * 1.3}%`, width: r * 4, height: r * 4, animationDelay: `${d}s` }}
        />
      ))}
      {/* Olas: dos capas a distinta velocidad y en sentidos opuestos */}
      <div className="absolute inset-x-0 bottom-0 h-20 md:h-24">
        <svg className="lq-wave absolute bottom-0 left-0 h-full w-[200%]" style={{ ['--lq-wave-d' as string]: '18s' }} viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path d={WAVE} className="fill-secondary/10" />
        </svg>
        <svg className="lq-wave absolute bottom-0 left-0 h-full w-[200%]" style={{ ['--lq-wave-d' as string]: '26s', animationDirection: 'reverse' }} viewBox="0 0 1200 100" preserveAspectRatio="none">
          <path d={WAVE_2} className="fill-primary/10" />
        </svg>
      </div>
    </div>
  );
}

/** Luna flotante con «z z z» que suben. */
export function SleepyMoon({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('relative inline-flex size-14 items-center justify-center', className)}>
      <span className="lq-breathe absolute inset-0 rounded-full bg-secondary/20" />
      <span className="lq-float relative inline-flex size-12 items-center justify-center rounded-full bg-secondary/15 text-secondary-text">
        <Moon className="size-6" strokeWidth={1.75} />
      </span>
      {['z', 'z', 'Z'].map((z, i) => (
        <span key={i} className="lq-zzz absolute -right-1 top-0 text-label-md font-bold text-secondary-text" style={{ animationDelay: `${i * 1.2}s` }}>{z}</span>
      ))}
    </span>
  );
}

/* ───────── Reloj de 24 h ───────── */

export interface DialSegment { start: string; end: string; kind: 'night' | 'nap'; label: string }

const polar = (c: number, r: number, minute: number) => {
  const a = (minute / 1440) * Math.PI * 2 - Math.PI / 2;
  return [c + r * Math.cos(a), c + r * Math.sin(a)] as const;
};
function arc(c: number, r: number, m0: number, m1: number) {
  let span = m1 - m0;
  if (span <= 0) span += 1440;
  const [x0, y0] = polar(c, r, m0);
  const [x1, y1] = polar(c, r, m0 + span);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${span > 720 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function RestDial({ segments, totalHours, size = 220, caption = 'descanso total' }: { segments: DialSegment[]; totalHours: number; size?: number; caption?: string }) {
  const C = 110, R = 84;
  const minutes = useCountUp(Math.round(totalHours * 60), 1.4);
  const now = minuteOfDay(new Date());
  const [nx, ny] = polar(C, R, now);
  const label = segments.length
    ? `Reloj de 24 horas: ${segments.map((s) => s.label).join('; ')}. Total ${hm(totalHours)}.`
    : 'Reloj de 24 horas sin registros.';
  return (
    <figure className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 220 220" role="img" aria-label={label} className="size-full overflow-visible">
        <circle cx={C} cy={C} r={R} className="fill-none stroke-surface-variant" strokeWidth={16} />
        {Array.from({ length: 24 }, (_, h) => {
          const [x0, y0] = polar(C, R + 13, h * 60);
          const [x1, y1] = polar(C, R + (h % 6 ? 16 : 19), h * 60);
          return <line key={h} x1={x0} y1={y0} x2={x1} y2={y1} className={h % 6 ? 'stroke-border' : 'stroke-border-strong'} strokeWidth={h % 6 ? 1 : 1.5} strokeLinecap="round" />;
        })}
        {[0, 6, 12, 18].map((h) => {
          const [x, y] = polar(C, R - 24, h * 60);
          return <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-on-surface-light text-[10px] font-semibold tabular-nums">{String(h).padStart(2, '0')}</text>;
        })}
        {segments.map((s, i) => (
          <motion.path
            key={`${s.start}-${i}`}
            d={arc(C, R, minuteOfDay(s.start), minuteOfDay(s.end))}
            className={cn('fill-none', s.kind === 'night' ? 'stroke-secondary' : 'stroke-warning')}
            strokeWidth={16}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ pathLength: { duration: 1.6, ease: expo, delay: 0.25 + i * 0.25 }, opacity: { duration: 0.2, delay: 0.25 + i * 0.25 } }}
          />
        ))}
        {/* Ahora: punto que respira sobre el anillo */}
        <circle cx={nx} cy={ny} r={9} className="lq-breathe fill-primary/30" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        <circle cx={nx} cy={ny} r={4} className="fill-primary stroke-background" strokeWidth={2} />
      </svg>
      <figcaption aria-hidden className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-heading-md font-bold tabular-nums">{hm(minutes / 60, true)}</span>
        <span className="text-body-sm text-on-surface-light">{caption}</span>
      </figcaption>
    </figure>
  );
}

/* ───────── Duración en vivo ───────── */

export function DurationMeter({ hours, target, targetLabel, tone = 'secondary', advice }: {
  hours: number | null; target: number; targetLabel: string; tone?: 'secondary' | 'warning'; advice?: { tone: 'success' | 'warning' | 'info'; text: string } | null;
}) {
  const minutes = useCountUp(Math.round((hours ?? 0) * 60), 0.6);
  const fill = hours ? Math.min(1, hours / target) : 0;
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-label-lg text-on-surface">Duración</span>
        <span className="text-heading-sm font-bold tabular-nums">{hours ? hm(minutes / 60) : '—'}</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-surface-variant">
        <motion.span
          className={cn('lq-sheen absolute inset-0 overflow-hidden rounded-full', tone === 'secondary' ? 'bg-secondary' : 'bg-warning')}
          style={{ originX: 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: fill }}
          transition={{ type: 'spring', stiffness: 120, damping: 18, mass: 0.8 }}
        />
      </div>
      <span className="text-body-sm text-on-surface-light">{targetLabel}</span>
      <AnimatePresence mode="wait" initial={false}>
        {advice && (
          <motion.p
            key={advice.text}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: springSoft }} exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
            className={cn('rounded-xl px-3 py-2 text-body-sm', softTone[advice.tone])}
          >
            {advice.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
