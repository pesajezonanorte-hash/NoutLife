// Los anillos dorados que giran alrededor del teléfono en la escena 2, como un
// giroscopio. Cada uno está en su propio plano inclinado, precesa despacio y gira
// sobre sí mismo: el giro se ve en las cuentas que lo recorren, en el destello que se
// desliza por la banda y en los trazos del anillo punteado. Se dibuja en dos capas:
// `back` (lo que queda detrás del plano del teléfono) va antes del teléfono, que lo
// tapa, y `front` va después. Se ven desde abajo y van algo altos: el arco de delante
// cruza la cabecera y la ventana, nunca las zonas que se están desbloqueando.
import type React from 'react';
import { AbsoluteFill } from 'remotion';
import { EASE, clamp, lerp, ramp, springAt } from '../../Video/lib/anim';
import { AD, AD_SPRING } from '../brand';
import { LIGHT, add, dot, goldAt, goldShade, normalize, project, rotateX, rotateY, rotateZ, scale, type Vec3 } from '../lib/space';
import { UNLOCK } from '../timeline';

interface Ring {
  /** Radio y ancho de la banda (px). Con `width` ≤ 4 es un hilo. */
  r: number;
  width: number;
  /** Inclinación del plano (rotateX): ±90 = de canto; negativa = visto desde abajo. */
  tilt: number;
  /** Altura del centro respecto del centro del teléfono (px, negativa = más arriba). */
  dy: number;
  /** Giro en pantalla (rotateZ). */
  roll: number;
  /** Orientación (rotateY) y precesión: amplitud en grados y velocidad en rad por fotograma. */
  yaw: number;
  wobble: number;
  wobbleRate: number;
  /** Giro sobre su eje (grados por fotograma). */
  spin: number;
  beads: number;
  /** Bisel de la banda (grados): el brillo cambia a lo largo del anillo. */
  bevel: number;
  /** Trazos encendidos y apagados (en segmentos) del hilo punteado. */
  dash?: number;
}

const RINGS: Ring[] = [
  { r: 520, width: 15, tilt: -76, dy: -120, roll: -8, yaw: 12, wobble: 20, wobbleRate: 0.02, spin: 0.85, beads: 2, bevel: 38 },
  { r: 604, width: 3, tilt: -66, dy: -80, roll: 13, yaw: 64, wobble: 16, wobbleRate: -0.016, spin: -0.55, beads: 1, bevel: 0 },
  { r: 446, width: 2.4, tilt: -81, dy: -170, roll: -22, yaw: 140, wobble: 24, wobbleRate: 0.025, spin: 1.25, beads: 1, bevel: 0, dash: 5 },
];
const SEGMENTS = 144;
const TAU = Math.PI * 2;
/** Ángulo llevado a [−π, π). */
const wrap = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
/** Lo que pasa por detrás del teléfono se ve más tenue. */
const BACK_DIM = 0.55;

/** Entrada (crece y se enciende) y salida (se abre, gira más rápido y se apaga). */
export function ringsPresence(frame: number) {
  const appear = springAt(frame, UNLOCK.rings.in, AD_SPRING.settle);
  const exit = ramp(frame, UNLOCK.rings.out - 4, UNLOCK.rings.out + 16, EASE.in);
  return { appear, exit, opacity: clamp(appear * 1.6) * (1 - exit) };
}

export const OrbitRings: React.FC<{ frame: number; cx: number; cy: number; layer: 'back' | 'front' }> = ({ frame, cx, cy, layer }) => {
  const { appear, exit, opacity } = ringsPresence(frame);
  if (opacity <= 0.001) return null;
  const size = lerp(0.62, 1, appear) * (1 + 0.4 * exit);
  const age = Math.max(0, frame - UNLOCK.rings.in);
  const front = layer === 'front';

  const parts: React.ReactNode[] = [];
  RINGS.forEach((ring, ri) => {
    // El giro acelera un poco al salir
    const spin = ring.spin * (age + 26 * exit * exit);
    const yaw = ring.yaw + ring.wobble * Math.sin(frame * ring.wobbleRate + ri);
    const orient = (v: Vec3) => scale(rotateZ(rotateY(rotateX(rotateZ(v, spin), ring.tilt), yaw), ring.roll), size);
    const place = (v: Vec3) => add(orient(v), [0, ring.dy * size, 0]);
    let normal = orient([0, 0, 1]);
    // La banda tiene dos caras: se ve la que mira a la cámara
    if (normal[2] < 0) normal = scale(normal, -1);
    normal = normalize(normal);

    // Tramos seguidos de la parte delantera, para el halo (índice → punto)
    const runs: Array<Array<[number, string]>> = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = (i / SEGMENTS) * Math.PI * 2;
      const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const radial = normalize(orient([Math.cos(am), Math.sin(am), 0]));
      const mid = place([ring.r * Math.cos(am), ring.r * Math.sin(am), 0]);
      if (mid[2] >= 0 !== front) continue;
      if (ring.dash && Math.floor(i / ring.dash) % 2 === 1) continue;
      // Destello fijo en el anillo: viaja con el giro, así se ve que gira
      const glint = Math.exp(-(wrap(am - 0.9) ** 2) / 0.05);
      if (ring.width > 4) {
        const n = normalize(add(scale(normal, Math.cos((ring.bevel * Math.PI) / 180)), scale(radial, Math.sin((ring.bevel * Math.PI) / 180))));
        const { color } = goldAt(n, 0.4 * glint);
        const hw = ring.width / 2;
        const pts = [
          place([(ring.r - hw) * Math.cos(a0), (ring.r - hw) * Math.sin(a0), 0]),
          place([(ring.r + hw) * Math.cos(a0), (ring.r + hw) * Math.sin(a0), 0]),
          place([(ring.r + hw) * Math.cos(a1), (ring.r + hw) * Math.sin(a1), 0]),
          place([(ring.r - hw) * Math.cos(a1), (ring.r - hw) * Math.sin(a1), 0]),
        ].map((p) => project(p, cx, cy));
        parts.push(
          <polygon
            key={`${ri}-${i}`}
            points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill={color}
            stroke={color}
            strokeWidth={0.7}
          />,
        );
      } else {
        const p0 = project(place([ring.r * Math.cos(a0), ring.r * Math.sin(a0), 0]), cx, cy);
        const p1 = project(place([ring.r * Math.cos(a1), ring.r * Math.sin(a1), 0]), cx, cy);
        const light = 0.42 + 0.3 * Math.max(0, dot(radial, LIGHT)) + 0.45 * glint;
        parts.push(
          <line
            key={`${ri}-${i}`}
            x1={p0.x}
            y1={p0.y}
            x2={p1.x}
            y2={p1.y}
            stroke={goldShade(light)}
            strokeWidth={ring.width * p0.k}
            strokeLinecap="round"
          />,
        );
      }
      if (front) {
        const p = project(mid, cx, cy);
        const last = runs[runs.length - 1];
        const point: [number, string] = [i, `${p.x.toFixed(1)},${p.y.toFixed(1)}`];
        if (last && last[last.length - 1][0] >= i - (ring.dash ? ring.dash + 1 : 1)) last.push(point);
        else runs.push([point]);
      }
    }
    // El tramo que cruza el índice 0 sigue en el primero
    if (runs.length > 1 && runs[0][0][0] === 0 && runs[runs.length - 1].at(-1)?.[0] === SEGMENTS - 1) {
      runs[0] = [...(runs.pop() ?? []), ...runs[0]];
    }
    // Halo suave bajo la parte delantera (un trazo ancho y tenue, sin filtros)
    runs.forEach((run, k) => {
      if (run.length < 2) return;
      parts.unshift(
        <polyline
          key={`glow-${ri}-${k}`}
          points={run.map(([, xy]) => xy).join(' ')}
          fill="none"
          stroke={AD.gold}
          strokeOpacity={0.1}
          strokeWidth={ring.width * 3 + 14}
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
      );
    });
    // Cuentas que recorren el anillo
    for (let b = 0; b < ring.beads; b++) {
      const a = (b / ring.beads) * Math.PI * 2 + 0.6 * ri;
      const w = place([ring.r * Math.cos(a), ring.r * Math.sin(a), 0]);
      if (w[2] >= 0 !== front) continue;
      const p = project(w, cx, cy);
      const rad = (ring.width > 4 ? 11 : 7) * p.k;
      parts.push(
        <g key={`bead-${ri}-${b}`}>
          <circle cx={p.x} cy={p.y} r={rad * 2.6} fill={`url(#bead-glow-${layer})`} />
          <circle cx={p.x} cy={p.y} r={rad} fill={`url(#bead-${layer})`} />
        </g>,
      );
    }
  });

  return (
    <AbsoluteFill style={{ opacity: opacity * (front ? 1 : BACK_DIM) }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <radialGradient id={`bead-${layer}`} cx="35%" cy="32%" r="70%">
            <stop offset="0" stopColor="#fffdf3" />
            <stop offset="0.35" stopColor={AD.goldLight} />
            <stop offset="0.8" stopColor={AD.gold} />
            <stop offset="1" stopColor={AD.goldDeep} />
          </radialGradient>
          <radialGradient id={`bead-glow-${layer}`}>
            <stop offset="0" stopColor={AD.goldLight} stopOpacity={0.45} />
            <stop offset="1" stopColor={AD.gold} stopOpacity={0} />
          </radialGradient>
        </defs>
        {parts}
      </svg>
    </AbsoluteFill>
  );
};
