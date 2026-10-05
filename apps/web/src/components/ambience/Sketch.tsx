// Trazos dibujados a mano (pathLength animado): checks, subrayados, círculos,
// tachados y marcas de conteo. Todos son decorativos (aria-hidden); el estado
// real lo comunica el texto o el control al que acompañan. Con «Reducir
// movimiento» aparecen ya dibujados, con un fundido.
//
// Excepción documentada: el trazo anima stroke-dasharray (pathLength de Framer).
import { motion, type Transition } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionStore } from '@/store/motionStore';

export interface InkPathProps {
  d: string;
  /** false = sin dibujar (el trazo se recoge si estaba dibujado). */
  drawn?: boolean;
  delay?: number;
  /** Duración del trazo (s). */
  duration?: number;
  className?: string;
  strokeWidth?: number;
}

const draw = (drawn: boolean, delay: number, duration: number, reduce: boolean): Transition => (reduce
  ? { duration: 0.2, delay: 0 }
  : drawn
    ? { pathLength: { duration, delay, ease: [0.45, 0.05, 0.25, 1] }, opacity: { duration: 0.05, delay } }
    : { pathLength: { duration: Math.min(0.2, duration), ease: [0.4, 0, 1, 1] }, opacity: { duration: 0.1, delay: 0.12 } });

/** Un trazo de tinta que se dibuja de principio a fin. */
export function InkPath({ d, drawn = true, delay = 0, duration = 0.45, className, strokeWidth = 2 }: InkPathProps) {
  const reduce = useMotionStore((s) => s.reduce);
  return (
    <motion.path
      d={d}
      className={cn('lq-ink', className)}
      strokeWidth={strokeWidth}
      initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 0 : 0 }}
      animate={{ pathLength: drawn ? 1 : 0, opacity: drawn ? 1 : 0 }}
      transition={draw(drawn, delay, duration, reduce)}
    />
  );
}

interface SketchProps { drawn?: boolean; delay?: number; duration?: number; className?: string; strokeWidth?: number }

/** Subrayado a mano bajo un título (ancho del contenedor). */
export function SketchUnderline({ drawn = true, delay = 0.35, duration = 0.6, className, strokeWidth = 2.5 }: SketchProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none" className={cn('pointer-events-none block h-3 w-full overflow-visible', className)}>
      <InkPath d="M3 8.6C38 4.2 76 9.8 114 6.4 146 3.6 172 5.2 197 7.4" drawn={drawn} delay={delay} duration={duration} strokeWidth={strokeWidth} className="lq-ink-stretch" />
      <InkPath d="M28 10.2C70 7.6 118 9.4 168 8.2" drawn={drawn} delay={delay + duration * 0.6} duration={duration * 0.6} strokeWidth={strokeWidth * 0.55} className="lq-ink-stretch opacity-60" />
    </svg>
  );
}

/** Círculo hecho a mano que no cierra del todo (marca «hoy», resalta algo). */
export function SketchCircle({ drawn = true, delay = 0, duration = 0.55, className, strokeWidth = 2 }: SketchProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 90" preserveAspectRatio="none" className={cn('pointer-events-none overflow-visible', className)}>
      <InkPath d="M58 7C83 7 97 25 93 47 89 70 62 86 35 80 11 74 1 51 8 31 13 15 31 5 61 10" drawn={drawn} delay={delay} duration={duration} strokeWidth={strokeWidth} />
    </svg>
  );
}

/** Check de tinta (trazo único, con el temblor de una mano). */
export function SketchCheck({ drawn = true, delay = 0, duration = 0.22, className, strokeWidth = 2.6 }: SketchProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 26 24" className={cn('pointer-events-none overflow-visible', className)}>
      <InkPath d="M4.2 13.2C6.4 14.9 8.4 17.1 10.3 19.6 13.4 14.2 17.2 9.2 22.4 4.6" drawn={drawn} delay={delay} duration={duration} strokeWidth={strokeWidth} />
    </svg>
  );
}

/** Tachado a mano sobre un texto (ancho del contenedor). */
export function SketchStrike({ drawn = true, delay = 0, duration = 0.32, className, strokeWidth = 2 }: SketchProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 10" preserveAspectRatio="none" className={cn('pointer-events-none absolute inset-x-0 top-1/2 h-2.5 w-full -translate-y-1/2 overflow-visible', className)}>
      <InkPath d="M2 6.2C52 3.4 104 7.6 150 4.6 172 3.4 186 4.4 198 5.2" drawn={drawn} delay={delay} duration={duration} strokeWidth={strokeWidth} className="lq-ink-stretch" />
    </svg>
  );
}

/**
 * Marcas de conteo (||||⧸): grupos de cinco con la quinta tachando a las cuatro.
 * Hasta 4 grupos completos se dibujan todos; a partir de ahí se dibuja uno con
 * «×N» y luego las marcas del grupo en curso. Cuando `count` sube, solo se dibuja la marca nueva (y el
 * tachado si cierra grupo), en menos de 400 ms.
 */
export function TallyMarks({ count, className }: { count: number; className?: string }) {
  const n = Math.max(0, Math.floor(count));
  const full = Math.floor(n / 5);
  const rest = n % 5;
  const compact = full > 4;
  const groups = [...Array.from({ length: compact ? 1 : full }, () => 5), ...(rest ? [rest] : [])];
  // La última marca (o el tachado) es la que acaba de llegar: se dibuja; el resto ya estaba.
  return (
    <span aria-hidden="true" className={cn('inline-flex items-center gap-1.5 text-warning-text', className)}>
      {groups.map((g, gi) => {
        const isLast = gi === groups.length - 1;
        return (
          <span key={`${n}-${gi}`} className="inline-flex items-center">
          <svg viewBox="0 0 26 20" className="h-4 w-[21px] overflow-visible">
            {Array.from({ length: Math.min(g, 4) }, (_, i) => (
              <InkPath
                key={i}
                d={`M${4 + i * 5.2} ${3 + (i % 2) * 0.8}C${4.4 + i * 5.2} 8 ${3.6 + i * 5.2} 12 ${4.2 + i * 5.2} 17.2`}
                drawn
                delay={isLast && g < 5 && i === g - 1 ? 0.14 : 0}
                duration={isLast && g < 5 && i === g - 1 ? 0.16 : 0}
                strokeWidth={1.8}
              />
            ))}
            {g === 5 && <InkPath d="M1.5 15.5C8 11.2 15.6 7.2 24.5 4" drawn delay={isLast ? 0.26 : 0} duration={isLast ? 0.12 : 0} strokeWidth={1.8} />}
          </svg>
          {compact && gi === 0 && <span className="ml-0.5 font-mono text-label-md tabular-nums">×{full}</span>}
          </span>
        );
      })}
    </span>
  );
}
