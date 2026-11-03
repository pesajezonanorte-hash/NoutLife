import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotionConfig } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface LeafBurstProps {
  /** Se dispara al montar; cambia `burst` para repetirlo. */
  burst?: number;
  pieces?: number;
  /** Origen de la explosión, en % del contenedor. */
  origin?: { x: number; y: number };
  /** fixed = toda la pantalla (portal); absolute = contenedor relativo. */
  position?: 'fixed' | 'absolute';
  className?: string;
}

const LEAF_PATH = 'M12 2.5C7 6.2 4.6 10.4 5.2 15.1 5.8 19.4 8.4 21.8 12 22.5c3.6-.7 6.2-3.1 6.8-7.4.6-4.7-1.8-8.9-6.8-12.6Z';
const VEIN_PATH = 'M12 6.2v14.6';
/** Verdes de la marca: tripletas RGB de los tokens de color. */
const GREENS = ['--lq-success', '--lq-jade-400', '--lq-jade-500', '--lq-success-strong', '--lq-jade-300'];

/** Valor entre 0 y 1 determinista por semilla: la misma explosión sale igual en cada render. */
const unit = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Hojas verdes que estallan desde un punto, se abren en el aire y caen con un leve
 * vaivén. Sustituye al confeti: solo transform y opacity, y nada con reduced motion.
 */
export function LeafBurst({ burst = 0, pieces = 22, origin = { x: 50, y: 38 }, position = 'fixed', className }: LeafBurstProps) {
  const reduce = useReducedMotionConfig();
  if (reduce) return null;

  const node = (
    <div key={burst} aria-hidden className={cn('pointer-events-none inset-0 z-[70] overflow-hidden', position, className)}>
      {Array.from({ length: pieces }, (_, i) => {
        // Abanico hacia arriba (entre -150° y -30°), distancia y caída variables.
        const angle = (-150 + unit(i * 3 + 1) * 120) * (Math.PI / 180);
        const distance = 90 + unit(i * 7 + 2) * 130;
        const size = 14 + unit(i * 19 + 7) * 12;
        const vars = {
          '--leaf-x': `${(Math.cos(angle) * distance).toFixed(1)}px`,
          '--leaf-y': `${(Math.sin(angle) * distance).toFixed(1)}px`,
          '--leaf-fall': `${(220 + unit(i * 5 + 3) * 140).toFixed(1)}px`,
          '--leaf-sway': `${((unit(i * 11 + 4) - 0.5) * 120).toFixed(1)}px`,
          '--leaf-r': `${(unit(i * 13 + 5) * 360).toFixed(1)}deg`,
          '--leaf-spin': `${((unit(i * 17 + 6) - 0.5) * 540).toFixed(1)}deg`,
        };
        return (
          <i
            key={i}
            className="absolute block animate-leaf-burst"
            style={{
              ...vars,
              left: `${origin.x}%`,
              top: `${origin.y}%`,
              width: size,
              height: size,
              marginLeft: -size / 2,
              marginTop: -size / 2,
              animationDelay: `${Math.round(unit(i * 23 + 8) * 180)}ms`,
              animationDuration: `${Math.round(2300 + unit(i * 29 + 9) * 900)}ms`,
              animationFillMode: 'both',
            } as CSSProperties}
          >
            <svg viewBox="0 0 24 24" className="size-full" aria-hidden>
              <path d={LEAF_PATH} style={{ fill: `rgb(var(${GREENS[i % GREENS.length]}))` }} />
              <path d={VEIN_PATH} fill="none" strokeWidth={1} strokeLinecap="round" style={{ stroke: 'rgb(var(--lq-jade-800) / .35)' }} />
            </svg>
          </i>
        );
      })}
    </div>
  );
  // fixed va en un portal: un ancestro con transform (transiciones de ruta)
  // lo dejaría por debajo de los diálogos.
  return position === 'fixed' ? createPortal(node, document.body) : node;
}
