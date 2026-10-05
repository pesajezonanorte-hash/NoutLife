// Texto escrito con la letra de la marca (el trazo del wordmark «noutlife»),
// siempre en minúsculas como el logo. Al montarse se escribe trazo a trazo, como
// el splash; con «Reducir movimiento» aparece ya escrito. Cada palabra es un SVG
// en línea, así el texto parte línea entre palabras. Los lectores de pantalla leen
// el texto original; si trae un carácter que el alfabeto no tiene, se muestra tal cual.
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { GAP, GLYPHS, type Glyph } from './letteringGlyphs';

/** Unidades del alfabeto por em: la altura x queda como la de Montserrat. */
const EM = 120;
/** Margen para el medio trazo y los remates redondos (u). */
const PAD = 10;
/** Caja vertical: de encima de las tildes a debajo de las descendentes (u). */
const TOP = -14;
const HEIGHT = 162;

const lower = (s: string) => s.toLocaleLowerCase('es');

/** ¿Se puede escribir entero con la letra de la marca? */
export function canLetter(text: string) {
  return [...lower(text)].every((c) => /\s/.test(c) || c in GLYPHS);
}

function layoutWord(word: string) {
  let x = PAD;
  const glyphs: { g: Glyph; x: number }[] = [];
  [...word].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (i > 0) x += g.lb ?? 0;
    glyphs.push({ g, x });
    x += g.w + GAP + (g.rb ?? 0);
  });
  return { glyphs, width: x - GAP + PAD };
}

export interface LetteringProps {
  text: string;
  className?: string;
  /** Escribirse al montarse (por defecto sí). */
  draw?: boolean;
  /** Espera antes del primer trazo (s). */
  delay?: number;
}

export function Lettering({ text, className, draw = true, delay = 0 }: LetteringProps) {
  if (!canLetter(text)) return <>{text}</>;
  const words = lower(text).split(/\s+/).filter(Boolean);
  const count = words.reduce((n, w) => n + [...w].length, 0);
  // Una frase larga no tarda más de ~1 s en escribirse.
  const step = Math.min(0.065, 0.95 / Math.max(1, count));
  let k = 0;
  return (
    <span className={cn('lq-letters', className)} data-draw={draw || undefined}>
      <span className="sr-only">{text}</span>
      {words.map((word, wi) => {
        const { glyphs, width } = layoutWord(word);
        return (
          <Fragment key={wi}>
            {wi > 0 && ' '}
            <svg aria-hidden="true" focusable="false" viewBox={`0 ${TOP} ${width} ${HEIGHT}`} style={{ width: `${width / EM}em` }}>
              {glyphs.map(({ g, x }, gi) => {
                const at = delay + k++ * step;
                return (
                  <g key={gi} transform={`translate(${x} 0)${g.t ? ` ${g.t}` : ''}`}>
                    {g.d.map((d, j) => <path key={j} d={d} pathLength={1} style={{ '--d': `${(at + j * 0.08).toFixed(3)}s` } as CSSProperties} />)}
                    {g.dots?.map(([cx, cy, r], j) => (
                      <circle key={`o${j}`} cx={cx} cy={cy} r={r} style={{ '--d': `${(at + g.d.length * 0.08 + 0.14).toFixed(3)}s` } as CSSProperties} />
                    ))}
                  </g>
                );
              })}
            </svg>
          </Fragment>
        );
      })}
    </span>
  );
}

/** Título de zona: con la letra de la marca si el texto es una cadena. */
export function TitleText({ children, draw, delay }: { children: ReactNode; draw?: boolean; delay?: number }) {
  return typeof children === 'string' ? <Lettering text={children} draw={draw} delay={delay} /> : <>{children}</>;
}
