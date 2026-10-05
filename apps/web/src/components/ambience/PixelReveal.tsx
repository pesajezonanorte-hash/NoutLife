// Aparición pixel a pixel, la misma del creador de personaje: los píxeles nacen
// del centro hacia fuera, cada uno cae un poco y crece con un rebote. Se hace con
// una máscara SVG (una celda por píxel con su propio retraso), así lo que se
// revela es el contenido real, con su sombra, sobre cualquier fondo. Al terminar
// la máscara se quita: el contenido queda intacto (también su 3D).
// Con «Reducir movimiento», un fundido corto.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useMotionStore } from '@/store/motionStore';
import { seeded } from './Particles';

/** Duración del rebote de cada píxel (ms); la misma que .lq-px-in. */
const POP = 500;

function maskFor(cols: number, rows: number, seed: number, delay: number, spread: number) {
  const rand = seeded(seed);
  const cx = (cols - 1) / 2, cy = (rows - 1) / 2;
  const far = Math.hypot(cx, cy);
  let rects = '';
  let last = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Del centro hacia fuera, con un poco de azar para que no sea un anillo perfecto.
      const d = Math.round(delay + (Math.hypot(x - cx, (y - cy) * 1.25) / far) * spread + rand() * 90);
      last = Math.max(last, d);
      // Un pelo más grandes que la celda: sin costuras entre píxeles vecinos.
      rects += `<rect x="${x - 0.02}" y="${y - 0.02}" width="1.04" height="1.04" style="animation-delay:${d}ms"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" preserveAspectRatio="none" shape-rendering="crispEdges">`
    + `<style>rect{fill:#fff;transform-box:fill-box;transform-origin:center;animation:p ${POP}ms cubic-bezier(.34,1.56,.64,1) both}@keyframes p{from{opacity:0;transform:translateY(-.35px) scale(.2)}to{opacity:1;transform:none}}</style>`
    + rects + '</svg>';
  return { url: `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`, total: last + POP };
}

export interface PixelRevealProps {
  children: ReactNode;
  /** Píxeles a lo ancho; el alto sale de `rows`. */
  cols?: number;
  rows?: number;
  /** Espera antes del primer píxel (ms). */
  delay?: number;
  /** Tiempo que tarda la onda en llegar del centro a las esquinas (ms). */
  spread?: number;
  seed?: number;
  /** Margen extra alrededor (rem) para que la sombra también aparezca pixel a pixel. */
  bleed?: number;
  className?: string;
  onDone?: () => void;
}

export function PixelReveal({ children, cols = 30, rows = 19, delay = 120, spread = 620, seed = 7, bleed = 1.5, className, onDone }: PixelRevealProps) {
  const reduce = useMotionStore((s) => s.reduce);
  const mask = useMemo(() => maskFor(cols, rows, seed, delay, spread), [cols, rows, seed, delay, spread]);
  const [done, setDone] = useState(reduce);

  useEffect(() => {
    if (reduce) { onDone?.(); return; }
    const t = window.setTimeout(() => { setDone(true); onDone?.(); }, mask.total + 60);
    return () => window.clearTimeout(t);
    // onDone es una notificación; no reinicia la aparición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, mask.total]);

  if (reduce) {
    return (
      <motion.div className={className} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.25 } }}>
        {children}
      </motion.div>
    );
  }

  const style: CSSProperties | undefined = done ? undefined : {
    margin: `-${bleed}rem`,
    padding: `${bleed}rem`,
    WebkitMaskImage: mask.url,
    maskImage: mask.url,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  };
  return <div className={cn(className)} style={style}>{children}</div>;
}
