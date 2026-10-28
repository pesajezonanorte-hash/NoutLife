// Una gema de oro (octaedro alargado) que flota y gira despacio: cada cara se proyecta
// y se sombrea con la luz de la escena (lib/space.ts), las de atrás no se dibujan y el
// resto se pinta de lejos a cerca. Un halo cálido la separa del fondo.
import type React from 'react';
import { useId } from 'react';
import { AD } from '../brand';
import { cross, dot, goldAt, normalize, project, rotateX, rotateY, rotateZ, type Vec3 } from '../lib/space';

const TOP: Vec3 = [0, -1.4, 0];
const BOTTOM: Vec3 = [0, 1.4, 0];
const RING: Vec3[] = [
  [1, 0, 0],
  [0, 0, 1],
  [-1, 0, 0],
  [0, 0, -1],
];
const FACES: Array<[Vec3, Vec3, Vec3]> = RING.flatMap((a, i) => {
  const b = RING[(i + 1) % RING.length];
  return [
    [TOP, a, b],
    [BOTTOM, b, a],
  ] as Array<[Vec3, Vec3, Vec3]>;
});

export const GoldGem: React.FC<{
  /** Centro en el lienzo (px) y profundidad (z > 0 = hacia la cámara). */
  x: number;
  y: number;
  z?: number;
  /** Radio del ecuador (px). */
  size: number;
  rx: number;
  ry: number;
  rz: number;
  opacity?: number;
}> = ({ x, y, z = 0, size, rx, ry, rz, opacity = 1 }) => {
  const halo = `gem-halo-${useId().replace(/:/g, '')}`;
  if (opacity <= 0.001) return null;
  const turn = (v: Vec3): Vec3 => {
    const r = rotateZ(rotateY(rotateX(v, rx), ry), rz);
    return [r[0] * size, r[1] * size, r[2] * size + z];
  };
  const box = size * 2.2;
  const faces = FACES.map((tri) => {
    const pts = tri.map(turn) as [Vec3, Vec3, Vec3];
    let n = normalize(cross([pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]], [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]]));
    // Normal hacia fuera: del centro de la gema hacia la cara
    const centroid: Vec3 = [(pts[0][0] + pts[1][0] + pts[2][0]) / 3, (pts[0][1] + pts[1][1] + pts[2][1]) / 3, (pts[0][2] + pts[1][2] + pts[2][2]) / 3 - z];
    if (dot(n, centroid) < 0) n = [-n[0], -n[1], -n[2]];
    return { pts, n, depth: centroid[2] };
  })
    .filter((f) => f.n[2] > 0.02)
    .sort((a, b) => a.depth - b.depth);
  const center = project([0, 0, z], 0, 0);
  return (
    <svg
      width={box * 2}
      height={box * 2}
      viewBox={`${-box} ${-box} ${box * 2} ${box * 2}`}
      style={{ position: 'absolute', left: x - box, top: y - box, overflow: 'visible', opacity }}
    >
      <defs>
        <radialGradient id={halo}>
          <stop offset="0" stopColor={AD.gold} stopOpacity={0.32} />
          <stop offset="1" stopColor={AD.gold} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={0} cy={0} r={size * 2.1 * center.k} fill={`url(#${halo})`} />
      {faces.map((f, i) => {
        const { color, spec } = goldAt(f.n);
        const pts = f.pts.map((p) => project(p, 0, 0));
        return (
          <polygon
            key={i}
            points={pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}
            fill={color}
            stroke={spec > 0.3 ? '#fffbea' : AD.goldPale}
            strokeOpacity={0.35 + 0.4 * spec}
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
};
