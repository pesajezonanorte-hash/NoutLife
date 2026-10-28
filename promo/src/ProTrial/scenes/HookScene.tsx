// Escena 1 (0–3 s): el gancho sobre slate, casi a oscuras. «¿Y si tu vida real /
// tuviera un / modo Pro?» se abre desde el centro con un rebote elástico. A 1,5 s un
// corte con un fundido cruzado de 3 fotogramas pasa a un plano más corto; a los 2 s
// «modo Pro» parpadea y se queda en oro champán, con un destello. Al final la cámara
// se aleja deprisa: el texto cae al fondo con desenfoque de movimiento y el fondo
// absorbe la malla de luz dorada.
import type React from 'react';
import { AbsoluteFill, Easing, useCurrentFrame } from 'remotion';
import { EASE, clamp, ramp } from '../../Video/lib/anim';
import { AD, goldText } from '../brand';
import { GoldMesh, MESH_FOCUS } from '../components/GoldMesh';
import { Reveal } from '../components/Reveal';
import { HOOK } from '../timeline';

/** Centro de cada línea (px del lienzo). */
const LINE_Y = [744, 830];
const PAYOFF_Y = 986;
/** Parpadeo de «modo Pro» desde el fotograma HOOK.flicker: blanco → oro. */
const FLICKER = [0.85, 0.2, 1, 0.5, 1, 0.75];
/** El alejamiento acelera como una cámara que tira hacia atrás. */
const PULL = Easing.bezier(0.7, 0, 0.84, 0);
/** Escala final del texto en el fondo. */
const FAR = 0.035;

const goldAmount = (frame: number) => {
  const i = Math.floor(frame - HOOK.flicker);
  if (i < 0) return 0;
  return i < FLICKER.length ? FLICKER[i] : 1;
};

/** Destello de cuatro puntas sobre «Pro». */
const Glint: React.FC<{ frame: number; at: number; size: number }> = ({ frame, at, size }) => {
  const p = ramp(frame, at, at + 18, EASE.out);
  if (p <= 0 || p >= 1) return null;
  const s = Math.sin(Math.PI * p);
  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      style={{ position: 'absolute', left: -size / 2, top: -size / 2, overflow: 'visible', transform: `rotate(${p * 90}deg) scale(${s})` }}
    >
      <path d="M0 -50 C4 -8 8 -4 50 0 C8 4 4 8 0 50 C-4 8 -8 4 -50 0 C-8 -4 -4 -8 0 -50Z" fill="#fffdf3" style={{ filter: `drop-shadow(0 0 10px ${AD.goldLight})` }} />
    </svg>
  );
};

/** El texto completo del gancho (se dibuja una vez por plano). */
const Copy: React.FC<{ frame: number }> = ({ frame }) => {
  const gold = goldAmount(frame);
  return (
    <>
      {HOOK.lines.map((line, i) => (
        <div key={line.text} style={{ position: 'absolute', left: 0, right: 0, top: LINE_Y[i] - 42 }}>
          <Reveal frame={frame} at={line.at} style={{ fontWeight: 300, fontSize: 70, lineHeight: 1.2, color: AD.inkSoft }}>
            {line.text}
          </Reveal>
        </div>
      ))}
      <div style={{ position: 'absolute', left: 0, right: 0, top: PAYOFF_Y - 72 }}>
        <Reveal frame={frame} at={HOOK.payoff} tracking={-0.035} style={{ fontWeight: 900, fontSize: 128, lineHeight: 1.1, color: AD.ink }}>
          <span style={{ position: 'relative', display: 'inline-block' }}>
            {/* Brillo dorado detrás, y el oro encima del blanco según el parpadeo */}
            <span aria-hidden style={{ position: 'absolute', inset: 0, color: AD.gold, filter: 'blur(26px)', opacity: 0.55 * gold }}>
              modo Pro
            </span>
            <span style={{ position: 'relative' }}>modo Pro</span>
            <span aria-hidden style={{ position: 'absolute', inset: 0, ...goldText(100), opacity: gold }}>
              modo Pro
            </span>
            <span style={{ position: 'absolute', right: '0.12em', top: '0.2em', width: 0, height: 0 }}>
              <Glint frame={frame} at={HOOK.flicker + 7} size={90} />
            </span>
          </span>
          ?
        </Reveal>
      </div>
    </>
  );
};

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  // Plano abierto que empuja muy despacio, y plano corto sobre «modo Pro?» tras el corte
  // («modo Pro?» mide ~720 px: a 1,14 sigue dentro de la zona segura de las redes)
  const wide = 1 + 0.035 * ramp(frame, 0, HOOK.cut + 3, EASE.linear);
  const close = 1.14 + 0.04 * ramp(frame, HOOK.cut, HOOK.zoomOut.from + 6, EASE.linear);
  const cross = ramp(frame, HOOK.cut, HOOK.cut + 3, EASE.linear);
  // Zoom out: escala geométrica (cada fotograma se aleja lo mismo en proporción)
  const far = (f: number) => Math.pow(FAR, ramp(f, HOOK.zoomOut.from, HOOK.zoomOut.to, PULL));
  const zoom = far(frame);
  const blur = clamp(Math.abs(Math.log(zoom / far(frame - 1))) * 24, 0, 12);
  const fade = 1 - ramp(frame, HOOK.zoomOut.to - 12, HOOK.zoomOut.to);
  const origin = `${MESH_FOCUS.x}px ${MESH_FOCUS.y}px`;
  return (
    <AbsoluteFill>
      <GoldMesh frame={frame} />
      <AbsoluteFill
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: origin,
          filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
          opacity: fade,
        }}
      >
        {cross < 1 && (
          <AbsoluteFill style={{ transform: `scale(${wide})`, transformOrigin: origin, opacity: 1 - cross }}>
            <Copy frame={frame} />
          </AbsoluteFill>
        )}
        {cross > 0 && (
          <AbsoluteFill style={{ transform: `scale(${close}) translateY(-14px)`, transformOrigin: origin, opacity: cross }}>
            <Copy frame={frame} />
          </AbsoluteFill>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
