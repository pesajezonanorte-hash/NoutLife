// Escena 1 (0–4 s): el gancho. Una lista de tareas gris y aburrida al fondo, la
// frase entra palabra a palabra en corcheas, un trazo jade tacha «aburrida» y la
// cámara se mete en el punto final, que ya es la luz de la escena 2.
import type React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AbsoluteFill, Easing, continueRender, delayRender, interpolateColors, useCurrentFrame } from 'remotion';
import { COLORS, FONT, SPRING, rgba } from '../theme';
import { EASE, clamp, lerp, ramp, springAt } from '../lib/anim';
import { fontsReady } from '../fonts';
import { ORB } from '../layout';
import { SEQUENCES } from '../timeline';

const FONT_SIZE = 124;
const TEXT_LEFT = 92;
const TEXT_TOP = 650;
/** Diámetro del punto final, en em (el punto de Montserrat ExtraBold). */
const DOT_EM = 0.15;

/** Palabras y su fotograma: en corcheas (7,5 f), las fuertes sobre el pulso. */
const LINES: Array<Array<[string, number]>> = [
  [['Tu', 8], ['vida', 15], ['no', 23], ['es', 30]],
  [['una', 38], ['lista', 45]],
  [['de', 53], ['tareas', 60]],
];
const DULL_AT = 75;
const STRIKE = { from: 84, to: 95 };
const HOOK_ZOOM = { from: 96, to: 120 };
/** Escala final del zoom: el punto llega con el diámetro de la luz de la escena 2. */
const S_END = ORB.d / (DOT_EM * FONT_SIZE);

const zoomProgress = (frame: number) => ramp(frame, HOOK_ZOOM.from, HOOK_ZOOM.to, Easing.bezier(0.45, 0, 0.85, 0.4));

/** Las partículas se estiran con el zoom: la cámara parece entrar de verdad. */
export const hookWarp = (frame: number) => {
  const z = zoomProgress(frame);
  return z > 0 && frame < HOOK_ZOOM.to + 4 ? { s: Math.pow(S_END, z * 0.32), x: ORB.x, y: ORB.y } : undefined;
};

/** Posición de `el` dentro de `root` sin contar transformaciones (offsetLeft/Top). */
function offsetWithin(el: HTMLElement, root: HTMLElement) {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

const Word: React.FC<{ frame: number; at: number; children: React.ReactNode; style?: React.CSSProperties; last?: boolean }> = ({
  frame,
  at,
  children,
  style,
  last,
}) => {
  const p = springAt(frame, at, SPRING.smooth, 14);
  return (
    <span
      style={{
        display: 'inline-block',
        marginRight: last ? 0 : '0.24em',
        opacity: p,
        transform: `translateY(${(1 - p) * 52}px) scale(${0.94 + 0.06 * p})`,
        filter: p < 0.99 ? `blur(${(1 - p) * 12}px)` : undefined,
        ...style,
      }}
    >
      {children}
    </span>
  );
};

/** La lista de tareas de siempre: casillas vacías y renglones grises. */
const GhostList: React.FC<{ frame: number }> = ({ frame }) => {
  const widths = [430, 300, 520, 360, 470, 280, 500, 340, 410, 300, 460];
  return (
    <div
      style={{
        position: 'absolute',
        left: 150,
        top: 120 - frame * 0.9,
        transform: 'perspective(1400px) rotateX(16deg) rotateZ(-5deg)',
        transformOrigin: '50% 40%',
      }}
    >
      {widths.map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 34, height: 150 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, boxShadow: `inset 0 0 0 3px ${rgba('#9aa8a1', 0.2)}` }} />
          <div style={{ width: w, height: 18, borderRadius: 9, background: rgba('#9aa8a1', 0.1) }} />
        </div>
      ))}
    </div>
  );
};

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame() + SEQUENCES.hook.from;
  const blockRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const [dot, setDot] = useState<{ x: number; y: number } | null>(null);
  const [handle] = useState(() => delayRender('Midiendo el punto final del gancho'));

  // El zoom apunta al punto final, así que hay que saber dónde quedó con la fuente real.
  useLayoutEffect(() => {
    let alive = true;
    fontsReady.then(() => {
      if (!alive) return;
      const el = dotRef.current;
      const root = blockRef.current;
      if (!el || !root) {
        setDot({ x: 720, y: 1040 });
        return;
      }
      const { x, y } = offsetWithin(el, root);
      setDot({ x: TEXT_LEFT + x + el.offsetWidth / 2, y: TEXT_TOP + y + el.offsetHeight / 2 });
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (dot) continueRender(handle);
  }, [dot, handle]);

  const p = dot ?? { x: 720, y: 1040 };
  const z = zoomProgress(frame);
  const move = ramp(frame, HOOK_ZOOM.from, HOOK_ZOOM.to, EASE.inOut);
  const s = Math.pow(S_END, z);
  const camera = `translate(${lerp(p.x, ORB.x, move) - s * p.x}px, ${lerp(p.y, ORB.y, move) - s * p.y}px) scale(${s})`;
  const listScale = Math.pow(S_END, z * 0.45);
  const listCamera = `translate(${lerp(p.x, ORB.x, move) - listScale * p.x}px, ${lerp(p.y, ORB.y, move) - listScale * p.y}px) scale(${listScale})`;

  // El texto pasa junto a la cámara antes de desvanecerse
  const textFade = 1 - ramp(frame, 103, 116, EASE.in);
  const listOpacity = (0.75 - 0.43 * ramp(frame, 20, 60)) * (1 - ramp(frame, 98, 114));
  const strike = ramp(frame, STRIKE.from, STRIKE.to, EASE.out);
  const lit = ramp(frame, 90, 102, EASE.out);
  const dull = springAt(frame, DULL_AT, SPRING.smooth, 14);
  const dotColor = interpolateColors(lit, [0, 1], [COLORS.textMuted, COLORS.jade300]);
  // Destello anamórfico sutil al empezar
  const flare = ramp(frame, 0, 18, EASE.out) * (1 - ramp(frame, 34, 80));
  const flareX = lerp(160, 520, ramp(frame, 0, 90, EASE.linear));

  return (
    <AbsoluteFill style={{ opacity: frame < HOOK_ZOOM.to ? 1 : 0 }}>
      <AbsoluteFill style={{ transformOrigin: '0 0', transform: listCamera, opacity: listOpacity }}>
        <GhostList frame={frame} />
      </AbsoluteFill>

      {/* Destello: un trazo horizontal de luz y su núcleo */}
      <AbsoluteFill style={{ opacity: flare * 0.9 }}>
        <div
          style={{
            position: 'absolute',
            left: flareX - 700,
            top: 352,
            width: 1400,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${rgba('#dbe9e1', 0.5)} 50%, transparent)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: flareX - 180,
            top: 353 - 180,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${rgba('#e6f2e8', 0.32)} 0%, ${rgba('#c4e2ca', 0.08)} 30%, transparent 65%)`,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ transformOrigin: '0 0', transform: camera }}>
        <div
          ref={blockRef}
          style={{
            position: 'absolute',
            left: TEXT_LEFT,
            top: TEXT_TOP,
            fontFamily: FONT.sans,
            fontWeight: 800,
            fontSize: FONT_SIZE,
            lineHeight: 1.02,
            letterSpacing: '-0.035em',
            color: COLORS.text,
          }}
        >
          {LINES.map((line, li) => (
            <div key={li} style={{ whiteSpace: 'nowrap', opacity: textFade }}>
              {line.map(([text, at], wi) => (
                <Word key={wi} frame={frame} at={at} last={wi === line.length - 1}>
                  {text}
                </Word>
              ))}
            </div>
          ))}
          <div style={{ whiteSpace: 'nowrap' }}>
            <span
              style={{
                position: 'relative',
                display: 'inline-block',
                color: COLORS.textMuted,
                opacity: dull * (1 - 0.45 * strike) * textFade,
                transform: `translateY(${(1 - dull) * 52}px) scale(${0.94 + 0.06 * dull})`,
                filter: dull < 0.99 ? `blur(${(1 - dull) * 12}px)` : undefined,
              }}
            >
              aburrida
              {/* El tachado: un trazo jade con brillo */}
              <span
                style={{
                  position: 'absolute',
                  left: '-0.04em',
                  right: '-0.06em',
                  top: '0.56em',
                  height: '0.085em',
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${COLORS.jade300}, ${COLORS.jade})`,
                  boxShadow: `0 0 22px ${rgba(COLORS.jade, 0.75)}, 0 0 5px ${COLORS.jade300}`,
                  transform: `scaleX(${strike})`,
                  transformOrigin: 'left center',
                  opacity: strike > 0 ? 1 : 0,
                }}
              />
            </span>
            {/* El punto final: un círculo sobre la línea base, para poder volverlo luz */}
            <span
              ref={dotRef}
              style={{
                position: 'relative',
                display: 'inline-block',
                width: `${DOT_EM}em`,
                height: `${DOT_EM}em`,
                marginLeft: '0.05em',
                borderRadius: '50%',
                background: dotColor,
                opacity: clamp(dull * 1.2),
              }}
            >
              {/* Halo con degradado y no con box-shadow: la cámara escala el punto hasta 8× */}
              <span
                style={{
                  position: 'absolute',
                  inset: '-170%',
                  borderRadius: '50%',
                  background: `radial-gradient(circle closest-side, ${rgba(COLORS.jade, 0.6)} 0%, ${rgba(COLORS.jade, 0.25)} 40%, ${rgba(COLORS.jade, 0.08)} 70%, transparent 100%)`,
                  opacity: lit,
                }}
              />
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
