// Escena 1 (0–6 s): el gancho, al estilo de una keynote. «Tu» queda fijo y cada
// palabra cae de golpe en un pulso, enorme y con su color (la rutina en menta, el
// cuerpo en rojo, la mente en violeta), empujando hacia el fondo a la anterior.
// Luego «Todo en un solo lugar.» en corcheas, donde se juntan los tres colores, y la
// frase entera se encoge hasta un solo punto de luz: de ahí nace el isotipo.
import type React from 'react';
import { CameraMotionBlur } from '@remotion/motion-blur';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { COLORS, FONT, HOOK_TINT, SPRING, gradientText, rgba } from '../theme';
import { EASE, clamp, decay, lerp, pulse, ramp, springAt } from '../lib/anim';
import { HOOK_CENTER, LOCKUP } from '../layout';
import { HOOK, SEQUENCES } from '../timeline';

const NOUN_SIZE = 236;
const TU_SIZE = 92;
const PHRASE_SIZE = 148;
/** El centro del isotipo: allí se encoge la frase y allí nacen las hojas. */
const POINT = LOCKUP.mark;
const COLLAPSE_EASE = Easing.bezier(0.7, 0, 0.84, 0);

/** Fotogramas con desenfoque de movimiento real: cada golpe de palabra y la caída al punto. */
const BLUR_WINDOWS: Array<[number, number]> = [
  [0, 6],
  [HOOK.nouns[1].at - 1, HOOK.nouns[1].at + 7],
  [HOOK.nouns[2].at - 1, HOOK.nouns[2].at + 7],
  [HOOK.out - 1, HOOK.phrase[3].at + 6],
  [HOOK.phrase[4].at - 1, HOOK.phrase[4].at + 8],
  [HOOK.collapse.from + 6, HOOK.collapse.to + 1],
];

/** Cuándo se va cada palabra: cuando cae la siguiente (la última, antes de «Todo»). */
const nounOut = (i: number) => (i + 1 < HOOK.nouns.length ? HOOK.nouns[i + 1].at : HOOK.out);

/** Golpe: llega desde grande (cerca de la cámara) y se posa; al irse, retrocede y se apaga. */
function slam(frame: number, at: number, out: number | null, from = 1.75) {
  const p = springAt(frame, at, SPRING.slam);
  const q = out === null ? 0 : ramp(frame, out, out + 7, EASE.out);
  return {
    scale: lerp(from, 1, p) * lerp(1, 0.76, q),
    opacity: clamp(p * 2.5) * (1 - q),
    blur: (1 - clamp(p)) * 10 + q * 12,
  };
}

const Glow: React.FC<{ color: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ color, children, style }) => (
  <span aria-hidden style={{ position: 'absolute', inset: 0, color, filter: 'blur(26px)', opacity: 0.55, ...style }}>
    {children}
  </span>
);

/** «Tu» y las tres palabras. */
const Nouns: React.FC<{ frame: number }> = ({ frame }) => {
  const tu = slam(frame, HOOK.nouns[0].at, HOOK.out, 1.4);
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
        const s = slam(frame, n.at, nounOut(i));
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

/** «Todo en un solo lugar.»: blanco arriba; «solo lugar.» con los tres colores juntos. */
const Phrase: React.FC<{ frame: number }> = ({ frame }) => {
  const shine = ramp(frame, HOOK.phrase[4].at + 2, HOOK.phrase[4].at + 26, EASE.inOut);
  const lines = [0, 1].map((line) => HOOK.phrase.filter((w) => w.line === line));
  const colorOf = (text: string): React.CSSProperties => {
    if (text === 'solo') return gradientText(HOOK_TINT.rutina.glow, HOOK_TINT.cuerpo.glow, 100);
    if (text === 'lugar.') return gradientText(HOOK_TINT.cuerpo.glow, HOOK_TINT.mente.glow, 100);
    return { color: '#f4f8f5' };
  };
  return (
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
            const last = w.text === 'lugar.';
            const s = slam(frame, w.at, null, last ? 2.1 : 1.5);
            const style = colorOf(w.text);
            return (
              <span
                key={w.text}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  marginRight: wi < words.length - 1 ? '0.24em' : 0,
                  transform: `scale(${s.scale})`,
                  opacity: s.opacity,
                  filter: s.blur > 0.3 ? `blur(${s.blur}px)` : undefined,
                }}
              >
                {li === 1 && <Glow color={w.text === 'solo' ? HOOK_TINT.rutina.glow : HOOK_TINT.mente.glow}>{w.text}</Glow>}
                <span style={{ position: 'relative', ...style }}>{w.text}</span>
                {/* Un brillo cruza «solo lugar.» cuando cae la última palabra */}
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
  );
};

/** El texto en movimiento. Lee el fotograma él mismo para que el desenfoque lo congele por submuestras. */
const Type: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.hook.from;
  // La frase respira hacia la cámara mientras se lee y luego cae al punto
  const breathe = 1 + 0.04 * ramp(frame, HOOK.phrase[4].at, HOOK.collapse.from, EASE.linear);
  const c = ramp(frame, HOOK.collapse.from, HOOK.collapse.to, COLLAPSE_EASE);
  const scale = breathe * (1 - c);
  return (
    <AbsoluteFill style={{ fontFamily: FONT.sans }}>
      {frame < HOOK.out + 10 && <Nouns frame={frame} />}
      {frame >= HOOK.phrase[0].at - 1 && c < 0.995 && (
        <AbsoluteFill
          style={{
            transformOrigin: `${POINT.x}px ${POINT.y}px`,
            transform: `scale(${scale})`,
            filter: c > 0.01 ? `blur(${c * 7}px) brightness(${1 + 1.6 * c})` : undefined,
            opacity: 1 - ramp(frame, HOOK.collapse.to - 4, HOOK.collapse.to),
          }}
        >
          <Phrase frame={frame} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** Un destello horizontal en cada golpe, del color de la palabra. */
const Flares: React.FC<{ frame: number }> = ({ frame }) => {
  const hits = [
    ...HOOK.nouns.map((n) => ({ at: Math.max(0, n.at + 2), color: HOOK_TINT[n.tint].glow, y: HOOK_CENTER.y + 10, k: 1 })),
    { at: HOOK.phrase[4].at, color: '#ffffff', y: HOOK_CENTER.y + 70, k: 1.3 },
  ];
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen' }}>
      {hits.map((h, i) => {
        const e = decay(frame, h.at, 9) * h.k;
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
                background: `linear-gradient(90deg, transparent, ${rgba(h.color, 0.85)} 50%, transparent)`,
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
                background: `radial-gradient(closest-side, ${rgba(h.color, 0.32)}, transparent)`,
                opacity: e,
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Tres luces (los tres colores del gancho) giran hacia el punto mientras la frase se encoge. */
const Converge: React.FC<{ frame: number }> = ({ frame }) => {
  const t = ramp(frame, HOOK.phrase[4].at + 10, HOOK.collapse.to, Easing.bezier(0.5, 0, 0.9, 0.6));
  if (t <= 0 || frame > HOOK.collapse.to + 2) return null;
  const colors = [HOOK_TINT.rutina.glow, HOOK_TINT.cuerpo.glow, HOOK_TINT.mente.glow];
  const core = ramp(frame, HOOK.collapse.from + 8, HOOK.collapse.to, EASE.in);
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen' }}>
      {colors.map((color, i) =>
        [0, 1, 2, 3, 4].map((trail) => {
          const tt = clamp(t - trail * 0.018);
          const radius = lerp(470, 0, tt);
          const angle = (i / 3) * Math.PI * 2 + tt * Math.PI * 2.6 - Math.PI / 2;
          const x = POINT.x + Math.cos(angle) * radius;
          const y = POINT.y + Math.sin(angle) * radius * 0.86;
          const size = lerp(150, 60, tt) * (1 - trail * 0.16);
          return (
            <div
              key={`${i}-${trail}`}
              style={{
                position: 'absolute',
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                borderRadius: '50%',
                background: `radial-gradient(closest-side, ${rgba('#ffffff', 0.9)} 0%, ${rgba(color, 0.75)} 30%, ${rgba(color, 0)} 100%)`,
                opacity: clamp(t * 4) * (1 - trail * 0.2),
              }}
            />
          );
        }),
      )}
      {/* El punto: un núcleo blanco que se carga de luz */}
      <div
        style={{
          position: 'absolute',
          left: POINT.x - 120,
          top: POINT.y - 120,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, #ffffff 0%, ${rgba('#ffffff', 0.85)} 18%, ${rgba('#e9fff4', 0.35)} 45%, transparent 100%)`,
          transform: `scale(${lerp(0.05, 1, core)})`,
          opacity: core,
        }}
      />
    </AbsoluteFill>
  );
};

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.hook.from;
  const blur = BLUR_WINDOWS.some(([a, b]) => frame >= a && frame <= b);
  return (
    <AbsoluteFill>
      <Flares frame={frame} />
      {blur ? (
        <CameraMotionBlur samples={8} shutterAngle={180}>
          <Type />
        </CameraMotionBlur>
      ) : (
        <Type />
      )}
      <Converge frame={frame} />
    </AbsoluteFill>
  );
};
