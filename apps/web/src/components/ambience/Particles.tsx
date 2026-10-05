// Partículas de ambiente (polvo, pétalos, brasas, vapor, luciérnagas…) en CSS
// puro: cada una es un <span> con su posición de reposo (--x/--y) y una
// animación que solo añade transform/opacity. Las posiciones salen de una
// semilla, así que son estables entre renders. Van dentro de <ZoneAmbience>,
// que las pausa fuera de pantalla.
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ParticleKind = 'rise' | 'fall' | 'drift' | 'glow';

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Range = readonly [number, number];

export interface ParticlesProps {
  count: number;
  kind: ParticleKind;
  seed?: number;
  /** Zona donde reposan (porcentaje del contenedor). */
  x?: Range;
  y?: Range;
  /** Duración de un ciclo (s). */
  duration?: Range;
  /** Opacidad máxima. */
  alpha?: Range;
  /** Tamaño (px). */
  size?: Range;
  /** Recorrido: horizontal (sx), vertical (sy) y altura de subida/caída (h), en px. */
  sx?: Range;
  sy?: Range;
  h?: Range;
  /** Dibuja cada partícula; recibe el tamaño y el índice. */
  render: (size: number, i: number) => ReactNode;
  className?: string;
}

export function Particles({
  count, kind, seed = 7, x = [0, 100], y = [0, 100], duration = [10, 18], alpha = [0.25, 0.6], size = [2, 5],
  sx = [-14, 14], sy = [-18, 18], h = [60, 140], render, className,
}: ParticlesProps) {
  // Los rangos llegan como arrays nuevos en cada render: se memoriza por su valor.
  const key = JSON.stringify([count, kind, seed, x, y, duration, alpha, size, sx, sy, h]);
  const items = useMemo(() => {
    const r = seeded(seed);
    const pick = ([a, b]: Range) => a + (b - a) * r();
    return Array.from({ length: count }, (_, i) => {
      const d = pick(duration);
      return {
        i,
        s: Math.round(pick(size) * 10) / 10,
        style: {
          '--x': `${pick(x).toFixed(2)}%`,
          '--y': `${pick(y).toFixed(2)}%`,
          '--d': `${d.toFixed(2)}s`,
          // Retraso negativo: cada partícula arranca en un punto distinto de su ciclo.
          '--delay': `${(-r() * d).toFixed(2)}s`,
          '--a': pick(alpha).toFixed(2),
          '--sx': `${pick(sx).toFixed(1)}px`,
          '--sy': `${pick(sy).toFixed(1)}px`,
          '--h': `${pick(h).toFixed(1)}px`,
        } as CSSProperties,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <>
      {items.map((p) => (
        <span key={p.i} className={cn('lq-p', `lq-p-${kind}`, className)} style={p.style}>
          {render(p.s, p.i)}
        </span>
      ))}
    </>
  );
}
