// Escena 1 (0–3 s): el gancho, solo, sobre el fondo. Cada línea aparece con un fundido
// y sube 18 px con una curva de desaceleración suave; la cámara empuja sin parar de 1 a
// 1,05. A 1,5 s «Pro» pasa de blanco a oro champán (el color cambia, la letra no se
// mueve), con un halo tenue y un brillo que la cruza una vez. Al final el texto se apaga
// mientras la cámara retrocede y el teléfono entra en foco.
// El texto son contornos vectoriales (type/OutlineText): se mueve y escala en fracciones
// de píxel, sin los saltos del texto HTML.
import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { lerp, ramp } from '../../Video/lib/anim';
import { usePalette } from '../palette';
import { EASE } from '../motion';
import { cameraAt, layerTransform } from '../camera';
import { COPY } from '../copy';
import { OutlineText, RunGlyphs, type LineLayout } from '../type/OutlineText';
import { ChampagneGradient } from '../components/ChampagneGradient';
import { HOOK } from '../timeline';

const SIZE = 72;
const TRACKING = -0.01;
/** Líneas base: el bloque queda centrado algo por encima del centro del lienzo. */
const BASELINES = [884, 970];
const RISE = 18;

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const palette = usePalette();
  const gold = ramp(frame, HOOK.pro.from, HOOK.pro.to, EASE.inOut);
  const sheen = ramp(frame, HOOK.sheen.from, HOOK.sheen.to, EASE.inOut);
  // Sale solo con un fundido mientras la cámara retrocede: un desenfoque animado sobre el
  // texto parpadea (Chrome cambia de núcleo de blur según el radio; medido en el render)
  const exit = ramp(frame, HOOK.exit.from, HOOK.exit.to, EASE.exit);

  const proRun = (layout: LineLayout) => layout.runs.find((r) => r.run.role === 'pro');

  return (
    <AbsoluteFill style={{ transform: layerTransform(cameraAt(frame)), transformOrigin: '0 0' }}>
      <AbsoluteFill style={{ opacity: 1 - exit }}>
        {COPY.hook.map((line, i) => {
          const p = ramp(frame, HOOK.lines[i], HOOK.lines[i] + HOOK.lineFrames, EASE.text);
          return (
            <OutlineText
              key={i}
              line={line}
              size={SIZE}
              tracking={TRACKING}
              x={540}
              y={BASELINES[i]}
              color={palette.ink}
              style={{ opacity: p, transform: `translateY(${lerp(RISE, 0, p)}px)` }}
              fill={(run, id) => (run.run.role === 'pro' ? `url(#${id}-gold)` : undefined)}
              defs={(layout, id) => {
                const pro = proRun(layout);
                if (!pro) return null;
                const x0 = pro.x + (sheen * 1.8 - 0.4) * pro.width;
                return (
                  <>
                    <ChampagneGradient id={`${id}-gold`} capHeight={layout.capHeight} amount={gold} />
                    <linearGradient id={`${id}-sheen`} gradientUnits="userSpaceOnUse" x1={x0 - 60} y1={0} x2={x0 + 60} y2={-24}>
                      <stop offset="0" stopColor="#ffffff" stopOpacity={0} />
                      <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.75} />
                      <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                    <filter id={`${id}-glow`} x="-40%" y="-80%" width="180%" height="260%">
                      <feGaussianBlur stdDeviation={11} />
                    </filter>
                  </>
                );
              }}
              behind={(layout, id) => {
                const pro = proRun(layout);
                return pro && gold > 0.001 ? <RunGlyphs run={pro} k={layout.k} fill={palette.gold} opacity={0.42 * gold} filter={`url(#${id}-glow)`} /> : null;
              }}
              front={(layout, id) => {
                const pro = proRun(layout);
                return pro && sheen > 0 && sheen < 1 ? <RunGlyphs run={pro} k={layout.k} fill={`url(#${id}-sheen)`} opacity={0.6 * Math.sin(Math.PI * sheen)} /> : null;
              }}
            />
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
