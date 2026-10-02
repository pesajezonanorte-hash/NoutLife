import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { solidBg, type Tone } from './tones';

const palette: Tone[] = ['primary', 'success', 'warning', 'secondary', 'info'];

export interface ConfettiProps {
  /** Se dispara al montar; cambia `burst` para repetirlo. */
  burst?: number;
  pieces?: number;
  /** fixed = toda la pantalla; absolute = contenedor relativo. */
  position?: 'fixed' | 'absolute';
  className?: string;
}

/** Confeti decorativo (aria-hidden). No se renderiza con reduced motion. */
export function Confetti({ burst = 0, pieces = 24, position = 'fixed', className }: ConfettiProps) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const node = (
    <div key={burst} aria-hidden className={cn('pointer-events-none inset-0 z-[70] overflow-hidden', position, className)}>
      {Array.from({ length: pieces }, (_, i) => (
        <i
          key={i}
          className={cn('absolute -top-3 h-3 w-2 animate-confetti rounded-[2px]', solidBg[palette[i % palette.length]])}
          style={{ left: `${3 + (i * 94) / pieces}%`, animationDelay: `${(i % 6) * 60}ms` }}
        />
      ))}
    </div>
  );
  // fixed va en un portal: un ancestro con transform (transiciones de ruta)
  // lo dejaría por debajo de los diálogos.
  return position === 'fixed' ? createPortal(node, document.body) : node;
}
