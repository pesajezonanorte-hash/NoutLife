// Texto vectorial: cada letra es el contorno real de Montserrat (type/outlines.ts), no
// texto del navegador. Chrome ajusta la línea base del texto HTML al píxel entero, así
// que una frase que sube despacio o crece con la cámara avanza a saltos; los trazados
// se mueven en fracciones de píxel y escalan sin cambiar de forma. El kerning y los
// anchos son los de Chrome (los compone fontkit con la misma fuente).
import type React from 'react';
import { useId } from 'react';
import { EM, GLYPHS, METRICS, RUNS, type Weight } from './outlines';

/** Un tramo de una línea: texto, peso y un papel opcional («pro» se pinta en oro). */
export interface Run {
  t: string;
  w: Weight;
  role?: string;
}
export type Line = ReadonlyArray<Run>;

export interface PlacedRun {
  run: Run;
  index: number;
  /** Inicio y ancho del tramo (px desde el inicio de la línea). */
  x: number;
  width: number;
  glyphs: Array<{ d: string; x: number; y: number }>;
}

export interface LineLayout {
  width: number;
  /** px por unidad de la fuente. */
  k: number;
  ascent: number;
  descent: number;
  capHeight: number;
  runs: PlacedRun[];
}

/**
 * Compone una línea a `size` px. `tracking` es el interletrado en em, entre letras
 * (no después de la última, para que la línea centrada quede centrada).
 */
export function layoutLine(line: Line, size: number, tracking = 0): LineLayout {
  const k = size / EM;
  const gap = tracking * size;
  let pen = 0;
  let count = 0;
  const runs = line.map((run, index): PlacedRun => {
    const data = RUNS[`${run.w}|${run.t}`];
    if (!data) throw new Error(`Falta el contorno de «${run.t}» (${run.w}): añádelo a copy.json y ejecuta npm run type:pro-keynote`);
    const x = pen;
    const glyphs = data.g.map(([id, gx, i, gy]) => ({ d: GLYPHS[run.w][id], x: x + gx * k + i * gap, y: (gy ?? 0) * k }));
    pen += data.adv * k + data.n * gap;
    count += data.n;
    return { run, index, x, width: pen - x, glyphs };
  });
  return {
    width: pen - (count > 0 ? gap : 0),
    k,
    ascent: METRICS.ascent * k,
    descent: -METRICS.descent * k,
    capHeight: METRICS.capHeight * k,
    runs,
  };
}

/** Los glifos de un tramo como trazados (línea base en y = 0). */
export const RunGlyphs: React.FC<{ run: PlacedRun; k: number } & React.SVGProps<SVGGElement>> = ({ run, k, ...g }) => (
  <g {...g}>
    {run.glyphs.map((glyph, i) => (
      <path key={i} d={glyph.d} transform={`translate(${glyph.x} ${glyph.y}) scale(${k})`} />
    ))}
  </g>
);

export interface OutlineTextProps {
  line: Line;
  size: number;
  tracking?: number;
  /** Punto de anclaje (px del contenedor): x según `align` y la línea base en y. */
  x: number;
  y: number;
  align?: 'left' | 'center' | 'right';
  color: string;
  /** Relleno propio de un tramo (un color o `url(#…)` de un degradado de `defs`, con el mismo prefijo). */
  fill?: (run: PlacedRun, id: string) => string | undefined;
  /** Degradados y filtros; reciben un prefijo único para sus id. */
  defs?: (layout: LineLayout, id: string) => React.ReactNode;
  /** Capas extra (brillos, reflejos) detrás o delante de los tramos. */
  behind?: (layout: LineLayout, id: string) => React.ReactNode;
  front?: (layout: LineLayout, id: string) => React.ReactNode;
  style?: React.CSSProperties;
}

export const OutlineText: React.FC<OutlineTextProps> = ({ line, size, tracking = 0, x, y, align = 'center', color, fill, defs, behind, front, style }) => {
  const id = useId().replace(/:/g, '');
  const layout = layoutLine(line, size, tracking);
  const height = layout.ascent + layout.descent;
  const left = x - layout.width * (align === 'center' ? 0.5 : align === 'right' ? 1 : 0);
  return (
    <svg
      width={layout.width}
      height={height}
      viewBox={`0 ${-layout.ascent} ${layout.width} ${height}`}
      style={{ position: 'absolute', left, top: y - layout.ascent, overflow: 'visible', ...style }}
    >
      {defs && <defs>{defs(layout, id)}</defs>}
      {behind?.(layout, id)}
      {layout.runs.map((run) => (
        <RunGlyphs key={run.index} run={run} k={layout.k} fill={fill?.(run, id) ?? color} />
      ))}
      {front?.(layout, id)}
    </svg>
  );
};

/** Ancho de una línea sin dibujarla. */
export const measureLine = (line: Line, size: number, tracking = 0) => layoutLine(line, size, tracking).width;
