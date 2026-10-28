// La malla de luz dorada del zoom out (escena 1): una rejilla de puntos aparece detrás
// del texto y, cuando la cámara se aleja, el fondo la absorbe: se encoge hacia el centro
// más despacio que el texto (paralaje) y gira un poco. Cada punto se dibuja como un
// trazo desde donde estaba en el fotograma anterior, así deja su estela al moverse.
// Algunos puntos destellan.
import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { EASE, clamp, pulse, ramp, rng } from '../../Video/lib/anim';
import { AD } from '../brand';
import { HOOK } from '../timeline';

const SPACING = 54;
const RADIUS = 1500;
/** Punto de fuga: donde termina el texto al alejarse («modo Pro?»). */
export const MESH_FOCUS = { x: 540, y: 980 };

const POINTS = (() => {
  const r = rng(23);
  const points: Array<{ x: number; y: number; fall: number; phase: number; spark: number | null }> = [];
  for (let gy = -RADIUS; gy <= RADIUS; gy += SPACING) {
    for (let gx = -RADIUS; gx <= RADIUS; gx += SPACING) {
      const d = Math.hypot(gx, gy * 0.78) / RADIUS;
      if (d > 1) continue;
      const edge = 1 - d;
      points.push({
        x: gx + SPACING / 2,
        y: gy + SPACING / 2,
        fall: edge * edge * (3 - 2 * edge),
        phase: r() * Math.PI * 2,
        // 1 de cada 16 destella una vez, en un momento distinto
        spark: r() < 0.06 ? HOOK.mesh.from + 4 + r() * 26 : null,
      });
    }
  }
  return points;
})();

/** Escala de la malla: 1 → ~0,22 mientras la cámara se aleja. */
const meshScale = (frame: number) => 1 / (1 + 3.6 * ramp(frame, HOOK.zoomOut.from, HOOK.zoomOut.to, EASE.inOut));

export const GoldMesh: React.FC<{ frame: number }> = ({ frame }) => {
  const visible = ramp(frame, HOOK.mesh.from, HOOK.mesh.from + 12, EASE.out) * (1 - ramp(frame, HOOK.zoomOut.to - 12, HOOK.mesh.to));
  if (visible <= 0.001) return null;
  const m = meshScale(frame);
  const m0 = meshScale(frame - 1);
  const p = ramp(frame, HOOK.zoomOut.from, HOOK.zoomOut.to, EASE.inOut);
  const turn = (6 * p * Math.PI) / 180;
  const turn0 = (6 * ramp(frame - 1, HOOK.zoomOut.from, HOOK.zoomOut.to, EASE.inOut) * Math.PI) / 180;
  const place = (x: number, y: number, k: number, a: number) => ({
    x: MESH_FOCUS.x + (x * Math.cos(a) - y * Math.sin(a)) * k,
    y: MESH_FOCUS.y + (x * Math.sin(a) + y * Math.cos(a)) * k,
  });
  return (
    <AbsoluteFill style={{ opacity: visible }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="mesh-core">
            <stop offset="0" stopColor={AD.goldLight} stopOpacity={0.5} />
            <stop offset="1" stopColor={AD.gold} stopOpacity={0} />
          </radialGradient>
        </defs>
        {POINTS.map((pt, i) => {
          const a = place(pt.x, pt.y, m, turn);
          if (a.x < -20 || a.x > 1100 || a.y < -20 || a.y > 1940) return null;
          const b = place(pt.x, pt.y, m0, turn0);
          const twinkle = 0.6 + 0.4 * Math.sin(frame * 0.3 + pt.phase);
          const alpha = 0.3 * pt.fall * twinkle;
          if (alpha < 0.01) return null;
          return (
            <line
              key={i}
              x1={b.x}
              y1={b.y}
              x2={a.x}
              y2={a.y}
              stroke={AD.gold}
              strokeOpacity={alpha}
              strokeWidth={Math.max(1.4, 3.6 * m)}
              strokeLinecap="round"
            />
          );
        })}
        {POINTS.map((pt, i) => {
          if (pt.spark === null) return null;
          const s = pulse(frame, pt.spark, 3.2);
          if (s < 0.02) return null;
          const c = place(pt.x, pt.y, m, turn);
          const size = (10 + 8 * pt.fall) * Math.max(0.5, m) * s;
          return (
            <path
              key={`s${i}`}
              d={`M${c.x} ${c.y - size}Q${c.x + size * 0.12} ${c.y - size * 0.12} ${c.x + size} ${c.y}Q${c.x + size * 0.12} ${c.y + size * 0.12} ${c.x} ${c.y + size}Q${c.x - size * 0.12} ${c.y + size * 0.12} ${c.x - size} ${c.y}Q${c.x - size * 0.12} ${c.y - size * 0.12} ${c.x} ${c.y - size}Z`}
              fill={AD.goldPale}
              opacity={clamp(s * pt.fall * 1.4)}
            />
          );
        })}
        {/* El centro se calienta mientras la malla cae hacia él */}
        <circle cx={MESH_FOCUS.x} cy={MESH_FOCUS.y} r={360 * (0.5 + 0.5 * m)} fill="url(#mesh-core)" opacity={0.7 * p} />
      </svg>
    </AbsoluteFill>
  );
};
