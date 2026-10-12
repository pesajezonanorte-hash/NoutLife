// Cargador «remolino de hojas»: las hojas del logo giran alrededor de un centro
// como un pequeño remolino de tiempo. Cada hoja orbita a su ritmo (las de dentro
// más rápido, como en un remolino de agua), se acerca y se aleja del centro y se
// mece sobre su eje; un arco tenue barre el contorno como la aguja de un reloj.
// El tamaño se adapta al hueco que ocupa: grande en una página, pequeño en una
// tarjeta o tabla. Todo lo visual es decorativo (aria-hidden); el estado se anuncia
// con role="status". CSS puro (lq-vortex en tokens.css): solo transform/opacity.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePageVisibility } from '@/components/ui/LoadingGate';
import { useMotionReduced } from '@/lib/motion';

/** Hoja asimétrica, misma familia que las del logo. Centrada en (0,0), 20 de alto. */
const LEAF = 'M0 -10C6.6 -6.4 6.2 4.6 0 10C-3.4 4.4 -4.2 -4.6 0 -10Z';
const LEAF_TONES = ['fill-jade-300', 'fill-jade-500', 'fill-primary', 'fill-jade-400', 'fill-jade-600', 'fill-primary-text'];

/**
 * Cada hoja: radios entre los que respira (fracción del diámetro), vueltas por
 * segundo implícitas en `t` y desfase. Las interiores van más rápido.
 */
const LEAVES = [
  { r1: 0.16, r2: 0.3, t: 1.9, t2: 1.3, s: 0.2, delay: 0 },
  { r1: 0.38, r2: 0.24, t: 2.6, t2: 1.7, s: 0.22, delay: -0.9 },
  { r1: 0.2, r2: 0.36, t: 2.2, t2: 1.5, s: 0.17, delay: -1.6 },
  { r1: 0.44, r2: 0.3, t: 3.2, t2: 2.1, s: 0.21, delay: -0.4 },
  { r1: 0.26, r2: 0.42, t: 2.9, t2: 1.9, s: 0.16, delay: -2.3 },
  { r1: 0.46, r2: 0.36, t: 3.8, t2: 2.4, s: 0.19, delay: -1.2 },
] as const;

export interface ModernLoaderProps {
  /** Frases que se van alternando bajo el remolino. */
  words?: readonly string[];
  /** Texto para lectores de pantalla (por defecto, la primera frase). */
  label?: string;
  /** lg: página completa · sm: sección, tarjeta o tabla. El diámetro final se ajusta al espacio disponible. */
  size?: 'lg' | 'sm';
  className?: string;
}

const LIMITS = { lg: { min: 72, max: 168, minH: 'min-h-[min(56vh,420px)]' }, sm: { min: 36, max: 104, minH: 'min-h-[140px]' } } as const;

/** Alterna las frases con un fundido suave. */
function useRotatingWord(words: readonly string[], active: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active || words.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % words.length), 2600);
    return () => window.clearInterval(id);
  }, [active, words.length]);
  return words[i % words.length] ?? '';
}

export function ModernLoader({
  words = ['Preparando todo…', 'Cargando módulos…', 'Casi listo…'],
  label,
  size = 'lg',
  className,
}: ModernLoaderProps) {
  const visible = usePageVisibility();
  const ref = useRef<HTMLDivElement>(null);
  const lim = LIMITS[size];
  const [d, setD] = useState<number>(size === 'lg' ? 132 : 64);
  const word = useRotatingWord(words, visible);

  // Diámetro según el hueco: ~40 % del ancho y ~50 % del alto, dentro de los límites del tamaño.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const next = Math.round(Math.max(lim.min, Math.min(lim.max, width * 0.42, height * 0.5)));
      setD((prev) => (Math.abs(prev - next) > 2 ? next : prev));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lim.min, lim.max]);

  const compact = d < 64;
  const leaves = compact ? LEAVES.slice(0, 4) : LEAVES;
  const reduce = useMotionReduced();

  return (
    <div
      ref={ref} role="status" aria-live="polite" aria-busy="true"
      className={cn('flex w-full flex-col items-center justify-center gap-4', lim.minH, className)}
    >
      <span className="sr-only">{label ?? words[0]}</span>
      <motion.div
        aria-hidden
        className="lq-vortex"
        data-paused={!visible || undefined}
        style={{ '--d': `${d}px` } as CSSProperties}
        initial={{ opacity: 0, scale: 0.6, rotate: -40 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 170, damping: 19, mass: 1.2 }}
      >
        {/* Aguja: un arco tenue que barre el contorno */}
        <svg className="lq-vortex-sweep" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="47" pathLength="100" strokeDasharray="22 78" strokeWidth={compact ? 3 : 1.6} strokeLinecap="round" className="fill-none stroke-primary/30" />
        </svg>
        <span className="lq-vortex-eye bg-primary/40" />
        {leaves.map((l, i) => (
          <span
            key={i} className="lq-vortex-orbit"
            style={{
              '--t': `${l.t}s`, '--t2': `${l.t2}s`, '--delay': `${l.delay}s`,
              '--r1': `${l.r1 * d}px`, '--r2': `${l.r2 * d}px`, '--s': `${Math.max(8, l.s * d)}px`,
            } as CSSProperties}
          >
            <span className="lq-vortex-drift">
              <svg className="lq-vortex-leaf" viewBox="-10 -10 20 20"><path d={LEAF} className={LEAF_TONES[i % LEAF_TONES.length]} /></svg>
            </span>
          </span>
        ))}
      </motion.div>
      {!compact && (
        <div aria-hidden className="relative h-5 w-full max-w-xs overflow-hidden text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={word}
              className="absolute inset-x-0 truncate text-body-sm text-on-surface-light"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: 'blur(4px)' }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: 'blur(4px)' }}
              transition={{ duration: reduce ? 0.15 : 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {word}
            </motion.span>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
