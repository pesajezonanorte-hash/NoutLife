// Escena 1 (0–3 s): «¿Y si tu vida real / tuviera un / modo Pro?» en negro sobre el papel
// crema, en Montserrat Light. Revelado de keynote: cada letra sube desde una máscara, una
// tras otra, mientras el interletrado de su línea se cierra (de 0,1 em a −0,005 em) y la
// línea se mantiene centrada; el bloque se recentra al sumar cada línea. La primera línea
// empieza antes del fotograma 0, así que el primer fotograma ya tiene texto, y cada letra
// es opaca en cuanto asoma. «Pro» va en SemiBold y oro champán hondo, con un destello que
// lo cruza y un halo tenue. Debajo, la cámara empuja sin parar de 1 a 1,05.
// Al final el texto se abre (el interletrado crece) y se apaga mientras detrás emerge el
// teléfono: las letras negras están en modo «difference» con el color papel − #111111, así
// que sobre el crema se ven #111111 y donde pasan por encima del teléfono se vuelven claras.
//
// Todo va en SVG: posiciones y escala en fracciones de píxel, sin los saltos del texto
// HTML. Sin desenfoques animados (Chrome cambia de núcleo según el radio y parpadea).
import type React from 'react';
import { useId } from 'react';
import { lerp, ramp, track } from '../../Video/lib/anim';
import { AD } from '../palette';
import { EASE, KEY_SPRING } from '../motion';
import { HOOK } from '../timeline';
import { COPY } from '../copy';
import { layoutLine, revealLetters, type RevealLetter } from '../type/OutlineText';

const SIZE = 100;
const LEAD = 120;
const CX = 540;
/** Centro óptico del bloque (algo por encima del centro del lienzo). */
const CY = 900;
const TRACK = { from: 0.1, to: -0.005, exit: 0.05 };
/** Color de las letras en modo «difference»: papel − #111111 (sobre el crema da #111111). */
const DIFF_INK = '#e9e5df';

const CAP = layoutLine(COPY.hook[0], SIZE).capHeight;

/** Interletrado de una línea en el fotograma: se cierra al entrar y se abre al salir. */
function trackingAt(i: number, frame: number) {
  const start = HOOK.lines[i];
  const settle = lerp(TRACK.from, TRACK.to, ramp(frame, start, start + 34, EASE.text));
  return settle + TRACK.exit * ramp(frame, HOOK.exit[0], HOOK.exit[1], EASE.exit);
}

/** Línea base de la primera línea: el bloque se recentra al sumar cada línea. */
function blockTop(frame: number) {
  const center = (n: number) => CY + CAP / 2 - ((n - 1) * LEAD) / 2;
  return track(frame, center(1), [
    [HOOK.lines[1], center(2), KEY_SPRING.word],
    [HOOK.lines[2], center(3), KEY_SPRING.word],
  ]);
}

const isPro = (t: RevealLetter) => t.run.run.role === 'pro';

export const Hook: React.FC<{ frame: number }> = ({ frame }) => {
  const id = useId().replace(/:/g, '');
  const push = 1 + 0.05 * ramp(frame, HOOK.push[0], HOOK.push[1], EASE.push) + 0.06 * ramp(frame, HOOK.exit[0], HOOK.exit[1], EASE.exit);
  const fade = 1 - ramp(frame, HOOK.exit[0] + 2, HOOK.exit[1], EASE.inOut);
  if (fade <= 0.001) return null;
  const top = blockTop(frame);
  const glint = ramp(frame, HOOK.glint, HOOK.glint + 18, EASE.inOut);
  const halo = ramp(frame, HOOK.glint, HOOK.glint + 6, EASE.inOut) * lerp(1, 0.3, ramp(frame, HOOK.glint + 6, HOOK.glint + 26, EASE.inOut));

  const lines = COPY.hook.map((line, i) => {
    if (frame < HOOK.lines[i]) return null;
    const layout = layoutLine(line, SIZE, trackingAt(i, frame));
    const pro = layout.runs.find((r) => r.run.role === 'pro');
    // Cada letra sube 1 em desde debajo de la línea base, en 16 fotogramas
    const letters = revealLetters(layout, HOOK.lines[i], frame, { stagger: HOOK.stagger, rise: SIZE });
    return { i, layout, pro, left: CX - layout.width / 2, y: top + i * LEAD, letters };
  });
  const camera = `translate(${CX} ${CY}) scale(${push}) translate(${-CX} ${-CY})`;
  /** La máscara de cada línea: las letras suben desde debajo de la línea base y aparecen al cruzar su borde inferior. */
  const mask = (l: NonNullable<(typeof lines)[number]>, layer: string) => (
    <clipPath key={l.i} id={`${id}-${layer}${l.i}`}>
      <rect x={-200} y={-l.layout.ascent * 2} width={l.layout.width + 400} height={l.layout.ascent * 2 + l.layout.descent} />
    </clipPath>
  );
  const glyph = (letter: RevealLetter, k: number, key: number) => (
    <path key={key} d={letter.d} transform={`translate(${letter.x} ${letter.y + letter.dy}) scale(${k})`} opacity={letter.opacity} />
  );

  return (
    <>
      {/* Las palabras negras, en modo «difference» */}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: fade, mixBlendMode: 'difference' }}>
        <defs>{lines.map((l) => l && mask(l, 'n'))}</defs>
        <g transform={camera}>
          {lines.map(
            (l) =>
              l && (
                <g key={l.i} transform={`translate(${l.left} ${l.y})`} clipPath={`url(#${id}-n${l.i})`} fill={DIFF_INK}>
                  {l.letters.filter((t) => !isPro(t)).map((t, n) => glyph(t, l.layout.k, n))}
                </g>
              ),
          )}
        </g>
      </svg>
      {/* «Pro» en oro champán, con su halo y el destello */}
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: fade }}>
        <defs>
          {lines.map((l) => l && mask(l, 'o'))}
          <filter id={`${id}-halo`} x="-50%" y="-100%" width="200%" height="300%">
            <feGaussianBlur stdDeviation={16} />
          </filter>
        </defs>
        <g transform={camera}>
          {lines.map((l) => {
            if (!l?.pro) return null;
            const pro = l.pro;
            const gold = AD.goldOnPaper;
            const letters = l.letters.filter(isPro);
            return (
              <g key={l.i} transform={`translate(${l.left} ${l.y})`}>
                {/* El halo va fuera de la máscara (cuando llega, las letras ya subieron) */}
                {halo > 0.001 && (
                  <g filter={`url(#${id}-halo)`} fill={AD.gold} opacity={0.5 * halo}>
                    {letters.map((t, n) => glyph(t, l.layout.k, n))}
                  </g>
                )}
                <g clipPath={`url(#${id}-o${l.i})`}>
                <defs>
                  <linearGradient id={`${id}-oro`} gradientUnits="userSpaceOnUse" x1={pro.x} y1={-CAP} x2={pro.x + pro.width} y2={0}>
                    <stop offset="0" stopColor={gold[0]} />
                    <stop offset="0.55" stopColor={gold[1]} />
                    <stop offset="1" stopColor={gold[2]} />
                  </linearGradient>
                  <linearGradient id={`${id}-brillo`} gradientUnits="userSpaceOnUse" x1={lerp(pro.x - 150, pro.x + pro.width, glint)} y1={0} x2={lerp(pro.x, pro.x + pro.width + 150, glint)} y2={-CAP}>
                    <stop offset="0" stopColor="#fff8e6" stopOpacity={0} />
                    <stop offset="0.5" stopColor="#fff8e6" stopOpacity={0.9} />
                    <stop offset="1" stopColor="#fff8e6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {letters.map((t, n) => (
                  // Cada letra: un rectángulo con el degradado recortado por su contorno (un degradado
                  // puesto en el glifo se resolvería en el espacio del glifo y no cruzaría la palabra)
                  <g key={n} transform={`translate(0 ${t.dy})`} opacity={t.opacity}>
                    <clipPath id={`${id}-g${n}`}>
                      <path d={t.d} transform={`translate(${t.x} ${t.y}) scale(${l.layout.k})`} />
                    </clipPath>
                    <rect x={pro.x - 6} y={-l.layout.ascent} width={pro.width + 12} height={l.layout.ascent + l.layout.descent} fill={`url(#${id}-oro)`} clipPath={`url(#${id}-g${n})`} />
                    {glint > 0 && glint < 1 && (
                      <rect x={pro.x - 6} y={-l.layout.ascent} width={pro.width + 12} height={l.layout.ascent + l.layout.descent} fill={`url(#${id}-brillo)`} clipPath={`url(#${id}-g${n})`} opacity={Math.sin(Math.PI * glint)} />
                    )}
                  </g>
                ))}
                </g>
              </g>
            );
          })}
        </g>
      </svg>
    </>
  );
};
