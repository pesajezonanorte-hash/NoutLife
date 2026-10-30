// Física de los objetos que se arrastran en 3D (hobbies, pesas, trofeos). Cada cuerpo es una
// esfera con un ancla (su sitio en la repisa). Suelto, un muelle elástico poco amortiguado lo
// devuelve al ancla con un par de rebotes («gravedad elástica»); agarrado, otro muelle rígido lo
// lleva al punto del dedo con un poco de retraso, así se siente el peso. Se lanza soltándolo en
// movimiento; choca con los otros y con los bordes del lienzo y rebota. El giro sigue al
// movimiento (rueda hacia donde va) y conserva la inercia al soltarlo, frenándose despacio.
// Puro (sin three): lo prueban los tests.

export interface Body {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Ancla: el sitio al que vuelve. */
  ax: number; ay: number; az: number;
  r: number;
  held: boolean;
  /** Objetivo mientras se arrastra. */
  tx: number; ty: number; tz: number;
  /** Velocidad angular (rad/s, eje del mundo). */
  wx: number; wy: number; wz: number;
}

export interface Bounds {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
}

export const PHYSICS = {
  anchorK: 26,
  anchorDamp: 3.4,
  holdK: 340,
  holdDamp: 30,
  restitution: 0.55,
  /** Freno del giro suelto (1/s): la inercia dura un par de segundos. */
  spinDecay: 1.1,
  /** Cuánto giro por unidad de velocidad (rueda al moverse). */
  spinFromMove: 2.2,
  maxSpeed: 14,
  maxSpin: 18,
};

export function makeBody(x: number, y: number, z: number, r: number): Body {
  return { x, y, z, vx: 0, vy: 0, vz: 0, ax: x, ay: y, az: z, r, held: false, tx: x, ty: y, tz: z, wx: 0, wy: 0, wz: 0 };
}

/** ¿Se mueve todavía (o se sostiene)? Para dejar de dibujar cuando todo está quieto. */
export function moving(b: Body, eps = 0.002): boolean {
  return b.held
    || Math.abs(b.vx) + Math.abs(b.vy) + Math.abs(b.vz) > eps
    || Math.abs(b.x - b.ax) + Math.abs(b.y - b.ay) + Math.abs(b.z - b.az) > eps
    || Math.abs(b.wx) + Math.abs(b.wz) > eps * 5;
}

function clampLength(b: Body, keys: ['vx', 'vy', 'vz'] | ['wx', 'wy', 'wz'], max: number) {
  const l = Math.hypot(b[keys[0]], b[keys[1]], b[keys[2]]);
  if (l > max) for (const k of keys) b[k] *= max / l;
}

/** Avanza `dt` segundos (en pasos de ≤ 1/120 s para que los muelles rígidos no exploten). */
export function stepBodies(bodies: Body[], dt: number, bounds: Bounds, p = PHYSICS) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    for (const b of bodies) {
      const k = b.held ? p.holdK : p.anchorK;
      const c = b.held ? p.holdDamp : p.anchorDamp;
      const tx = b.held ? b.tx : b.ax;
      const ty = b.held ? b.ty : b.ay;
      const tz = b.held ? b.tz : b.az;
      b.vx += ((tx - b.x) * k - b.vx * c) * h;
      b.vy += ((ty - b.y) * k - b.vy * c) * h;
      b.vz += ((tz - b.z) * k - b.vz * c) * h;
      clampLength(b, ['vx', 'vy', 'vz'], p.maxSpeed);
      b.x += b.vx * h;
      b.y += b.vy * h;
      b.z += b.vz * h;
      if (b.held) {
        // Agarrado: gira como si rodara hacia donde se mueve (eje = arriba × velocidad).
        const blend = Math.min(1, 10 * h);
        b.wx += (b.vz * p.spinFromMove - b.wx) * blend;
        b.wz += (-b.vx * p.spinFromMove - b.wz) * blend;
        b.wy += (b.vx * 0.6 - b.wy) * blend;
      }
      clampLength(b, ['wx', 'wy', 'wz'], p.maxSpin);
    }
    // Choques entre esferas: se separan (el agarrado no cede) y rebotan por la normal.
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const overlap = a.r + b.r - d;
        if (overlap <= 0) continue;
        const nx = dx / d;
        const ny = dy / d;
        const nz = dz / d;
        const wa = a.held ? 0 : b.held ? 1 : 0.5;
        const wb = 1 - wa;
        a.x -= nx * overlap * wa; a.y -= ny * overlap * wa; a.z -= nz * overlap * wa;
        b.x += nx * overlap * wb; b.y += ny * overlap * wb; b.z += nz * overlap * wb;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
        if (rel < 0) {
          const j0 = -(1 + p.restitution) * rel;
          a.vx -= nx * j0 * wa; a.vy -= ny * j0 * wa; a.vz -= nz * j0 * wa;
          b.vx += nx * j0 * wb; b.vy += ny * j0 * wb; b.vz += nz * j0 * wb;
          // El golpe también hace girar un poco.
          a.wy -= j0 * 0.8 * wa;
          b.wy += j0 * 0.8 * wb;
        }
      }
    }
    // Bordes del lienzo: rebote.
    for (const b of bodies) {
      for (const [pos, vel, lo, hi] of [['x', 'vx', bounds.minX, bounds.maxX], ['y', 'vy', bounds.minY, bounds.maxY], ['z', 'vz', bounds.minZ, bounds.maxZ]] as const) {
        if (b[pos] - b.r < lo) { b[pos] = lo + b.r; if (b[vel] < 0) b[vel] = -b[vel] * p.restitution; }
        if (b[pos] + b.r > hi) { b[pos] = hi - b.r; if (b[vel] > 0) b[vel] = -b[vel] * p.restitution; }
      }
    }
  }
  // Suelto, el giro se frena despacio (la inercia se nota un buen rato).
  const decay = Math.exp(-p.spinDecay * dt);
  for (const b of bodies) {
    if (b.held) continue;
    b.wx *= decay;
    b.wy *= decay;
    b.wz *= decay;
  }
}

/** Anclas en filas centradas dentro de un ancho y alto (unidades de la escena). */
export function shelfAnchors(n: number, width: number, height: number, cols = n): Array<[number, number]> {
  const rows = Math.ceil(n / Math.max(1, cols));
  const out: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const col = i - row * cols;
    const x = (col - (inRow - 1) / 2) * (width / Math.max(1, cols));
    const y = ((rows - 1) / 2 - row) * (height / Math.max(1, rows));
    out.push([x, y]);
  }
  return out;
}
