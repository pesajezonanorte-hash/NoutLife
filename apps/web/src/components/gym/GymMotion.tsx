// Piezas de movimiento del gimnasio: todo tiene masa. La barra carga un disco
// por día entrenado y «cae» al recibirlo, el cronómetro gira dígito a dígito,
// las barras de volumen se levantan como una repetición y los bloques acusan el
// golpe cuando algo cae dentro. Solo transform/opacity (más `r`/scale en SVG).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useAnimationControls, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';
import { heavy, slam, thud } from '@/lib/motion';
import { formatClock } from '@/components/ui/lq';

/* ───────────────────────── Golpe ───────────────────────── */

/** Envuelve un bloque y le da un golpe seco (y 0→3→−1→0) cada vez que `trigger` sube. */
export function Thud({ trigger, children, className, as = 'div', ...rest }: {
  trigger: number; children: ReactNode; className?: string; as?: 'div' | 'section'; 'aria-label'?: string; 'aria-labelledby'?: string;
}) {
  const controls = useAnimationControls();
  const prev = useRef(trigger);
  useEffect(() => {
    if (trigger > prev.current) void controls.start(thud);
    prev.current = trigger;
  }, [trigger, controls]);
  const Tag = as === 'section' ? motion.section : motion.div;
  return <Tag animate={controls} className={className} {...rest}>{children}</Tag>;
}

/* ───────────────────────── Barra con discos ───────────────────────── */

const SLOT_H = [64, 56, 46, 36];
const PLATE_W = 12;
const GAP = 3;
const COLLAR_L = 92;
const COLLAR_R = 208;
const MID = 40;

/**
 * Barra olímpica minimalista: un disco por día con asistencia (máx. 7, alternando
 * lados). Cada disco entra deslizándose por la manga con un muelle pesado y la barra
 * acusa el peso cuando llega uno nuevo. Decorativa: el contexto lleva el texto.
 */
export function Barbell({ plates, className }: { plates: number; className?: string }) {
  const n = Math.max(0, Math.min(7, plates));
  const controls = useAnimationControls();
  const prev = useRef(n);
  useEffect(() => {
    if (n > prev.current) void controls.start({ y: [0, 3.5, -1, 0], transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.35 } });
    prev.current = n;
  }, [n, controls]);

  const slots = Array.from({ length: 7 }, (_, k) => {
    const left = k % 2 === 0;
    const slot = Math.floor(k / 2);
    const h = SLOT_H[slot];
    const x = left ? COLLAR_L - (slot + 1) * (PLATE_W + GAP) : COLLAR_R + GAP + slot * (PLATE_W + GAP);
    return { k, left, x, y: MID - h / 2, h };
  });

  return (
    <svg viewBox="0 0 300 80" className={cn('h-auto w-full max-w-[300px] overflow-visible', className)} aria-hidden>
      <motion.g animate={controls}>
        {/* Barra y mangas */}
        <line x1={COLLAR_L + 6} y1={MID} x2={COLLAR_R - 6} y2={MID} strokeWidth="3" strokeLinecap="round" className="stroke-on-surface-light/50" />
        <rect x="4" y={MID - 4} width={COLLAR_L - 4} height="8" rx="4" className="fill-on-surface-light/25" />
        <rect x={COLLAR_R} y={MID - 4} width={296 - COLLAR_R} height="8" rx="4" className="fill-on-surface-light/25" />
        <rect x={COLLAR_L} y={MID - 11} width="6" height="22" rx="2" className="fill-on-surface-light/70" />
        <rect x={COLLAR_R - 6} y={MID - 11} width="6" height="22" rx="2" className="fill-on-surface-light/70" />
        {/* Huecos vacíos: se intuye la capacidad sin ruido */}
        {slots.map((s) => (
          <rect key={`e${s.k}`} x={s.x} y={s.y} width={PLATE_W} height={s.h} rx="3" className="fill-on-surface-light/10" />
        ))}
        {/* Discos cargados */}
        {slots.slice(0, n).map((s) => (
          <motion.rect
            key={`p${s.k}`} x={s.x} y={s.y} width={PLATE_W} height={s.h} rx="3"
            className={s.k < 2 ? 'fill-primary' : 'fill-primary-text'}
            initial={{ opacity: 0, x: s.left ? -46 : 46 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...heavy, delay: 0.25 + s.k * 0.11, opacity: { duration: 0.2, delay: 0.25 + s.k * 0.11 } }}
          />
        ))}
      </motion.g>
    </svg>
  );
}

/* ───────────────────────── Cronómetro rodante ───────────────────────── */

/** mm:ss donde cada dígito que cambia rueda hacia abajo con peso. role="timer" sin aria-live. */
export function RollingClock({ seconds, label, className }: { seconds: number; label: string; className?: string }) {
  const text = formatClock(seconds);
  return (
    <span role="timer" aria-live="off" aria-label={`${label}: ${text}`} className={cn('inline-flex font-mono font-bold tabular-nums leading-none', className)}>
      {text.split('').map((ch, i) => (
        ch === ':' ? <span key={`c${i}`} aria-hidden className="opacity-40">:</span> : (
          <span key={`d${text.length - i}`} aria-hidden className="relative inline-flex overflow-hidden py-[0.06em]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={ch}
                initial={{ y: '-70%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '70%', opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 1.1 }}
                className="inline-block"
              >
                {ch}
              </motion.span>
            </AnimatePresence>
          </span>
        )
      ))}
    </span>
  );
}

/* ───────────────────────── Volumen que se levanta ───────────────────────── */

export interface LiftDay {
  key: string;
  label: string;
  /** «Martes, 30 sep» */
  title: string;
  value: number;
  sessions: string[];
}

const fmtKg = (n: number) => `${Math.round(n).toLocaleString('es-ES')} kg`;

/**
 * Barras de volumen que suben como una repetición (muelle con masa: arrancan lentas,
 * se pasan y asientan). Al pasar o enfocar una barra, las demás bajan de tono y un
 * tooltip con día, kilos y sesiones aparece encima. Línea de media punteada.
 */
export function LiftBars({ days, height = 190, label }: { days: LiftDay[]; height?: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.4 });
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.value));
  const trained = days.filter((d) => d.value > 0);
  const avg = trained.length ? trained.reduce((a, d) => a + d.value, 0) / trained.length : 0;
  const best = days.findIndex((d) => d.value === max && d.value > 0);
  const plot = height - 28; // espacio para el tooltip y la etiqueta «Mayor carga»

  return (
    <div ref={ref} className="flex flex-col gap-2">
      <div role="group" aria-label={label} className="relative" style={{ height }} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}>
        {/* Media */}
        {avg > 0 && (
          <motion.div
            aria-hidden className="pointer-events-none absolute inset-x-0 z-10 translate-y-1/2"
            style={{ bottom: (avg / max) * plot }}
            initial={{ opacity: 0 }}
            animate={seen ? { opacity: active === null ? 1 : 0.35 } : {}}
            transition={{ duration: 0.4, delay: seen && active === null ? 0.9 : 0 }}
          >
            <motion.span
              className="block h-px border-t border-dashed border-on-surface-light/50" style={{ originX: 0 }}
              initial={{ scaleX: 0 }} animate={seen ? { scaleX: 1 } : {}} transition={{ ...heavy, delay: 0.9 }}
            />
            <span className="absolute -top-5 left-0 rounded-full bg-surface/90 px-1.5 font-mono text-label-md tabular-nums text-on-surface-light">media {fmtKg(avg)}</span>
          </motion.div>
        )}
        <div className="absolute inset-0 grid items-end gap-2 md:gap-4" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d, i) => {
            const on = active === i;
            const dim = active !== null && !on;
            const h = d.value > 0 ? Math.max(6, (d.value / max) * plot) : 4;
            const edge = i === 0 ? 'left-0' : i === days.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2';
            const desc = d.value > 0
              ? `${d.title}: ${fmtKg(d.value)} en ${d.sessions.length} ${d.sessions.length === 1 ? 'sesión' : 'sesiones'}`
              : `${d.title}: descanso`;
            return (
              <button
                key={d.key} type="button" aria-label={desc}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setActive(i); }}
                onPointerDown={() => setActive(i)}
                onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                className="relative flex h-full flex-col items-center justify-end rounded-md focus-visible:outline-offset-4"
              >
                <AnimatePresence>
                  {on && (
                    <motion.span
                      role="tooltip"
                      initial={{ opacity: 0, y: 8, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.12 } }}
                      transition={slam}
                      className={cn('pointer-events-none absolute z-20 w-max max-w-[200px] rounded-lg border border-border bg-surface px-3 py-2 text-left shadow-lg', edge)}
                      style={{ bottom: h + 10 }}
                    >
                      <span className="block text-label-md text-on-surface-light">{d.title}</span>
                      <span className="block font-mono text-heading-sm font-bold tabular-nums text-on-background">{d.value > 0 ? fmtKg(d.value) : 'Descanso'}</span>
                      {d.sessions.length > 0 && (
                        <span className="block truncate text-label-md text-on-surface">{d.sessions.length === 1 ? d.sessions[0] : `${d.sessions.length} sesiones`}</span>
                      )}
                      {i === best && <span className="mt-1 block text-label-md text-primary-text">Mayor carga de la semana</span>}
                    </motion.span>
                  )}
                </AnimatePresence>
                {i === best && !on && (
                  <motion.span
                    aria-hidden className="absolute whitespace-nowrap text-label-md text-primary-text" style={{ bottom: h + 6 }}
                    initial={{ opacity: 0, y: 6 }} animate={seen ? { opacity: active === null ? 1 : 0, y: 0 } : {}} transition={{ ...slam, delay: 0.8 }}
                  >
                    {fmtKg(d.value)}
                  </motion.span>
                )}
                <motion.span
                  aria-hidden
                  className={cn(
                    'block w-full rounded-t-[10px] rounded-b-[4px] transition-opacity duration-300',
                    d.value === 0 ? 'bg-surface-variant' : i === best ? 'bg-primary' : 'bg-primary/35',
                    dim && 'opacity-40',
                  )}
                  style={{ height: h, originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={seen ? { scaleY: on ? 1.03 : 1 } : { scaleY: 0 }}
                  transition={{ ...heavy, delay: seen && active === null ? 0.15 + i * 0.07 : 0 }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div aria-hidden className="grid gap-2 md:gap-4" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d, i) => (
          <span key={d.key} className={cn('text-center text-label-md transition-colors', active === i ? 'text-on-background' : 'text-on-surface-light')}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Carga relativa ───────────────────────── */

/** Barra fina que se carga (scaleX) con peso al entrar en pantalla. */
export function LoadBar({ pct, delay = 0, className }: { pct: number; delay?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.8 });
  return (
    <span ref={ref} aria-hidden className={cn('block h-1 overflow-hidden rounded-full bg-surface-variant', className)}>
      <motion.span
        className="block h-full rounded-full bg-primary"
        style={{ originX: 0 }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: seen ? Math.max(0.04, Math.min(1, pct)) : 0 }}
        transition={{ ...heavy, delay: 0.2 + delay }}
      />
    </span>
  );
}

/** Título que cae letra a letra como discos sobre el suelo. */
export function DropTitle({ text, className }: { text: string; className?: string }) {
  return (
    <h1 aria-label={text} className={cn('flex', className)}>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i} aria-hidden className="inline-block"
          initial={{ opacity: 0, y: -36 }} animate={{ opacity: 1, y: 0 }}
          transition={{ ...slam, delay: 0.12 + i * 0.045, opacity: { duration: 0.18, delay: 0.12 + i * 0.045 } }}
        >
          {ch === ' ' ? ' ' : ch}
        </motion.span>
      ))}
    </h1>
  );
}
