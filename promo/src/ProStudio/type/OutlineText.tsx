// Texto vectorial: cada letra es el contorno real de Montserrat (type/outlines.ts), no
// texto del navegador. Chrome ajusta la línea base del texto HTML al píxel entero, así
// que una frase que sube despacio o crece con la cámara avanza a saltos; los trazados
// se mueven en fracciones de píxel y escalan sin cambiar de forma. El kerning y los
// anchos son los de Chrome (los compone fontkit con la misma fuente). Es el mismo motor
// que src/ProKeynote/type, con los textos de este anuncio.
import type React from 'react';
import { useId } from 'react';
import { ramp } from '../../Video/lib/anim';
import { EASE } from '../motion';
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

/** Compone una línea a `size` px; `tracking` es el interletrado en em, entre letras. */
export function layoutLine(line: Line, size: number, tracking = 0): LineLayout {
  const k = size / EM;
  const gap = tracking * size;
  let pen = 0;
  let count = 0;
  const runs = line.map((run, index): PlacedRun => {
    const data = RUNS[`${run.w}|${run.t}`];
    if (!data) throw new Error(`Falta el contorno de «${run.t}» (${run.w}): añádelo a copy.json y ejecuta node scripts/build-keynote-type.mjs src/ProStudio`);
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

export interface RevealLetter {
  d: string;
  x: number;
  y: number;
  run: PlacedRun;
  /** Lo que aún le falta subir (px) y su opacidad en el fotograma. */
  dy: number;
  opacity: number;
}

/**
 * Revelado de keynote: las letras de la línea suben una tras otra (`stagger` fotogramas
 * entre letra y letra, sin contar espacios) desde `rise` px por debajo de su sitio, en
 * `duration` fotogramas. Con una máscara cuyo borde inferior es la línea base de
 * descendentes, cada letra aparece al cruzarlo. Cada letra es opaca en 4 fotogramas: la
 * máscara hace la suavidad y, cuando la letra asoma, ya se ve sólida (con un fundido largo
 * las letras parecían a medio aparecer).
 */
export function revealLetters(layout: LineLayout, start: number, frame: number, opts: { stagger: number; rise: number; duration?: number }): RevealLetter[] {
  const { stagger, rise, duration = 16 } = opts;
  const out: RevealLetter[] = [];
  let order = 0;
  for (const run of layout.runs) {
    for (const glyph of run.glyphs) {
      const at = start + order * stagger;
      order += 1;
      if (frame < at) continue;
      out.push({ ...glyph, run, dy: (1 - ramp(frame, at, at + duration, EASE.text)) * rise, opacity: ramp(frame, at, at + 4, EASE.inOut) });
    }
  }
  return out;
}

/** Los glifos de un tramo como trazados (línea base en y = 0). */
export const RunGlyphs: React.FC<{ run: PlacedRun; k: number; dx?: number } & React.SVGProps<SVGGElement>> = ({ run, k, dx = 0, ...g }) => (
  <g {...g}>
    {run.glyphs.map((glyph, i) => (
      <path key={i} d={glyph.d} transform={`translate(${glyph.x - dx} ${glyph.y}) scale(${k})`} />
    ))}
  </g>
);

/**
 * Un tramo como recorte. Un degradado en `userSpaceOnUse` puesto directamente en los
 * glifos se resuelve en el espacio de cada glifo (con su translate y su escala), así que
 * para que un degradado o un brillo cruce la palabra entera se rellena un rectángulo en
 * coordenadas de la línea y se recorta con los glifos.
 */
export const RunClip: React.FC<{ id: string; run: PlacedRun; k: number }> = ({ id, run, k }) => (
  // Dentro de clipPath no vale <g>: van los trazados sueltos
  <clipPath id={id}>
    {run.glyphs.map((glyph, i) => (
      <path key={i} d={glyph.d} transform={`translate(${glyph.x} ${glyph.y}) scale(${k})`} />
    ))}
  </clipPath>
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
  /** Capas extra (brillos) delante de los tramos. */
  front?: (layout: LineLayout, id: string) => React.ReactNode;
  style?: React.CSSProperties;
}

export const OutlineText: React.FC<OutlineTextProps> = ({ line, size, tracking = 0, x, y, align = 'center', color, fill, defs, front, style }) => {
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
      {layout.runs.map((run) => (
        <RunGlyphs key={run.index} run={run} k={layout.k} fill={fill?.(run, id) ?? color} />
      ))}
      {front?.(layout, id)}
    </svg>
  );
};
