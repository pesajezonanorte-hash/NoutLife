// Piezas de movimiento del gimnasio: todo tiene masa. La barra carga un disco
// por día entrenado y «cae» al recibirlo, el cronómetro gira dígito a dígito,
// las barras de volumen se levantan como una repetición y los bloques acusan el
// golpe cuando algo cae dentro. Solo transform/opacity (más `r`/scale en SVG).
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useAnimationControls, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';
import { heavy, slam } from '@/lib/motion';
import { WeightBars, formatClock } from '@/components/ui/lq';

export { Thud } from '@/components/ui/lq';

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

/** Volumen semanal en kilos sobre las barras con peso compartidas (WeightBars). */
export function LiftBars({ days, height = 190, label }: { days: LiftDay[]; height?: number; label: string }) {
  return (
    <WeightBars
      data={days.map((d) => ({ key: d.key, label: d.label, title: d.title, value: d.value, details: d.sessions }))}
      label={label} height={height} format={fmtKg}
      bestLabel="Mayor carga de la semana" emptyLabel="Descanso" noun={['sesión', 'sesiones']}
    />
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
