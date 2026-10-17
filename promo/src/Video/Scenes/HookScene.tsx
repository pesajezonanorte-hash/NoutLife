// Escena 1 (0–6 s): el gancho. «Tu» queda arriba y «rutina», «cuerpo» y «mente» caen
// con su color, uno a uno. Después «Todo en un solo lugar.» entra palabra a palabra con
// un muelle sin rebote: escala, opacidad y desenfoque se asientan a la vez. Al final la
// frase se encoge hacia el centro del isotipo con el mismo tipo de muelle, desenfocándose
// y apagándose; la luz que queda la recoge la escena 2 (BrandScene).
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS, FONT, HOOK_TINT, SPRING, gradientText, rgba } from '../theme';
import { EASE, clamp, flash, lerp, pulse, ramp, springAt } from '../lib/anim';
import { HOOK_CENTER, LOCKUP } from '../layout';
import { HOOK, SEQUENCES } from '../timeline';

const NOUN_SIZE = 236;
const TU_SIZE = 92;
const PHRASE_SIZE = 148;
/** Centro del isotipo: ahí se encoge la frase y ahí nace la luz de la escena 2. */
const POINT = LOCKUP.mark;

/** Golpe de una palabra suelta: llega grande y se posa; al irse retrocede y se desvanece. */
function slam(frame: number, at: number, out: number | null, from = 1.45) {
  const p = springAt(frame, at, SPRING.slam);
  // Curva de ida y vuelta: la salida arranca sin tirón (una curva de llegada arrancaría de golpe)
  const q = out === null ? 0 : ramp(frame, out, out + 9, EASE.inOut);
  // La opacidad sube en dos fotogramas (el muelle rígido ya da ~40 % en el primero): sin aparición de golpe
  return {
    scale: lerp(from, 1, p) * lerp(1, 0.8, q),
    opacity: clamp(p * 1.5) * (1 - q),
    blur: (1 - clamp(p)) * 10 + q * 12,
  };
}

/** Entrada de una palabra de la frase: un muelle sin rebote mueve escala, opacidad, desenfoque y altura a la vez. */
function glide(frame: number, at: number) {
  const p = clamp(springAt(frame, at, SPRING.glide));
  return { scale: lerp(1.12, 1, p), opacity: clamp(p * 1.4), blur: (1 - p) * 14, y: (1 - p) * 30 };
}

/** Copia borrosa del color de la palabra debajo, para que el texto emita un poco de luz. */
const Glow: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span aria-hidden style={{ position: 'absolute', inset: 0, color, filter: 'blur(26px)', opacity: 0.55 }}>
    {children}
  </span>
);

/** «Tu» y las tres palabras que caen. */
const Nouns: React.FC<{ frame: number }> = ({ frame }) => {
  const tu = slam(frame, HOOK.nouns[0].at, HOOK.out, 1.3);
  const bump = Math.max(...HOOK.nouns.slice(1).map((n) => pulse(frame, n.at + 2, 3)));
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: HOOK_CENTER.y - 214,
          textAlign: 'center',
          fontFamily: FONT.sans,
          fontWeight: 600,
          fontSize: TU_SIZE,
          letterSpacing: '-0.02em',
          color: rgba(COLORS.text, 0.78),
          transform: `scale(${tu.scale * (1 + 0.05 * bump)})`,
          opacity: tu.opacity,
          filter: tu.blur > 0.3 ? `blur(${tu.blur}px)` : undefined,
        }}
      >
        Tu
      </div>
      {HOOK.nouns.map((n, i) => {
        // Cada palabra se va cuando entra la siguiente (la última, al empezar la frase)
        const s = slam(frame, n.at, i + 1 < HOOK.nouns.length ? HOOK.nouns[i + 1].at : HOOK.out);
        if (s.opacity <= 0.002) return null;
        const tint = HOOK_TINT[n.tint];
        return (
          <div
            key={n.text}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: HOOK_CENTER.y - 108,
              textAlign: 'center',
              fontFamily: FONT.sans,
              fontWeight: 800,
              fontSize: NOUN_SIZE,
              lineHeight: 1,
              letterSpacing: '-0.05em',
              whiteSpace: 'nowrap',
              transform: `scale(${s.scale})`,
              opacity: s.opacity,
              filter: s.blur > 0.3 ? `blur(${s.blur}px)` : undefined,
            }}
          >
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <Glow color={tint.glow}>{n.text}</Glow>
              <span style={{ position: 'relative', ...gradientText(tint.from, tint.to, 100) }}>{n.text}</span>
            </span>
          </div>
        );
      })}
    </>
  );
};

/** «Todo en un solo lugar.» palabra a palabra y, al final, su encogimiento hacia el isotipo. */
const Phrase: React.FC<{ frame: number }> = ({ frame }) => {
  // c: 0 → 1 con una curva de ida y vuelta de 30 fotogramas. Un muelle arrancaría con un
  // tirón (su primer fotograma ya mueve ~2 % de la escala); esta curva empieza casi quieta.
  const c = ramp(frame, HOOK.collapse.from, HOOK.collapse.to, EASE.inOut);
  const fade = 1 - EASE.inOut(clamp((c - 0.5) / 0.45));
  const shine = ramp(frame, HOOK.phrase[4].at + 2, HOOK.phrase[4].at + 26, EASE.inOut);
  const lines = [0, 1].map((line) => HOOK.phrase.filter((w) => w.line === line));
  const colorOf = (text: string): React.CSSProperties => {
    if (text === 'solo') return gradientText(HOOK_TINT.rutina.glow, HOOK_TINT.cuerpo.glow, 100);
    if (text === 'lugar.') return gradientText(HOOK_TINT.cuerpo.glow, HOOK_TINT.mente.glow, 100);
    return { color: '#f4f8f5' };
  };
  return (
    <AbsoluteFill
      style={{
        transformOrigin: `${POINT.x}px ${POINT.y}px`,
        transform: `scale(${1 - c})`,
        filter: c > 0.004 ? `blur(${c * 16}px)` : undefined,
        opacity: fade,
        fontFamily: FONT.sans,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: HOOK_CENTER.y - PHRASE_SIZE * 1.02,
          textAlign: 'center',
          fontWeight: 800,
          fontSize: PHRASE_SIZE,
          lineHeight: 1.02,
          letterSpacing: '-0.045em',
        }}
      >
        {lines.map((words, li) => (
          <div key={li} style={{ whiteSpace: 'nowrap' }}>
            {words.map((w, wi) => {
              const g = glide(frame, w.at);
              const glowColor = w.text === 'solo' ? HOOK_TINT.rutina.glow : HOOK_TINT.mente.glow;
              return (
                <span
                  key={w.text}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    marginRight: wi < words.length - 1 ? '0.24em' : 0,
                    transform: `translateY(${g.y}px) scale(${g.scale})`,
                    opacity: g.opacity,
                    filter: g.blur > 0.3 ? `blur(${g.blur}px)` : undefined,
                  }}
                >
                  {li === 1 && <Glow color={glowColor}>{w.text}</Glow>}
                  <span style={{ position: 'relative', ...colorOf(w.text) }}>{w.text}</span>
                  {/* Un brillo cruza «solo lugar.» al terminar de entrar */}
                  {li === 1 && shine > 0 && shine < 1 && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        ...gradientText('transparent', 'transparent'),
                        backgroundImage: 'linear-gradient(100deg, transparent 40%, rgba(255, 255, 255, 0.9) 50%, transparent 60%)',
                        backgroundSize: '300% 100%',
                        backgroundPosition: `${lerp(100, 0, shine) + (w.text === 'solo' ? 0 : -18)}% 0`,
                        backgroundRepeat: 'no-repeat',
                      }}
                    >
                      {w.text}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Un destello horizontal en cada golpe, del color de la palabra: entra en tres fotogramas y se apaga despacio. */
const Flares: React.FC<{ frame: number }> = ({ frame }) => {
  const hits = [
    ...HOOK.nouns.map((n) => ({ at: Math.max(0, n.at + 2), color: HOOK_TINT[n.tint].glow, y: HOOK_CENTER.y + 10, k: 1 })),
    { at: HOOK.phrase[4].at, color: '#ffffff', y: HOOK_CENTER.y + 70, k: 0.8 },
  ];
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen' }}>
      {hits.map((h, i) => {
        const e = flash(frame, h.at, 3, 9) * h.k;
        if (e < 0.01) return null;
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                left: -200,
                width: 1480,
                top: h.y - 3,
                height: 6,
                background: `linear-gradient(90deg, transparent, ${rgba(h.color, 0.8)} 50%, transparent)`,
                opacity: e,
                transform: `scaleX(${0.6 + 0.4 * (1 - e)})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 540 - 520,
                top: h.y - 160,
                width: 1040,
                height: 320,
                borderRadius: '50%',
                background: `radial-gradient(closest-side, ${rgba(h.color, 0.28)}, transparent)`,
                opacity: e,
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.hook.from;
  return (
    <AbsoluteFill>
      <Flares frame={frame} />
      {frame < HOOK.out + 10 && <Nouns frame={frame} />}
      {frame >= HOOK.phrase[0].at - 1 && <Phrase frame={frame} />}
    </AbsoluteFill>
  );
};
